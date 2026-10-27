import {compareSemver, isSemver, isSemverRange, satisfiesSemverRange} from '@modula/greenfield-module-manifest'
import type {PackageLockfile, PackageReleaseDescriptor} from '@modula/greenfield-module-registry-contracts'

export type PackageResolutionRequest = {
  requested: Array<{packageId: string; versionRange: string}>
  available: PackageReleaseDescriptor[]
  hostVersion: string
  platform: string
  hostCapabilities: ReadonlySet<string>
  trustedPublishers: ReadonlySet<string>
  /** Only public immutable bytes may be reused across account installations. */
  installedPublicDigests: ReadonlySet<string>
}

export class PackageResolutionError extends Error {
  constructor(readonly code: string, message: string) { super(message) }
}

/** Deterministic backtracking across the existing signed product release catalogue. */
export function resolvePackageClosure(request: PackageResolutionRequest): PackageLockfile {
  if (!isSemver(request.hostVersion)) throw new PackageResolutionError('HOST_VERSION_INVALID', 'Host version is invalid')
  if (!request.requested.length || request.requested.length > 32 || request.available.length > 4096) {
    throw new PackageResolutionError('PACKAGE_GRAPH_BOUNDS', 'Requested package count or catalogue exceeds the supported bound')
  }
  const catalogue = new Map<string, PackageReleaseDescriptor[]>()
  for (const release of request.available) {
    validateRelease(release)
    const rows = catalogue.get(release.packageId) ?? []
    rows.push(release)
    catalogue.set(release.packageId, rows)
  }
  for (const rows of catalogue.values()) rows.sort((a, b) =>
    compareSemver(b.version, a.version) || a.artifact.sha256.localeCompare(b.artifact.sha256) || a.releaseId.localeCompare(b.releaseId))

  const constraints = new Map<string, string[]>()
  for (const item of request.requested) addConstraint(constraints, item.packageId, item.versionRange)
  let lastFailure: PackageResolutionError | null = null
  let visited = 0
  const solve = (chosen: Map<string, PackageReleaseDescriptor>, ranges: Map<string, string[]>): Map<string, PackageReleaseDescriptor> | null => {
    if (++visited > 16384 || chosen.size > 128) throw new PackageResolutionError('PACKAGE_GRAPH_BOUNDS', 'Dependency closure exceeds the supported bound')
    const pending = [...ranges.keys()].filter(id => !chosen.has(id)).sort()[0]
    if (!pending) {
      const cycle = findCycle(chosen)
      if (cycle) { lastFailure = new PackageResolutionError('DEPENDENCY_CYCLE', `Dependency cycle: ${cycle.join(' -> ')}`); return null }
      return chosen
    }
    const all = catalogue.get(pending)
    if (!all?.length) { lastFailure = new PackageResolutionError('DEPENDENCY_MISSING', `No signed release exists for ${pending}`); return null }
    const candidates = all.filter(release => ranges.get(pending)!.every(range => satisfiesSemverRange(release.version, range)))
    if (!candidates.length) { lastFailure = new PackageResolutionError('DEPENDENCY_CONFLICT', `No version of ${pending} satisfies ${ranges.get(pending)!.join(', ')}`); return null }
    for (const release of candidates) {
      const invalid = incompatible(release, request)
      if (invalid) { lastFailure = invalid; continue }
      const nextChosen = new Map(chosen).set(pending, release)
      const nextRanges = new Map([...ranges].map(([id, values]) => [id, [...values]]))
      let compatible = true
      for (const dependency of release.dependencies) {
        addConstraint(nextRanges, dependency.packageId, dependency.versionRange)
        const selected = nextChosen.get(dependency.packageId)
        if (selected && !satisfiesSemverRange(selected.version, dependency.versionRange)) {
          lastFailure = new PackageResolutionError('DEPENDENCY_CONFLICT', `${release.packageId} requires ${dependency.packageId}@${dependency.versionRange}`)
          compatible = false
          break
        }
      }
      if (compatible) {
        const result = solve(nextChosen, nextRanges)
        if (result) return result
      }
    }
    return null
  }
  const chosen = solve(new Map(), constraints)
  if (!chosen) throw lastFailure ?? new PackageResolutionError('DEPENDENCY_CONFLICT', 'No compatible package closure exists')
  const packages = [...chosen.values()].sort((a, b) => a.packageId.localeCompare(b.packageId))
    .map(release => ({...release, platforms: [...release.platforms].sort(), requiredCapabilities: [...release.requiredCapabilities].sort(),
      dependencies: [...release.dependencies].sort((a, b) => a.packageId.localeCompare(b.packageId) || a.versionRange.localeCompare(b.versionRange))}))
  const counted = new Set<string>()
  let aggregateCompressedBytes = 0
  let aggregateInstalledEstimateBytes = 0
  let newDownloadBytes = 0
  const reusedArtifactDigests: string[] = []
  for (const release of packages) {
    const digest = release.artifact.sha256
    const shareable = release.sharing === 'public-immutable'
    if (shareable && counted.has(digest)) continue
    if (shareable) counted.add(digest)
    aggregateCompressedBytes += release.artifact.compressedSizeBytes
    aggregateInstalledEstimateBytes += release.artifact.installedSizeEstimateBytes
    if (shareable && request.installedPublicDigests.has(digest)) reusedArtifactDigests.push(digest)
    else newDownloadBytes += release.artifact.compressedSizeBytes
  }
  return {schemaVersion: 'modula.package-lock.1', requested: [...new Set(request.requested.map(item => item.packageId))].sort(),
    packages, aggregateCompressedBytes, aggregateInstalledEstimateBytes, newDownloadBytes,
    reusedArtifactDigests: reusedArtifactDigests.sort()}
}

function addConstraint(ranges: Map<string, string[]>, id: string, range: string): void {
  if (!id || !isSemverRange(range)) throw new PackageResolutionError('DEPENDENCY_CONSTRAINT_INVALID', `Invalid dependency constraint for ${id}`)
  const values = ranges.get(id) ?? []
  if (!values.includes(range)) values.push(range)
  ranges.set(id, values)
}

function validateRelease(release: PackageReleaseDescriptor): void {
  if (release.schemaVersion !== 'modula.package.1' || !release.packageId || !release.publisherId || !isSemver(release.version) ||
      !['module', 'web-runtime', 'game-content', 'model-data', 'asset-pack'].includes(release.category) ||
      !['public-immutable', 'account-private'].includes(release.sharing) ||
      !['retain-while-owned', 'remove-when-unused'].includes(release.cachePolicy) ||
      !/^[a-f0-9]{64}$/.test(release.artifact.sha256) || !Number.isSafeInteger(release.artifact.compressedSizeBytes) ||
      release.artifact.compressedSizeBytes < 1 || !Number.isSafeInteger(release.artifact.installedSizeEstimateBytes) ||
      release.artifact.installedSizeEstimateBytes < 1 || !isSemverRange(release.minimumHostVersion) ||
      !release.signature.keyId || !release.signature.signature || release.signature.algorithm !== 'Ed25519' ||
      !release.releaseId || !release.platforms.length || release.platforms.some(item => !['ios', 'android', 'web', 'macos', 'windows'].includes(item)) ||
      !release.artifact.download.pathOrUrl || !['none', 'bearer'].includes(release.artifact.download.authorization)) {
    throw new PackageResolutionError('PACKAGE_METADATA_INVALID', `Invalid signed release metadata for ${release.packageId}`)
  }
  if (release.category === 'web-runtime' && release.sharing !== 'public-immutable') {
    throw new PackageResolutionError('PACKAGE_METADATA_INVALID', `Web runtime ${release.packageId} must be public immutable content`)
  }
  if (release.category === 'model-data' && !release.executionProvider) {
    throw new PackageResolutionError('PACKAGE_METADATA_INVALID', `Model ${release.packageId} lacks an execution provider`)
  }
  for (const dependency of release.dependencies) addConstraint(new Map(), dependency.packageId, dependency.versionRange)
}

function incompatible(release: PackageReleaseDescriptor, request: PackageResolutionRequest): PackageResolutionError | null {
  if (!release.trust.verified || !release.trust.publisherVerified || !request.trustedPublishers.has(release.publisherId))
    return new PackageResolutionError('PACKAGE_UNTRUSTED', `${release.packageId}@${release.version} is not trusted`)
  if (release.trust.revoked) return new PackageResolutionError('PACKAGE_REVOKED', `${release.packageId}@${release.version} is revoked`)
  if (!satisfiesSemverRange(request.hostVersion, release.minimumHostVersion))
    return new PackageResolutionError('HOST_INCOMPATIBLE', `${release.packageId}@${release.version} requires host ${release.minimumHostVersion}`)
  if (!release.platforms.includes(request.platform))
    return new PackageResolutionError('PLATFORM_UNSUPPORTED', `${release.packageId}@${release.version} does not support ${request.platform}`)
  const missing = release.requiredCapabilities.filter(value => !request.hostCapabilities.has(value))
  if (missing.length) return new PackageResolutionError('CAPABILITY_UNSUPPORTED', `${release.packageId}@${release.version} requires ${missing.join(', ')}`)
  if (release.category === 'model-data' && (!release.executionProvider || !request.hostCapabilities.has(release.executionProvider)))
    return new PackageResolutionError('EXECUTION_PROVIDER_UNAVAILABLE', `${release.packageId}@${release.version} has no compatible model provider`)
  return null
}

function findCycle(chosen: Map<string, PackageReleaseDescriptor>): string[] | null {
  const visited = new Set<string>()
  const active = new Set<string>()
  const visit = (id: string, path: string[]): string[] | null => {
    if (active.has(id)) return [...path.slice(path.indexOf(id)), id]
    if (visited.has(id)) return null
    active.add(id)
    for (const dependency of chosen.get(id)?.dependencies ?? []) {
      const cycle = visit(dependency.packageId, [...path, id])
      if (cycle) return cycle
    }
    active.delete(id)
    visited.add(id)
    return null
  }
  for (const id of [...chosen.keys()].sort()) {
    const cycle = visit(id, [])
    if (cycle) return cycle
  }
  return null
}
