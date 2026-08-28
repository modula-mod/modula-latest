import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import type {GreenfieldSessionService} from '../sessions/service.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {GreenfieldEntitlementService} from './service.js'

export async function registerEntitlementRoutes(app: FastifyInstance, db: ModulaDb, config: AppConfig, sessions: GreenfieldSessionService, routeConfig: {profileConfig: Record<string, unknown>; writeConfig: Record<string, unknown>}) {
  const service = new GreenfieldEntitlementService(db)
  const authenticate = async (request: any, reply: any) => {
    const header = request.headers.authorization
    const auth = header?.startsWith('Bearer ') ? await sessions.resolveAccess(header.slice(7).trim()) : null
    if (!auth) reply.code(401).send(failureEnvelope('UNAUTHENTICATED', 'Authentication required', request.id))
    return auth
  }
  const action = (handler: (accountId: string, request: any) => Promise<unknown>, created = false, admin = false) => async (request: any, reply: any) => {
    const auth = await authenticate(request, reply)
    if (!auth) return
    try {
      if (admin) {
        const account = await db.selectFrom('greenfield_accounts').select('primary_handle').where('account_id', '=', auth.accountId).executeTakeFirst()
        if (!account || !config.adminHandles.includes(account.primary_handle.toLowerCase())) throw Object.assign(new Error('Commerce administration required'), {code: 'FORBIDDEN'})
      }
      return reply.code(created ? 201 : 200).send(successEnvelope(await handler(auth.accountId, request), request.id))
    } catch (error: any) {
      const code = ['VALIDATION_FAILED','FORBIDDEN','CONFLICT','NOT_FOUND'].includes(error?.code) ? error.code : 'SERVER_ERROR'
      return reply.code(statusForError(code)).send(failureEnvelope(code, code === 'SERVER_ERROR' ? 'Entitlement operation failed' : error.message, request.id))
    }
  }
  app.get('/v1/commerce/entitlements', routeConfig.profileConfig, action((accountId, request) => service.listAccount(accountId, typeof request.query?.productId === 'string' ? request.query.productId : undefined)))
  app.post('/v1/commerce/entitlements/check', routeConfig.profileConfig, action((accountId, request) => service.check(accountId, String(request.body?.productId ?? ''), String(request.body?.capability ?? ''))))
  app.get('/v1/commerce/billing-adapters', routeConfig.profileConfig, action(() => service.adapterStatus()))
  app.put('/v1/admin/commerce/offers/:offerId', routeConfig.writeConfig, action((accountId, request) => service.upsertOffer(accountId, String(request.params.offerId), request.body ?? {}), false, true))
  app.post('/v1/admin/commerce/entitlements', routeConfig.writeConfig, action((accountId, request) => service.grant(accountId, request.body ?? {}), true, true))
  app.post('/v1/admin/commerce/entitlements/:entitlementId/transitions', routeConfig.writeConfig, action((accountId, request) => service.transition(accountId, String(request.params.entitlementId), request.body ?? {}), false, true))
  app.put('/v1/admin/commerce/quotas/:quotaPolicyId', routeConfig.writeConfig, action((accountId, request) => service.upsertQuota(accountId, String(request.params.quotaPolicyId), request.body ?? {}), false, true))
}
