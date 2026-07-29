import {validateModuleBackendDiscovery, type ModuleBackendDiscovery} from '@modula/module-backend-protocol'
import {backendUsesModuleRuntime} from '@modula/greenfield-module-manifest'
import type {ModulaDb} from '../../database/client.js'
import {moduleError} from '../module-errors.js'
import type {GreenfieldModuleRuntimeContext} from '../runtime-access.js'
import {ModuleBackendCapabilityService} from './capability-service.js'
import {fetchBackendJson, resolveBackendEndpoint} from './network-policy.js'
import {ModuleBackendRepository} from './repository.js'
import {ModuleBackendTrustService} from './trust-service.js'

export class ModuleBackendDiscoveryService {
  private readonly repository: ModuleBackendRepository
  private readonly trust = new ModuleBackendTrustService()
  private readonly capabilities = new ModuleBackendCapabilityService()

  constructor(db: ModulaDb) {
    this.repository = new ModuleBackendRepository(db)
  }

  async discover(context: GreenfieldModuleRuntimeContext, input: {origin?: string} = {}) {
    if (!backendUsesModuleRuntime(context.manifest)) {
      return this.repository.ensureInstallation(context, null)
    }
    const backend = await this.repository.ensureDefinitionForContext(context)
    const endpoint = await resolveBackendEndpoint(backend, input.origin)
    await this.repository.ensureInstallation(context, endpoint.origin)
    try {
      const started = Date.now()
      const path = backend.endpoints?.discoveryPath ?? '/.well-known/modula-module'
      const response = await fetchBackendJson(endpoint.urlFor(path), {timeoutMs: backend.health?.timeoutMs ?? 5000, maxResponseBytes: 512_000})
      if (response.status < 200 || response.status >= 300) throw moduleError('VALIDATION_FAILED', `Module backend discovery failed with HTTP ${response.status}`)
      const validation = validateModuleBackendDiscovery(response.json, {
        moduleId: context.moduleId,
        moduleVersion: context.version,
        protocolVersion: backend.protocolVersion ?? '1.0.0',
      })
      if (!validation.valid) throw moduleError('VALIDATION_FAILED', `Invalid module backend discovery: ${validation.issues.map(issue => issue.code).join(', ')}`)
      const discovery = response.json as ModuleBackendDiscovery
      this.trust.verifyDiscovery(context, backend, endpoint.origin, discovery)
      const resolvedCapabilities = this.capabilities.resolve(context, backend, discovery)
      const projection = await this.repository.markDiscovered({context, origin: endpoint.origin, discovery, capabilities: resolvedCapabilities})
      await this.repository.recordHealth({context, component: 'discovery', status: 'healthy', latencyMs: Date.now() - started, circuitState: 'closed', details: {bytes: response.bytes}})
      return projection
    } catch (error) {
      await this.repository.markUnavailable(context, errorCode(error), {message: error instanceof Error ? error.message : String(error)})
      throw error
    }
  }
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error ? String((error as any).code) : 'BACKEND_DISCOVERY_FAILED'
}
