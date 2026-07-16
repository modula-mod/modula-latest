import {PHASE5_PREVIEW_CAPABILITIES, isModulaHandle} from '@modula/api-contracts'
import {MODULA_PROTOCOL_VERSION} from '@modula/protocol-contracts'
import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {DiscoveryRepository} from '../domains/discovery/repository.js'
import {PostRepository} from '../domains/posts/repository.js'
import {ProfileRepository} from '../domains/profiles/repository.js'
import {checkReadiness} from '../domains/system/health.js'
import {denyWrite} from '../security/writes.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {decodeCursor, parseLimit, toCursorPage} from '../transport/pagination.js'

function sendError(reply: any, code: any, message: string, requestId: string) {
  return reply.code(statusForError(code)).send(failureEnvelope(code, message, requestId))
}

export async function registerRoutes(app: FastifyInstance, db: ModulaDb, config: AppConfig): Promise<void> {
  const profiles = new ProfileRepository(db)
  const posts = new PostRepository(db)
  const discovery = new DiscoveryRepository(db)

  const healthConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 120, timeWindow: '1 minute'}}} : {}
  const feedConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 60, timeWindow: '1 minute'}}} : {}
  const profileConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 120, timeWindow: '1 minute'}}} : {}

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
    return reply.send(
      successEnvelope(
        {
          apiVersion: 'v1' as const,
          protocolVersion: MODULA_PROTOCOL_VERSION,
          environment,
          minimumClientVersion: config.minimumClientVersion,
          capabilities: PHASE5_PREVIEW_CAPABILITIES,
        },
        request.id,
      ),
    )
  })

  app.get('/v1/feed/home', feedConfig, async (request, reply) => {
    try {
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const mode = typeof query.mode === 'string' ? query.mode : 'following'
      const items = await posts.listHome(mode, limit, cursor)
      const page = toCursorPage(items, limit, item => `${item.createdAt}|${item.id}`)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      const code = error?.code === 'VALIDATION_FAILED' ? 'VALIDATION_FAILED' : 'SERVER_ERROR'
      return sendError(reply, code, error?.message ?? 'Failed to load feed', request.id)
    }
  })

  app.get('/v1/posts/:postId', profileConfig, async (request, reply) => {
    const {postId} = request.params as {postId: string}
    const post = await posts.getById(postId)
    if (!post) return sendError(reply, 'NOT_FOUND', 'Post not found', request.id)
    return reply.send(successEnvelope(post, request.id))
  })

  app.get('/v1/profiles/:handle', profileConfig, async (request, reply) => {
    const {handle} = request.params as {handle: string}
    if (!isModulaHandle(handle)) return sendError(reply, 'VALIDATION_FAILED', 'Invalid handle', request.id)
    const profile = await profiles.getByHandle(handle)
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
      const items = await posts.listForHandle(handle, limit, cursor)
      if (!items) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      const page = toCursorPage(items, limit, item => `${item.createdAt}|${item.id}`)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      const code = error?.code === 'VALIDATION_FAILED' ? 'VALIDATION_FAILED' : 'SERVER_ERROR'
      return sendError(reply, code, error?.message ?? 'Failed to load posts', request.id)
    }
  })

  app.get('/v1/profiles/:handle/followers', profileConfig, async (request, reply) => {
    try {
      const {handle} = request.params as {handle: string}
      if (!isModulaHandle(handle)) return sendError(reply, 'VALIDATION_FAILED', 'Invalid handle', request.id)
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const result = await profiles.listFollowers(handle, limit, cursor)
      if (!result) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      const page = toCursorPage(result.items, limit, item => item.id)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      const code = error?.code === 'VALIDATION_FAILED' ? 'VALIDATION_FAILED' : 'SERVER_ERROR'
      return sendError(reply, code, error?.message ?? 'Failed to load followers', request.id)
    }
  })

  app.get('/v1/profiles/:handle/following', profileConfig, async (request, reply) => {
    try {
      const {handle} = request.params as {handle: string}
      if (!isModulaHandle(handle)) return sendError(reply, 'VALIDATION_FAILED', 'Invalid handle', request.id)
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const result = await profiles.listFollowing(handle, limit, cursor)
      if (!result) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      const page = toCursorPage(result.items, limit, item => item.id)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      const code = error?.code === 'VALIDATION_FAILED' ? 'VALIDATION_FAILED' : 'SERVER_ERROR'
      return sendError(reply, code, error?.message ?? 'Failed to load following', request.id)
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

  app.post('/v1/posts', denyWrite)
  app.post('/v1/posts/:postId/like', denyWrite)
  app.delete('/v1/posts/:postId/like', denyWrite)
  app.post('/v1/profiles/:profileId/follow', denyWrite)
  app.delete('/v1/profiles/:profileId/follow', denyWrite)
  app.patch('/v1/profiles/me', denyWrite)
}
