import type {GreenfieldAIRequestContract} from '@modula/greenfield-contracts'
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from '../modules/module-errors.js'
import {GreenfieldModulePublisherService} from '../modules/publisher-service.js'
import {GreenfieldModuleRuntimeAccessService} from '../modules/runtime-access.js'
import type {GreenfieldSessionService} from '../sessions/service.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {AIProviderCredentialService} from './credential-service.js'
import {GreenfieldAIGatewayService} from './gateway-service.js'
import {GreenfieldAIProviderRuntimeService} from './provider-runtime-service.js'
import {GreenfieldAIProductActionService} from './product-action-service.js'
import {GreenfieldAIRepository} from './repository.js'
import {GreenfieldAIStreamingRuntime} from './streaming-runtime.js'
import {GreenfieldAIToolBroker} from './tool-broker.js'

type RouteConfig = Record<string, unknown>

export async function registerAiRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  sessions: GreenfieldSessionService,
  routeConfig: {profileConfig: RouteConfig; writeConfig: RouteConfig},
): Promise<void> {
  const repository = new GreenfieldAIRepository(db)
  const gateway = new GreenfieldAIGatewayService(db)
  const providerRuntime = new GreenfieldAIProviderRuntimeService(db, config)
  const productActions = new GreenfieldAIProductActionService(db, config)
  const credentials = new AIProviderCredentialService(db, config)
  const streaming = new GreenfieldAIStreamingRuntime(db)
  const tools = new GreenfieldAIToolBroker(db)
  const publishers = new GreenfieldModulePublisherService(db, config)
  const runtimeAccess = new GreenfieldModuleRuntimeAccessService(db)

  const requireGateway = (reply: FastifyReply, requestId: string) => {
    if (!config.aiGatewayEnabled) {
      reply
        .code(statusForError('CAPABILITY_DISABLED'))
        .send(failureEnvelope('CAPABILITY_DISABLED', 'Greenfield AI gateway is disabled', requestId))
      return false
    }
    return true
  }

  app.get('/v1/ai/providers', routeConfig.profileConfig, async (request, reply) => {
    if (!requireGateway(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    return reply.send(successEnvelope(await repository.listProviders(), request.id))
  })

  app.get('/v1/ai/models', routeConfig.profileConfig, async (request, reply) => {
    if (!requireGateway(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    return reply.send(successEnvelope(await repository.listModels(), request.id))
  })

  app.post('/v1/modules/:moduleId/ai/actions/:actionId/executions', routeConfig.writeConfig, async (request, reply) => {
    if (!requireGateway(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const params = request.params as {moduleId: string; actionId: string}
      const body = ((request.body as any) ?? {}) as Record<string, unknown>
      return reply.send(successEnvelope(await productActions.execute(auth.accountId, params.moduleId, params.actionId, {
        ...body,
        idempotencyKey: idempotencyKey(request, body),
      }), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'AI product action execution failed')
    }
  })

  app.post('/v1/modules/:moduleId/ai/executions/:executionId/apply', routeConfig.writeConfig, async (request, reply) => {
    if (!requireGateway(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const params = request.params as {moduleId: string; executionId: string}
      const body = ((request.body as any) ?? {}) as Record<string, unknown>
      return reply.send(successEnvelope(await productActions.apply(auth.accountId, params.moduleId, params.executionId, {
        ...body,
        idempotencyKey: idempotencyKey(request, body),
      }), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'AI product action application failed')
    }
  })

  app.post('/v1/modules/:moduleId/ai/requests', routeConfig.writeConfig, async (request, reply) => {
    if (!requireGateway(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const moduleId = (request.params as {moduleId: string}).moduleId
      const context = await runtimeAccess.resolve(auth.accountId, moduleId, {requireEnabled: true})
      if (!context.manifest.ai?.features?.length) throw moduleError('CAPABILITY_DISABLED', 'Module does not declare AI capabilities')
      const body = ((request.body as any) ?? {}) as Partial<GreenfieldAIRequestContract>
      return reply.send(successEnvelope(await providerRuntime.executeModuleRequest({
        ...body,
        accountId: auth.accountId,
        requestingModuleId: moduleId,
        installationId: context.installationId,
        manifest: context.manifest,
        grantedPermissions: context.grantedPermissions,
        correlationId: body.correlationId ?? request.id,
        requestId: body.requestId ?? request.id,
        requiredCapabilities: body.requiredCapabilities ?? context.manifest.ai.requiredCapabilities ?? ['chat'],
      }), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'AI request failed')
    }
  })

  app.get('/v1/ai/executions/:executionId', routeConfig.profileConfig, async (request, reply) => {
    if (!requireGateway(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await providerRuntime.getExecution((request.params as {executionId: string}).executionId, auth.accountId), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'AI execution lookup failed')
    }
  })

  app.get('/v1/ai/executions/:executionId/stream', routeConfig.profileConfig, async (request, reply) => {
    if (!requireGateway(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const cursor = cursorFromRequest(request)
      const events = await providerRuntime.streamEvents((request.params as {executionId: string}).executionId, auth.accountId, cursor)
      reply.raw.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      })
      for (const event of events) {
        reply.raw.write(`id: ${event.id}\n`)
        reply.raw.write(`event: ${event.event}\n`)
        reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`)
      }
      reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify({status: 'replay-complete'})}\n\n`)
      reply.raw.end()
      return reply
    } catch (error) {
      return sendMapped(reply, error, request.id, 'AI execution stream failed')
    }
  })

  app.post('/v1/ai/executions/:executionId/cancel', routeConfig.writeConfig, async (request, reply) => {
    if (!requireGateway(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await providerRuntime.cancelExecution((request.params as {executionId: string}).executionId, auth.accountId), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'AI execution cancellation failed')
    }
  })

  app.post('/v1/ai/requests', routeConfig.writeConfig, async (request, reply) => {
    if (!requireGateway(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = ((request.body as any) ?? {}) as Partial<GreenfieldAIRequestContract>
      if (!body.requestingModuleId) throw moduleError('VALIDATION_FAILED', 'requestingModuleId is required')
      return reply.send(successEnvelope(await gateway.createRequest({
        ...body,
        accountId: auth.accountId,
        requestingModuleId: body.requestingModuleId,
        correlationId: body.correlationId ?? request.id,
        requestId: body.requestId ?? request.id,
        requiredCapabilities: body.requiredCapabilities ?? ['chat'],
      }), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'AI request failed')
    }
  })

  app.post('/v1/ai/streams/:streamId/cancel', routeConfig.writeConfig, async (request, reply) => {
    if (!requireGateway(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      await streaming.cancel((request.params as {streamId: string}).streamId)
      return reply.send(successEnvelope({cancelled: true}, request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'AI stream cancellation failed')
    }
  })

  app.post('/v1/ai/streams/:streamId/reconnect', routeConfig.writeConfig, async (request, reply) => {
    if (!requireGateway(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await streaming.reconnect((request.params as {streamId: string}).streamId), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'AI stream reconnect failed')
    }
  })

  app.post('/v1/ai/tools/:toolId/validate', routeConfig.writeConfig, async (request, reply) => {
    if (!requireGateway(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      return reply.send(successEnvelope(await tools.validateAndRecord({
        requestId: stringOrNull(body.requestId),
        toolId: (request.params as {toolId: string}).toolId,
        accountId: auth.accountId,
        arguments: recordOrEmpty(body.arguments),
        grantedPermissions: Array.isArray(body.grantedPermissions)
          ? body.grantedPermissions.filter((item: unknown): item is string => typeof item === 'string')
          : [],
        confirmed: body.confirmed === true,
        requestContext: {requestId: request.id, correlationId: stringOrNull(body.correlationId) ?? request.id},
      }), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'AI tool validation failed')
    }
  })

  app.post('/v1/admin/ai/providers', routeConfig.writeConfig, adminAction(sessions, publishers, request =>
    repository.upsertProvider((request.body as any) ?? {}),
  ))

  app.post('/v1/admin/ai/models', routeConfig.writeConfig, adminAction(sessions, publishers, request =>
    repository.upsertModel((request.body as any) ?? {}),
  ))

  app.post('/v1/admin/ai/prompts', routeConfig.writeConfig, adminAction(sessions, publishers, request =>
    repository.registerPrompt((request.body as any) ?? {}),
  ))

  app.post('/v1/admin/ai/tools', routeConfig.writeConfig, adminAction(sessions, publishers, request =>
    tools.declareTool((request.body as any) ?? {}),
  ))

  app.get('/v1/admin/ops/ai/providers', routeConfig.profileConfig, adminAction(sessions, publishers, async () => ({
    providers: await repository.listProviders(),
  })))

  app.get('/v1/admin/ops/ai/providers/:providerId/health', routeConfig.profileConfig, adminAction(sessions, publishers, request =>
    providerRuntime.verifyProvider((request.params as {providerId: string}).providerId, {scopeType: 'platform'}),
  ))

  app.post('/v1/admin/ops/ai/providers/:providerId/verify', routeConfig.writeConfig, adminAction(sessions, publishers, request => {
    const body = (request.body as any) ?? {}
    return providerRuntime.verifyProvider((request.params as {providerId: string}).providerId, {
      scopeType: body.scopeType === 'account' || body.scopeType === 'organisation' || body.scopeType === 'development' ? body.scopeType : 'platform',
      scopeId: stringOrNull(body.scopeId),
    })
  }))

  app.post('/v1/admin/ops/ai/providers/:providerId/disable', routeConfig.writeConfig, adminAction(sessions, publishers, request =>
    providerRuntime.setProviderEnabled({providerId: (request.params as {providerId: string}).providerId, enabled: false, requestId: request.id}),
  ))

  app.post('/v1/admin/ops/ai/providers/:providerId/enable', routeConfig.writeConfig, adminAction(sessions, publishers, request =>
    providerRuntime.setProviderEnabled({providerId: (request.params as {providerId: string}).providerId, enabled: true, requestId: request.id}),
  ))

  app.post('/v1/admin/ops/ai/providers/:providerId/credentials', routeConfig.writeConfig, adminAction(sessions, publishers, request => {
    const body = (request.body as any) ?? {}
    return credentials.store({
      providerId: (request.params as {providerId: string}).providerId,
      scopeType: body.scopeType === 'account' || body.scopeType === 'organisation' || body.scopeType === 'development' ? body.scopeType : 'platform',
      scopeId: stringOrNull(body.scopeId),
      credential: recordOrEmpty(body.credential),
      requestId: request.id,
    })
  }))

  app.get('/v1/admin/ops/ai/executions', routeConfig.profileConfig, adminAction(sessions, publishers, () =>
    providerRuntime.diagnostics(),
  ))

  app.get('/v1/admin/ops/ai/usage', routeConfig.profileConfig, adminAction(sessions, publishers, () =>
    providerRuntime.diagnostics(),
  ))
}

function adminAction(
  sessions: GreenfieldSessionService,
  publishers: GreenfieldModulePublisherService,
  action: (request: FastifyRequest) => Promise<unknown>,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      await publishers.requireAdminAccount(auth.accountId)
      return reply.send(successEnvelope(await action(request), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Administrative AI action failed')
    }
  }
}

async function requireGreenfieldAuth(request: FastifyRequest, reply: FastifyReply, sessions: GreenfieldSessionService) {
  const token = bearerToken(request)
  const auth = token ? await sessions.resolveAccess(token) : null
  if (!auth) {
    sendError(reply, 'UNAUTHENTICATED', 'Authentication required', request.id)
    return null
  }
  return auth
}

function bearerToken(request: FastifyRequest): string {
  const rawHeader = request.headers.authorization
  const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function cursorFromRequest(request: FastifyRequest): number {
  const query = (request.query as Record<string, unknown>) ?? {}
  const header = request.headers['last-event-id']
  const value = typeof query.cursor === 'string' ? query.cursor : Array.isArray(header) ? header[0] : header
  const parsed = Number.parseInt(String(value ?? '0'), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function idempotencyKey(request: FastifyRequest, body: Record<string, unknown>): string | null {
  const header = request.headers['idempotency-key']
  const headerValue = Array.isArray(header) ? header[0] : header
  return stringOrNull(body.idempotencyKey) ?? stringOrNull(headerValue)
}

function sendError(reply: FastifyReply, code: any, message: string, requestId: string) {
  return reply.code(statusForError(code)).send(failureEnvelope(code, message, requestId))
}

function sendMapped(reply: FastifyReply, error: unknown, requestId: string, fallback: string) {
  const code = error && typeof error === 'object' && 'code' in error ? (error as any).code : 'SERVER_ERROR'
  if (typeof code === 'string' && code.startsWith('AI_')) {
    return reply.code(statusForAiError(code)).send(failureEnvelope(code as any, error instanceof Error ? error.message : fallback, requestId))
  }
  if (['VALIDATION_FAILED', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT', 'CAPABILITY_DISABLED', 'UNAUTHENTICATED', 'NOTE_REVISION_CONFLICT'].includes(code)) {
    return sendError(reply, code, error instanceof Error ? error.message : fallback, requestId)
  }
  return sendError(reply, 'SERVER_ERROR', fallback, requestId)
}

function statusForAiError(code: string): number {
  if (code === 'AI_ACTION_NOT_DECLARED') return 404
  if (code === 'AI_ACTION_PERMISSION_REQUIRED' || code === 'AI_CONTEXT_PERMISSION_REQUIRED' || code === 'AI_RESULT_OWNERSHIP_MISMATCH') return 403
  if (code === 'AI_RESULT_ALREADY_APPLIED') return 409
  if (code === 'AI_PROVIDER_AUTH_FAILED' || code === 'AI_CAPABILITY_UNAVAILABLE') return 403
  if (code === 'AI_QUOTA_EXCEEDED' || code === 'AI_PROVIDER_RATE_LIMITED') return 429
  if (code === 'AI_MODEL_UNAVAILABLE' || code === 'AI_PROVIDER_UNAVAILABLE') return 503
  if (code === 'AI_PROVIDER_TIMEOUT') return 504
  if (code === 'AI_EXECUTION_CANCELLED') return 409
  return 400
}
