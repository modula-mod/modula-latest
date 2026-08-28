import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import type {GreenfieldSessionService} from '../sessions/service.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {GreenfieldProviderResolutionService} from './service.js'

export async function registerProviderRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  _config: AppConfig,
  sessions: GreenfieldSessionService,
  routeConfig: {profileConfig: Record<string, unknown>; writeConfig: Record<string, unknown>},
): Promise<void> {
  const service = new GreenfieldProviderResolutionService(db)
  const action = (handler: (accountId: string, request: any) => Promise<unknown>) => async (request: any, reply: any) => {
    const header = request.headers.authorization
    const auth = header?.startsWith('Bearer ') ? await sessions.resolveAccess(header.slice(7).trim()) : null
    if (!auth) return reply.code(401).send(failureEnvelope('UNAUTHENTICATED', 'Authentication required', request.id))
    try {
      return reply.send(successEnvelope(await handler(auth.accountId, request), request.id))
    } catch (error: any) {
      const code = ['VALIDATION_FAILED', 'FORBIDDEN', 'CONFLICT', 'NOT_FOUND'].includes(error?.code) ? error.code : 'SERVER_ERROR'
      return reply.code(statusForError(code)).send(failureEnvelope(code, code === 'SERVER_ERROR' ? 'Provider operation failed' : error.message, request.id))
    }
  }

  app.get('/v1/providers/:capabilityRole', routeConfig.profileConfig, action((accountId, request) =>
    service.list(accountId, String(request.params.capabilityRole ?? ''))))
  app.get('/v1/providers/:capabilityRole/resolve', routeConfig.profileConfig, action((accountId, request) =>
    service.resolve(accountId, String(request.params.capabilityRole ?? ''))))
  app.put('/v1/providers/:capabilityRole/default', routeConfig.writeConfig, action((accountId, request) =>
    service.setDefault(accountId, String(request.params.capabilityRole ?? ''), String(request.body?.providerInstallationId ?? ''))))
}
