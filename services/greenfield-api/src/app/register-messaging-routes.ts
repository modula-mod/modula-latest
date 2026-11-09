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

const startConversationBody = {
  attachValidation: true,
  schema: {
    body: {
      type: 'object',
      // Fastify's default Ajv configuration removes unknown fields when this
      // is false. Keep them for the authenticated handler to reject instead.
      additionalProperties: true,
      required: ['handle'],
      properties: {
        handle: {type: 'string', minLength: 1, maxLength: 80},
        text: {type: 'string', maxLength: 5_000},
      },
    },
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
    const q = request.query as {cursor?: string; limit?: string; archived?: string}
    try {
      return reply.send(successEnvelope(await messaging.listConversations(auth.actorId, q.cursor, q.limit, q.archived), request.id))
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

  app.post('/v1/conversations', write(startConversationBody), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    if (request.validationError) {
      return reply.code(statusForError('VALIDATION_FAILED')).send(failureEnvelope('VALIDATION_FAILED', 'Invalid conversation request', request.id))
    }
    const body = (request.body ?? {}) as {handle?: unknown; text?: unknown}
    if (Object.keys(body).some(key => key !== 'handle' && key !== 'text')) {
      return reply.code(statusForError('VALIDATION_FAILED')).send(failureEnvelope('VALIDATION_FAILED', 'Invalid conversation request', request.id))
    }
    try {
      const result = await messaging.startConversation(auth.actorId, body)
      if (result.created) return reply.code(201).send(successEnvelope(result, request.id))
      return reply.code(200).send(successEnvelope(result, request.id))
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
    const body = (request.body ?? {}) as {text?: unknown; replyToMessageId?: unknown}
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

  // ---- messaging v2 ---------------------------------------------------

  const messageParams = {
    schema: {
      params: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'messageId'],
        properties: {id: {type: 'string', minLength: 1, maxLength: 64}, messageId: {type: 'string', minLength: 1, maxLength: 64}},
      },
    },
  }

  app.patch('/v1/conversations/:id/messages/:messageId', write(messageParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id, messageId} = request.params as {id: string; messageId: string}
    try {
      const message = await messaging.editMessage(auth.actorId, id, messageId, (request.body ?? {}) as {text?: unknown})
      return reply.send(successEnvelope({message}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to edit message')
    }
  })

  app.delete('/v1/conversations/:id/messages/:messageId', write(messageParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id, messageId} = request.params as {id: string; messageId: string}
    try {
      await messaging.unsendMessage(auth.actorId, id, messageId)
      return reply.send(successEnvelope({ok: true}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to unsend message')
    }
  })

  app.put('/v1/conversations/:id/messages/:messageId/reactions', write(messageParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id, messageId} = request.params as {id: string; messageId: string}
    try {
      return reply.send(successEnvelope(await messaging.react(auth.actorId, id, messageId, (request.body ?? {}) as {emoji?: unknown}, true), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to react')
    }
  })

  app.delete('/v1/conversations/:id/messages/:messageId/reactions', write(messageParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id, messageId} = request.params as {id: string; messageId: string}
    const q = request.query as {emoji?: string}
    try {
      return reply.send(successEnvelope(await messaging.react(auth.actorId, id, messageId, {emoji: q.emoji}, false), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to remove reaction')
    }
  })

  app.post('/v1/conversations/:id/typing', write(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      await messaging.setTyping(auth.actorId, id)
      return reply.send(successEnvelope({ok: true}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to update typing')
    }
  })

  app.get('/v1/conversations/:id/typing', read(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      return reply.send(successEnvelope(await messaging.typing(auth.actorId, id), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load typing')
    }
  })

  app.post('/v1/conversations/:id/mute', write(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      return reply.send(successEnvelope(await messaging.setMuted(auth.actorId, id, (request.body ?? {}) as {muted?: unknown; until?: unknown}), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to update mute')
    }
  })

  app.post('/v1/conversations/:id/archive', write(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      return reply.send(successEnvelope(await messaging.setArchived(auth.actorId, id, (request.body ?? {}) as {archived?: unknown}), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to update archive')
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
      // Muted chats stay quiet until the mute ends.
      .where(eb => eb.or([eb('muted_until', 'is', null), eb('muted_until', '<=', new Date())]))
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
