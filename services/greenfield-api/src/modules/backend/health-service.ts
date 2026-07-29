import {backendUsesModuleRuntime} from '@modula/greenfield-module-manifest'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import type {GreenfieldModuleRuntimeContext} from '../runtime-access.js'
import {fetchBackendJson, resolveBackendEndpoint} from './network-policy.js'
import {ModuleBackendRepository} from './repository.js'

export class ModuleBackendHealthService {
  private readonly repository: ModuleBackendRepository

  constructor(
    db: ModulaDb,
    private readonly config: AppConfig,
  ) {
    this.repository = new ModuleBackendRepository(db)
  }

  async check(context: GreenfieldModuleRuntimeContext) {
    void this.config
    const backend = await this.repository.ensureDefinitionForContext(context)
    const installation = await this.repository.ensureInstallation(context, null)
    if (!backendUsesModuleRuntime(context.manifest)) {
      return {
        mode: backend.mode,
        status: 'healthy',
        lifecycleState: installation.lifecycleState,
        diagnostics: {provider: 'greenfield'},
      }
    }
    const endpoint = await resolveBackendEndpoint(backend, installation.resolvedOrigin ?? undefined)
    const started = Date.now()
    try {
      const response = await fetchBackendJson(endpoint.urlFor(backend.endpoints?.healthPath ?? '/v1/health'), {
        timeoutMs: backend.health?.timeoutMs ?? 5000,
        maxResponseBytes: 512_000,
      })
      const status = response.status >= 200 && response.status < 300 ? statusFromHealth(response.json) : 'unreachable'
      await this.repository.recordHealth({
        context,
        component: 'api',
        status,
        latencyMs: Date.now() - started,
        circuitState: status === 'healthy' ? 'closed' : 'open',
        details: redactedHealth(response.json),
      })
      return {
        mode: backend.mode,
        status,
        resolvedOrigin: endpoint.origin,
        lifecycleState: (await this.repository.requireInstallation(context.installationId)).lifecycleState,
        diagnostics: redactedHealth(response.json),
      }
    } catch (error) {
      await this.repository.recordHealth({
        context,
        component: 'api',
        status: 'unreachable',
        latencyMs: Date.now() - started,
        failureCount: 1,
        circuitState: 'open',
        details: {error: error instanceof Error ? error.message : String(error)},
      })
      throw error
    }
  }

  async diagnostics(context: GreenfieldModuleRuntimeContext) {
    const backend = await this.repository.ensureDefinitionForContext(context)
    const installation = await this.repository.ensureInstallation(context, null)
    const latestHealth = await this.repository.latestHealth(context.installationId)
    return {
      mode: backend.mode,
      resolvedEndpoint: installation.resolvedOrigin,
      protocolVersion: installation.protocolVersion ?? backend.protocolVersion ?? null,
      deploymentIdentity: backend.trust?.deploymentIdentity ?? null,
      lastSuccessfulHealthCheck: latestHealth?.status === 'healthy' ? latestHealth.checked_at.toISOString() : null,
      latencyMs: latestHealth?.latency_ms ?? null,
      failureCount: latestHealth?.failure_count ?? 0,
      circuitState: latestHealth?.circuit_state ?? 'closed',
      tokenExchangeStatus: backend.authentication?.tokenExchangeRequired ? 'available' : 'not-attempted',
      eventLag: null,
      webhookFailures: 0,
      lifecycleState: installation.lifecycleState,
      verificationStatus: installation.verificationStatus,
      dataLocation: backend.data?.primaryStore ?? (backend.mode === 'frontend-only' ? 'device' : 'greenfield'),
      deployment: backend.deployment?.ownership ?? 'modula-hosted',
      selfHostingSupported: backend.deployment?.selfHostingSupported ?? false,
    }
  }
}

function statusFromHealth(value: unknown): 'healthy' | 'degraded' | 'unreachable' | 'incompatible' | 'quarantined' | 'disabled' {
  const status = isRecord(value) ? String(value.status ?? value.overall ?? 'healthy') : 'healthy'
  if (['healthy', 'degraded', 'incompatible', 'quarantined', 'disabled'].includes(status)) return status as any
  return status === 'failed' ? 'unreachable' : 'healthy'
}

function redactedHealth(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {}
  const allowed = new Set(['status', 'overall', 'components', 'latencyMs', 'failureCount', 'circuitState'])
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
