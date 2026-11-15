import type {FastifyInstance} from 'fastify'

import type {ModulaDb} from '../database/client.js'
import {MESSAGING_FEATURES_ALL_ON, type MessagingFeaturesConfig} from '../config/env.js'
import {
  CHAT_FOLDER_ITEMS_MAX,
  CHAT_FOLDERS_MAX,
  CHAT_PINS_MAX,
  CHAT_THEMES,
  DISAPPEARING_TTL_OPTIONS,
  FORWARD_TARGETS_MAX,
  MessagingFeaturesService,
  NOTIFICATION_LEVELS,
  PINNED_MESSAGES_MAX,
  QUICK_REPLIES_MAX,
  SCHEDULE_MAX_LEAD_MS,
  SCHEDULE_MIN_LEAD_MS,
  SCHEDULED_PENDING_MAX,
} from '../domains/messaging/features4.js'
import type {MessagingRealtimeEvent, MessagingRealtimeHub} from '../domains/messaging/realtime-hub.js'
import type {MessageDto} from '../domains/messaging/service.js'
import {requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'

type FeatureKey = Exclude<keyof MessagingFeaturesConfig, 'schedulerIntervalMs'>

/** Capability block merged into GET /v1/messaging/capabilities. */
export function messagingFeaturesCapabilities(features: MessagingFeaturesConfig) {
  const off = {enabled: false}
  return {
    pinnedMessages: features.pinnedMessages ? {enabled: true, max: PINNED_MESSAGES_MAX, groupAdminsOnly: true} : off,
    savedMessages: features.savedMessages ? {enabled: true} : off,
    editHistory: features.editHistory ? {enabled: true} : off,
    scheduledMessages: features.scheduledMessages
      ? {enabled: true, minLeadSeconds: SCHEDULE_MIN_LEAD_MS / 1000, maxLeadDays: Math.round(SCHEDULE_MAX_LEAD_MS / 86_400_000), maxPending: SCHEDULED_PENDING_MAX}
      : off,
    disappearingMessages: features.disappearingMessages ? {enabled: true, ttlOptionsSeconds: [...DISAPPEARING_TTL_OPTIONS]} : off,
    chatFolders: features.chatFolders ? {enabled: true, maxFolders: CHAT_FOLDERS_MAX, maxChatsPerFolder: CHAT_FOLDER_ITEMS_MAX} : off,
    chatPins: features.chatPins ? {enabled: true, max: CHAT_PINS_MAX} : off,
    notificationLevels: features.notificationLevels ? {enabled: true, levels: [...NOTIFICATION_LEVELS]} : off,
    quickReplies: features.quickReplies ? {enabled: true, max: QUICK_REPLIES_MAX} : off,
    forwarding: features.forwarding ? {enabled: true, maxTargets: FORWARD_TARGETS_MAX, kinds: ['text']} : off,
    chatThemes: features.chatThemes ? {enabled: true, themes: [...CHAT_THEMES]} : off,
  }
}

function mapError(reply: any, error: any, requestId: string, fallback: string) {
  const code = error?.code
  if (code === 'VALIDATION_FAILED' || code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'CONFLICT') {
    const details = error?.details?.reason ? {details: {reason: error.details.reason}} : undefined
    return reply.code(statusForError(code)).send(failureEnvelope(code, error.message ?? fallback, requestId, details as any))
  }
  return reply.code(statusForError('SERVER_ERROR')).send(failureEnvelope('SERVER_ERROR', fallback, requestId))
}

const idSchema = {type: 'string', minLength: 1, maxLength: 64}
const params = (...names: string[]) => ({
  schema: {params: {type: 'object', additionalProperties: false, required: names, properties: Object.fromEntries(names.map(n => [n, idSchema]))}},
})

export type MessagingFeaturesHooks = {
  /** Dispatch due scheduled messages once (tests and the interval timer). */
  runScheduledOnce: (onlyId?: string) => Promise<number>
  /** Sweep expired disappearing messages once. */
  sweepExpiredOnce: () => Promise<number>
}

export function registerMessagingFeaturesRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  options: {
    messaging: MessagingFeaturesService
    hub: MessagingRealtimeHub
    features?: Partial<MessagingFeaturesConfig>
    mediaEnabled: boolean
    read: (extra?: Record<string, any>) => Record<string, any>
    write: (extra?: Record<string, any>) => Record<string, any>
    toMembers: (request: any, conversationId: string, actorId: string, event: MessagingRealtimeEvent, includeActor?: boolean) => void
    notify: (senderActorId: string, conversationId: string, message: MessageDto, mentioned: string[]) => Promise<void>
  },
): MessagingFeaturesHooks {
  const {messaging, hub, read, write, toMembers, notify} = options
  const features: MessagingFeaturesConfig = {...MESSAGING_FEATURES_ALL_ON, ...(options.features ?? {})}
  const now = () => new Date().toISOString()
  const disabled = (reply: any, request: any, key: FeatureKey) => {
    if (features[key]) return false
    reply.code(statusForError('CAPABILITY_DISABLED')).send(failureEnvelope('CAPABILITY_DISABLED', 'This messaging feature is not available', request.id))
    return true
  }
  const body = (request: any) => (request.body ?? {}) as Record<string, unknown>
  const sendOpts = (accountId?: string) => ({accountId, mediaEnabled: options.mediaEnabled, disappearingEnabled: features.disappearingMessages})

  // ---- pinned messages -------------------------------------------------------

  const pinRoute = (pinned: boolean) => async (request: any, reply: any) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth || disabled(reply, request, 'pinnedMessages')) return
    const {id, messageId} = request.params as {id: string; messageId: string}
    try {
      const result = await messaging.pinMessage(auth.actorId, id, messageId, pinned)
      if (result.changed) toMembers(request, id, auth.actorId, {type: 'message.pinned', conversationId: id, messageId, pinned, actorId: auth.actorId, at: now()})
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to update pin')
    }
  }
  app.post('/v1/conversations/:id/messages/:messageId/pin', write(params('id', 'messageId')), pinRoute(true))
  app.delete('/v1/conversations/:id/messages/:messageId/pin', write(params('id', 'messageId')), pinRoute(false))
  app.get('/v1/conversations/:id/pins', read(params('id')), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth || disabled(reply, request, 'pinnedMessages')) return
    try {
      return reply.send(successEnvelope(await messaging.listPins(auth.actorId, (request.params as {id: string}).id), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load pinned messages')
    }
  })

  // ---- saved messages --------------------------------------------------------

  const saveRoute = (saved: boolean) => async (request: any, reply: any) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth || disabled(reply, request, 'savedMessages')) return
    const {id, messageId} = request.params as {id: string; messageId: string}
    try {
      const result = await messaging.saveMessage(auth.actorId, id, messageId, saved)
      if (result.changed) hub.publish([auth.actorId], {type: 'message.saved', conversationId: id, messageId, saved, at: now()})
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to update saved message')
    }
  }
  app.put('/v1/conversations/:id/messages/:messageId/saved', write(params('id', 'messageId')), saveRoute(true))
  app.delete('/v1/conversations/:id/messages/:messageId/saved', write(params('id', 'messageId')), saveRoute(false))
  app.get('/v1/messages/saved', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth || disabled(reply, request, 'savedMessages')) return
    const q = request.query as {cursor?: string; limit?: string}
    try {
      return reply.send(successEnvelope(await messaging.listSaved(auth.actorId, q.cursor, q.limit), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load saved messages')
    }
  })

  // ---- edit history ----------------------------------------------------------

  app.get('/v1/conversations/:id/messages/:messageId/edits', read(params('id', 'messageId')), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth || disabled(reply, request, 'editHistory')) return
    const {id, messageId} = request.params as {id: string; messageId: string}
    try {
      return reply.send(successEnvelope(await messaging.editHistory(auth.actorId, id, messageId), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load edit history')
    }
  })

  // ---- scheduled messages ----------------------------------------------------

  let dispatching: Promise<number> | null = null
  const dispatchScheduled = async (onlyId?: string): Promise<number> => {
    const rows = await messaging.claimDue(20, onlyId)
    let sent = 0
    for (const row of rows) {
      try {
        const result = await messaging.sendDetailed(row.sender_actor_id, row.conversation_id, {
          text: row.body, replyToMessageId: row.reply_to_message_id ?? undefined, clientMessageId: `sched-${row.scheduled_id}`,
        }, sendOpts())
        await messaging.finishScheduled(row.scheduled_id, {messageId: result.message.id})
        if (result.created) {
          await notify(row.sender_actor_id, row.conversation_id, result.message, result.mentionedActorIds).catch(() => undefined)
          hub.publish(await messaging.realtimeRecipients(row.conversation_id, row.sender_actor_id, {includeActor: true}), {
            type: 'message.created', conversationId: row.conversation_id, messageId: result.message.id, senderId: row.sender_actor_id,
            kind: result.message.kind ?? 'text', sentAt: result.message.sentAt,
          })
        }
        hub.publish([row.sender_actor_id], {type: 'scheduled.updated', conversationId: row.conversation_id, scheduledId: row.scheduled_id, state: 'sent', messageId: result.message.id})
        sent += 1
      } catch (error: any) {
        // Membership, blocks and request state are re-checked at send time.
        const reason = error?.code === 'NOT_FOUND' ? 'not-member' : error?.code === 'FORBIDDEN' ? 'not-allowed' : error?.code === 'VALIDATION_FAILED' ? 'invalid' : 'server-error'
        await messaging.finishScheduled(row.scheduled_id, {failure: reason}).catch(() => undefined)
        hub.publish([row.sender_actor_id], {type: 'scheduled.updated', conversationId: row.conversation_id, scheduledId: row.scheduled_id, state: 'failed', messageId: null})
      }
    }
    return sent
  }
  const runScheduledOnce = (onlyId?: string) => {
    if (onlyId) return dispatchScheduled(onlyId)
    dispatching ??= dispatchScheduled().finally(() => { dispatching = null })
    return dispatching
  }
  const sweepExpiredOnce = async () => {
    const swept = await messaging.sweepExpired()
    let count = 0
    for (const item of swept) {
      count += item.messageIds.length
      hub.publish(await messaging.realtimeRecipients(item.conversationId, '', {includeActor: true}), {type: 'message.expired', conversationId: item.conversationId, messageIds: item.messageIds})
    }
    return count
  }

  const scheduledRoute = async (request: any, reply: any, fn: (actorId: string) => Promise<any>, fallback: string, status = 200) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth || disabled(reply, request, 'scheduledMessages')) return
    try {
      const result = await fn(auth.actorId)
      if (result?.id && result?.state) {
        hub.publish([auth.actorId], {type: 'scheduled.updated', conversationId: result.conversationId, scheduledId: result.id, state: result.state, messageId: result.sentMessageId ?? null})
      }
      return reply.code(status).send(successEnvelope(result?.id ? {scheduled: result} : result, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, fallback)
    }
  }
  app.post('/v1/conversations/:id/scheduled', write(params('id')), (request, reply) =>
    scheduledRoute(request, reply, actor => messaging.schedule(actor, (request.params as {id: string}).id, body(request)), 'Unable to schedule message', 201))
  app.get('/v1/conversations/:id/scheduled', read(params('id')), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth || disabled(reply, request, 'scheduledMessages')) return
    try {
      return reply.send(successEnvelope(await messaging.listScheduled(auth.actorId, (request.params as {id: string}).id), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load scheduled messages')
    }
  })
  app.get('/v1/messages/scheduled', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth || disabled(reply, request, 'scheduledMessages')) return
    try {
      return reply.send(successEnvelope(await messaging.listScheduled(auth.actorId, null), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load scheduled messages')
    }
  })
  app.patch('/v1/conversations/:id/scheduled/:scheduledId', write(params('id', 'scheduledId')), (request, reply) =>
    scheduledRoute(request, reply, actor => messaging.updateScheduled(actor, (request.params as {scheduledId: string}).scheduledId, body(request)), 'Unable to update scheduled message'))
  app.delete('/v1/conversations/:id/scheduled/:scheduledId', write(params('id', 'scheduledId')), (request, reply) =>
    scheduledRoute(request, reply, actor => messaging.cancelScheduled(actor, (request.params as {scheduledId: string}).scheduledId), 'Unable to cancel scheduled message'))
  app.post('/v1/conversations/:id/scheduled/:scheduledId/send-now', write(params('id', 'scheduledId')), (request, reply) =>
    scheduledRoute(request, reply, async actor => {
      const {scheduledId} = request.params as {scheduledId: string}
      await messaging.makeDueNow(actor, scheduledId)
      await runScheduledOnce(scheduledId)
      return messaging.getScheduled(actor, scheduledId)
    }, 'Unable to send scheduled message'))

  // ---- shared chat settings (disappearing, theme) ---------------------------

  app.post('/v1/conversations/:id/disappearing', write(params('id')), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth || disabled(reply, request, 'disappearingMessages')) return
    const {id} = request.params as {id: string}
    const b = body(request)
    if (!('ttlSeconds' in b)) return reply.code(statusForError('VALIDATION_FAILED')).send(failureEnvelope('VALIDATION_FAILED', 'ttlSeconds is required', request.id))
    try {
      const result = await messaging.setDisappearing(auth.actorId, id, b.ttlSeconds)
      toMembers(request, id, auth.actorId, {type: 'conversation.updated', conversationId: id, reason: 'disappearing'})
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to update disappearing messages')
    }
  })
  app.post('/v1/conversations/:id/theme', write(params('id')), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth || disabled(reply, request, 'chatThemes')) return
    const {id} = request.params as {id: string}
    const b = body(request)
    if (!('theme' in b)) return reply.code(statusForError('VALIDATION_FAILED')).send(failureEnvelope('VALIDATION_FAILED', 'theme is required', request.id))
    try {
      const result = await messaging.setTheme(auth.actorId, id, b.theme)
      toMembers(request, id, auth.actorId, {type: 'conversation.updated', conversationId: id, reason: 'theme'})
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to update theme')
    }
  })

  // ---- per-member settings (chat pins, notification level) -------------------

  app.post('/v1/conversations/:id/pin', write(params('id')), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth || disabled(reply, request, 'chatPins')) return
    const {id} = request.params as {id: string}
    const b = body(request)
    if (b.pinned !== undefined && typeof b.pinned !== 'boolean') return reply.code(statusForError('VALIDATION_FAILED')).send(failureEnvelope('VALIDATION_FAILED', 'pinned must be a boolean', request.id))
    try {
      const result = await messaging.pinChat(auth.actorId, id, b.pinned !== false)
      hub.publish([auth.actorId], {type: 'conversation.updated', conversationId: id, reason: 'pin'})
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to pin chat')
    }
  })
  app.post('/v1/conversations/:id/notifications', write(params('id')), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth || disabled(reply, request, 'notificationLevels')) return
    const {id} = request.params as {id: string}
    try {
      const result = await messaging.setNotificationLevel(auth.actorId, id, body(request).level)
      hub.publish([auth.actorId], {type: 'conversation.updated', conversationId: id, reason: 'notifications'})
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to update notifications')
    }
  })

  // ---- chat folders ----------------------------------------------------------

  const folderRoute = (fn: (actor: string, request: any) => Promise<any>, fallback: string, status = 200) => async (request: any, reply: any) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth || disabled(reply, request, 'chatFolders')) return
    try {
      const result = await fn(auth.actorId, request)
      if (request.method !== 'GET') hub.publish([auth.actorId], {type: 'messaging.folders.updated', at: now()})
      return reply.code(status).send(successEnvelope(result?.id ? {folder: result} : result, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, fallback)
    }
  }
  app.get('/v1/messaging/folders', read(), folderRoute(actor => messaging.listFolders(actor), 'Unable to load folders'))
  app.post('/v1/messaging/folders', write(), folderRoute((actor, request) => messaging.createFolder(actor, body(request)), 'Unable to create folder', 201))
  app.patch('/v1/messaging/folders/:folderId', write(params('folderId')), folderRoute((actor, request) => messaging.updateFolder(actor, request.params.folderId, body(request)), 'Unable to update folder'))
  app.delete('/v1/messaging/folders/:folderId', write(params('folderId')), folderRoute((actor, request) => messaging.deleteFolder(actor, request.params.folderId), 'Unable to delete folder'))

  // ---- quick replies ---------------------------------------------------------

  const quickRoute = (fn: (actor: string, request: any) => Promise<any>, fallback: string, status = 200) => async (request: any, reply: any) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth || disabled(reply, request, 'quickReplies')) return
    try {
      const result = await fn(auth.actorId, request)
      if (request.method !== 'GET') hub.publish([auth.actorId], {type: 'messaging.quick-replies.updated', at: now()})
      return reply.code(status).send(successEnvelope(result?.id ? {quickReply: result} : result, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, fallback)
    }
  }
  app.get('/v1/messaging/quick-replies', read(), quickRoute(actor => messaging.listQuickReplies(actor), 'Unable to load quick replies'))
  app.post('/v1/messaging/quick-replies', write(), quickRoute((actor, request) => messaging.createQuickReply(actor, body(request)), 'Unable to create quick reply', 201))
  app.patch('/v1/messaging/quick-replies/:replyId', write(params('replyId')), quickRoute((actor, request) => messaging.updateQuickReply(actor, request.params.replyId, body(request)), 'Unable to update quick reply'))
  app.delete('/v1/messaging/quick-replies/:replyId', write(params('replyId')), quickRoute((actor, request) => messaging.deleteQuickReply(actor, request.params.replyId), 'Unable to delete quick reply'))

  // ---- forwarding ------------------------------------------------------------

  app.post('/v1/conversations/:id/messages/:messageId/forward', write(params('id', 'messageId')), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth || disabled(reply, request, 'forwarding')) return
    const {id, messageId} = request.params as {id: string; messageId: string}
    try {
      const targets = messaging.parseTargets(body(request).conversationIds, id)
      const source = await messaging.forwardSource(auth.actorId, id, messageId)
      await messaging.assertForwardAllowed(auth.actorId, source.original.actorId)
      const results: {conversationId: string; ok: boolean; message?: MessageDto; error?: {code: string; reason?: string}}[] = []
      for (const target of targets) {
        try {
          const sent = await messaging.sendDetailed(auth.actorId, target, {text: source.text}, {...sendOpts(auth.accountId), forwardedFrom: source.original})
          await notify(auth.actorId, target, sent.message, sent.mentionedActorIds).catch(error => request.log.warn({error: error?.message}, 'forward push enqueue failed'))
          toMembers(request, target, auth.actorId, {
            type: 'message.created', conversationId: target, messageId: sent.message.id, senderId: auth.actorId, kind: 'text', sentAt: sent.message.sentAt,
          })
          results.push({conversationId: target, ok: true, message: sent.message})
        } catch (error: any) {
          const code = ['VALIDATION_FAILED', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT'].includes(error?.code) ? error.code : 'SERVER_ERROR'
          results.push({conversationId: target, ok: false, error: {code, ...(error?.details?.reason ? {reason: error.details.reason} : {})}})
        }
      }
      return reply.send(successEnvelope({results}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to forward message')
    }
  })

  // ---- background work -------------------------------------------------------

  const interval = features.schedulerIntervalMs
  if (interval > 0) {
    const timer = setInterval(() => {
      if (features.scheduledMessages) runScheduledOnce().catch(error => app.log.warn({error: error?.message}, 'scheduled message dispatch failed'))
      sweepExpiredOnce().catch(error => app.log.warn({error: error?.message}, 'disappearing message sweep failed'))
    }, interval)
    timer.unref()
    app.addHook('onClose', async () => clearInterval(timer))
  }
  void db
  return {runScheduledOnce, sweepExpiredOnce}
}
