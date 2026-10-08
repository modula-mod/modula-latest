import {IntelligenceError, type IntelligenceErrorCode} from '@modula/intelligence-contracts'
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify'
import type {ModulaDb} from '../database/client.js'
import type {AppConfig} from '../config/index.js'
import type {GreenfieldSessionService} from '../sessions/service.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {GovernedIntelligenceService} from './service.js'

type RouteConfig = Record<string, unknown>

export async function registerIntelligenceRoutes(app: FastifyInstance, db: ModulaDb, sessions: GreenfieldSessionService, routeConfig: {profileConfig: RouteConfig; writeConfig: RouteConfig}, config?: Pick<AppConfig, 'environment' | 'moduleAllowUntrustedDevelopmentReleases'>) {
  const intelligence = new GovernedIntelligenceService(db, config)

  app.post('/v1/intelligence/missions', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = record(request.body)
      return reply.code(201).send(successEnvelope(await intelligence.createMission(auth.accountId, {objective: body.objective, workspaceId: body.workspaceId, correlationId: request.id}), request.id))
    } catch (error) { return sendIntelligenceError(reply, error, request.id) }
  })

  app.get('/v1/intelligence/missions', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    return reply.send(successEnvelope(await intelligence.listMissions(auth.accountId), request.id))
  })

  app.get('/v1/intelligence/missions/:missionId', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try { return reply.send(successEnvelope(await intelligence.detail(auth.accountId, param(request, 'missionId')), request.id)) }
    catch (error) { return sendIntelligenceError(reply, error, request.id) }
  })

  app.post('/v1/intelligence/missions/:missionId/start', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try { return reply.send(successEnvelope(await intelligence.start(auth.accountId, param(request, 'missionId')), request.id)) }
    catch (error) { return sendIntelligenceError(reply, error, request.id) }
  })

  app.get('/v1/intelligence/missions/:missionId/ledger', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try { return reply.send(successEnvelope(await intelligence.ledger(auth.accountId, param(request, 'missionId')), request.id)) }
    catch (error) { return sendIntelligenceError(reply, error, request.id) }
  })

  app.get('/v1/intelligence/missions/:missionId/decisions', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try { return reply.send(successEnvelope(await intelligence.decisions(auth.accountId, param(request, 'missionId')), request.id)) }
    catch (error) { return sendIntelligenceError(reply, error, request.id) }
  })

  app.get('/v1/intelligence/missions/:missionId/approvals', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try { return reply.send(successEnvelope(await intelligence.approvals(auth.accountId, param(request, 'missionId')), request.id)) }
    catch (error) { return sendIntelligenceError(reply, error, request.id) }
  })

  app.get('/v1/intelligence/missions/:missionId/evidence', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try { return reply.send(successEnvelope(await intelligence.evidence(auth.accountId, param(request, 'missionId')), request.id)) }
    catch (error) { return sendIntelligenceError(reply, error, request.id) }
  })

  app.post('/v1/intelligence/missions/:missionId/approvals/:approvalId/approve', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try { return reply.send(successEnvelope(await intelligence.approve(auth.accountId, param(request, 'missionId'), param(request, 'approvalId')), request.id)) }
    catch (error) { return sendIntelligenceError(reply, error, request.id) }
  })

  app.post('/v1/intelligence/missions/:missionId/approvals/:approvalId/reject', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try { return reply.send(successEnvelope(await intelligence.reject(auth.accountId, param(request, 'missionId'), param(request, 'approvalId')), request.id)) }
    catch (error) { return sendIntelligenceError(reply, error, request.id) }
  })

  app.post('/v1/intelligence/missions/:missionId/proposals/:proposalId/execute', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try { return reply.send(successEnvelope(await intelligence.execute(auth.accountId, param(request, 'missionId'), param(request, 'proposalId')), request.id)) }
    catch (error) { return sendIntelligenceError(reply, error, request.id) }
  })
}

async function requireGreenfieldAuth(request: FastifyRequest, reply: FastifyReply, sessions: GreenfieldSessionService) {
  const raw = request.headers.authorization
  const header = Array.isArray(raw) ? raw[0] : raw
  const auth = header?.startsWith('Bearer ') ? await sessions.resolveAccess(header.slice(7).trim()) : null
  if (!auth) reply.code(statusForError('UNAUTHENTICATED')).send(failureEnvelope('UNAUTHENTICATED', 'Authentication required', request.id))
  return auth
}

function sendIntelligenceError(reply: FastifyReply, error: unknown, requestId: string) {
  if (error instanceof IntelligenceError) {
    return reply.code(statusForIntelligenceError(error.code)).send(failureEnvelope(error.code, error.message, requestId, {details: error.details}))
  }
  return reply.code(500).send(failureEnvelope('SERVER_ERROR', 'Governed intelligence request failed', requestId))
}

function statusForIntelligenceError(code: IntelligenceErrorCode): number {
  if (code === 'MISSION_NOT_FOUND') return 404
  if (code === 'MISSION_ACCESS_DENIED' || code === 'CAPABILITY_DENIED' || code === 'PERMISSION_DENIED' || code === 'AKI_DENIED' || code === 'GOVERNOR_BLOCKED') return 403
  if (code === 'INVALID_MISSION_STATE' || code === 'APPROVAL_REQUIRED' || code === 'APPROVAL_REJECTED' || code === 'EXECUTION_ALREADY_COMPLETED') return 409
  if (code === 'INVALID_ACTION_SCHEMA' || code === 'CAPABILITY_UNKNOWN' || code === 'AKI_ABSTAINED') return 400
  return 500
}

function param(request: FastifyRequest, key: string): string { return String((request.params as Record<string, unknown>)[key] ?? '') }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
