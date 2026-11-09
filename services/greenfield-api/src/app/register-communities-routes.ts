import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {
  CommunityService,
  type CommunityCreateInput,
  type CommunityEventCreateInput,
  type CommunityEventPatchInput,
  type CommunityPatchInput,
  type CommunityPollCreateInput,
  type CommunityPollPatchInput,
} from '../domains/communities/service.js'
import {requireAuth, requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {decodeCursor, parseLimit, toCursorPage} from '../transport/pagination.js'

type RateConfig = Record<string, unknown>

const communityParams = {
  type: 'object', additionalProperties: false, required: ['communityId'],
  properties: {communityId: {type: 'string', format: 'uuid'}},
}
const eventParams = {
  type: 'object', additionalProperties: false, required: ['communityId', 'eventId'],
  properties: {communityId: {type: 'string', format: 'uuid'}, eventId: {type: 'string', format: 'uuid'}},
}
const pollParams = {
  type: 'object', additionalProperties: false, required: ['communityId', 'pollId'],
  properties: {communityId: {type: 'string', format: 'uuid'}, pollId: {type: 'string', format: 'uuid'}},
}
const pageQuery = {
  type: 'object', additionalProperties: false,
  properties: {limit: {type: 'integer', minimum: 1, maximum: 50}, cursor: {type: 'string', minLength: 1, maxLength: 512}},
}
const eventBodyProperties = {
  title: {type: 'string', minLength: 1, maxLength: 160},
  description: {type: 'string', maxLength: 10000},
  startsAt: {type: 'string', format: 'date-time'},
  endsAt: {type: 'string', format: 'date-time'},
  timezone: {type: 'string', minLength: 1, maxLength: 100},
  location: {
    type: 'object', additionalProperties: false, required: ['type'],
    properties: {
      type: {type: 'string', enum: ['online', 'inPerson', 'tba']},
      name: {type: ['string', 'null'], maxLength: 300},
      onlineUrl: {type: ['string', 'null'], maxLength: 2000},
    },
  },
  coverAttachmentId: {type: ['string', 'null'], format: 'uuid'},
  capacity: {type: ['integer', 'null'], minimum: 1, maximum: 1000000},
}

function sendError(reply: FastifyReply, code: any, message: string, requestId: string) {
  return reply.code(statusForError(code)).send(failureEnvelope(code, message, requestId))
}

function mapError(reply: FastifyReply, error: unknown, requestId: string, fallback: string) {
  const code = (error as {code?: string})?.code
  if (['VALIDATION_FAILED', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT', 'UNAUTHENTICATED', 'CAPABILITY_DISABLED'].includes(code ?? '')) {
    return sendError(reply, code, (error as Error).message || fallback, requestId)
  }
  return sendError(reply, 'SERVER_ERROR', fallback, requestId)
}

function rejectUnknownBody(allowed: readonly string[]) {
  const permitted = new Set(allowed)
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) return
    const unknown = Object.keys(request.body as Record<string, unknown>).filter(key => !permitted.has(key))
    if (unknown.length > 0) {
      return sendError(reply, 'VALIDATION_FAILED', `Unknown request field: ${unknown[0]}`, request.id)
    }
  }
}

export async function registerCommunitiesRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  options: {profileConfig: RateConfig; writeConfig: RateConfig; mutationsAllowed: boolean},
): Promise<void> {
  const communities = new CommunityService(db, config)
  const {profileConfig, writeConfig, mutationsAllowed} = options
  const mutationGate = (reply: FastifyReply, requestId: string) => {
    if (mutationsAllowed) return true
    sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', requestId)
    return false
  }
  const contextFor = (request: {id: string; auth?: {accountId: string}}) => ({
    requestId: request.id,
    correlationId: request.id,
    accountId: request.auth?.accountId ?? null,
  })

  app.get('/v1/communities', {
    ...profileConfig,
    schema: {
      querystring: {
        type: 'object', additionalProperties: false,
        properties: {
          limit: {type: 'integer', minimum: 1, maximum: 50}, cursor: {type: 'string', minLength: 1, maxLength: 512},
          query: {type: 'string', minLength: 1, maxLength: 120}, category: {type: 'string', minLength: 1, maxLength: 80},
          membership: {type: 'string', enum: ['joined', 'notJoined']},
        },
      },
    },
  }, async (request, reply) => {
    try {
      const query = (request.query ?? {}) as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const items = await communities.list(request.auth?.actorId ?? null, {
        limit, cursor: decodeCursor(query.cursor),
        query: query.query as string | undefined, category: query.category as string | undefined,
        membership: query.membership as 'joined' | 'notJoined' | undefined,
      })
      return reply.send(successEnvelope(toCursorPage(items, limit, item => `${item.featured ? '1' : '0'}|${item.recentActivityAt}|${item.id}`), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to list communities')
    }
  })

  app.post('/v1/communities', {
    ...writeConfig,
    preValidation: rejectUnknownBody([
      'slug', 'name', 'description', 'category', 'visibility', 'discoverable', 'membershipPolicy',
      'postingPolicy', 'iconAttachmentId', 'coverAttachmentId',
    ]),
    schema: {body: {
      type: 'object', additionalProperties: false, required: ['name', 'category'],
      properties: {
        slug: {type: 'string', minLength: 2, maxLength: 120}, name: {type: 'string', minLength: 1, maxLength: 120},
        description: {type: 'string', maxLength: 5000}, category: {type: 'string', minLength: 1, maxLength: 80},
        visibility: {type: 'string', enum: ['public', 'private']}, discoverable: {type: 'boolean'},
        membershipPolicy: {type: 'string', enum: ['open', 'approval']}, postingPolicy: {type: 'string', enum: ['members', 'moderators']},
        iconAttachmentId: {type: ['string', 'null'], format: 'uuid'}, coverAttachmentId: {type: ['string', 'null'], format: 'uuid'},
      },
    }},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      const community = await communities.create(auth.actorId, request.body as CommunityCreateInput, contextFor(request))
      return reply.code(201).send(successEnvelope({community}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to create community')
    }
  })

  app.get('/v1/communities/:communityId', {...profileConfig, schema: {params: communityParams}}, async (request, reply) => {
    try {
      const {communityId} = request.params as {communityId: string}
      return reply.send(successEnvelope({community: await communities.get(communityId, request.auth?.actorId ?? null)}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load community')
    }
  })

  app.patch('/v1/communities/:communityId', {
    ...writeConfig,
    preValidation: rejectUnknownBody([
      'expectedVersion', 'slug', 'name', 'description', 'category', 'visibility', 'discoverable',
      'membershipPolicy', 'postingPolicy', 'iconAttachmentId', 'coverAttachmentId',
    ]),
    schema: {params: communityParams, body: {
      type: 'object', additionalProperties: false, required: ['expectedVersion'], minProperties: 2,
      properties: {
        expectedVersion: {type: 'integer', minimum: 1}, slug: {type: 'string', minLength: 2, maxLength: 120},
        name: {type: 'string', minLength: 1, maxLength: 120}, description: {type: 'string', maxLength: 5000},
        category: {type: 'string', minLength: 1, maxLength: 80}, visibility: {type: 'string', enum: ['public', 'private']},
        discoverable: {type: 'boolean'}, membershipPolicy: {type: 'string', enum: ['open', 'approval']},
        postingPolicy: {type: 'string', enum: ['members', 'moderators']},
        iconAttachmentId: {type: ['string', 'null'], format: 'uuid'}, coverAttachmentId: {type: ['string', 'null'], format: 'uuid'},
      },
    }},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      const {communityId} = request.params as {communityId: string}
      const community = await communities.update(auth.actorId, communityId, request.body as CommunityPatchInput, contextFor(request))
      return reply.send(successEnvelope({community}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to update community')
    }
  })

  app.post('/v1/communities/:communityId/join', {...writeConfig, schema: {params: communityParams}}, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      const {communityId} = request.params as {communityId: string}
      return reply.send(successEnvelope(await communities.join(auth.actorId, communityId, contextFor(request)), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to join community')
    }
  })

  app.post('/v1/communities/:communityId/leave', {...writeConfig, schema: {params: communityParams}}, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      const {communityId} = request.params as {communityId: string}
      return reply.send(successEnvelope(await communities.leave(auth.actorId, communityId, contextFor(request)), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to leave community')
    }
  })

  app.get('/v1/communities/:communityId/members', {
    ...profileConfig, schema: {params: communityParams, querystring: pageQuery},
  }, async (request, reply) => {
    try {
      const {communityId} = request.params as {communityId: string}
      const query = (request.query ?? {}) as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const items = await communities.listMembers(communityId, request.auth?.actorId ?? null, limit, decodeCursor(query.cursor))
      return reply.send(successEnvelope(toCursorPage(items, limit, item => `${item.joinedAt}|${item.actorId}`), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to list community members')
    }
  })

  app.get('/v1/communities/:communityId/posts', {
    ...profileConfig, schema: {params: communityParams, querystring: pageQuery},
  }, async (request, reply) => {
    try {
      const {communityId} = request.params as {communityId: string}
      const query = (request.query ?? {}) as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const items = await communities.listPosts(communityId, request.auth?.actorId ?? null, limit, decodeCursor(query.cursor))
      return reply.send(successEnvelope(toCursorPage(items, limit, item => `${item.featuredAt ?? '-'}|${item.post.createdAt}|${item.post.id}`), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to list community posts')
    }
  })

  app.post('/v1/communities/:communityId/posts', {
    ...writeConfig,
    preValidation: rejectUnknownBody(['text', 'media', 'content', 'idempotencyKey']),
    schema: {params: communityParams, body: {
      type: 'object', additionalProperties: false, required: ['text'],
      properties: {
        text: {type: 'string', maxLength: 5000}, idempotencyKey: {type: 'string', minLength: 1, maxLength: 200},
        media: {type: 'array', maxItems: 10}, content: {type: 'array', maxItems: 10},
      },
    }},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    try {
      const {communityId} = request.params as {communityId: string}
      const item = await communities.createPost(auth.actorId, communityId, request.body as any, contextFor(request))
      return reply.code(201).send(successEnvelope({item}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to create community post')
    }
  })

  app.get('/v1/communities/:communityId/settings', {...profileConfig, schema: {params: communityParams}}, async (request, reply) => {
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      const {communityId} = request.params as {communityId: string}
      return reply.send(successEnvelope({settings: await communities.getSettings(communityId, auth.actorId)}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load community settings')
    }
  })

  app.patch('/v1/communities/:communityId/settings', {
    ...writeConfig,
    preValidation: rejectUnknownBody([
      'expectedVersion', 'membershipPolicy', 'postingPolicy', 'inviteLinksEnabled', 'allowAttachments',
      'reactionsEnabled', 'featuredPostsEnabled', 'blockedWords', 'notifyMentions', 'weeklyDigest', 'eventReminders',
    ]),
    schema: {params: communityParams, body: {
      type: 'object', additionalProperties: false, minProperties: 1,
      properties: {
        expectedVersion: {type: 'integer', minimum: 1}, membershipPolicy: {type: 'string', enum: ['open', 'approval']},
        postingPolicy: {type: 'string', enum: ['members', 'moderators']}, inviteLinksEnabled: {type: 'boolean'},
        allowAttachments: {type: 'boolean'}, reactionsEnabled: {type: 'boolean'}, featuredPostsEnabled: {type: 'boolean'},
        blockedWords: {type: 'array', maxItems: 100, uniqueItems: true, items: {type: 'string', minLength: 1, maxLength: 80}},
        notifyMentions: {type: 'boolean'}, weeklyDigest: {type: 'boolean'}, eventReminders: {type: 'boolean'},
      },
    }},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      const {communityId} = request.params as {communityId: string}
      const settings = await communities.updateSettings(auth.actorId, communityId, request.body as any, contextFor(request))
      return reply.send(successEnvelope({settings}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to update community settings')
    }
  })

  app.get('/v1/communities/:communityId/events', {
    ...profileConfig, schema: {params: communityParams, querystring: pageQuery},
  }, async (request, reply) => {
    try {
      const {communityId} = request.params as {communityId: string}
      const query = (request.query ?? {}) as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const items = await communities.listEvents(communityId, request.auth?.actorId ?? null, limit, decodeCursor(query.cursor))
      return reply.send(successEnvelope(toCursorPage(items, limit, item => `${item.startsAt}|${item.id}`), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to list community events')
    }
  })

  app.post('/v1/communities/:communityId/events', {
    ...writeConfig,
    preValidation: rejectUnknownBody([
      'title', 'description', 'startsAt', 'endsAt', 'timezone', 'location', 'coverAttachmentId', 'capacity',
    ]),
    schema: {params: communityParams, body: {type: 'object', additionalProperties: false,
      required: ['title', 'startsAt', 'endsAt', 'timezone', 'location'], properties: eventBodyProperties}},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      const {communityId} = request.params as {communityId: string}
      const event = await communities.createEvent(auth.actorId, communityId, request.body as CommunityEventCreateInput, contextFor(request))
      return reply.code(201).send(successEnvelope({event}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to create community event')
    }
  })

  app.get('/v1/communities/:communityId/events/:eventId', {...profileConfig, schema: {params: eventParams}}, async (request, reply) => {
    try {
      const {communityId, eventId} = request.params as {communityId: string; eventId: string}
      return reply.send(successEnvelope({event: await communities.getEvent(communityId, eventId, request.auth?.actorId ?? null)}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load community event')
    }
  })

  app.patch('/v1/communities/:communityId/events/:eventId', {
    ...writeConfig,
    preValidation: rejectUnknownBody([
      'expectedVersion', 'title', 'description', 'startsAt', 'endsAt', 'timezone', 'location',
      'coverAttachmentId', 'capacity', 'status',
    ]),
    schema: {params: eventParams, body: {type: 'object', additionalProperties: false, required: ['expectedVersion'], minProperties: 2,
      properties: {...eventBodyProperties, expectedVersion: {type: 'integer', minimum: 1}, status: {type: 'string', enum: ['scheduled', 'cancelled']}}}},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      const {communityId, eventId} = request.params as {communityId: string; eventId: string}
      const event = await communities.updateEvent(auth.actorId, communityId, eventId, request.body as CommunityEventPatchInput, contextFor(request))
      return reply.send(successEnvelope({event}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to update community event')
    }
  })

  app.put('/v1/communities/:communityId/events/:eventId/response', {
    ...writeConfig,
    preValidation: rejectUnknownBody(['response']),
    schema: {params: eventParams, body: {type: 'object', additionalProperties: false, required: ['response'],
      properties: {response: {type: ['string', 'null'], enum: ['going', 'interested', null]}}}},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      const {communityId, eventId} = request.params as {communityId: string; eventId: string}
      const response = (request.body as {response: 'going' | 'interested' | null}).response
      const event = await communities.respondToEvent(auth.actorId, communityId, eventId, response, contextFor(request))
      return reply.send(successEnvelope({event}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to update event response')
    }
  })

  app.get('/v1/communities/:communityId/polls', {
    ...profileConfig, schema: {params: communityParams, querystring: pageQuery},
  }, async (request, reply) => {
    try {
      const {communityId} = request.params as {communityId: string}
      const query = (request.query ?? {}) as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const items = await communities.listPolls(communityId, request.auth?.actorId ?? null, limit, decodeCursor(query.cursor))
      return reply.send(successEnvelope(toCursorPage(items, limit, item => `${item.createdAt}|${item.id}`), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to list community polls')
    }
  })

  app.post('/v1/communities/:communityId/polls', {
    ...writeConfig,
    preValidation: rejectUnknownBody(['question', 'options', 'closesAt', 'allowVoteChanges', 'resultsVisibility']),
    schema: {params: communityParams, body: {type: 'object', additionalProperties: false,
      required: ['question', 'options', 'closesAt'], properties: {
        question: {type: 'string', minLength: 1, maxLength: 500},
        options: {type: 'array', minItems: 2, maxItems: 10, items: {type: 'string', minLength: 1, maxLength: 200}},
        closesAt: {type: 'string', format: 'date-time'}, allowVoteChanges: {type: 'boolean'},
        resultsVisibility: {type: 'string', enum: ['always', 'afterVote', 'afterClose']},
      }}},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      const {communityId} = request.params as {communityId: string}
      const poll = await communities.createPoll(auth.actorId, communityId, request.body as CommunityPollCreateInput, contextFor(request))
      return reply.code(201).send(successEnvelope({poll}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to create community poll')
    }
  })

  app.get('/v1/communities/:communityId/polls/:pollId', {...profileConfig, schema: {params: pollParams}}, async (request, reply) => {
    try {
      const {communityId, pollId} = request.params as {communityId: string; pollId: string}
      return reply.send(successEnvelope({poll: await communities.getPoll(communityId, pollId, request.auth?.actorId ?? null)}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load community poll')
    }
  })

  app.patch('/v1/communities/:communityId/polls/:pollId', {
    ...writeConfig,
    preValidation: rejectUnknownBody(['status', 'expectedVersion']),
    schema: {params: pollParams, body: {type: 'object', additionalProperties: false, required: ['status', 'expectedVersion'],
      properties: {status: {type: 'string', const: 'cancelled'}, expectedVersion: {type: 'integer', minimum: 1}}}},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      const {communityId, pollId} = request.params as {communityId: string; pollId: string}
      const poll = await communities.updatePoll(auth.actorId, communityId, pollId, request.body as CommunityPollPatchInput, contextFor(request))
      return reply.send(successEnvelope({poll}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to update community poll')
    }
  })

  app.put('/v1/communities/:communityId/polls/:pollId/vote', {
    ...writeConfig,
    preValidation: rejectUnknownBody(['optionId']),
    schema: {params: pollParams, body: {type: 'object', additionalProperties: false, required: ['optionId'],
      properties: {optionId: {type: 'string', format: 'uuid'}}}},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      const {communityId, pollId} = request.params as {communityId: string; pollId: string}
      const {optionId} = request.body as {optionId: string}
      const poll = await communities.vote(auth.actorId, communityId, pollId, optionId, contextFor(request))
      return reply.send(successEnvelope({poll}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to vote in community poll')
    }
  })
}
