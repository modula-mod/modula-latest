import type {CreatePostDraftInput, UpdatePostDraftInput} from '@modula/api-contracts'
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {SavedCollectionService} from '../domains/collections/service.js'
import {PostDraftService} from '../domains/drafts/service.js'
import {requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {decodeCursor, parseLimit, toCursorPage} from '../transport/pagination.js'

type RateConfig = Record<string, unknown>

const collectionParams = {type: 'object', additionalProperties: false, required: ['collectionId'],
  properties: {collectionId: {type: 'string', format: 'uuid'}}}
const collectionItemParams = {type: 'object', additionalProperties: false, required: ['collectionId', 'itemId'],
  properties: {collectionId: {type: 'string', format: 'uuid'}, itemId: {type: 'string', format: 'uuid'}}}
const draftParams = {type: 'object', additionalProperties: false, required: ['draftId'],
  properties: {draftId: {type: 'string', format: 'uuid'}}}
const pageQuery = {type: 'object', additionalProperties: false, properties: {
  limit: {type: 'integer', minimum: 1, maximum: 50}, cursor: {type: 'string', minLength: 1, maxLength: 512},
}}
const expectedVersionQuery = {type: 'object', additionalProperties: false, required: ['expectedVersion'],
  properties: {expectedVersion: {type: 'integer', minimum: 1}}}
const contentItems = {type: 'array', maxItems: 10, uniqueItems: false, items: {
  type: 'object', additionalProperties: false, required: ['type', 'attachmentId'],
  properties: {
    type: {type: 'string', enum: ['image', 'video', 'audio', 'pdf', 'document']},
    attachmentId: {type: 'string', format: 'uuid'}, caption: {type: 'string', maxLength: 1000},
  },
}}
const draftProperties = {
  text: {type: 'string', maxLength: 5000}, feed: {type: 'string', enum: ['following', 'forYou', 'modules']},
  audience: {type: 'string', enum: ['public', 'followers', 'private']},
  replyPermission: {type: 'string', enum: ['everyone', 'followers', 'mentioned', 'none']},
  content: contentItems, publishToAtproto: {type: 'boolean'},
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
    if (unknown.length > 0) return sendError(reply, 'VALIDATION_FAILED', `Unknown request field: ${unknown[0]}`, request.id)
  }
}

export async function registerCollectionsDraftsRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  options: {profileConfig: RateConfig; writeConfig: RateConfig; mutationsAllowed: boolean},
): Promise<void> {
  const collections = new SavedCollectionService(db, config)
  const drafts = new PostDraftService(db, config)
  const {profileConfig, writeConfig, mutationsAllowed} = options
  const mutationGate = (reply: FastifyReply, requestId: string) => {
    if (mutationsAllowed) return true
    sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', requestId)
    return false
  }
  const contextFor = (request: FastifyRequest) => ({
    requestId: request.id, correlationId: request.id, accountId: request.auth?.accountId ?? null,
  })

  app.get('/v1/me/collections', {...profileConfig, schema: {querystring: pageQuery}}, async (request, reply) => {
    const auth = requireCapability(request, reply, 'saved:manage')
    if (!auth) return
    try {
      const query = (request.query ?? {}) as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const items = await collections.list(auth.actorId, limit, decodeCursor(query.cursor))
      return reply.send(successEnvelope(toCursorPage(items, limit, item => `${item.updatedAt}|${item.id}`), request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to list collections') }
  })

  app.post('/v1/me/collections', {
    ...writeConfig, preValidation: rejectUnknownBody(['name']),
    schema: {body: {type: 'object', additionalProperties: false, required: ['name'],
      properties: {name: {type: 'string', minLength: 1, maxLength: 120}}}},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireCapability(request, reply, 'saved:manage')
    if (!auth) return
    try {
      const collection = await collections.create(auth.actorId, (request.body as {name: string}).name, contextFor(request))
      return reply.code(201).send(successEnvelope({collection}, request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to create collection') }
  })

  app.get('/v1/me/collections/:collectionId', {...profileConfig, schema: {params: collectionParams}}, async (request, reply) => {
    const auth = requireCapability(request, reply, 'saved:manage')
    if (!auth) return
    try {
      const {collectionId} = request.params as {collectionId: string}
      return reply.send(successEnvelope({collection: await collections.get(auth.actorId, collectionId)}, request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to load collection') }
  })

  app.patch('/v1/me/collections/:collectionId', {
    ...writeConfig, preValidation: rejectUnknownBody(['name', 'expectedVersion']),
    schema: {params: collectionParams, body: {type: 'object', additionalProperties: false,
      required: ['name', 'expectedVersion'], properties: {
        name: {type: 'string', minLength: 1, maxLength: 120}, expectedVersion: {type: 'integer', minimum: 1},
      }}},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireCapability(request, reply, 'saved:manage')
    if (!auth) return
    try {
      const {collectionId} = request.params as {collectionId: string}
      const collection = await collections.update(auth.actorId, collectionId,
        request.body as {name: string; expectedVersion: number}, contextFor(request))
      return reply.send(successEnvelope({collection}, request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to update collection') }
  })

  app.delete('/v1/me/collections/:collectionId', {
    ...writeConfig, schema: {params: collectionParams, querystring: expectedVersionQuery},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireCapability(request, reply, 'saved:manage')
    if (!auth) return
    try {
      const {collectionId} = request.params as {collectionId: string}
      const expectedVersion = Number((request.query as {expectedVersion: number}).expectedVersion)
      await collections.remove(auth.actorId, collectionId, expectedVersion, contextFor(request))
      return reply.send(successEnvelope({deleted: true}, request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to delete collection') }
  })

  app.get('/v1/me/collections/:collectionId/items', {
    ...profileConfig, schema: {params: collectionParams, querystring: pageQuery},
  }, async (request, reply) => {
    const auth = requireCapability(request, reply, 'saved:manage')
    if (!auth) return
    try {
      const {collectionId} = request.params as {collectionId: string}
      const query = (request.query ?? {}) as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const items = await collections.listItems(auth.actorId, collectionId, limit, decodeCursor(query.cursor))
      return reply.send(successEnvelope(toCursorPage(items, limit, item => `${item.position}|${item.id}`), request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to list collection items') }
  })

  app.post('/v1/me/collections/:collectionId/items', {
    ...writeConfig, preValidation: rejectUnknownBody(['postId']),
    schema: {params: collectionParams, body: {type: 'object', additionalProperties: false, required: ['postId'],
      properties: {postId: {type: 'string', format: 'uuid'}}}},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireCapability(request, reply, 'saved:manage')
    if (!auth) return
    try {
      const {collectionId} = request.params as {collectionId: string}
      const outcome = await collections.addItem(auth.actorId, collectionId,
        (request.body as {postId: string}).postId, contextFor(request))
      return reply.code(outcome.created ? 201 : 200).send(successEnvelope({item: outcome.item}, request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to add collection item') }
  })

  app.delete('/v1/me/collections/:collectionId/items/:itemId', {
    ...writeConfig, schema: {params: collectionItemParams},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireCapability(request, reply, 'saved:manage')
    if (!auth) return
    try {
      const {collectionId, itemId} = request.params as {collectionId: string; itemId: string}
      await collections.removeItem(auth.actorId, collectionId, itemId, contextFor(request))
      return reply.send(successEnvelope({deleted: true}, request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to remove collection item') }
  })

  app.get('/v1/me/drafts', {...profileConfig, schema: {querystring: pageQuery}}, async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    try {
      const query = (request.query ?? {}) as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const items = await drafts.list(auth.actorId, limit, decodeCursor(query.cursor))
      return reply.send(successEnvelope(toCursorPage(items, limit, item => `${item.updatedAt}|${item.id}`), request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to list drafts') }
  })

  app.post('/v1/me/drafts', {
    ...writeConfig, preValidation: rejectUnknownBody(['idempotencyKey', ...Object.keys(draftProperties)]),
    schema: {body: {type: 'object', additionalProperties: false, required: ['text'], properties: {
      idempotencyKey: {type: 'string', minLength: 1, maxLength: 200}, ...draftProperties,
    }}},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    try {
      const outcome = await drafts.create(auth.actorId, request.body as CreatePostDraftInput, contextFor(request))
      return reply.code(outcome.created ? 201 : 200).send(successEnvelope({draft: outcome.draft}, request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to create draft') }
  })

  app.get('/v1/me/drafts/:draftId', {...profileConfig, schema: {params: draftParams}}, async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    try {
      const {draftId} = request.params as {draftId: string}
      return reply.send(successEnvelope({draft: await drafts.get(auth.actorId, draftId)}, request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to load draft') }
  })

  app.patch('/v1/me/drafts/:draftId', {
    ...writeConfig, preValidation: rejectUnknownBody(['expectedVersion', ...Object.keys(draftProperties)]),
    schema: {params: draftParams, body: {type: 'object', additionalProperties: false,
      required: ['expectedVersion'], minProperties: 2, properties: {
        expectedVersion: {type: 'integer', minimum: 1}, ...draftProperties,
      }}},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    try {
      const {draftId} = request.params as {draftId: string}
      const draft = await drafts.update(auth.actorId, draftId, request.body as UpdatePostDraftInput, contextFor(request))
      return reply.send(successEnvelope({draft}, request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to update draft') }
  })

  app.delete('/v1/me/drafts/:draftId', {
    ...writeConfig, schema: {params: draftParams, querystring: expectedVersionQuery},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    try {
      const {draftId} = request.params as {draftId: string}
      await drafts.remove(auth.actorId, draftId, Number((request.query as {expectedVersion: number}).expectedVersion), contextFor(request))
      return reply.send(successEnvelope({deleted: true}, request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to delete draft') }
  })

  app.post('/v1/me/drafts/:draftId/publish', {
    ...writeConfig, preValidation: rejectUnknownBody(['expectedVersion']),
    schema: {params: draftParams, body: {type: 'object', additionalProperties: false, required: ['expectedVersion'],
      properties: {expectedVersion: {type: 'integer', minimum: 1}}}},
  }, async (request, reply) => {
    if (!mutationGate(reply, request.id)) return
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    try {
      const {draftId} = request.params as {draftId: string}
      const outcome = await drafts.publish(auth.actorId, draftId,
        (request.body as {expectedVersion: number}).expectedVersion, contextFor(request))
      return reply.code(outcome.created ? 201 : 200).send(successEnvelope(outcome, request.id))
    } catch (error) { return mapError(reply, error, request.id, 'Unable to publish draft') }
  })
}
