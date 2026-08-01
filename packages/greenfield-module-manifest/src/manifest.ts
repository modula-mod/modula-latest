import type {GreenfieldModuleCompatibility} from './compatibility.js'
import type {GreenfieldModuleContributions} from './contributions.js'
import type {GreenfieldModuleDependency} from './dependencies.js'
import type {GreenfieldModuleIntegrity} from './integrity.js'
import type {GreenfieldModuleLifecycleManifest} from './lifecycle.js'
import type {GreenfieldModulePermission} from './permissions.js'
import type {GreenfieldGitHubModuleSource} from './source.js'
import type {GreenfieldModuleBackendDefinition} from './backend.js'
import type {GreenfieldModuleAiDeclaration} from './ai.js'
import type {ModuleStandard20ManifestExtensions, ModuleStandard20SectionVersions} from '@modula/module-standard'

export const GREENFIELD_MODULE_MANIFEST_VERSION = 1 as const
export const GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION = 2 as const

export type GreenfieldModuleLicenseStatus =
  | 'firstParty'
  | 'verified'
  | 'declared'
  | 'founderOverride'
  | 'unknown'
  | 'denied'

export type GreenfieldModuleTrustLevel =
  | 'firstParty'
  | 'verifiedPublisher'
  | 'reviewedCommunity'
  | 'untrustedManifest'

export type GreenfieldModuleManifestV1 = {
  manifestVersion: typeof GREENFIELD_MODULE_MANIFEST_VERSION
  moduleId: string
  name: string
  description: string
  version: string
  publisher: {
    publisherId: string
    displayName: string
    website?: string
  }
  source: {
    provider: 'github'
    repository: string
    commit: string
    manifestPath: string
    releaseTag?: string
    releaseAssetName?: string
  }
  license: {
    status: GreenfieldModuleLicenseStatus
    spdx?: string
    evidenceIds: string[]
  }
  trust: {
    requestedLevel: GreenfieldModuleTrustLevel
  }
  compatibility: GreenfieldModuleCompatibility
  permissions: GreenfieldModulePermission[]
  dependencies?: GreenfieldModuleDependency[]
  contributions: GreenfieldModuleContributions
  lifecycle?: GreenfieldModuleLifecycleManifest
  backend?: GreenfieldModuleBackendDefinition
  ai?: GreenfieldModuleAiDeclaration
  integrity: GreenfieldModuleIntegrity
  extensions?: Record<string, unknown>
}

export type GreenfieldModuleManifestV2 = Omit<GreenfieldModuleManifestV1, 'manifestVersion'> &
  ModuleStandard20ManifestExtensions & {
    manifestVersion: typeof GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION
    standardVersion: '2.0.0'
    sectionVersions: ModuleStandard20SectionVersions
  }

export type GreenfieldModuleManifest = GreenfieldModuleManifestV1 | GreenfieldModuleManifestV2
export type {GreenfieldGitHubModuleSource}
