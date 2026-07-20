import type {GreenfieldModuleManifest} from './module.js'

/**
 * Lightweight helpers for Forge / boilerplate — no runtime sandbox.
 */
export function isGreenfieldModuleManifestShape(
  value: unknown,
): value is GreenfieldModuleManifest {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GreenfieldModuleManifest>
  return (
    typeof candidate.moduleId === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.repositoryUrl === 'string' &&
    typeof candidate.packageVersion === 'string' &&
    Array.isArray(candidate.capabilities) &&
    Array.isArray(candidate.permissions) &&
    typeof candidate.uninstallBehaviour === 'string' &&
    !!candidate.hostCompatibility &&
    typeof candidate.hostCompatibility.minimumHostVersion === 'string'
  )
}

export function emptyModuleManifestDraft(
  overrides: Partial<GreenfieldModuleManifest> = {},
): GreenfieldModuleManifest {
  return {
    moduleId: overrides.moduleId ?? 'digital.modula.example',
    name: overrides.name ?? 'Example Module',
    description: overrides.description,
    repositoryUrl: overrides.repositoryUrl ?? 'https://github.com/modula-mod/example-module',
    packageVersion: overrides.packageVersion ?? '0.0.0-preview',
    hostCompatibility: overrides.hostCompatibility ?? {minimumHostVersion: '0.1.0'},
    routes: overrides.routes,
    profileTabs: overrides.profileTabs,
    boardSurfaces: overrides.boardSurfaces,
    settings: overrides.settings,
    functions: overrides.functions,
    tools: overrides.tools,
    widgets: overrides.widgets,
    schemas: overrides.schemas,
    capabilities: overrides.capabilities ?? [],
    permissions: overrides.permissions ?? ['storage:namespaced'],
    migrationMetadata: overrides.migrationMetadata,
    uninstallBehaviour: overrides.uninstallBehaviour ?? 'exportThenPurge',
  }
}
