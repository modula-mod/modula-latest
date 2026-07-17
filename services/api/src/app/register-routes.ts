import {
  ADMIN_SESSION_CAPABILITIES,
  PHASE6_PREVIEW_CAPABILITIES,
  PREVIEW_ACTOR_CAPABILITIES,
  isModulaHandle,
  type AtmosphereFeedMode,
  type CreatePostInput,
  type CreateReportInput,
  type SearchType,
  type UpdatePostInput,
} from '@modula/api-contracts'
import {MODULA_PROTOCOL_VERSION} from '@modula/protocol-contracts'
import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {AtprotoService} from '../domains/atproto/service.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {DiscoveryRepository} from '../domains/discovery/repository.js'
import {ModerationRepository} from '../domains/moderation/repository.js'
import {NotificationRepository} from '../domains/notifications/repository.js'
import {PostRepository} from '../domains/posts/repository.js'
import {PostWriteService} from '../domains/posts/writes.js'
import {ProfileRepository} from '../domains/profiles/repository.js'
import {ProfileWriteService} from '../domains/profiles/writes.js'
import {SearchRepository} from '../domains/search/repository.js'
import {checkReadiness} from '../domains/system/health.js'
import {attachAuth, requireAuth, requireCapability} from '../security/auth-context.js'
import {SessionService} from '../security/session.js'
import {assertSafeHttpsUrl, isBlockedIp} from '../security/ssrf.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {decodeCursor, parseLimit, toCursorPage} from '../transport/pagination.js'

function sendError(reply: any, code: any, message: string, requestId: string) {
  return reply.code(statusForError(code)).send(failureEnvelope(code, message, requestId))
}

function mapDomainError(reply: any, error: any, requestId: string, fallback: string) {
  const code = error?.code
  if (
    code === 'VALIDATION_FAILED' ||
    code === 'NOT_FOUND' ||
    code === 'FORBIDDEN' ||
    code === 'CONFLICT' ||
    code === 'UNAUTHENTICATED' ||
    code === 'CAPABILITY_DISABLED'
  ) {
    return sendError(reply, code, error.message ?? fallback, requestId)
  }
  return sendError(reply, 'SERVER_ERROR', fallback, requestId)
}

export async function registerRoutes(app: FastifyInstance, db: ModulaDb, config: AppConfig): Promise<void> {
  const profiles = new ProfileRepository(db)
  const posts = new PostRepository(db)
  const discovery = new DiscoveryRepository(db)
  const sessions = new SessionService(db, config)
  const postWrites = new PostWriteService(db)
  const profileWrites = new ProfileWriteService(db)
  const moderation = new ModerationRepository(db)
  const notifications = new NotificationRepository(db)
  const search = new SearchRepository(db)
  const atproto = new AtprotoService(db, config)

  app.addHook('preHandler', async request => {
    await attachAuth(request, sessions)
  })

  const healthConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 120, timeWindow: '1 minute'}}} : {}
  const feedConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 60, timeWindow: '1 minute'}}} : {}
  const profileConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 120, timeWindow: '1 minute'}}} : {}
  const writeConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 30, timeWindow: '1 minute'}}} : {}

  const mutationsAllowed = config.mutationsEnabled

  app.get('/v1/health/live', healthConfig, async (request, reply) => {
    return reply.send(successEnvelope({status: 'live'}, request.id))
  })

  app.get('/v1/health/ready', healthConfig, async (request, reply) => {
    try {
      const ready = await checkReadiness(db, config)
      if (!ready.ok) {
        return sendError(reply, 'SERVER_ERROR', `API not ready: ${ready.reason}`, request.id)
      }
      return reply.send(successEnvelope({status: 'ready'}, request.id))
    } catch {
      return sendError(reply, 'SERVER_ERROR', 'API not ready', request.id)
    }
  })

  app.get('/v1/meta', healthConfig, async (request, reply) => {
    const environment = config.environment === 'development' ? 'preview' : config.environment
    const capabilities = {
      ...PHASE6_PREVIEW_CAPABILITIES,
      authentication: mutationsAllowed,
      mutations: mutationsAllowed,
      atproto: config.atprotoEnabled,
      atprotoOAuth: config.atprotoEnabled,
      atprotoPublishing: config.atprotoEnabled,
      atprotoImport: config.atprotoEnabled,
      pdsPilot: config.pdsPilotEnabled,
    }
    return reply.send(
      successEnvelope(
        {
          apiVersion: 'v1' as const,
          protocolVersion: MODULA_PROTOCOL_VERSION,
          environment,
          minimumClientVersion: config.minimumClientVersion,
          capabilities,
        },
        request.id,
      ),
    )
  })

  app.get('/oauth/atproto/web-client-metadata.json', async (_request, reply) => {
    return reply.type('application/json').code(200).send(atproto.webClientMetadata())
  })

  app.get('/oauth/atproto/native-client-metadata.json', async (_request, reply) => {
    return reply.type('application/json').code(200).send(atproto.nativeClientMetadata())
  })

  app.post('/v1/auth/preview/session', writeConfig, async (request, reply) => {
    if (!(config.environment === 'development' || config.environment === 'preview' || config.nodeEnv === 'test')) {
      return sendError(reply, 'FORBIDDEN', 'Preview session mint is disabled', request.id)
    }
    if (!mutationsAllowed && config.environment === 'preview') {
      return sendError(reply, 'CAPABILITY_DISABLED', 'Preview writes are disabled', request.id)
    }
    const body = request.body as {handle?: string}
    const handle = body?.handle?.trim()
    if (!handle || !isModulaHandle(handle)) {
      return sendError(reply, 'VALIDATION_FAILED', 'Valid handle required', request.id)
    }
    const profile = await profiles.getByHandle(handle)
    if (!profile) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
    const actor = await db
      .selectFrom('profiles')
      .select('actor_id')
      .where('id', '=', profile.id)
      .executeTakeFirstOrThrow()
    const isAdminHandle = config.adminHandles.includes(handle.toLowerCase())
    const grantedCapabilities = isAdminHandle
      ? Array.from(new Set([...PREVIEW_ACTOR_CAPABILITIES, ...ADMIN_SESSION_CAPABILITIES]))
      : PREVIEW_ACTOR_CAPABILITIES
    const created = await sessions.createSession(actor.actor_id, grantedCapabilities)
    return reply.send(
      successEnvelope(
        {
          accessToken: created.token,
          session: created.session,
        },
        request.id,
      ),
    )
  })

  app.get('/v1/sessions/me', profileConfig, async (request, reply) => {
    const auth = requireAuth(request, reply)
    if (!auth) return
    return reply.send(successEnvelope(auth.session, request.id))
  })

  app.delete('/v1/sessions/me', writeConfig, async (request, reply) => {
    const auth = requireAuth(request, reply)
    if (!auth) return
    await sessions.revokeSession(auth.session.id)
    return reply.send(successEnvelope({revoked: true}, request.id))
  })

  app.get('/v1/feed/home', feedConfig, async (request, reply) => {
    try {
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const mode = typeof query.mode === 'string' ? query.mode : 'following'
      const viewerActorId = request.auth?.actorId ?? null
      const blocked = await moderation.blockedSet(viewerActorId)
      const muted = await moderation.mutedSet(viewerActorId)
      const excluded = Array.from(new Set([...blocked, ...muted]))
      const items = await posts.listHome(mode, limit, cursor, excluded)
      const page = toCursorPage(items, limit, item => `${item.createdAt}|${item.id}`)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load feed')
    }
  })

  app.get('/v1/posts/:postId', profileConfig, async (request, reply) => {
    const {postId} = request.params as {postId: string}
    const post = await posts.getById(postId, request.auth?.actorId ?? null)
    if (!post) return sendError(reply, 'NOT_FOUND', 'Post not found', request.id)
    return reply.send(successEnvelope(post, request.id))
  })

  app.post('/v1/posts', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    try {
      const body = request.body as CreatePostInput
      if ((body as any)?.authorActorId && (body as any).authorActorId !== auth.actorId) {
        return sendError(reply, 'FORBIDDEN', 'Cross-actor create denied', request.id)
      }
      const created = await postWrites.create(auth.actorId, body)
      return reply.code(201).send(successEnvelope(created, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to create post')
    }
  })

  app.patch('/v1/posts/:postId', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:update')
    if (!auth) return
    try {
      const {postId} = request.params as {postId: string}
      const body = request.body as UpdatePostInput
      const updated = await postWrites.update(auth.actorId, postId, body)
      return reply.send(successEnvelope(updated, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to update post')
    }
  })

  app.delete('/v1/posts/:postId', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:delete')
    if (!auth) return
    try {
      const {postId} = request.params as {postId: string}
      await postWrites.delete(auth.actorId, postId)
      return reply.send(successEnvelope({deleted: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to delete post')
    }
  })

  for (const [method, path, kind, enabled] of [
    ['POST', '/v1/posts/:postId/like', 'like', true],
    ['DELETE', '/v1/posts/:postId/like', 'like', false],
    ['POST', '/v1/posts/:postId/save', 'save', true],
    ['DELETE', '/v1/posts/:postId/save', 'save', false],
    ['POST', '/v1/posts/:postId/repost', 'repost', true],
    ['DELETE', '/v1/posts/:postId/repost', 'repost', false],
  ] as const) {
    app.route({
      method,
      url: path,
      ...writeConfig,
      handler: async (request, reply) => {
        if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
        const auth = requireCapability(request, reply, 'post:engage')
        if (!auth) return
        try {
          const {postId} = request.params as {postId: string}
          await postWrites.setEngagement(auth.actorId, postId, kind, enabled)
          return reply.send(successEnvelope({ok: true}, request.id))
        } catch (error: any) {
          return mapDomainError(reply, error, request.id, 'Engagement failed')
        }
      },
    })
  }

  app.get('/v1/profiles/:handle', profileConfig, async (request, reply) => {
    const {handle} = request.params as {handle: string}
    if (!isModulaHandle(handle)) return sendError(reply, 'VALIDATION_FAILED', 'Invalid handle', request.id)
    const profile = await profiles.getByHandle(handle, request.auth?.actorId ?? null)
    if (!profile) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
    return reply.send(successEnvelope(profile, request.id))
  })

  app.get('/v1/profiles/:handle/posts', feedConfig, async (request, reply) => {
    try {
      const {handle} = request.params as {handle: string}
      if (!isModulaHandle(handle)) return sendError(reply, 'VALIDATION_FAILED', 'Invalid handle', request.id)
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const items = await posts.listForHandle(handle, limit, cursor, request.auth?.actorId ?? null)
      if (!items) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      const page = toCursorPage(items, limit, item => `${item.createdAt}|${item.id}`)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load posts')
    }
  })

  app.get('/v1/profiles/:handle/followers', profileConfig, async (request, reply) => {
    try {
      const {handle} = request.params as {handle: string}
      if (!isModulaHandle(handle)) return sendError(reply, 'VALIDATION_FAILED', 'Invalid handle', request.id)
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const result = await profiles.listFollowers(handle, limit, cursor, request.auth?.actorId ?? null)
      if (!result) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      const page = toCursorPage(result.items, limit, item => item.id)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load followers')
    }
  })

  app.get('/v1/profiles/:handle/following', profileConfig, async (request, reply) => {
    try {
      const {handle} = request.params as {handle: string}
      if (!isModulaHandle(handle)) return sendError(reply, 'VALIDATION_FAILED', 'Invalid handle', request.id)
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const result = await profiles.listFollowing(handle, limit, cursor, request.auth?.actorId ?? null)
      if (!result) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      const page = toCursorPage(result.items, limit, item => item.id)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load following')
    }
  })

  app.post('/v1/profiles/:profileId/follow', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:follow')
    if (!auth) return
    try {
      const {profileId} = request.params as {profileId: string}
      await profileWrites.follow(auth.actorId, profileId)
      return reply.send(successEnvelope({following: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Follow failed')
    }
  })

  app.delete('/v1/profiles/:profileId/follow', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:follow')
    if (!auth) return
    try {
      const {profileId} = request.params as {profileId: string}
      await profileWrites.unfollow(auth.actorId, profileId)
      return reply.send(successEnvelope({following: false}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Unfollow failed')
    }
  })

  app.patch('/v1/profiles/me', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'profile:update')
    if (!auth) return
    try {
      const body = request.body as {displayName?: string; bio?: string; expectedVersion?: number; actorId?: string}
      if (body.actorId && body.actorId !== auth.actorId) {
        return sendError(reply, 'FORBIDDEN', 'Cross-actor profile edit denied', request.id)
      }
      const updated = await profileWrites.updateMe(auth.actorId, body)
      return reply.send(successEnvelope(updated, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Profile update failed')
    }
  })

  app.post('/v1/profiles/:profileId/block', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:block')
    if (!auth) return
    try {
      const {profileId} = request.params as {profileId: string}
      const actorId = await profileWrites.actorIdForProfileId(profileId)
      if (!actorId) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      await moderation.block(auth.actorId, actorId)
      return reply.send(successEnvelope({blocked: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Block failed')
    }
  })

  app.delete('/v1/profiles/:profileId/block', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:block')
    if (!auth) return
    try {
      const {profileId} = request.params as {profileId: string}
      const actorId = await profileWrites.actorIdForProfileId(profileId)
      if (!actorId) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      await moderation.unblock(auth.actorId, actorId)
      return reply.send(successEnvelope({blocked: false}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Unblock failed')
    }
  })

  app.post('/v1/profiles/:profileId/mute', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:mute')
    if (!auth) return
    try {
      const {profileId} = request.params as {profileId: string}
      const actorId = await profileWrites.actorIdForProfileId(profileId)
      if (!actorId) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      await moderation.mute(auth.actorId, actorId)
      return reply.send(successEnvelope({muted: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Mute failed')
    }
  })

  app.delete('/v1/profiles/:profileId/mute', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:mute')
    if (!auth) return
    try {
      const {profileId} = request.params as {profileId: string}
      const actorId = await profileWrites.actorIdForProfileId(profileId)
      if (!actorId) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      await moderation.unmute(auth.actorId, actorId)
      return reply.send(successEnvelope({muted: false}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Unmute failed')
    }
  })

  app.post('/v1/reports', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'report:create')
    if (!auth) return
    try {
      const body = request.body as CreateReportInput
      const report = await moderation.createReport(auth.actorId, body)
      return reply.code(201).send(successEnvelope(report, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Report failed')
    }
  })

  app.get('/v1/notifications', feedConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const items = await notifications.listForActor(auth.actorId, limit, cursor)
      const page = toCursorPage(items, limit, item => `${item.createdAt}|${item.id}`)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load notifications')
    }
  })

  app.post('/v1/notifications/:notificationId/read', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {notificationId} = request.params as {notificationId: string}
    const ok = await notifications.markRead(auth.actorId, notificationId)
    if (!ok) return sendError(reply, 'NOT_FOUND', 'Notification not found', request.id)
    return reply.send(successEnvelope({read: true}, request.id))
  })

  app.post('/v1/notifications/read-all', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const count = await notifications.markAllRead(auth.actorId)
    return reply.send(successEnvelope({updated: count}, request.id))
  })

  app.get('/v1/search', feedConfig, async (request, reply) => {
    try {
      const query = request.query as Record<string, unknown>
      const q = typeof query.q === 'string' ? query.q : ''
      const type = (typeof query.type === 'string' ? query.type : 'all') as SearchType
      const limit = parseLimit(query.limit)
      const data = await search.search({
        q,
        type,
        limit,
        viewerActorId: request.auth?.actorId ?? null,
      })
      return reply.send(successEnvelope(data, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Search failed')
    }
  })

  app.get('/v1/discover', feedConfig, async (request, reply) => {
    const data = await discovery.getDiscover()
    return reply.send(successEnvelope(data, request.id))
  })

  app.get('/v1/activity', feedConfig, async (request, reply) => {
    const data = await discovery.listActivity()
    return reply.send(successEnvelope(data, request.id))
  })

  app.get('/v1/reels', feedConfig, async (request, reply) => {
    const data = await discovery.listReels()
    return reply.send(successEnvelope(data, request.id))
  })

  app.get('/v1/atproto/connections', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'atproto:connect')
    if (!auth) return
    const connections = await atproto.listConnections(auth.actorId)
    return reply.send(successEnvelope({items: connections}, request.id))
  })

  app.post('/v1/atproto/oauth/start', writeConfig, async (request, reply) => {
    if (!config.atprotoEnabled) return sendError(reply, 'CAPABILITY_DISABLED', 'AT Proto disabled', request.id)
    const auth = requireCapability(request, reply, 'atproto:connect')
    if (!auth) return
    try {
      const body = request.body as {
        clientKind?: 'web' | 'native'
        returnRoute?: string
        requestScope?: 'atproto' | 'publish'
        handle?: string
      }
      const started = await atproto.startOAuth({
        actorId: auth.actorId,
        sessionId: auth.session.id,
        clientKind: body.clientKind === 'native' ? 'native' : 'web',
        returnRoute: body.returnRoute ?? '/settings/connections/atproto',
        requestScope: body.requestScope === 'publish' ? 'publish' : 'atproto',
        handle: body.handle,
      })
      return reply.send(successEnvelope(started, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'OAuth start failed')
    }
  })

  app.get('/v1/atproto/oauth/callback', writeConfig, async (request, reply) => {
    if (!config.atprotoEnabled) return sendError(reply, 'CAPABILITY_DISABLED', 'AT Proto disabled', request.id)
    const auth = requireCapability(request, reply, 'atproto:connect')
    if (!auth) return
    try {
      const query = request.query as Record<string, string>
      const state = query.state
      if (!state) return sendError(reply, 'VALIDATION_FAILED', 'state required', request.id)
      // Preview completion path for disposable test identities (no provider tokens returned).
      if (config.environment !== 'production' && query.preview === '1') {
        const pdsUrl = query.pdsUrl || 'https://bsky.social'
        await assertSafeHttpsUrl(pdsUrl)
        const connection = await atproto.completePreviewOAuth({
          actorId: auth.actorId,
          sessionId: auth.session.id,
          state,
          did: query.did || `did:plc:preview${auth.actorId.replace(/[^a-z0-9]/gi, '').slice(0, 16)}`,
          handle: query.handle || 'preview.modula.test',
          pdsUrl,
        })
        return reply.send(successEnvelope({connection}, request.id))
      }
      const consumed = await atproto.consumeOAuthState({
        state,
        actorId: auth.actorId,
        sessionId: auth.session.id,
      })
      return reply.send(successEnvelope({returnRoute: consumed.returnRoute, status: 'pending_provider'}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'OAuth callback failed')
    }
  })

  app.post('/v1/atproto/connections/:connectionId/disconnect', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'atproto:connect')
    if (!auth) return
    try {
      const {connectionId} = request.params as {connectionId: string}
      await atproto.disconnect(auth.actorId, connectionId)
      return reply.send(successEnvelope({disconnected: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Disconnect failed')
    }
  })

  app.post('/v1/atproto/connections/:connectionId/refresh', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'atproto:connect')
    if (!auth) return
    const {connectionId} = request.params as {connectionId: string}
    const connection = await atproto.getConnection(auth.actorId, connectionId)
    if (!connection) return sendError(reply, 'NOT_FOUND', 'Connection not found', request.id)
    if (connection.status === 'revoked' || connection.status === 'disconnected') {
      return sendError(reply, 'FORBIDDEN', 'Connection is not refreshable', request.id)
    }
    return reply.send(successEnvelope({connection, refreshed: true}, request.id))
  })

  app.get('/v1/atproto/connections/:connectionId/status', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'atproto:connect')
    if (!auth) return
    const {connectionId} = request.params as {connectionId: string}
    const connection = await atproto.getConnection(auth.actorId, connectionId)
    if (!connection) return sendError(reply, 'NOT_FOUND', 'Connection not found', request.id)
    return reply.send(successEnvelope(connection, request.id))
  })

  app.get('/v1/atproto/preferences', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'atproto:publish')
    if (!auth) return
    const prefs = await atproto.getPreferences(auth.actorId)
    return reply.send(successEnvelope(prefs, request.id))
  })

  app.patch('/v1/atproto/preferences', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'atproto:publish')
    if (!auth) return
    const prefs = await atproto.updatePreferences(auth.actorId, request.body as any)
    return reply.send(successEnvelope(prefs, request.id))
  })

  app.get('/v1/atproto/feed', feedConfig, async (request, reply) => {
    const query = request.query as Record<string, unknown>
    const mode = (typeof query.mode === 'string' ? query.mode : 'modula-network') as AtmosphereFeedMode
    const limit = parseLimit(query.limit)
    const items = await atproto.atmosphereFeed(mode, limit)
    return reply.send(
      successEnvelope(
        {
          label: 'Atmosphere Preview',
          mode,
          items,
        },
        request.id,
      ),
    )
  })

  async function setOperationalControl(key: string, value: unknown, updatedBy: string): Promise<void> {
    await db
      .insertInto('operational_controls')
      .values({key, value, updated_at: new Date(), updated_by: updatedBy})
      .onConflict(oc => oc.column('key').doUpdateSet({value, updated_at: new Date(), updated_by: updatedBy}))
      .execute()
  }

  app.post('/v1/admin/ops/atproto/publish', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    const body = request.body as {enabled?: boolean}
    await setOperationalControl('atproto.publish.enabled', Boolean(body.enabled), auth.actorId)
    return reply.send(successEnvelope({atprotoPublishEnabled: Boolean(body.enabled)}, request.id))
  })

  app.post('/v1/admin/ops/atproto/ingest', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    const body = request.body as {paused?: boolean}
    await setOperationalControl('atproto.ingest.paused', Boolean(body.paused), auth.actorId)
    return reply.send(successEnvelope({atprotoIngestPaused: Boolean(body.paused)}, request.id))
  })

  app.post('/v1/admin/ops/atproto/connections/:connectionId/revoke', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    try {
      const {connectionId} = request.params as {connectionId: string}
      await atproto.adminRevokeConnection(connectionId, auth.actorId)
      return reply.send(successEnvelope({revoked: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to revoke connection')
    }
  })

  app.post('/v1/admin/ops/queue/drain', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    const body = request.body as {drained?: boolean}
    await setOperationalControl('jobs.queue.drained', Boolean(body.drained), auth.actorId)
    return reply.send(successEnvelope({queueDrained: Boolean(body.drained)}, request.id))
  })

  app.post('/v1/admin/ops/queue/dead-letters/:deadLetterId/retry', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    const {deadLetterId} = request.params as {deadLetterId: string}
    try {
      const requeued = await db.transaction().execute(async trx => {
        const deadLetter = await trx
          .selectFrom('atproto_dead_letters')
          .selectAll()
          .where('id', '=', deadLetterId)
          .where('resolved_at', 'is', null)
          .executeTakeFirst()
        if (!deadLetter) throw Object.assign(new Error('Dead letter not found'), {code: 'NOT_FOUND'})
        const now = new Date()
        const jobId = `job-${deadLetterId}-retry-${now.getTime()}`
        await trx
          .insertInto('background_jobs')
          .values({
            id: jobId,
            job_type: deadLetter.source,
            payload: deadLetter.payload,
            status: 'pending',
            priority: 100,
            available_at: now,
            lease_owner: null,
            lease_expires_at: null,
            attempt_count: 0,
            maximum_attempts: 5,
            last_error: null,
            created_at: now,
            updated_at: now,
            completed_at: null,
          })
          .execute()
        await trx.updateTable('atproto_dead_letters').set({resolved_at: now}).where('id', '=', deadLetterId).execute()
        await new AuditRepository(trx).append('admin.queue.dead_letter.retried', {deadLetterId, jobId}, {type: 'job', id: jobId, actorId: auth.actorId})
        return jobId
      })
      return reply.send(successEnvelope({jobId: requeued}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to retry dead letter')
    }
  })

  app.post('/v1/admin/ops/atproto/lexicons/:collection/disable', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    const {collection} = request.params as {collection: string}
    const body = request.body as {disabled?: boolean}
    await setOperationalControl(`atproto.lexicon.${collection}.disabled`, Boolean(body.disabled), auth.actorId)
    return reply.send(successEnvelope({collection, disabled: Boolean(body.disabled)}, request.id))
  })

  // SSRF helper exposed only in tests via internal assert
  app.get('/v1/internal/ssrf-check', async (request, reply) => {
    if (config.nodeEnv !== 'test' && config.environment !== 'development') {
      return sendError(reply, 'NOT_FOUND', 'Not found', request.id)
    }
    const query = request.query as {url?: string; ip?: string}
    if (query.ip) {
      return reply.send(successEnvelope({blocked: isBlockedIp(query.ip)}, request.id))
    }
    try {
      await assertSafeHttpsUrl(query.url ?? '')
      return reply.send(successEnvelope({safe: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Unsafe URL')
    }
  })
}
