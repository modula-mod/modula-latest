import type {FastifyInstance} from 'fastify'

import type {ModulaDb} from '../database/client.js'
import {MessagingService} from '../domains/messaging/service.js'
import {enqueuePush} from '../domains/push/service.js'
import {requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'

function mapDomainError(reply: any, error: any, requestId: string, fallback: string) {
  const code = error?.code
  if (code === 'VALIDATION_FAILED' || code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'CONFLICT') {
    return reply.code(statusForError(code)).send(failureEnvelope(code, error.message ?? fallback, requestId))
  }
  return reply.code(statusForError('SERVER_ERROR')).send(failureEnvelope('SERVER_ERROR', fallback, requestId))
}

const idParams = {
  schema: {
    params: {type: 'object', additionalProperties: false, required: ['id'], properties: {id: {type: 'string', minLength: 1, maxLength: 64}}},
  },
}

/**
 * Direct messages, message requests and In-Mail. Every route requires an
 * authenticated actor; membership is enforced in MessagingService.
 */
export async function registerMessagingRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  options: {feedConfig: Record<string, any>; writeConfig: Record<string, any>},
): Promise<void> {
  const messaging = new MessagingService(db)
  const {feedConfig, writeConfig} = options
  const read = (extra: Record<string, any> = {}) => ({...feedConfig, ...extra})
  const write = (extra: Record<string, any> = {}) => ({...writeConfig, ...extra})

  app.get('/v1/conversations', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const q = request.query as {cursor?: string; limit?: string}
    try {
      return reply.send(successEnvelope(await messaging.listConversations(auth.actorId, q.cursor, q.limit), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load conversations')
    }
  })

  app.get('/v1/conversations/unread', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      return reply.send(successEnvelope(await messaging.unreadSummary(auth.actorId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load unread count')
    }
  })

  app.post('/v1/conversations', write(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const body = (request.body ?? {}) as {handle?: unknown; text?: unknown}
    try {
      const conversation = await messaging.startConversation(auth.actorId, body)
      return reply.code(201).send(successEnvelope({conversation}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to start conversation')
    }
  })

  app.get('/v1/conversations/:id/messages', read(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {id} = request.params as {id: string}
    const q = request.query as {cursor?: string; limit?: string}
    try {
      return reply.send(successEnvelope(await messaging.listMessages(auth.actorId, id, q.cursor, q.limit), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load messages')
    }
  })

  app.post('/v1/conversations/:id/messages', write(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id} = request.params as {id: string}
    const body = (request.body ?? {}) as {text?: unknown}
    try {
      const message = await messaging.send(auth.actorId, id, body)
      await notifyConversationMembers(db, auth.actorId, id, typeof body.text === 'string' ? body.text : '')
        .catch(error => request.log.warn({error: error?.message}, 'message push enqueue failed'))
      return reply.code(201).send(successEnvelope({message}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to send message')
    }
  })

  app.post('/v1/conversations/:id/read', write(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      await messaging.markRead(auth.actorId, id)
      return reply.send(successEnvelope({ok: true}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to mark conversation read')
    }
  })

  app.get('/v1/message-requests', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      return reply.send(successEnvelope(await messaging.listRequests(auth.actorId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load message requests')
    }
  })

  app.post('/v1/message-requests/:id/accept', write(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      const conversation = await messaging.acceptRequest(auth.actorId, id)
      return reply.send(successEnvelope({conversation}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to accept request')
    }
  })

  app.post('/v1/message-requests/:id/decline', write(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      await messaging.declineRequest(auth.actorId, id)
      return reply.send(successEnvelope({ok: true}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to decline request')
    }
  })

  app.get('/v1/in-mail', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const q = request.query as {cursor?: string; limit?: string}
    try {
      return reply.send(successEnvelope(await messaging.listInMail(auth.actorId, q.cursor, q.limit), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load In-Mail')
    }
  })

  app.post('/v1/in-mail', write(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const body = (request.body ?? {}) as {to?: unknown; subject?: unknown; body?: unknown}
    try {
      const thread = await messaging.composeInMail(auth.actorId, body)
      return reply.code(201).send(successEnvelope({thread}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to send In-Mail')
    }
  })

  app.get('/v1/in-mail/:id', read(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      return reply.send(successEnvelope(await messaging.getInMail(auth.actorId, id), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load In-Mail')
    }
  })

  app.post('/v1/in-mail/:id/replies', write(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id} = request.params as {id: string}
    const body = (request.body ?? {}) as {body?: unknown}
    try {
      const message = await messaging.replyInMail(auth.actorId, id, body)
      return reply.code(201).send(successEnvelope({message}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to send reply')
    }
  })
}

/** Best-effort push fan-out for a new direct message / In-Mail reply. */
async function notifyConversationMembers(db: ModulaDb, senderActorId: string, conversationId: string, text: string): Promise<void> {
  const [members, sender] = await Promise.all([
    db.selectFrom('greenfield_conversation_members')
      .select(['actor_id', 'state'])
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '<>', senderActorId)
      .where('state', 'in', ['active', 'pending'])
      .execute(),
    db.selectFrom('profiles').select(['handle', 'display_name']).where('actor_id', '=', senderActorId).executeTakeFirst(),
  ])
  const name = (sender as any)?.display_name || (sender?.handle ? `@${sender.handle}` : 'Someone')
  const preview = text.trim().replace(/\s+/g, ' ').slice(0, 160) || 'sent you a message'
  for (const member of members) {
    await enqueuePush(db, {
      recipientActorId: member.actor_id,
      category: 'messages',
      actorId: senderActorId,
      title: member.state === 'pending' ? `Message request from ${name}` : name,
      body: preview,
      deepLink: `modula://messages/${conversationId}`,
      threadId: `messages:${conversationId}`,
      data: {conversationId, type: 'message'},
    })
  }
}
