import type {FastifyInstance} from 'fastify'
import websocket from '@fastify/websocket'

import type {CallsConfig} from '../config/env.js'
import type {ModulaDb} from '../database/client.js'
import {
  CALL_NEGOTIATION_TIMEOUT_MS,
  CALL_RECONNECT_GRACE_MS,
  CALL_RING_TIMEOUT_MS,
  CALL_SIGNALLING_AUTH_RECHECK_MS,
  CALL_SIGNALLING_HEARTBEAT_MS,
  CALL_SIGNALLING_PROTOCOL_VERSION,
  CALL_SIGNALLING_STALE_MS,
  CALL_TICKET_TTL_MS,
  isTerminal,
} from '../domains/calls/policy.js'
import {CallError, CallsService, type CallActor, type CallTransition} from '../domains/calls/service.js'
import {CallSignallingHub, FrameRateLimiter, isRelayType, parseClientFrame} from '../domains/calls/signalling-hub.js'
import type {MessagingRealtimeHub} from '../domains/messaging/realtime-hub.js'
import {requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'

/** Lets routes registered earlier (block) end live calls once calls are wired. */
export type CallPolicyHooks = {onBlock?: (a: string, b: string) => Promise<void>}

const CALL_ID = {type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'}
const callParams = {schema: {params: {type: 'object', additionalProperties: false, required: ['callId'], properties: {callId: CALL_ID}}}}
const conversationParams = {schema: {params: {type: 'object', additionalProperties: false, required: ['id'], properties: {id: {type: 'string', minLength: 1, maxLength: 64}}}}}
const registrationParams = {schema: {params: {type: 'object', additionalProperties: false, required: ['registrationId'], properties: {registrationId: {type: 'string', minLength: 1, maxLength: 64}}}}}

/** Capability block advertised in GET /v1/messaging/capabilities. Off unless every prerequisite is configured. */
export function callsCapabilities(config: CallsConfig) {
  return {
    enabled: config.enabled,
    audio: config.enabled,
    video: config.enabled,
    voipPush: config.enabled && config.voipTokenKey !== null,
    maxParticipants: 2,
    ringTimeoutMs: CALL_RING_TIMEOUT_MS,
    negotiationTimeoutMs: CALL_NEGOTIATION_TIMEOUT_MS,
    reconnectGraceMs: CALL_RECONNECT_GRACE_MS,
    signallingProtocolVersion: CALL_SIGNALLING_PROTOCOL_VERSION,
    singleInstance: true,
  }
}

function sendCallError(reply: any, error: unknown, requestId: string, fallback: string) {
  if (error instanceof CallError) {
    const details: Record<string, unknown> = {}
    if (error.reason) details.reason = error.reason
    if (error.details.call) details.call = error.details.call
    if (typeof error.details.revision === 'number') details.revision = error.details.revision
    if (typeof error.details.version === 'number') details.version = error.details.version
    return reply.code(statusForError(error.code)).send(failureEnvelope(error.code, error.message, requestId, {
      details, retryable: error.code === 'RATE_LIMITED' || error.code === 'CAPABILITY_UNAVAILABLE',
    }))
  }
  const code = (error as any)?.code
  if (code === 'VALIDATION_FAILED' || code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'CONFLICT') {
    return reply.code(statusForError(code)).send(failureEnvelope(code, (error as any).message ?? fallback, requestId))
  }
  return reply.code(statusForError('SERVER_ERROR')).send(failureEnvelope('SERVER_ERROR', fallback, requestId))
}

function bearer(header: unknown): string | null {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length).trim() || null
}

/**
 * 1:1 voice and video calls (CALLS-ARCHITECTURE.md). HTTP is the command and
 * recovery boundary; the per-call WebSocket carries SDP/ICE relay and media
 * reports. Every route requires an authenticated actor and re-derives call
 * membership, blocks and state on each request.
 */
export async function registerCallsRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  options: {
    config: CallsConfig
    feedConfig: Record<string, any>
    writeConfig: Record<string, any>
    publicApiUrl: string
    bundleId: string
    messagingHub: MessagingRealtimeHub
    hooks?: CallPolicyHooks
  },
): Promise<{calls: CallsService; signalling: CallSignallingHub}> {
  const calls = new CallsService(db, options.config, {publicApiUrl: options.publicApiUrl, bundleId: options.bundleId})
  const signalling = new CallSignallingHub()
  const {feedConfig, writeConfig, messagingHub} = options
  const read = (extra: Record<string, any> = {}) => ({...feedConfig, ...extra})
  const write = (extra: Record<string, any> = {}) => ({...writeConfig, ...extra})
  const actorOf = (auth: {actorId: string; sessionId: string; accountId: string}): CallActor => ({actorId: auth.actorId, sessionId: auth.sessionId, accountId: auth.accountId})
  const key = (request: any) => request.headers['idempotency-key']

  /** Fan a committed transition out to both participants' messaging sockets and the call's signalling sockets. */
  const publish = (log: any, transition: CallTransition | null | undefined) => {
    if (!transition) return
    const {call} = transition
    const participants = [call.initiator_actor_id, call.recipient_actor_id]
    messagingHub.publish(participants, {
      type: 'call.updated', callId: call.call_id, conversationId: call.conversation_id, state: call.state,
      revision: call.revision, mediaKind: call.media_kind, initiatorActorId: call.initiator_actor_id,
      event: transition.eventType, terminalReason: call.terminal_reason,
    })
    void (async () => {
      const dtos = new Map(await Promise.all(participants.map(async id => [id, await calls.dtoFor(call, id)] as const)))
      signalling.broadcast(call.call_id, actorId => {
        const snapshot = dtos.get(actorId)
        if (!snapshot) return null
        if (transition.eventType === 'accepted') return {type: 'call.accepted', payload: {call: snapshot}}
        if (transition.eventType === 'media_disconnected') {
          const owner = [call.initiator_actor_id, call.recipient_actor_id].sort()[0]
          return {type: 'media.reconnect_required', payload: {call: snapshot, ownerActorId: owner, deadlineAt: call.state_deadline_at?.toISOString() ?? null}}
        }
        if (isTerminal(call.state)) return {type: `call.${call.state}`, payload: {call: snapshot, reason: call.terminal_reason}}
        return {type: 'call.snapshot', payload: {call: snapshot}}
      })
      if (isTerminal(call.state)) signalling.closeCall(call.call_id, 1000, 'Call ended')
    })().catch(error => log.warn({error: error?.message, callId: call.call_id}, 'call publish failed'))
  }
  const publishAll = (log: any, transitions: CallTransition[]) => { for (const t of transitions) publish(log, t) }

  if (options.hooks) {
    options.hooks.onBlock = async (a, b) => {
      if (!calls.enabled) return
      publishAll(app.log, await calls.endForBlock(a, b))
    }
  }

  if (calls.enabled) {
    const timer = setInterval(() => {
      calls.sweepDeadlines().then(t => publishAll(app.log, t)).catch(error => app.log.warn({error: error?.message}, 'call deadline sweep failed'))
    }, 2_000)
    timer.unref()
    app.addHook('onClose', async () => clearInterval(timer))
  } else {
    app.log.info({reason: options.config.disabledReason}, 'calls disabled')
  }

  // ---- lifecycle -------------------------------------------------------------------------

  app.post('/v1/conversations/:id/calls', write(conversationParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {id} = request.params as {id: string}
    try {
      const result = await calls.start(actorOf(auth), id, request.body, key(request), request.id)
      publish(request.log, result.transition)
      const status = result.replay || result.glare ? 200 : 201
      return reply.code(status).send(successEnvelope({call: result.call, replay: result.replay, glare: result.glare}, request.id))
    } catch (error) {
      return sendCallError(reply, error, request.id, 'Unable to start call')
    }
  })

  app.get('/v1/calls/:callId', read(callParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {callId} = request.params as {callId: string}
    try {
      const result = await calls.snapshot(actorOf(auth), callId)
      publish(request.log, result.expired)
      return reply.send(successEnvelope({call: result.call}, request.id))
    } catch (error) {
      return sendCallError(reply, error, request.id, 'Unable to load call')
    }
  })

  app.get('/v1/me/calls', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      return reply.send(successEnvelope(await calls.history(actorOf(auth), (request.query ?? {}) as Record<string, unknown>), request.id))
    } catch (error) {
      return sendCallError(reply, error, request.id, 'Unable to load call history')
    }
  })

  for (const command of ['accept', 'decline', 'cancel', 'end'] as const) {
    app.post(`/v1/calls/:callId/${command}`, write(callParams), async (request, reply) => {
      const auth = requireCapability(request, reply, 'post:engage')
      if (!auth) return
      const {callId} = request.params as {callId: string}
      try {
        const result = await calls.command(actorOf(auth), callId, command, request.body, key(request), request.id)
        publish(request.log, result.expired)
        publish(request.log, result.transition)
        return reply.send(successEnvelope({call: result.call, replay: result.replay}, request.id))
      } catch (error) {
        publish(request.log, CallsService.expiredFrom(error))
        return sendCallError(reply, error, request.id, `Unable to ${command} call`)
      }
    })
  }

  app.post('/v1/calls/:callId/signalling-ticket', write(callParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {callId} = request.params as {callId: string}
    try {
      return reply.code(201).send(successEnvelope(await calls.issueTicket(actorOf(auth), callId, request.body), request.id))
    } catch (error) {
      return sendCallError(reply, error, request.id, 'Unable to issue signalling ticket')
    }
  })

  app.post('/v1/calls/:callId/media-credentials', write(callParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {callId} = request.params as {callId: string}
    try {
      const body = request.body
      if (body !== undefined && body !== null && (typeof body !== 'object' || Object.keys(body as object).length > 0)) {
        throw new CallError('VALIDATION_FAILED', 'This route takes no body fields')
      }
      reply.header('cache-control', 'no-store')
      return reply.send(successEnvelope(await calls.mediaCredentials(actorOf(auth), callId), request.id))
    } catch (error) {
      return sendCallError(reply, error, request.id, 'Unable to issue media credentials')
    }
  })

  // ---- settings and VoIP registrations ---------------------------------------------------

  app.get('/v1/me/call-settings', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      return reply.send(successEnvelope({settings: await calls.getSettings(actorOf(auth))}, request.id))
    } catch (error) {
      return sendCallError(reply, error, request.id, 'Unable to load call settings')
    }
  })

  app.patch('/v1/me/call-settings', write(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    try {
      return reply.send(successEnvelope({settings: await calls.updateSettings(actorOf(auth), request.body)}, request.id))
    } catch (error) {
      return sendCallError(reply, error, request.id, 'Unable to update call settings')
    }
  })

  app.post('/v1/push/voip-devices', write(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    try {
      return reply.code(201).send(successEnvelope({registration: await calls.registerVoip(actorOf(auth), request.body)}, request.id))
    } catch (error) {
      return sendCallError(reply, error, request.id, 'Unable to register VoIP device')
    }
  })

  app.get('/v1/push/voip-devices', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      return reply.send(successEnvelope({items: await calls.listVoip(actorOf(auth))}, request.id))
    } catch (error) {
      return sendCallError(reply, error, request.id, 'Unable to list VoIP devices')
    }
  })

  app.delete('/v1/push/voip-devices/:registrationId', write(registrationParams), async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const {registrationId} = request.params as {registrationId: string}
    try {
      await calls.deleteVoip(actorOf(auth), registrationId)
      return reply.send(successEnvelope({removed: true}, request.id))
    } catch (error) {
      return sendCallError(reply, error, request.id, 'Unable to remove VoIP device')
    }
  })

  // ---- signalling socket -------------------------------------------------------------------
  // The single-use ticket from POST /signalling-ticket travels in the
  // Authorization header. The route preHandler consumes it BEFORE the upgrade
  // is accepted: a missing, unknown, expired, revoked or replayed ticket gets
  // HTTP 401 and never a 101 handshake.
  if (!app.hasDecorator('websocketServer')) await app.register(websocket, {options: {maxPayload: 72 * 1024}})
  const bindings = new WeakMap<object, {actorId: string; sessionId: string}>()
  app.get('/v1/calls/:callId/signalling', {
    ...read(callParams),
    websocket: true,
    preHandler: async (request: any, reply: any) => {
      const {callId} = request.params as {callId: string}
      const ticket = bearer(request.headers.authorization)
      const binding = ticket ? await calls.consumeTicket(ticket, callId).catch(() => null) : null
      if (!binding) {
        return reply.code(statusForError('UNAUTHENTICATED')).send(failureEnvelope('UNAUTHENTICATED', 'A valid signalling ticket is required', request.id))
      }
      bindings.set(request, {actorId: binding.actorId, sessionId: binding.sessionId})
    },
  } as any, async (socket: any, request: any) => {
    const binding = bindings.get(request)
    const {callId} = request.params as {callId: string}
    if (!binding) { socket.close(4401, 'Authentication required'); return }
    const {actorId, sessionId} = binding
    const send = (frame: Record<string, unknown>) => socket.send(JSON.stringify(frame))
    const leave = signalling.join(callId, {actorId, sessionId, send, close: (code, reason) => socket.close(code, reason)})
    const limiter = new FrameRateLimiter()
    let lastFrameAt = Date.now()
    let closed = false
    const errorFrame = (code: string, messageId?: string) => send({
      protocolVersion: CALL_SIGNALLING_PROTOCOL_VERSION, type: 'error', callId, sentAt: new Date().toISOString(),
      payload: {code, messageId: messageId ?? null, retryable: false},
    })
    const ack = (messageId: string, extra: Record<string, unknown> = {}) => send({
      protocolVersion: CALL_SIGNALLING_PROTOCOL_VERSION, type: 'server.ack', callId, sentAt: new Date().toISOString(),
      payload: {messageId, ...extra},
    })
    const stale = setInterval(() => {
      if (Date.now() - lastFrameAt > CALL_SIGNALLING_STALE_MS) socket.close(4408, 'Signalling heartbeat expired')
    }, CALL_SIGNALLING_HEARTBEAT_MS)
    const recheck = setInterval(() => {
      calls.stillAuthorized(actorId, callId)
        .then(ok => { if (!ok) socket.close(4403, 'Call no longer authorized') })
        .catch(() => undefined)
    }, CALL_SIGNALLING_AUTH_RECHECK_MS)
    stale.unref(); recheck.unref()

    const snapshot = await calls.socketSnapshot(actorId, sessionId, callId)
    send({
      protocolVersion: CALL_SIGNALLING_PROTOCOL_VERSION, type: 'server.ready', callId, sentAt: new Date().toISOString(),
      payload: {actorId, heartbeatMs: CALL_SIGNALLING_HEARTBEAT_MS, ticketTtlMs: CALL_TICKET_TTL_MS, call: snapshot},
    })

    socket.on('message', async (raw: Buffer) => {
      lastFrameAt = Date.now()
      if (!limiter.take()) { socket.close(4429, 'Too many frames'); return }
      const frame = parseClientFrame(raw, callId)
      if ('error' in frame) { errorFrame(frame.error); return }
      if (frame.type === 'ping') {
        send({protocolVersion: CALL_SIGNALLING_PROTOCOL_VERSION, type: 'pong', callId, sentAt: new Date().toISOString(), payload: {serverTime: new Date().toISOString()}})
        return
      }
      if (!signalling.firstSeen(callId, actorId, frame.messageId)) { ack(frame.messageId, {duplicate: true}); return }
      try {
        if (frame.type === 'client.ready') {
          send({protocolVersion: CALL_SIGNALLING_PROTOCOL_VERSION, type: 'call.snapshot', callId, sentAt: new Date().toISOString(),
            payload: {call: await calls.socketSnapshot(actorId, sessionId, callId)}})
          return
        }
        const current = await calls.socketSnapshot(actorId, sessionId, callId)
        if (!current || isTerminal(current.state)) { errorFrame('CALL_ALREADY_TERMINAL', frame.messageId); return }
        if (isRelayType(frame.type)) {
          if (current.state === 'ringing') { errorFrame('CALL_NOT_ACCEPTED', frame.messageId); return }
          if (current.direction === 'incoming' && current.answeredHere === false) { errorFrame('CALL_ALREADY_ANSWERED', frame.messageId); return }
          if (frame.type === 'signal.offer') {
            const owner = current.state === 'reconnecting'
              ? [current.initiatorActorId, current.recipientActorId].sort()[0]
              : current.initiatorActorId
            if (owner !== actorId) { errorFrame('SIGNALLING_GLARE', frame.messageId); return }
          }
          if (frame.type === 'signal.ice_candidate' && !signalling.allowCandidate(callId, actorId, frame.negotiationId!)) {
            errorFrame('TOO_MANY_CANDIDATES', frame.messageId); return
          }
          ack(frame.messageId, {relayed: signalling.relay(callId, actorId, frame)})
          return
        }
        if (frame.type === 'media.connected' || frame.type === 'media.disconnected' || frame.type === 'media.reconnect_started') {
          const type = frame.type === 'media.connected' ? 'connected' : frame.type === 'media.disconnected' ? 'disconnected' : 'reconnect_started'
          publish(request.log, await calls.reportMedia({actorId, sessionId}, callId, {type, negotiationId: frame.negotiationId!}))
          ack(frame.messageId)
          return
        }
        if (frame.type === 'call.end') {
          const result = await calls.command({actorId, sessionId, accountId: ''}, callId, 'end',
            {reason: frame.payload.reason ?? 'user_action'}, frame.payload.idempotencyKey, request.id)
          publish(request.log, result.expired)
          publish(request.log, result.transition)
          ack(frame.messageId)
        }
      } catch (error) {
        publish(request.log, CallsService.expiredFrom(error))
        errorFrame(error instanceof CallError ? (error.reason ?? error.code) : 'SERVER_ERROR', frame.messageId)
      }
    })
    socket.on('close', () => {
      if (closed) return
      closed = true
      clearInterval(stale); clearInterval(recheck)
      leave()
      // Signalling loss alone does not end the call: media may still be flowing.
    })
  })

  return {calls, signalling}
}
