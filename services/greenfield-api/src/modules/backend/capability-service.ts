import type {ModuleBackendDefinition, ModuleBackendDiscovery, ResolvedModuleCapability} from '@modula/greenfield-module-manifest'
import type {GreenfieldModuleRuntimeContext} from '../runtime-access.js'

const GREENFIELD_CAPABILITIES = new Set(['records', 'actions', 'search', 'events', 'settings', 'permissions', 'exports', 'health', 'storage'])

export class ModuleBackendCapabilityService {
  resolve(context: GreenfieldModuleRuntimeContext, backend: ModuleBackendDefinition, discovery?: ModuleBackendDiscovery): ResolvedModuleCapability[] {
    const declared = new Set<string>([
      ...(context.manifest.permissions ?? []).map(permission => permission.permission),
      ...(discovery?.capabilities ?? []),
      ...(backend.actions ?? []).map(action => action.actionId),
    ])
    const capabilities = Array.from(declared).sort()
    return capabilities.map(capability => {
      const provider = GREENFIELD_CAPABILITIES.has(capability) && backend.mode !== 'module-managed' ? 'greenfield' : 'module-backend'
      return {
        capability,
        available: provider === 'greenfield' || Boolean(discovery?.capabilities?.includes(capability) || (backend.actions ?? []).some(action => action.actionId === capability)),
        granted: !context.permissionReviewRequired && (context.grantedPermissions.includes(capability) || (backend.actions ?? []).some(action => action.actionId === capability)),
        provider,
        reason: provider === 'module-backend' ? 'resolved through module backend declaration' : 'resolved through Greenfield platform',
      } satisfies ResolvedModuleCapability
    })
  }
}
