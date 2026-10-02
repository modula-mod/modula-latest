import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import type {GreenfieldSessionService} from '../sessions/service.js'
import {collectPublicStatus} from '../domains/system/status.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {GreenfieldSupportService} from './service.js'

export async function registerSupportRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  sessions: GreenfieldSessionService,
  routeConfig: {healthConfig: Record<string, unknown>; profileConfig: Record<string, unknown>; writeConfig: Record<string, unknown>},
) {
  const service = new GreenfieldSupportService(db, config)
  const release = () => ({commit: process.env.MODULA_RELEASE_SHA?.slice(0, 12) ?? null, builtAt: process.env.MODULA_RELEASE_BUILT_AT ?? null})

  // Public, unauthenticated, cached for a few seconds server-side.
  app.get('/v1/status', routeConfig.healthConfig, async (request, reply) => {
    try {
      const status = await collectPublicStatus(db, release())
      return reply.header('Cache-Control', 'no-store').send(successEnvelope(status, request.id))
    } catch {
      return reply.code(503).send(failureEnvelope('SERVER_ERROR', 'Status unavailable', request.id, {retryable: true}))
    }
  })

  app.get('/v1/support/contact', routeConfig.healthConfig, async (request, reply) => {
    return reply.header('Cache-Control', 'public, max-age=300').send(successEnvelope(service.contact(), request.id))
  })

  const authenticate = async (request: any, reply: any) => {
    const header = request.headers.authorization
    const auth = header?.startsWith('Bearer ') ? await sessions.resolveAccess(header.slice(7).trim()) : null
    if (!auth) reply.code(401).send(failureEnvelope('UNAUTHENTICATED', 'Authentication required', request.id))
    return auth
  }
  const action = (handler: (accountId: string, request: any) => Promise<unknown>, created = false) => async (request: any, reply: any) => {
    const auth = await authenticate(request, reply)
    if (!auth) return
    try {
      return reply.code(created ? 201 : 200).send(successEnvelope(await handler(auth.accountId, request), request.id))
    } catch (error: any) {
      const code = ['VALIDATION_FAILED', 'RATE_LIMITED', 'NOT_FOUND', 'CAPABILITY_DISABLED'].includes(error?.code) ? error.code : 'SERVER_ERROR'
      const fieldErrors = code === 'VALIDATION_FAILED' && error?.field ? {[error.field]: error.message} : undefined
      return reply
        .code(statusForError(code))
        .send(failureEnvelope(code, code === 'SERVER_ERROR' ? 'Support request failed' : error.message, request.id, {fieldErrors, retryable: code === 'RATE_LIMITED'}))
    }
  }

  app.get('/v1/support/cases', routeConfig.profileConfig, action(accountId => service.list(accountId)))
  app.post('/v1/support/cases', routeConfig.writeConfig, action((accountId, request) => {
    if (!config.mutationsEnabled) throw Object.assign(new Error('Support requests are disabled'), {code: 'CAPABILITY_DISABLED'})
    const key = request.headers['idempotency-key']
    return service.open(accountId, typeof key === 'string' ? key.trim() : '', request.body ?? {})
  }, true))
}
