import type {DeveloperProgrammeState} from '@modula/api-contracts'
import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import type {GreenfieldSessionService} from '../sessions/service.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {DeveloperService} from './service.js'

export async function registerDeveloperRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  sessions: GreenfieldSessionService,
  routeConfig: {profileConfig: Record<string, unknown>; writeConfig: Record<string, unknown>},
) {
  const developers = new DeveloperService(db, config)
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
      const code = ['VALIDATION_FAILED', 'FORBIDDEN', 'CONFLICT', 'NOT_FOUND'].includes(error?.code) ? error.code : 'SERVER_ERROR'
      return reply.code(statusForError(code)).send(failureEnvelope(code, code === 'SERVER_ERROR' ? 'Developer operation failed' : error.message, request.id))
    }
  }

  app.get('/v1/developer/board', routeConfig.profileConfig, action((accountId) => developers.board(accountId)))
  app.put('/v1/developer/profile', routeConfig.writeConfig, action((accountId, request) => developers.upsertProfile(accountId, request.body ?? {})))
  app.post('/v1/developer/organisations', routeConfig.writeConfig, action((accountId, request) => developers.createOrganisation(accountId, request.body ?? {}), true))
  app.post('/v1/developer/organisations/:organisationId/members', routeConfig.writeConfig, action((accountId, request) => developers.inviteOrganisationMember(accountId, String(request.params.organisationId), request.body ?? {}), true))
  app.post('/v1/developer/organisations/:organisationId/invitations/accept', routeConfig.writeConfig, action((accountId, request) => developers.acceptOrganisationInvitation(accountId, String(request.params.organisationId))))
  app.post('/v1/developer/publishers', routeConfig.writeConfig, action((accountId, request) => developers.createPublisher(accountId, request.body ?? {}), true))
  app.post('/v1/developer/publishers/:publisherId/namespaces', routeConfig.writeConfig, action((accountId, request) => developers.claimNamespace(accountId, String(request.params.publisherId), request.body?.namespace), true))
  app.post('/v1/developer/agreements/:agreementId/:version/accept', routeConfig.writeConfig, action((accountId, request) => developers.acceptAgreement(accountId, String(request.params.agreementId), String(request.params.version), String(request.body?.documentHash ?? '')), true))
  app.post('/v1/developer/programme/enrol', routeConfig.writeConfig, action((accountId) => developers.enrol(accountId), true))
  app.patch('/v1/admin/developer/programme/:accountId', routeConfig.writeConfig, action((operatorAccountId, request) => developers.setProgrammeState(operatorAccountId, String(request.params.accountId), String(request.body?.state) as DeveloperProgrammeState, request.body?.reason)))
  app.post('/v1/admin/developer/namespaces/:namespace/verify', routeConfig.writeConfig, action((operatorAccountId, request) => developers.verifyNamespace(operatorAccountId, String(request.params.namespace))))
  app.get('/v1/developer/products', routeConfig.profileConfig, action((accountId) => developers.listProducts(accountId)))
  app.post('/v1/developer/products', routeConfig.writeConfig, action((accountId, request) => developers.createProduct(accountId, request.body ?? {}), true))
  app.get('/v1/developer/products/:productId', routeConfig.profileConfig, action((accountId, request) => developers.productDetail(accountId, String(request.params.productId))))
  app.post('/v1/developer/products/:productId/sources', routeConfig.writeConfig, action((accountId, request) => developers.connectSource(accountId, String(request.params.productId), request.body ?? {}), true))
  app.post('/v1/developer/products/:productId/test-groups', routeConfig.writeConfig, action((accountId, request) => developers.createTestGroup(accountId, String(request.params.productId), request.body ?? {}), true))
  app.post('/v1/developer/products/:productId/reviews', routeConfig.writeConfig, action((accountId, request) => developers.submitReview(accountId, String(request.params.productId), request.body ?? {}), true))
}
