import type {GreenfieldRuntimeCapability} from './capability.js'
import type {GreenfieldEngineKind} from './engine-kind.js'
import type {GreenfieldRuntimePlatform} from './provider.js'

export type GreenfieldEngineFallbackPolicy =
  | 'required'
  | 'degraded-allowed'
  | 'installable-provider-required'
  | 'optional'

export type GreenfieldNativeBuildPolicy =
  | 'not-required'
  | 'allowed'
  | 'required'
  | 'forbidden'

export type GreenfieldEngineRequirement = {
  requirementId: string
  kind: GreenfieldEngineKind
  capabilities: GreenfieldRuntimeCapability[]
  minimumApiVersion?: string
  fallbackPolicy: GreenfieldEngineFallbackPolicy
  requiredPermissions?: string[]
  supportedPlatforms?: GreenfieldRuntimePlatform[]
  nativeBuildPolicy?: GreenfieldNativeBuildPolicy
}

export type GreenfieldResolvedModuleRuntimeSubject = {
  accountId: string
  moduleId: string
  installationId: string
  installationStatus: 'installed' | 'enabled' | 'disabled' | 'quarantined' | 'removed' | 'installing' | 'updating' | 'failed'
  releaseId: string
  releaseVersion: string
  releaseState: 'published' | 'pendingReview' | 'quarantined' | 'revoked' | 'superseded' | 'failed'
  trustLevel: 'firstParty' | 'verifiedPublisher' | 'reviewedCommunity' | 'untrustedManifest'
  engineRequirements: GreenfieldEngineRequirement[]
  grantedPermissions: string[]
}
