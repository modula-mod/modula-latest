/** Optional data and web runtimes remain releases in the existing GreenField registry. */
export type PackageCategory = 'module' | 'web-runtime' | 'game-content' | 'model-data' | 'asset-pack'

export type PackageReleaseDescriptor = {
  schemaVersion: 'modula.package.1'
  packageId: string
  publisherId: string
  category: PackageCategory
  version: string
  releaseId: string
  artifact: {
    sha256: string
    compressedSizeBytes: number
    installedSizeEstimateBytes: number
    mediaType: string
    download: {pathOrUrl: string; authorization: 'none' | 'bearer'; range: boolean}
  }
  signature: {algorithm: 'Ed25519'; keyId: string; signature: string; statementDigest: string | null}
  trust: {verified: boolean; publisherVerified: boolean; revoked: boolean}
  minimumHostVersion: string
  platforms: string[]
  dependencies: Array<{packageId: string; versionRange: string}>
  requiredCapabilities: string[]
  cachePolicy: 'retain-while-owned' | 'remove-when-unused'
  sharing: 'public-immutable' | 'account-private'
  executionProvider?: string
}

export type PackageLockfile = {
  schemaVersion: 'modula.package-lock.1'
  requested: string[]
  packages: PackageReleaseDescriptor[]
  aggregateCompressedBytes: number
  aggregateInstalledEstimateBytes: number
  newDownloadBytes: number
  reusedArtifactDigests: string[]
}
