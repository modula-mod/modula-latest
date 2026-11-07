import type {ApiErrorCode} from '@modula/api-contracts'
import {PUBLISHER_CONSOLE_ERROR_HTTP_STATUS, type PublisherConsoleErrorCode} from '@modula/greenfield-module-registry-contracts'
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {HttpGithubReleaseSource, type GithubReleaseSource} from '../modules/github-release-sync-service.js'
import type {GreenfieldSessionService} from '../sessions/service.js'
import {failureEnvelope, successEnvelope} from '../transport/envelope.js'
import {PublisherConsoleError} from './release-job-core.js'
import {PublisherReleaseConsoleService} from './release-job-service.js'

type RouteConfig = Record<string, unknown>

const ENVELOPE_CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'VALIDATION_FAILED', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 503: 'CAPABILITY_UNAVAILABLE', 500: 'SERVER_ERROR',
}

/**
 * BUILDER-01 publisher Module Release Console. Every route authenticates the
 * session and then checks publisher access for the specific module/job. No
 * admin-handle authority, no in-request downloads, no publication in-request.
 */
export async function registerPublisherConsoleRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  sessions: GreenfieldSessionService,
  routeConfig: {profileConfig: RouteConfig; writeConfig: RouteConfig},
  options: {githubReleaseSource?: GithubReleaseSource} = {},
) {
  const service = new PublisherReleaseConsoleService(
    db,
    config,
    options.githubReleaseSource ?? new HttpGithubReleaseSource({token: process.env.GREENFIELD_MODULE_GITHUB_TOKEN ?? null}),
    {githubEnabled: config.moduleGithubSyncEnabled},
  )

  const send = (reply: FastifyReply, request: FastifyRequest, code: PublisherConsoleErrorCode, message: string, details: Record<string, unknown> = {}) => {
    const status = PUBLISHER_CONSOLE_ERROR_HTTP_STATUS[code]
    return reply.code(status).send(failureEnvelope(ENVELOPE_CODE_BY_STATUS[status] ?? 'SERVER_ERROR', message, request.id, {details: {...details, publisherConsoleCode: code}}))
  }

  const handle = (fn: (accountId: string, request: FastifyRequest) => Promise<{status?: number; data: unknown}>) => async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    const auth = token ? await sessions.resolveAccess(token) : null
    if (!auth) return send(reply, request, 'UNAUTHENTICATED', 'Authentication required')
    try {
      const result = await fn(auth.accountId, request)
      return reply.code(result.status ?? 200).send(successEnvelope(result.data, request.id))
    } catch (error) {
      if (error instanceof PublisherConsoleError) return send(reply, request, error.code, error.message, error.details)
      request.log.error({err: error}, 'publisher console request failed')
      return send(reply, request, 'INTERNAL_ERROR', 'Publisher console operation failed')
    }
  }

  const params = (request: FastifyRequest) => request.params as {moduleId?: string; jobId?: string}
  const idempotencyKey = (request: FastifyRequest) => {
    const raw = request.headers['idempotency-key']
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  app.get('/v1/publisher/modules', routeConfig.profileConfig, handle(async accountId => ({data: await service.listModules(accountId)})))
  app.get('/v1/publisher/modules/:moduleId', routeConfig.profileConfig, handle(async (accountId, request) => ({data: await service.moduleDetail(accountId, String(params(request).moduleId))})))
  app.get('/v1/publisher/modules/:moduleId/versions', routeConfig.profileConfig, handle(async (accountId, request) => ({data: await service.versions(accountId, String(params(request).moduleId))})))
  app.get('/v1/publisher/modules/:moduleId/github-releases', routeConfig.profileConfig, handle(async (accountId, request) => ({data: await service.githubReleases(accountId, String(params(request).moduleId))})))
  app.get('/v1/publisher/modules/:moduleId/release-jobs', routeConfig.profileConfig, handle(async (accountId, request) => {
    const limit = Number((request.query as {limit?: string})?.limit ?? 50)
    return {data: await service.listJobs(accountId, String(params(request).moduleId), Number.isFinite(limit) ? limit : 50)}
  }))
  app.post('/v1/publisher/modules/:moduleId/release-jobs', routeConfig.writeConfig, handle(async (accountId, request) => {
    const body = (request.body ?? {}) as Record<string, unknown>
    const result = await service.createJob(accountId, String(params(request).moduleId), {sourceRepository: body.sourceRepository as string, releaseTag: body.releaseTag as string}, idempotencyKey(request))
    return {status: result.replayed ? 200 : 202, data: result.job}
  }))
  app.get('/v1/publisher/release-jobs/:jobId', routeConfig.profileConfig, handle(async (accountId, request) => ({data: await service.getJob(accountId, String(params(request).jobId))})))
  app.get('/v1/publisher/release-jobs/:jobId/logs', routeConfig.profileConfig, handle(async (accountId, request) => ({data: await service.logs(accountId, String(params(request).jobId), (request.query ?? {}) as Record<string, unknown>)})))
  app.post('/v1/publisher/release-jobs/:jobId/validate', routeConfig.writeConfig, handle(async (accountId, request) => ({status: 202, data: await service.validate(accountId, String(params(request).jobId))})))
  app.post('/v1/publisher/release-jobs/:jobId/publish', routeConfig.writeConfig, handle(async (accountId, request) => {
    const body = request.body ?? {}
    if (typeof body !== 'object' || Array.isArray(body)) throw new PublisherConsoleError('INVALID_REQUEST', 'Body must be an object')
    const keys = Object.keys(body as object)
    const unknown = keys.filter(key => key !== 'permissionChangeAcknowledged')
    if (unknown.length) throw new PublisherConsoleError('INVALID_REQUEST', `Unsupported field(s): ${unknown.join(', ')}; the only accepted field is permissionChangeAcknowledged`, {fields: unknown})
    const ack = (body as {permissionChangeAcknowledged?: unknown}).permissionChangeAcknowledged
    if (ack !== undefined && typeof ack !== 'boolean') throw new PublisherConsoleError('INVALID_REQUEST', 'permissionChangeAcknowledged must be a boolean')
    return {status: 202, data: await service.publish(accountId, String(params(request).jobId), {permissionChangeAcknowledged: ack as boolean | undefined})}
  }))
  app.post('/v1/publisher/release-jobs/:jobId/cancel', routeConfig.writeConfig, handle(async (accountId, request) => ({data: await service.cancel(accountId, String(params(request).jobId))})))
  app.post('/v1/publisher/release-jobs/:jobId/resume', routeConfig.writeConfig, handle(async (accountId, request) => ({status: 202, data: await service.resume(accountId, String(params(request).jobId))})))
}
