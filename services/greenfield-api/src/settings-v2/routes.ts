import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import type {GreenfieldSessionService} from '../sessions/service.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {SettingsV2Service} from './service.js'

type Access = NonNullable<Awaited<ReturnType<GreenfieldSessionService['resolveAccess']>>>

export async function registerSettingsV2Routes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  sessions: GreenfieldSessionService,
  routeConfig: {profileConfig: Record<string, unknown>; writeConfig: Record<string, unknown>},
) {
  const service = new SettingsV2Service(db, sessions)
  const authenticate = async (request: any, reply: any) => {
    const header = request.headers.authorization
    const auth = header?.startsWith('Bearer ') ? await sessions.resolveAccess(header.slice(7).trim()) : null
    if (!auth) reply.code(401).send(failureEnvelope('UNAUTHENTICATED', 'Authentication required', request.id))
    return auth
  }
  const action = (handler: (auth: Access, request: any) => Promise<unknown>, options: {mutation?: boolean} = {}) => async (request: any, reply: any) => {
    const auth = await authenticate(request, reply)
    if (!auth) return
    try {
      if (options.mutation && !config.mutationsEnabled) throw Object.assign(new Error('Changes are disabled right now'), {code: 'CAPABILITY_DISABLED'})
      return reply.header('Cache-Control', 'no-store').send(successEnvelope(await handler(auth, request), request.id))
    } catch (error: any) {
      const code = ['VALIDATION_FAILED', 'RATE_LIMITED', 'NOT_FOUND', 'CONFLICT', 'CAPABILITY_DISABLED', 'UNAUTHENTICATED'].includes(error?.code) ? error.code : 'SERVER_ERROR'
      const fieldErrors = code === 'VALIDATION_FAILED' && error?.field ? {[error.field]: error.message} : undefined
      if (code === 'SERVER_ERROR') request.log?.error({err: error}, 'settings-v2 request failed')
      return reply
        .code(statusForError(code))
        .send(failureEnvelope(code, code === 'SERVER_ERROR' ? 'Request failed' : error.message, request.id, {fieldErrors, retryable: code === 'RATE_LIMITED'}))
    }
  }

  app.get('/v1/accounts/me/app-preferences', routeConfig.profileConfig, action(auth => service.preferences(auth.accountId)))
  app.patch('/v1/accounts/me/app-preferences', routeConfig.writeConfig, action((auth, request) => service.updatePreferences(auth.accountId, request.body), {mutation: true}))
  app.get('/v1/accounts/me/mutes', routeConfig.profileConfig, action(auth => service.mutes(auth.accountId)))
  app.get('/v1/accounts/me/blocks', routeConfig.profileConfig, action(auth => service.blocks(auth.accountId)))
  app.get('/v1/creator/insights', routeConfig.profileConfig, action((auth, request) => service.insights(auth.accountId, request.query?.days)))
  app.get('/v1/creator/payouts', routeConfig.profileConfig, action(auth => service.payouts(auth.accountId)))
  app.get('/v1/commerce/invoices', routeConfig.profileConfig, action(auth => service.invoices(auth.accountId)))
  app.post('/v1/auth/step-up/password', routeConfig.writeConfig, action((auth, request) => service.passwordStepUp(auth, request.body)))
  app.get('/v1/account/deletion-requests/current', routeConfig.profileConfig, action(auth => service.currentDeletion(auth.accountId)))
}
