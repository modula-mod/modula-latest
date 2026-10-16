import type {GreenfieldModulePlatform, ModuleStandardRuntimeSupportState} from '@modula/greenfield-module-manifest'
import type {GreenfieldModuleReleaseStatus} from './release.js'

export type GreenfieldRegistryModuleSummary = {
  moduleId: string
  productKind?: 'module' | 'addon' | 'plugin' | 'function' | 'tool' | 'widget' | 'connector' | 'service' | 'engine' | 'game' | 'integration' | 'theme'
  name: string
  description: string
  publisherId: string
  publisherName: string
  latestVersion: string | null
  /** Explicit stable-channel alias; latestVersion remains for v1 compatibility. */
  latestStableVersion?: string | null
  /** Newest published release across stable, beta, rc and dev channels. */
  newestPublishedVersion?: string | null
  newestPublishedChannel?: 'stable' | 'beta' | 'rc' | 'dev' | null
  registryReleaseId?: string | null
  releaseChannel?: 'stable' | 'beta' | 'rc' | 'dev' | null
  releaseSizeBytes?: number | null
  trustLevel: string
  licenseStatus: string
  status: GreenfieldModuleReleaseStatus | 'planned' | 'inactive' | 'unavailable'
  installable: boolean
  platforms: GreenfieldModulePlatform[]
  permissionRequirements?: Array<{permission: string; reason?: string; risk?: string}>
  compatibility?: Record<string, unknown>
  presentation?: unknown
  trustSummary?: unknown
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
  productKind?: 'module' | 'addon' | 'plugin' | 'function' | 'tool' | 'widget' | 'connector' | 'service' | 'engine' | 'game' | 'integration' | 'theme' | 'all'
  capability?: string
  limit?: number
  cursor?: string
}

/** A missing registry declaration is intentionally different from `false`. */
export type GreenfieldRegistryDeclaration<T> =
  | {state: 'declared'; value: T}
  | {state: 'unknown'}

export type GreenfieldModulePreview = {
  id: string
  type: 'image' | 'video'
  source: string
  posterSource?: string
  alt?: string
  width?: number
  height?: number
  sortOrder: number
}

export type GreenfieldModuleRatingAggregate = {
  average: number | null
  count: number
  updatedAt: string | null
}

export type GreenfieldModuleMarketplace = {
  category: GreenfieldRegistryDeclaration<string>
  ageRating: GreenfieldRegistryDeclaration<string>
  privacy: GreenfieldRegistryDeclaration<string>
  offlineSupport: GreenfieldRegistryDeclaration<boolean>
  syncSupport: GreenfieldRegistryDeclaration<boolean>
  inAppPurchases: GreenfieldRegistryDeclaration<boolean>
  previews: GreenfieldModulePreview[]
  rating: GreenfieldModuleRatingAggregate
  installations: {count: number}
  chart: {rank: number; category: string; totalModules: number} | null
  release: {
    publishedAt: string | null
    sizeBytes: number | null
    notes: string[]
  }
}

export type GreenfieldModuleRating = GreenfieldModuleRatingAggregate & {
  moduleId: string
  userRating: number
}
