import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {createHash} from 'node:crypto'
import {backendUsesModuleRuntime, type ModuleBackendActionDefinition} from '@modula/greenfield-module-manifest'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import {moduleError} from '../module-errors.js'
import type {GreenfieldModuleRuntimeContext} from '../runtime-access.js'
import {ModuleBackendDiscoveryService} from './discovery-service.js'
import {fetchBackendJson, resolveBackendEndpoint} from './network-policy.js'
import {ModuleBackendRepository} from './repository.js'
import {ModuleBackendTokenService} from './token-service.js'

export class ModuleBackendGatewayService {
  private readonly repository: ModuleBackendRepository
  private readonly discovery: ModuleBackendDiscoveryService
  private readonly tokens: ModuleBackendTokenService

  constructor(
    db: ModulaDb,
    private readonly config: AppConfig,
  ) {
    this.repository = new ModuleBackendRepository(db)
    this.discovery = new ModuleBackendDiscoveryService(db)
    this.tokens = new ModuleBackendTokenService(db, config)
  }

  canHandle(context: GreenfieldModuleRuntimeContext, actionId: string): boolean {
    return backendUsesModuleRuntime(context.manifest) && Boolean((context.manifest.backend?.actions ?? []).some(action => action.actionId === actionId))
  }

  async executeAction(input: {
    context: GreenfieldModuleRuntimeContext
    actionId: string
    actorId: string
    payload: Record<string, unknown>
    idempotencyKey?: string
    requestId?: string
    extensionInvocation?: {
      consumerProductId: string
      targetProductId: string
      targetInstallationId: string
      scope: {type: 'installation' | 'resource' | 'action'; ref: string | null}
      capabilities: string[]
    }
  }) {
    // This gateway is also called outside the generic action route (extension
    // invocations), so enforce the review boundary before discovery or tokens.
    if (input.context.permissionReviewRequired) throw moduleError('PERMISSION_REVIEW_REQUIRED', 'Module permission review is required')
    const backend = await this.repository.ensureDefinitionForContext(input.context)
    if (!backendUsesModuleRuntime(input.context.manifest)) throw moduleError('VALIDATION_FAILED', 'Module does not use a module backend')
    const action = (backend.actions ?? []).find(item => item.actionId === input.actionId)
    if (!action) throw moduleError('NOT_FOUND', 'Module backend action not found')
    if (action.idempotent && !input.idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Idempotency key is required')
    enforceActionPermissions(input.context, action)
    let installation = await this.repository.ensureInstallation(input.context, null)
    if (installation.lifecycleState === 'disabled' || installation.lifecycleState === 'quarantined' || installation.lifecycleState === 'revoked') {
      throw moduleError('FORBIDDEN', 'Module backend is not available')
    }
    if (installation.verificationStatus !== 'verified' || !installation.resolvedOrigin) {
      installation = await this.discovery.discover(input.context)
    }
    if (installation.lifecycleState === 'disabled' || installation.lifecycleState === 'quarantined' || installation.lifecycleState === 'revoked') {
      throw moduleError('FORBIDDEN', 'Module backend is not available')
    }
    const latestHealth = await this.repository.latestHealth(input.context.installationId)
    if ((latestHealth?.failure_count ?? 0) >= 3 && latestHealth?.circuit_state === 'open') throw moduleError('CAPABILITY_DISABLED', 'Module backend circuit is open')

    const serviceInvocation = input.extensionInvocation ? {
      ...input.extensionInvocation,
      serviceId: backendServiceIdentity(input.context, backend),
      actionId: input.actionId,
    } : {
      consumerProductId: input.context.moduleId,
      targetProductId: input.context.moduleId,
      targetInstallationId: input.context.installationId,
      serviceId: backendServiceIdentity(input.context, backend),
      actionId: input.actionId,
      scope: {type: 'action' as const, ref: input.actionId},
      capabilities: [input.actionId],
    }
    const scoped = await this.tokens.issue({
      context: input.context,
      backend,
      actorId: input.actorId,
      permissions: action.permissions,
      capabilities: serviceInvocation.capabilities,
      requestId: input.requestId,
      traceId: input.requestId,
      extensionInvocation: serviceInvocation,
    })
    const endpoint = await resolveBackendEndpoint(backend, installation.resolvedOrigin ?? undefined)
    const started = Date.now()
    try {
      const response = await executeWithBoundedRetry(async () => {
        const attempt = await fetchBackendJson(endpoint.urlFor(action.path), {
          method: 'POST',
          body: {
            actionId: action.actionId,
            installationId: input.context.installationId,
            moduleId: input.context.moduleId,
            input: input.payload,
            idempotencyKey: input.idempotencyKey,
            requestId: input.requestId,
            token: scoped.token,
          },
          token: scoped.token,
          idempotencyKey: input.idempotencyKey,
          timeoutMs: action.timeoutMs,
          maxResponseBytes: 1_000_000,
        })
        if (attempt.status < 200 || attempt.status >= 300) throw moduleError('VALIDATION_FAILED', `Module backend action failed with HTTP ${attempt.status}`)
        return attempt
      }, {
        enabled: action.idempotent,
      })
      const result = validateBackendActionResponse(response.json)
      await this.repository.recordHealth({context: input.context, component: 'gateway', status: 'healthy', latencyMs: Date.now() - started, circuitState: 'closed'})
      return {
        backend: true,
        actionId: action.actionId,
        result,
        outputHash: hashPayload(result),
      }
    } catch (error) {
      await this.repository.recordFailure({context: input.context, type: 'gateway', reasonCode: errorCode(error), details: {actionId: action.actionId}})
      await this.repository.recordHealth({context: input.context, component: 'gateway', status: 'unreachable', latencyMs: Date.now() - started, failureCount: (latestHealth?.failure_count ?? 0) + 1, circuitState: 'open'})
      throw error
    }
  }
}

export function backendServiceIdentity(context: GreenfieldModuleRuntimeContext, backend: {trust?: {deploymentIdentity?: string}}): string {
  const serviceId = backend.trust?.deploymentIdentity?.trim() || `service.${context.moduleId}.backend`
  if (!/^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/.test(serviceId) || serviceId.length > 180) {
    throw moduleError('VALIDATION_FAILED', 'Module backend service identity is invalid')
  }
  return serviceId
}

const BACKEND_RETRY_DELAYS_MS = [100, 300] as const

export async function executeWithBoundedRetry<T>(
  operation: () => Promise<T>,
  options: {
    enabled: boolean
    maximumAttempts?: number
    retryDelaysMs?: readonly number[]
    sleep?: (delayMs: number) => Promise<void>
  },
): Promise<T> {
  const maximumAttempts = options.enabled ? Math.max(1, Math.min(options.maximumAttempts ?? 3, 3)) : 1
  const retryDelaysMs = options.retryDelaysMs ?? BACKEND_RETRY_DELAYS_MS
  const sleep = options.sleep ?? (delayMs => new Promise(resolve => setTimeout(resolve, delayMs)))
  let attempt = 0
  while (attempt < maximumAttempts) {
    attempt += 1
    try {
      return await operation()
    } catch (error) {
      if (attempt >= maximumAttempts || !isRetryableBackendFailure(error)) throw error
      await sleep(retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)] ?? 0)
    }
  }
  throw new Error('Module backend retry bounds exhausted')
}

function isRetryableBackendFailure(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as {code?: unknown}).code ?? '') : ''
  if (['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN'].includes(code)) return true
  const message = error instanceof Error ? error.message : String(error)
  return /timed out|HTTP 5\d\d/i.test(message)
}

function enforceActionPermissions(context: GreenfieldModuleRuntimeContext, action: ModuleBackendActionDefinition) {
  for (const permission of action.permissions) {
    if (!context.grantedPermissions.includes(permission)) throw moduleError('FORBIDDEN', `Module backend permission denied: ${permission}`)
  }
  if (action.sideEffects === 'financial' || action.sideEffects === 'destructive') {
    if (action.confirmation === 'none') throw moduleError('FORBIDDEN', 'High-risk backend actions require confirmation')
  }
}

function validateBackendActionResponse(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw moduleError('VALIDATION_FAILED', 'Module backend action response must be an object')
  const object = value as Record<string, unknown>
  if (object.ok === false) {
    const error = object.error && typeof object.error === 'object' ? object.error as Record<string, unknown> : {}
    throw moduleError('VALIDATION_FAILED', typeof error.message === 'string' ? error.message : 'Module backend action rejected the request')
  }
  return redactSecrets(object.result ?? object)
}

function redactSecrets(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(redactSecrets)
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    /token|secret|password|privateKey/i.test(key) ? '[redacted]' : redactSecrets(entry),
  ]))
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(canonicalJsonStringify(value), 'utf8').digest('hex')
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error ? String((error as any).code) : 'BACKEND_GATEWAY_FAILED'
}
