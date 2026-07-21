import {
  isSemver,
  isSemverRange,
  type GreenfieldModulePlatform,
  type GreenfieldModuleCompatibility,
} from './compatibility.js'
import {CONTRIBUTION_GROUPS, flattenContributionIds, type GreenfieldModuleContributions} from './contributions.js'
import {canPublisherUseNamespace, isGreenfieldModuleId} from './identity.js'
import {isSha256} from './integrity.js'
import {GREENFIELD_MODULE_MANIFEST_VERSION, type GreenfieldModuleManifestV1} from './manifest.js'
import {validatePermissionRequest} from './permissions.js'
import {isGitHubRepository, isImmutableGitCommit, isMutableGitReference, isSafeManifestPath} from './source.js'

export type GreenfieldManifestValidationIssue = {
  path: string
  code: string
  message: string
}

export type GreenfieldManifestValidationResult = {
  valid: boolean
  manifest?: GreenfieldModuleManifestV1
  issues: GreenfieldManifestValidationIssue[]
}

const ROOT_KEYS = new Set([
  'manifestVersion',
  'moduleId',
  'name',
  'description',
  'version',
  'publisher',
  'source',
  'license',
  'trust',
  'compatibility',
  'permissions',
  'dependencies',
  'contributions',
  'lifecycle',
  'integrity',
  'extensions',
])

const PLATFORMS = new Set<GreenfieldModulePlatform>(['ios', 'android', 'web', 'server'])

export function validateGreenfieldModuleManifest(
  input: unknown,
  options: {firstPartyPublisherIds?: string[]} = {},
): GreenfieldManifestValidationResult {
  const issues: GreenfieldManifestValidationIssue[] = []
  const add = (path: string, code: string, message: string) => issues.push({path, code, message})

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    add('$', 'MANIFEST_NOT_OBJECT', 'Manifest must be a JSON object')
    return {valid: false, issues}
  }

  const manifest = input as Record<string, any>
  for (const key of Object.keys(manifest)) {
    if (!ROOT_KEYS.has(key)) add(`$.${key}`, 'UNKNOWN_ROOT_PROPERTY', `Unknown critical root property ${key}`)
  }

  if (manifest.manifestVersion !== GREENFIELD_MODULE_MANIFEST_VERSION) {
    add('$.manifestVersion', 'UNSUPPORTED_MANIFEST_VERSION', 'Only Greenfield Module Manifest v1 is supported')
  }
  if (!isGreenfieldModuleId(manifest.moduleId)) {
    add('$.moduleId', 'INVALID_MODULE_ID', 'Module ID must be a lowercase reverse-domain identifier')
  }
  const firstParty =
    manifest.trust?.requestedLevel === 'firstParty' ||
    manifest.license?.status === 'firstParty' ||
    (options.firstPartyPublisherIds ?? ['modula', 'digital.modula']).includes(manifest.publisher?.publisherId)
  if (typeof manifest.moduleId === 'string' && !canPublisherUseNamespace(manifest.moduleId, firstParty)) {
    add('$.moduleId', 'RESERVED_NAMESPACE_MISUSE', 'Reserved namespaces require first-party publisher verification')
  }
  checkBoundedString(manifest.name, '$.name', 1, 120, add)
  checkBoundedString(manifest.description, '$.description', 1, 2000, add)
  if (!isSemver(manifest.version)) add('$.version', 'INVALID_SEMVER', 'Manifest version must be semantic version')

  if (!manifest.publisher || typeof manifest.publisher !== 'object') {
    add('$.publisher', 'MISSING_PUBLISHER', 'Manifest publisher is required')
  } else {
    checkBoundedString(manifest.publisher.publisherId, '$.publisher.publisherId', 1, 160, add)
    checkBoundedString(manifest.publisher.displayName, '$.publisher.displayName', 1, 120, add)
  }

  validateSource(manifest.source, add)
  validateLicense(manifest.license, add)
  validateCompatibility(manifest.compatibility, add)
  validatePermissions(manifest.permissions, {firstParty, community: manifest.trust?.requestedLevel !== 'firstParty'}, add)
  validateDependencies(manifest.dependencies, manifest.moduleId, add)
  validateContributions(manifest.contributions, manifest.moduleId, add)
  validateLifecycle(manifest.lifecycle, add)
  validateIntegrity(manifest.integrity, add)

  return {valid: issues.length === 0, manifest: issues.length === 0 ? (manifest as GreenfieldModuleManifestV1) : undefined, issues}
}

function validateSource(source: any, add: (path: string, code: string, message: string) => void) {
  if (!source || typeof source !== 'object') {
    add('$.source', 'MISSING_SOURCE', 'Immutable GitHub source is required')
    return
  }
  if (source.provider !== 'github') add('$.source.provider', 'INVALID_SOURCE_PROVIDER', 'Only github source is supported')
  if (typeof source.repository !== 'string' || !isGitHubRepository(source.repository)) {
    add('$.source.repository', 'INVALID_REPOSITORY', 'GitHub source must be owner/repository')
  }
  if (typeof source.commit !== 'string' || !isImmutableGitCommit(source.commit) || isMutableGitReference(source.commit)) {
    add('$.source.commit', 'INVALID_SOURCE_COMMIT', 'Source commit must be a full immutable commit SHA')
  }
  if (typeof source.manifestPath !== 'string' || !isSafeManifestPath(source.manifestPath)) {
    add('$.source.manifestPath', 'INVALID_MANIFEST_PATH', 'Manifest path must be a safe relative JSON path')
  }
}

function validateLicense(license: any, add: (path: string, code: string, message: string) => void) {
  const statuses = new Set(['firstParty', 'verified', 'declared', 'founderOverride', 'unknown', 'denied'])
  if (!license || typeof license !== 'object') {
    add('$.license', 'MISSING_LICENSE', 'License evidence is required')
    return
  }
  if (!statuses.has(license.status)) add('$.license.status', 'INVALID_LICENSE_STATUS', 'Unsupported license status')
  if (!Array.isArray(license.evidenceIds) || license.evidenceIds.length > 50) {
    add('$.license.evidenceIds', 'INVALID_LICENSE_EVIDENCE', 'License evidence IDs must be a bounded array')
  }
}

function validateCompatibility(
  compatibility: GreenfieldModuleCompatibility | undefined,
  add: (path: string, code: string, message: string) => void,
) {
  if (!compatibility || typeof compatibility !== 'object') {
    add('$.compatibility', 'MISSING_COMPATIBILITY', 'Compatibility declaration is required')
    return
  }
  for (const key of ['minimumGreenfieldVersion', 'minimumModulaHostVersion'] as const) {
    if (!isSemver((compatibility as any)[key])) add(`$.compatibility.${key}`, 'INVALID_SEMVER', `${key} must be semantic version`)
  }
  for (const key of ['maximumGreenfieldVersion', 'maximumModulaHostVersion'] as const) {
    const value = (compatibility as any)[key]
    if (value !== undefined && !isSemver(value)) add(`$.compatibility.${key}`, 'INVALID_SEMVER', `${key} must be semantic version`)
  }
  if (!Array.isArray(compatibility.protocolVersions) || compatibility.protocolVersions.length < 1 || compatibility.protocolVersions.length > 20) {
    add('$.compatibility.protocolVersions', 'INVALID_PROTOCOLS', 'At least one bounded protocol version is required')
  }
  if (!Array.isArray(compatibility.platforms) || compatibility.platforms.length < 1 || compatibility.platforms.length > 4) {
    add('$.compatibility.platforms', 'INVALID_PLATFORMS', 'At least one bounded platform is required')
  } else {
    for (const platform of compatibility.platforms) {
      if (!PLATFORMS.has(platform)) add('$.compatibility.platforms', 'UNSUPPORTED_PLATFORM', `Unsupported platform ${platform}`)
    }
  }
}

function validatePermissions(
  permissions: any,
  options: {firstParty: boolean; community: boolean},
  add: (path: string, code: string, message: string) => void,
) {
  if (!Array.isArray(permissions) || permissions.length > 80) {
    add('$.permissions', 'INVALID_PERMISSIONS', 'Permissions must be a bounded array')
    return
  }
  permissions.forEach((permission, index) => {
    for (const message of validatePermissionRequest(permission, options)) {
      add(`$.permissions[${index}]`, 'INVALID_PERMISSION', message)
    }
  })
}

function validateDependencies(
  dependencies: any,
  moduleId: string,
  add: (path: string, code: string, message: string) => void,
) {
  if (dependencies === undefined) return
  if (!Array.isArray(dependencies) || dependencies.length > 40) {
    add('$.dependencies', 'INVALID_DEPENDENCIES', 'Dependencies must be a bounded array')
    return
  }
  dependencies.forEach((dependency, index) => {
    if (!isGreenfieldModuleId(dependency?.moduleId)) add(`$.dependencies[${index}].moduleId`, 'INVALID_MODULE_ID', 'Invalid dependency module ID')
    if (dependency?.moduleId === moduleId) add(`$.dependencies[${index}].moduleId`, 'SELF_DEPENDENCY', 'Module cannot depend on itself')
    if (!isSemverRange(dependency?.versionRange)) {
      add(`$.dependencies[${index}].versionRange`, 'INVALID_SEMVER_RANGE', 'Dependency version range must be semantic')
    }
    if (typeof dependency?.optional !== 'boolean') add(`$.dependencies[${index}].optional`, 'INVALID_OPTIONAL', 'Dependency optional flag is required')
  })
}

function validateContributions(
  contributions: GreenfieldModuleContributions | undefined,
  moduleId: string,
  add: (path: string, code: string, message: string) => void,
) {
  if (!contributions || typeof contributions !== 'object' || Array.isArray(contributions)) {
    add('$.contributions', 'MISSING_CONTRIBUTIONS', 'Contributions object is required')
    return
  }
  const ids = flattenContributionIds(contributions)
  if (ids.length > 200) add('$.contributions', 'TOO_MANY_CONTRIBUTIONS', 'Contribution arrays are bounded at 200 IDs')
  const seen = new Set<string>()
  for (const id of ids) {
    if (typeof id !== 'string' || !id.startsWith(`${moduleId}.`)) {
      add('$.contributions', 'CONTRIBUTION_OUTSIDE_NAMESPACE', `Contribution ${String(id)} must begin with ${moduleId}.`)
    }
    if (seen.has(id)) add('$.contributions', 'DUPLICATE_CONTRIBUTION_ID', `Duplicate contribution ID ${id}`)
    seen.add(id)
  }
  for (const group of CONTRIBUTION_GROUPS) {
    const entries = contributions[group]
    if (entries !== undefined && (!Array.isArray(entries) || entries.length > 50)) {
      add(`$.contributions.${group}`, 'INVALID_CONTRIBUTION_GROUP', `${group} must be a bounded array`)
    }
  }
  for (const route of contributions.routes ?? []) {
    if (!route.path?.startsWith(`/module/${moduleId}`)) add('$.contributions.routes', 'INVALID_ROUTE', 'Module routes must live under /module/{moduleId}')
  }
}

function validateLifecycle(lifecycle: any, add: (path: string, code: string, message: string) => void) {
  if (lifecycle === undefined) return
  const modes = new Set(['declarative', 'builtIn', 'backgroundJob', 'remoteHttp'])
  if (!modes.has(lifecycle.executionMode)) add('$.lifecycle.executionMode', 'INVALID_EXECUTION_MODE', 'Unsupported execution mode')
}

function validateIntegrity(integrity: any, add: (path: string, code: string, message: string) => void) {
  if (!integrity || typeof integrity !== 'object') {
    add('$.integrity', 'MISSING_INTEGRITY', 'Integrity checksums are required')
    return
  }
  if (!isSha256(integrity.manifestSha256)) add('$.integrity.manifestSha256', 'INVALID_SHA256', 'Manifest checksum must be SHA-256 hex')
  if (integrity.releaseSha256 !== undefined && !isSha256(integrity.releaseSha256)) {
    add('$.integrity.releaseSha256', 'INVALID_SHA256', 'Release checksum must be SHA-256 hex')
  }
}

function checkBoundedString(
  value: unknown,
  path: string,
  min: number,
  max: number,
  add: (path: string, code: string, message: string) => void,
) {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    add(path, 'INVALID_STRING_LENGTH', `${path} must be a string between ${min} and ${max} characters`)
  }
}
