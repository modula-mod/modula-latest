import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import type {GreenfieldSessionService} from '../sessions/service.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {GreenfieldAccountDataService} from './service.js'

export async function registerAccountDataRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  sessions: GreenfieldSessionService,
  routeConfig: {profileConfig: Record<string, unknown>; writeConfig: Record<string, unknown>},
) {
  const service = new GreenfieldAccountDataService(db)
  const authenticate = async (request: any, reply: any) => {
    const header = request.headers.authorization
    const auth = header?.startsWith('Bearer ') ? await sessions.resolveAccess(header.slice(7).trim()) : null
    if (!auth) reply.code(401).send(failureEnvelope('UNAUTHENTICATED', 'Authentication required', request.id))
    return auth
  }
  const action = (handler: (auth: NonNullable<Awaited<ReturnType<typeof sessions.resolveAccess>>>, request: any) => Promise<unknown>, created = false) => async (request: any, reply: any) => {
    const auth = await authenticate(request, reply)
    if (!auth) return
    try {
      return reply.code(created ? 201 : 200).send(successEnvelope(await handler(auth, request), request.id))
    } catch (error: any) {
      const code = ['VALIDATION_FAILED','FORBIDDEN','CONFLICT','NOT_FOUND','CAPABILITY_DISABLED'].includes(error?.code) ? error.code : 'SERVER_ERROR'
      return reply.code(statusForError(code)).send(failureEnvelope(code, code === 'SERVER_ERROR' ? 'Account data operation failed' : error.message, request.id))
    }
  }
  const requestId = (request: any) => String(request.params?.requestId ?? '')
  const idempotencyKey = (request: any) => {
    const value = request.headers['idempotency-key']
    return typeof value === 'string' ? value.trim() : ''
  }

  app.post('/v1/account/data-exports', routeConfig.writeConfig, action((auth, request) => {
    if (!config.mutationsEnabled) disabled()
    return service.requestExport(auth.accountId, idempotencyKey(request))
  }, true))
  app.post('/v1/account/deletion-requests', routeConfig.writeConfig, action((auth, request) => {
    if (!config.mutationsEnabled) disabled()
    return service.requestDeletion(auth.accountId, idempotencyKey(request), {at: auth.recentAuthenticationAt, strength: auth.authenticationStrength}, request.body?.confirm === true)
  }, true))
  app.get('/v1/account/data-requests/:requestId', routeConfig.profileConfig, action((auth, request) => service.get(auth.accountId, requestId(request))))
  app.get('/v1/account/data-requests/:requestId/artifacts', routeConfig.profileConfig, action((auth, request) => service.artifacts(auth.accountId, requestId(request))))
  app.post('/v1/account/data-requests/:requestId/advance', routeConfig.writeConfig, action((auth, request) => {
    if (!config.mutationsEnabled) disabled()
    return service.advance(auth.accountId, requestId(request))
  }))
  app.post('/v1/account/data-requests/:requestId/cancel', routeConfig.writeConfig, action((auth, request) => {
    if (!config.mutationsEnabled) disabled()
    return service.cancel(auth.accountId, requestId(request))
  }))
}

function disabled(): never {
  throw Object.assign(new Error('Account data mutations are disabled'), {code: 'CAPABILITY_DISABLED'})
}
