import type {FastifyInstance} from 'fastify'
import websocket from '@fastify/websocket'

import type {ModulaDb} from '../database/client.js'
import {MessagingRealtimeHub, type MessagingRealtimeEvent} from '../domains/messaging/realtime-hub.js'
import {
  GROUP_MAX_MEMBERS,
  MESSAGE_ATTACHMENTS_MAX,
  MessagingService,
  PRESENCE_ONLINE_MS,
  TYPING_TTL_MS,
  VOICE_NOTE_MAX_MS,
  type MessageDto,
} from '../domains/messaging/service.js'
import {enqueuePush} from '../domains/push/service.js'
import {requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'

/** Socket heartbeat: clients ping at this interval; presence is refreshed at most once per interval. */
export const MESSAGING_SOCKET_HEARTBEAT_MS = 25_000

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
  options: {
    feedConfig: Record<string, any>
    writeConfig: Record<string, any>
    publicApiUrl?: string
    /** Photo/video message kinds. Off unless explicitly enabled. */
    mediaEnabled?: boolean
    hub?: MessagingRealtimeHub
  },
): Promise<{hub: MessagingRealtimeHub; messaging: MessagingService}> {
  const messaging = new MessagingService(db, {publicApiUrl: options.publicApiUrl})
  const hub = options.hub ?? new MessagingRealtimeHub()
  const mediaEnabled = options.mediaEnabled === true
  const {feedConfig, writeConfig} = options
  const publish = (request: any, recipients: Promise<string[]> | string[], event: MessagingRealtimeEvent) => {
    Promise.resolve(recipients)
      .then(ids => hub.publish(ids, event))
      .catch(error => request.log.warn({error: error?.message, type: event.type}, 'messaging realtime publish failed'))
  }
  const toMembers = (request: any, conversationId: string, actorId: string, event: MessagingRealtimeEvent, includeActor = true) =>
    publish(request, messaging.realtimeRecipients(conversationId, actorId, {includeActor}), event)
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
    const body = (request.body ?? {}) as {text?: unknown; replyToMessageId?: unknown; clientMessageId?: unknown; kind?: unknown; attachments?: unknown}
    try {
      const result = await messaging.sendDetailed(auth.actorId, id, body, {accountId: auth.accountId, mediaEnabled})
      if (!result.created) return reply.code(200).send(successEnvelope({message: result.message, duplicate: true}, request.id))
      await notifyConversationMembers(db, messaging, auth.actorId, id, result.message, result.mentionedActorIds)
        .catch(error => request.log.warn({error: error?.message}, 'message push enqueue failed'))
      toMembers(request, id, auth.actorId, {
        type: 'message.created', conversationId: id, messageId: result.message.id, senderId: auth.actorId,
        kind: result.message.kind ?? 'text', sentAt: result.message.sentAt,
      })
      return reply.code(201).send(successEnvelope({message: result.message}, request.id))
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
      const readAt = new Date().toISOString()
      publish(request, messaging.receiptRecipients(id, auth.actorId), {type: 'read', conversationId: id, actorId: auth.actorId, readAt})
      // Other devices of the reader clear their unread badge too.
      hub.publish([auth.actorId], {type: 'read', conversationId: id, actorId: auth.actorId, readAt})
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
      toMembers(request, id, auth.actorId, {type: 'message.updated', conversationId: id, messageId})
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
      toMembers(request, id, auth.actorId, {type: 'message.deleted', conversationId: id, messageId})
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
      const result = await messaging.react(auth.actorId, id, messageId, (request.body ?? {}) as {emoji?: unknown}, true)
      toMembers(request, id, auth.actorId, {type: 'reaction.changed', conversationId: id, messageId})
      return reply.send(successEnvelope(result, request.id))
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
      const result = await messaging.react(auth.actorId, id, messageId, {emoji: q.emoji}, false)
      toMembers(request, id, auth.actorId, {type: 'reaction.changed', conversationId: id, messageId})
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to remove reaction')
    }
  })

  app.post('/v1/conversations/:id/typing', write(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      const published = await messaging.setTyping(auth.actorId, id)
      if (published) {
        toMembers(request, id, auth.actorId, {type: 'typing', conversationId: id, actorId: auth.actorId, expiresAt: new Date(Date.now() + TYPING_TTL_MS).toISOString()}, false)
      }
      return reply.send(successEnvelope({ok: true, published}, request.id))
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

  // ---- messaging v3 ---------------------------------------------------

  const memberParams = {
    schema: {
      params: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'actorId'],
        properties: {id: {type: 'string', minLength: 1, maxLength: 64}, actorId: {type: 'string', minLength: 1, maxLength: 64}},
      },
    },
  }

  /** Server-declared messaging capabilities so the client never guesses. */
  app.get('/v1/messaging/capabilities', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    return reply.send(successEnvelope({
      version: 3,
      groups: true,
      maxGroupMembers: GROUP_MAX_MEMBERS,
      mentions: true,
      voiceNotes: true,
      voiceNoteMaxMs: VOICE_NOTE_MAX_MS,
      voiceNoteMimeTypes: ['audio/mp4', 'audio/mpeg', 'audio/wav'],
      photoVideo: mediaEnabled,
      maxAttachmentsPerMessage: MESSAGE_ATTACHMENTS_MAX,
      reactionDetails: true,
      groupReadReceipts: true,
      historySearch: true,
      presence: true,
      presenceOnlineWindowMs: PRESENCE_ONLINE_MS,
      realtime: {socketPath: '/v1/messaging/socket', heartbeatMs: MESSAGING_SOCKET_HEARTBEAT_MS, singleInstance: true},
      privacyControls: ['readReceipts', 'typingIndicators', 'presenceVisibility', 'notificationPreview'],
      idempotentSend: true,
      notificationActions: ['reply', 'markRead'],
    }, request.id))
  })

  app.get('/v1/messaging/privacy', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      return reply.send(successEnvelope({privacy: await messaging.getPrivacy(auth.actorId)}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load messaging privacy')
    }
  })

  app.patch('/v1/messaging/privacy', write(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const body = request.body && typeof request.body === 'object' && !Array.isArray(request.body) ? request.body as Record<string, unknown> : {}
    try {
      return reply.send(successEnvelope({privacy: await messaging.updatePrivacy(auth.actorId, body)}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to update messaging privacy')
    }
  })

  app.post('/v1/groups', write(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    try {
      const conversation = await messaging.createGroup(auth.actorId, (request.body ?? {}) as Record<string, unknown>)
      toMembers(request, conversation.id, auth.actorId, {type: 'conversation.updated', conversationId: conversation.id, reason: 'membership'})
      return reply.code(201).send(successEnvelope({conversation}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to create group')
    }
  })

  app.get('/v1/groups/:id', read(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      return reply.send(successEnvelope({group: await messaging.getGroup(auth.actorId, id)}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load group')
    }
  })

  app.patch('/v1/groups/:id', write(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      const group = await messaging.updateGroup(auth.actorId, id, (request.body ?? {}) as Record<string, unknown>)
      toMembers(request, id, auth.actorId, {type: 'conversation.updated', conversationId: id, reason: 'group-info'})
      return reply.send(successEnvelope({group}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to update group')
    }
  })

  app.post('/v1/groups/:id/members', write(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      const result = await messaging.addGroupMembers(auth.actorId, id, (request.body ?? {}) as {handles?: unknown})
      toMembers(request, id, auth.actorId, {type: 'conversation.updated', conversationId: id, reason: 'members'})
      hub.publish(result.added, {type: 'conversation.updated', conversationId: id, reason: 'membership'})
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to add members')
    }
  })

  app.delete('/v1/groups/:id/members/:actorId', write(memberParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id, actorId} = request.params as {id: string; actorId: string}
    try {
      const group = await messaging.removeGroupMember(auth.actorId, id, actorId)
      toMembers(request, id, auth.actorId, {type: 'conversation.updated', conversationId: id, reason: 'members'})
      hub.publish([actorId], {type: 'conversation.updated', conversationId: id, reason: 'membership'})
      return reply.send(successEnvelope({group}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to remove member')
    }
  })

  app.post('/v1/groups/:id/members/:actorId/role', write(memberParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id, actorId} = request.params as {id: string; actorId: string}
    try {
      const group = await messaging.setGroupRole(auth.actorId, id, actorId, (request.body ?? {}) as {role?: unknown})
      toMembers(request, id, auth.actorId, {type: 'conversation.updated', conversationId: id, reason: 'members'})
      return reply.send(successEnvelope({group}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to change role')
    }
  })

  app.post('/v1/groups/:id/leave', write(idParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      await messaging.leaveGroup(auth.actorId, id)
      toMembers(request, id, auth.actorId, {type: 'conversation.updated', conversationId: id, reason: 'members'})
      hub.publish([auth.actorId], {type: 'conversation.updated', conversationId: id, reason: 'membership'})
      return reply.send(successEnvelope({ok: true}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to leave group')
    }
  })

  app.get('/v1/conversations/:id/messages/:messageId/reactions', read(messageParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {id, messageId} = request.params as {id: string; messageId: string}
    try {
      return reply.send(successEnvelope(await messaging.reactionDetails(auth.actorId, id, messageId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load reactions')
    }
  })

  app.get('/v1/conversations/:id/messages/:messageId/receipts', read(messageParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {id, messageId} = request.params as {id: string; messageId: string}
    try {
      return reply.send(successEnvelope(await messaging.messageReceipts(auth.actorId, id, messageId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load read receipts')
    }
  })

  app.get('/v1/messages/search', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      return reply.send(successEnvelope(await messaging.searchMessages(auth.actorId, (request.query ?? {}) as Record<string, unknown>), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to search messages')
    }
  })

  app.post('/v1/presence/heartbeat', write(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      await messaging.touchPresence(auth.actorId)
      return reply.send(successEnvelope({ok: true, onlineWindowMs: PRESENCE_ONLINE_MS}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to update presence')
    }
  })

  app.get('/v1/presence', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const q = (request.query ?? {}) as {actorIds?: unknown}
    try {
      return reply.send(successEnvelope(await messaging.presence(auth.actorId, q.actorIds, id => hub.isOnline(id)), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load presence')
    }
  })

  // Realtime socket. Authentication and capability are checked in a route
  // preHandler, which runs after the global auth hook and BEFORE the upgrade
  // is accepted: an unauthenticated client receives 401 instead of a 101
  // handshake. Membership is re-derived from the database for every event.
  if (!app.hasDecorator('websocketServer')) await app.register(websocket, {options: {maxPayload: 8192}})
  const socketAuth = new WeakMap<object, {actorId: string}>()
  app.get('/v1/messaging/socket', {
    ...read(),
    websocket: true,
    preHandler: async (request: any, reply: any) => {
      const auth = requireCapability(request, reply, 'social:read')
      if (!auth) return reply
      if (hub.connectionCount(auth.actorId) >= 5) {
        return reply.code(statusForError('CONFLICT')).send(failureEnvelope('CONFLICT', 'Too many open message sockets', request.id))
      }
      socketAuth.set(request, {actorId: auth.actorId})
    },
  } as any, async (socket: any, request: any) => {
    const auth = socketAuth.get(request)
    if (!auth) { socket.close(4401, 'Authentication required'); return }
    const send = (event: MessagingRealtimeEvent) => socket.send(JSON.stringify(event))
    const unsubscribe = hub.subscribe({actorId: auth.actorId, send})
    if (!unsubscribe) { socket.close(4429, 'Too many open message sockets'); return }
    let lastTouch = 0
    const touch = async (force = false) => {
      const now = Date.now()
      if (!force && now - lastTouch < MESSAGING_SOCKET_HEARTBEAT_MS) return
      lastTouch = now
      await messaging.touchPresence(auth.actorId, new Date(now)).catch(() => undefined)
    }
    const wasOnline = hub.connectionCount(auth.actorId) > 1
    await touch(true)
    if (!wasOnline) {
      publish(request, messaging.presenceRecipients(auth.actorId), {type: 'presence', actorId: auth.actorId, status: 'online', lastActiveAt: new Date().toISOString()})
    }
    send({type: 'hello', actorId: auth.actorId, heartbeatMs: MESSAGING_SOCKET_HEARTBEAT_MS})
    socket.on('message', async (raw: Buffer) => {
      let message: any
      try { message = JSON.parse(raw.toString('utf8')) } catch { send({type: 'error', reason: 'invalid-json'}); return }
      if (message?.type === 'ping') { await touch(); send({type: 'pong'}); return }
      if (message?.type === 'typing' && typeof message.conversationId === 'string' && message.conversationId.length <= 64) {
        const conversationId = message.conversationId
        try {
          if (await messaging.setTyping(auth.actorId, conversationId)) {
            toMembers(request, conversationId, auth.actorId, {type: 'typing', conversationId, actorId: auth.actorId, expiresAt: new Date(Date.now() + TYPING_TTL_MS).toISOString()}, false)
          }
        } catch {
          send({type: 'error', reason: 'not-found'})
        }
        return
      }
      send({type: 'error', reason: 'unsupported'})
    })
    socket.on('close', () => {
      unsubscribe()
      if (!hub.isOnline(auth.actorId)) {
        const at = new Date()
        messaging.touchPresence(auth.actorId, at).catch(() => undefined)
        publish(request, messaging.presenceRecipients(auth.actorId), {type: 'presence', actorId: auth.actorId, status: 'offline', lastActiveAt: at.toISOString()})
      }
    })
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

  return {hub, messaging}
}

/**
 * Best-effort push fan-out for a new direct or group message. Copy follows
 * each recipient's notification preview preference; blocked pairs, muted
 * chats (except @mentions) and pending group invites get nothing.
 */
async function notifyConversationMembers(
  db: ModulaDb,
  messaging: MessagingService,
  senderActorId: string,
  conversationId: string,
  message: MessageDto,
  mentionedActorIds: string[],
): Promise<void> {
  const plan = await messaging.pushPlan(conversationId, senderActorId, message, mentionedActorIds)
  for (const item of plan) {
    await enqueuePush(db, {
      recipientActorId: item.recipientActorId,
      category: 'messages',
      actorId: senderActorId,
      title: item.title,
      body: item.body,
      deepLink: `modula://messages/${conversationId}`,
      threadId: `messages:${conversationId}`,
      data: {conversationId, messageId: message.id, type: item.mention ? 'mention' : 'message', preview: item.preview},
    })
  }
}
