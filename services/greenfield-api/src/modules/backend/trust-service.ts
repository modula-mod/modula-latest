import {MODULA_MODULE_BACKEND_PROTOCOL_VERSION, type ModuleBackendDefinition, type ModuleBackendDiscovery} from '@modula/greenfield-module-manifest'
import type {GreenfieldModuleRuntimeContext} from '../runtime-access.js'
import {moduleError} from '../module-errors.js'

export class ModuleBackendTrustService {
  verifyDiscovery(context: GreenfieldModuleRuntimeContext, backend: ModuleBackendDefinition, origin: string, discovery: ModuleBackendDiscovery): void {
    if (context.releaseState === 'quarantined' || context.installationStatus === 'quarantined') throw moduleError('FORBIDDEN', 'Module backend is quarantined')
    if (discovery.moduleId !== context.moduleId) throw moduleError('VALIDATION_FAILED', 'Module backend discovery moduleId does not match release')
    if (discovery.moduleVersion !== context.version) throw moduleError('VALIDATION_FAILED', 'Module backend discovery moduleVersion does not match release')
    if (discovery.protocolVersion !== (backend.protocolVersion ?? MODULA_MODULE_BACKEND_PROTOCOL_VERSION)) throw moduleError('VALIDATION_FAILED', 'Module backend protocol version is unsupported')
    const allowedOrigins = new Set(backend.trust?.allowedOrigins ?? [])
    const strategy = backend.endpoints?.baseUrlStrategy
    if (!allowedOrigins.has(origin) && strategy !== 'self-hosted' && strategy !== 'user-configured') {
      throw moduleError('FORBIDDEN', 'Module backend origin is not trusted by the manifest')
    }
    if (discovery.healthUrl) {
      const healthOrigin = new URL(discovery.healthUrl).origin
      if (healthOrigin !== origin) throw moduleError('VALIDATION_FAILED', 'Module backend healthUrl must use the verified backend origin')
    }
  }
}
