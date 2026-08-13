import type {GreenfieldModulePlatform, ModuleStandardRuntimeSupportState} from '@modula/greenfield-module-manifest'
import type {GreenfieldModuleReleaseStatus} from './release.js'

export type GreenfieldRegistryModuleSummary = {
  moduleId: string
  name: string
  description: string
  publisherId: string
  publisherName: string
  latestVersion: string | null
  trustLevel: string
  licenseStatus: string
  status: GreenfieldModuleReleaseStatus | 'planned' | 'inactive' | 'unavailable'
  installable: boolean
  platforms: GreenfieldModulePlatform[]
  standard?: GreenfieldRegistryStandardMetadata
  betaClassification?: GreenfieldModuleBetaClassification
  installability?: GreenfieldModuleInstallabilityProjection
}

export type GreenfieldModuleBetaClassification =
  | 'CANONICAL_PRODUCT'
  | 'VALID_OLDER_RELEASE'
  | 'PLACEHOLDER'
  | 'COMING_SOON'
  | 'INTERNAL_ONLY'
  | 'TEST_ONLY'
  | 'DUPLICATE'
  | 'STALE'
  | 'QUARANTINED'
  | 'BROKEN'

export type GreenfieldModuleInstallabilityStatus =
  | 'available'
  | 'installed'
  | 'update_available'
  | 'coming_soon'
  | 'incompatible'
  | 'quarantined'
  | 'unavailable'

export type GreenfieldModuleInstallabilityProjection = {
  moduleId: string
  release: {version: string; releaseId?: string | null} | null
  status: GreenfieldModuleInstallabilityStatus
  reasonCode: string
  reason: string
}

export type GreenfieldRegistryStandardMetadata = {
  manifestVersion: number | null
  standardVersion: string | null
  sectionVersions: Record<string, string>
  runtimeSupport?: {
    standardVersion: string
    maximumServiceInvocationDepth: number
    sections: Record<string, ModuleStandardRuntimeSupportState>
  }
  runtimeDiagnostics: Array<{
    section: string
    state: ModuleStandardRuntimeSupportState
    declared: boolean
    operational: boolean
    message: string
  }>
  dependencies: Record<'requires' | 'optional' | 'recommended' | 'conflicts' | 'replaces' | 'provides', number>
  registries: {
    services: number
    apis: number
    hooks: number
    jobs: number
    storage: number
    widgets: number
    navigation: number
    ui: number
    automation: number
    metrics: number
  }
  capabilityFlags: Record<string, boolean>
  capabilities: string[]
  engines: string[]
}

export type GreenfieldRegistryFilter = {
  q?: string
  publisher?: string
  trust?: string
  platform?: GreenfieldModulePlatform
  status?: string
  compatible?: boolean
  capability?: string
  limit?: number
  cursor?: string
}
