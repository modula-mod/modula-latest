import type {FastifyInstance} from 'fastify'
import websocket from '@fastify/websocket'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import type {GreenfieldSessionService} from '../sessions/service.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import {GubicLobbyHub, type GubicLobbySubscriber} from './lobby-hub.js'
import {GubicPlayService} from './play-service.js'

const KNOWN = new Set(['VALIDATION_FAILED', 'FORBIDDEN', 'CONFLICT', 'NOT_FOUND'])

/**
 * GUBIC play platform routes. Catalogue, install-plan and My Games routes
 * live in modules/routes (GREENFIELD-GUBIC-FOUNDATION-01); this file adds
 * library, sessions, lobbies (+WebSocket), achievements, capabilities and
 * developer submissions. Everything is off unless MODULA_GUBIC_PLAY_ENABLED.
 */
export async function registerGubicPlayRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  sessions: GreenfieldSessionService,
  routeConfig: {profileConfig: Record<string, unknown>; writeConfig: Record<string, unknown>},
  hub = new GubicLobbyHub(),
) {
  if (!config.gubic.playEnabled) return
  const play = new GubicPlayService(db, config, hub)

  const resolve = async (request: any) => {
    const header = request.headers.authorization
    return header?.startsWith('Bearer ') ? sessions.resolveAccess(header.slice(7).trim()) : null
  }
  const send = (reply: any, request: any, error: any, fallback: string) => {
    const code = KNOWN.has(error?.code) ? error.code : 'SERVER_ERROR'
    if (code === 'SERVER_ERROR') request.log.error({err: error}, fallback)
    return reply.code(statusForError(code)).send(failureEnvelope(code, code === 'SERVER_ERROR' ? fallback : error.message, request.id))
  }
  const authed = (fallback: string, handler: (accountId: string, request: any) => Promise<unknown>, created = false) => async (request: any, reply: any) => {
    const auth = await resolve(request)
    if (!auth) return reply.code(401).send(failureEnvelope('UNAUTHENTICATED', 'Authentication required', request.id))
    try {
      return reply.code(created ? 201 : 200).send(successEnvelope(await handler(auth.accountId, request), request.id))
    } catch (error) {
      return send(reply, request, error, fallback)
    }
  }
  const gameParam = (request: any) => resolveCanonicalModuleId(String(request.params.gameId ?? ''))
  const body = (request: any) => (request.body && typeof request.body === 'object' ? request.body : {}) as Record<string, any>

  app.get('/v1/gubic/capabilities', routeConfig.profileConfig, authed('GUBIC capabilities failed', accountId => play.capabilities(accountId)))

  app.get('/v1/gubic/library', routeConfig.profileConfig, authed('GUBIC library failed', accountId => play.library(accountId)))
  app.put('/v1/gubic/library/:gameId', routeConfig.writeConfig, authed('GUBIC library update failed', (accountId, request) => play.upsertLibraryItem(accountId, gameParam(request), body(request))))
  app.delete('/v1/gubic/library/:gameId', routeConfig.writeConfig, authed('GUBIC library removal failed', (accountId, request) => play.removeLibraryItem(accountId, gameParam(request))))

  app.post('/v1/gubic/games/:gameId/sessions', routeConfig.writeConfig, authed('GUBIC session start failed', (accountId, request) => play.startSession(accountId, gameParam(request), body(request)), true))
  app.post('/v1/gubic/sessions/:sessionId/heartbeat', routeConfig.writeConfig, authed('GUBIC heartbeat failed', (accountId, request) => play.heartbeat(accountId, String(request.params.sessionId))))
  app.post('/v1/gubic/sessions/:sessionId/end', routeConfig.writeConfig, authed('GUBIC session end failed', (accountId, request) => play.endSession(accountId, String(request.params.sessionId))))
  app.post('/v1/gubic/sessions/:sessionId/achievements/:key', routeConfig.writeConfig, authed('GUBIC achievement unlock failed', (accountId, request) => play.unlockAchievement(accountId, String(request.params.sessionId), String(request.params.key))))

  app.get('/v1/gubic/games/:gameId/achievements', routeConfig.profileConfig, async (request: any, reply) => {
    const auth = await resolve(request)
    try { return reply.send(successEnvelope(await play.gameAchievements(auth?.accountId ?? null, gameParam(request)), request.id)) }
    catch (error) { return send(reply, request, error, 'GUBIC achievements failed') }
  })
  app.get('/v1/gubic/me/achievements', routeConfig.profileConfig, authed('GUBIC achievements failed', accountId => play.myAchievements(accountId)))

  app.get('/v1/gubic/games/:gameId/lobbies', routeConfig.profileConfig, authed('GUBIC lobby listing failed', (_accountId, request) => play.listLobbies(gameParam(request))))
  app.post('/v1/gubic/games/:gameId/lobbies', routeConfig.writeConfig, authed('GUBIC lobby creation failed', (accountId, request) => play.createLobby(accountId, gameParam(request), body(request)), true))
  app.post('/v1/gubic/lobbies/join', routeConfig.writeConfig, authed('GUBIC lobby join failed', (accountId, request) => play.joinLobby(accountId, {joinCode: body(request).joinCode})))
  app.get('/v1/gubic/lobbies/:lobbyId', routeConfig.profileConfig, authed('GUBIC lobby lookup failed', (accountId, request) => play.getLobby(accountId, String(request.params.lobbyId))))
  app.post('/v1/gubic/lobbies/:lobbyId/join', routeConfig.writeConfig, authed('GUBIC lobby join failed', (accountId, request) => play.joinLobby(accountId, {lobbyId: String(request.params.lobbyId)})))
  app.post('/v1/gubic/lobbies/:lobbyId/leave', routeConfig.writeConfig, authed('GUBIC lobby leave failed', (accountId, request) => play.leaveLobby(accountId, String(request.params.lobbyId))))
  app.post('/v1/gubic/lobbies/:lobbyId/ready', routeConfig.writeConfig, authed('GUBIC lobby ready failed', (accountId, request) => play.setReady(accountId, String(request.params.lobbyId), body(request).ready)))
  app.post('/v1/gubic/lobbies/:lobbyId/start', routeConfig.writeConfig, authed('GUBIC lobby start failed', (accountId, request) => play.startLobby(accountId, String(request.params.lobbyId))))

  // Lobby WebSocket: change notifications + size/rate-limited opaque relay.
  if (!app.hasDecorator('websocketServer')) await app.register(websocket, {options: {maxPayload: 8192}})
  // Authenticate and authorise BEFORE the HTTP upgrade is accepted: replying in
  // preValidation makes @fastify/websocket reject the handshake with that status
  // instead of answering 101 and closing afterwards.
  const socketAuth = new WeakMap<object, {accountId: string}>()
  app.get('/v1/gubic/lobbies/:lobbyId/socket', {
    websocket: true,
    preValidation: async (request: any, reply: any) => {
      const lobbyId = String(request.params.lobbyId ?? '')
      const auth = await resolve(request).catch(() => null)
      if (!auth) return reply.code(401).send(failureEnvelope('UNAUTHENTICATED', 'Authentication required', request.id))
      if (!lobbyId || !(await play.isActiveMember(lobbyId, auth.accountId).catch(() => false))) {
        return reply.code(404).send(failureEnvelope('NOT_FOUND', 'Lobby not found', request.id))
      }
      socketAuth.set(request, {accountId: auth.accountId})
    },
  } as any, async (socket: any, request: any) => {
    const lobbyId = String(request.params.lobbyId ?? '')
    const auth = socketAuth.get(request)
    if (!auth) { socket.close(4401, 'Authentication required'); return }
    const subscriber: GubicLobbySubscriber = {accountId: auth.accountId, send: event => socket.send(JSON.stringify(event))}
    const unsubscribe = hub.subscribe(lobbyId, subscriber)
    socket.send(JSON.stringify({type: 'hello', lobbyId}))
    socket.on('message', async (raw: Buffer) => {
      let message: any
      try { message = JSON.parse(raw.toString('utf8')) } catch { socket.send(JSON.stringify({type: 'error', reason: 'invalid-json'})); return }
      if (message?.type === 'ping') { socket.send(JSON.stringify({type: 'pong'})); return }
      if (message?.type === 'relay') {
        // Membership may have changed since connect.
        if (!(await play.isActiveMember(lobbyId, auth.accountId).catch(() => false))) { socket.close(4403, 'No longer in lobby'); return }
        const result = hub.relay(lobbyId, subscriber, message.payload)
        if (!result.ok) socket.send(JSON.stringify({type: 'error', reason: result.reason}))
        return
      }
      socket.send(JSON.stringify({type: 'error', reason: 'unsupported'}))
    })
    socket.on('close', unsubscribe)
  })

  app.post('/v1/developer/gubic/submissions', routeConfig.writeConfig, authed('GUBIC submission failed', (accountId, request) => play.submit(accountId, body(request)), true))
  app.get('/v1/developer/gubic/submissions', routeConfig.profileConfig, authed('GUBIC submissions failed', (accountId, request) => play.listSubmissions(accountId, String(request.query?.publisherId ?? ''))))
  app.post('/v1/developer/gubic/submissions/:submissionId/withdraw', routeConfig.writeConfig, authed('GUBIC withdraw failed', (accountId, request) => play.withdraw(accountId, String(request.params.submissionId))))
  app.get('/v1/admin/gubic/submissions', routeConfig.profileConfig, authed('GUBIC review queue failed', accountId => play.reviewQueue(accountId)))
  app.post('/v1/admin/gubic/submissions/:submissionId/decision', routeConfig.writeConfig, authed('GUBIC decision failed', (accountId, request) => play.decide(accountId, String(request.params.submissionId), body(request))))
}
