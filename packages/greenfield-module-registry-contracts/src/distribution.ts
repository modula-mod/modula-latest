/** Canonical, platform-neutral MODULE-DISTRIBUTION-03 contracts. */

export const MODULE_DISTRIBUTION_DESCRIPTOR_VERSION = '1.0.0' as const
export const MODULE_RELEASE_SIGNATURE_PAYLOAD_VERSION = 1 as const

export type ModuleReleaseChannel = 'stable' | 'beta' | 'rc' | 'dev'
export type ModuleUpdatePolicy = 'automaticStable' | 'followChannel' | 'lockedVersion' | 'manual'

export type ModuleArtifactKind =
  | 'module-package'
  | 'frontend'
  | 'asset'
  | 'icon'
  | 'cover'
  | 'screenshot'
  | 'schema'
  | 'other'

export type ModuleArtifactAccess = 'public' | 'installation'

export type ModuleArtifactDescriptor = {
  artifactId: string
  kind: ModuleArtifactKind
  digest: string
  digestAlgorithm: 'sha256'
  size: number
  contentType: string
  immutable: true
  requiredForOfflineLaunch: boolean
  access: ModuleArtifactAccess
  download: {
    method: 'GET'
    pathOrUrl: string
    authorization: 'none' | 'bearer'
    range: boolean
  }
}

export type HostCapabilityRequirement = {
  capability: string
  versionRange?: string
  required: boolean
  fallback?: string
}

export type ModuleCompatibilityReason = {
  code:
    | 'MODULE_SDK_TOO_OLD'
    | 'MODULE_SDK_TOO_NEW'
    | 'PRODUCT_UI_CONTRACT_UNSUPPORTED'
    | 'HOST_RANGE_UNSATISFIED'
    | 'FRONTEND_HOST_RUNTIME_UNSATISFIED'
    | 'HOST_VERSION_TOO_OLD'
    | 'HOST_VERSION_TOO_NEW'
    | 'PLATFORM_UNSUPPORTED'
    | 'CAPABILITY_UNAVAILABLE'
    | 'RELEASE_REVOKED'
    | string
  message: string
  required?: string
  actual?: string
  capability?: string
}

export type ModuleCompatibilityResult = {
  evaluated: boolean
  compatible: boolean | null
  reasons: ModuleCompatibilityReason[]
  actual: {
    hostVersion: string | null
    platform: string | null
    moduleSdk: string | null
    productUiContract: string | null
    hostCapabilities: string[]
  }
}

export type ModuleReleaseDescriptor = {
  descriptorVersion: typeof MODULE_DISTRIBUTION_DESCRIPTOR_VERSION
  moduleId: string
  version: string
  releaseId: string
  channel: ModuleReleaseChannel
  manifestDigest: string
  packageDigest: string
  frontendDigest?: string
  signature: {
    algorithm: 'Ed25519'
    keyId: string
    signature: string
    signaturePayloadVersion: typeof MODULE_RELEASE_SIGNATURE_PAYLOAD_VERSION
    statementDigest: string | null
  }
  trust: {
    verified: boolean
    signatureState: 'verified' | 'unsigned' | 'unverified' | 'invalid' | 'unknownKey' | 'revokedKey'
    publisherVerified: boolean
    signerRevoked: boolean
    warnings: string[]
  }
  artifacts: ModuleArtifactDescriptor[]
  moduleSdk: {min?: string; max?: string}
  productUiContract?: string
  requiredHostCapabilities: HostCapabilityRequirement[]
  optionalHostCapabilities: HostCapabilityRequirement[]
  requestedPermissions: string[]
  publishedAt: string
  provenance?: {
    provider: 'github'
    repository: string
    commit: string
    releaseTag: string | null
    releaseAssetName: string | null
  }
  revoked: boolean
}

export type ModulePermissionReviewDescriptor = {
  releaseId: string
  status: 'approved' | 'review-required' | 'denied'
  effectiveCapabilities: string[]
}

export type ModuleInstallationDescriptor = {
  descriptorVersion: typeof MODULE_DISTRIBUTION_DESCRIPTOR_VERSION
  installationId: string
  moduleId: string
  enabled: boolean
  currentRelease: ModuleReleaseDescriptor
  compatibility: ModuleCompatibilityResult
  permissionReview: ModulePermissionReviewDescriptor
  updatePolicy: {
    mode: ModuleUpdatePolicy
    channel: ModuleReleaseChannel
    lockedVersion: string | null
  }
  launchEligible: boolean
  descriptorRevision: string
  updatedAt: string
}

export type ModulePermissionDelta = {
  unchanged: string[]
  removed: string[]
  added: string[]
  changedSemantics: string[]
  reviewRequired: boolean
}

export type ModuleInstallPlan = {
  moduleId: string
  targetRelease: ModuleReleaseDescriptor
  compatibility: ModuleCompatibilityResult
  permissionReviewRequired: boolean
  requestedCapabilities: string[]
  downloadBytes: number
  allowed: boolean
  blockers: Array<{code: string; message: string}>
}

export type ModuleUpdatePlan = {
  installationId: string
  moduleId: string
  expectedDescriptorRevision: string
  currentRelease: ModuleReleaseDescriptor
  targetRelease: ModuleReleaseDescriptor | null
  allowed: boolean
  blockers: Array<{code: string; message: string}>
  compatibility: ModuleCompatibilityResult
  permissionDelta: ModulePermissionDelta
  targetArtifacts: ModuleArtifactDescriptor[]
  downloadBytes: number
  rollbackCandidateReleaseId: string | null
  dataMigration: {
    required: boolean
    supported: boolean
    missingCollections: string[]
    olderCollections: Array<{collection: string; from: string; to: string}>
  }
  permissionReviewRequired: boolean
}

export type ModuleUpdateFeedItem = {
  installationId: string
  moduleId: string
  currentReleaseId: string
  currentVersion: string
  currentTrust: {
    verified: boolean
    signerRevoked: boolean
    releaseRevoked: boolean
  }
  availableTargetReleaseId: string | null
  availableTargetVersion: string | null
  descriptorRevision: string
  permissionReviewRequired: boolean
  compatibility: ModuleCompatibilityResult
  blockedReasonCodes: string[]
}

export type ModuleUpdateFeed = {
  revision: string
  generatedAt: string
  items: ModuleUpdateFeedItem[]
}
