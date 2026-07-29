import type {GreenfieldModuleCompatibility} from './compatibility.js'
import type {GreenfieldModuleContributions} from './contributions.js'
import type {GreenfieldModuleDependency} from './dependencies.js'
import type {GreenfieldModuleIntegrity} from './integrity.js'
import type {GreenfieldModuleLifecycleManifest} from './lifecycle.js'
import type {GreenfieldModulePermission} from './permissions.js'
import type {GreenfieldGitHubModuleSource} from './source.js'
import type {GreenfieldModuleBackendDefinition} from './backend.js'

export const GREENFIELD_MODULE_MANIFEST_VERSION = 1 as const

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
  manifestVersion: 1
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
  integrity: GreenfieldModuleIntegrity
  extensions?: Record<string, unknown>
}

export type GreenfieldModuleManifest = GreenfieldModuleManifestV1
export type {GreenfieldGitHubModuleSource}
