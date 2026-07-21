import type {GreenfieldModuleManifestV1, GreenfieldModuleTrustLevel, GreenfieldModuleLicenseStatus} from '@modula/greenfield-module-manifest'

export type GreenfieldModuleReleaseStatus =
  | 'draft'
  | 'pendingReview'
  | 'verified'
  | 'published'
  | 'quarantined'
  | 'revoked'
  | 'superseded'

export type GreenfieldModuleReleaseIntegrity = {
  manifestSha256: string
  releaseSha256?: string
  signatureKeyId?: string
  signature?: string
}

export type GreenfieldModuleRelease = {
  releaseId: string
  moduleId: string
  version: string
  publisherId: string
  status: GreenfieldModuleReleaseStatus
  sourceRepository: string
  sourceCommit: string
  manifestPath: string
  manifest: GreenfieldModuleManifestV1
  integrity: GreenfieldModuleReleaseIntegrity
  compatibility: GreenfieldModuleManifestV1['compatibility']
  licenseStatus: GreenfieldModuleLicenseStatus
  trustLevel: GreenfieldModuleTrustLevel
  publishedAt: string | null
  quarantinedAt: string | null
  revokedAt: string | null
  supersededAt: string | null
}

export function isReleaseAvailable(status: GreenfieldModuleReleaseStatus): boolean {
  return status === 'published'
}

export function isReleaseImmutable(status: GreenfieldModuleReleaseStatus): boolean {
  return status === 'published' || status === 'quarantined' || status === 'revoked' || status === 'superseded'
}
