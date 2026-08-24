import {
  isSemver,
  isSemverRange,
  type GreenfieldModulePlatform,
  type GreenfieldModuleCompatibility,
} from './compatibility.js'
import {
  MODULA_MODULE_STANDARD_2_VERSION,
  MODULA_MODULE_STANDARD_VERSION,
  MODULA_EXTENSION_CONTRIBUTION_KINDS,
  MODULA_EXTENSION_PRODUCT_KINDS,
  MODULE_STANDARD_20_PERMISSION_CATEGORIES,
  MODULE_STANDARD_20_SECTION_NAMES,
} from '@modula/module-standard'
import {CONTRIBUTION_GROUPS, flattenContributionIds, type GreenfieldModuleContributions} from './contributions.js'
import {validateGreenfieldModuleBackend} from './backend.js'
import {validateGreenfieldModuleAi} from './ai.js'
import {canPublisherUseNamespace, isGreenfieldModuleId} from './identity.js'
import {isSha256} from './integrity.js'
import {GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION, GREENFIELD_MODULE_MANIFEST_VERSION, type GreenfieldModuleManifest} from './manifest.js'
import {validatePermissionRequest} from './permissions.js'
import {isGitHubRepository, isImmutableGitCommit, isMutableGitReference, isSafeManifestPath} from './source.js'

export type GreenfieldManifestValidationIssue = {
  path: string
  code: string
  message: string
}

export type GreenfieldManifestValidationResult = {
  valid: boolean
  manifest?: GreenfieldModuleManifest
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
  'backend',
  'ai',
  'integrity',
  'extensions',
  'standardVersion',
  'sectionVersions',
  'identity',
  'dependencyGraph',
  'serviceRegistry',
  'apiRegistry',
  'eventBus',
  'hookRegistry',
  'capabilityDiscovery',
  'healthModel',
  'diagnosticsModel',
  'metrics',
  'permissionModel',
  'jobRegistry',
  'storageModel',
  'widgetRegistry',
  'navigationRegistry',
  'uiContributions',
  'automationRegistry',
  'offline',
  'realtime',
  'versioning',
  'compatibilityMatrix',
  'marketplace',
  'engineReadiness',
  'exports',
  'imports',
  'synchronization',
  'integrations',
  'billing',
  'telemetry',
  'accessibility',
  'localization',
  'appearance',
  'onboarding',
  'extensionProduct',
])

const PLATFORMS = new Set<GreenfieldModulePlatform>(['ios', 'android', 'web', 'desktop', 'server'])

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

  if (manifest.manifestVersion !== GREENFIELD_MODULE_MANIFEST_VERSION && manifest.manifestVersion !== GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION) {
    add('$.manifestVersion', 'UNSUPPORTED_MANIFEST_VERSION', 'Only Greenfield Module Manifest v1 and v2 are supported')
  }
  if (manifest.manifestVersion === GREENFIELD_MODULE_MANIFEST_VERSION && hasStandard20RootFields(manifest)) {
    add('$.standardVersion', 'STANDARD_2_REQUIRES_MANIFEST_V2', 'Standard 2.0 contract fields require Greenfield Module Manifest v2')
  }
  if (
    manifest.manifestVersion === GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION &&
    manifest.standardVersion !== MODULA_MODULE_STANDARD_2_VERSION &&
    manifest.standardVersion !== MODULA_MODULE_STANDARD_VERSION
  ) {
    add('$.standardVersion', 'UNSUPPORTED_STANDARD_VERSION', 'Greenfield Module Manifest v2 requires Modula Module Standard 2.0.0 or 2.1.0')
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
  for (const issue of validateGreenfieldModuleBackend(manifest.backend, {moduleId: manifest.moduleId, publisherId: manifest.publisher?.publisherId})) {
    add(issue.path, issue.code, issue.message)
  }
  for (const issue of validateGreenfieldModuleAi(manifest.ai, {moduleId: manifest.moduleId})) {
    add(issue.path, issue.code, issue.message)
  }
  validateIntegrity(manifest.integrity, add)
  validateStandard20Extensions(manifest, add)

  return {valid: issues.length === 0, manifest: issues.length === 0 ? (manifest as GreenfieldModuleManifest) : undefined, issues}
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

const STANDARD_20_ROOT_FIELDS = new Set([
  'standardVersion',
  'sectionVersions',
  'identity',
  'dependencyGraph',
  'serviceRegistry',
  'apiRegistry',
  'eventBus',
  'hookRegistry',
  'capabilityDiscovery',
  'healthModel',
  'diagnosticsModel',
  'metrics',
  'permissionModel',
  'jobRegistry',
  'storageModel',
  'widgetRegistry',
  'navigationRegistry',
  'uiContributions',
  'automationRegistry',
  'offline',
  'realtime',
  'versioning',
  'compatibilityMatrix',
  'marketplace',
  'engineReadiness',
  'exports',
  'imports',
  'synchronization',
  'integrations',
  'billing',
  'telemetry',
  'accessibility',
  'localization',
  'appearance',
  'onboarding',
  'extensionProduct',
])

const VERSIONED_STANDARD_20_SECTIONS = [
  'identity',
  'serviceRegistry',
  'apiRegistry',
  'eventBus',
  'hookRegistry',
  'healthModel',
  'diagnosticsModel',
  'metrics',
  'jobRegistry',
  'storageModel',
  'widgetRegistry',
  'navigationRegistry',
  'uiContributions',
  'automationRegistry',
  'exports',
  'imports',
  'synchronization',
  'integrations',
  'billing',
  'telemetry',
  'accessibility',
  'localization',
  'appearance',
  'onboarding',
] as const

function hasStandard20RootFields(manifest: Record<string, any>): boolean {
  return Object.keys(manifest).some(key => STANDARD_20_ROOT_FIELDS.has(key))
}

function validateStandard20Extensions(manifest: Record<string, any>, add: (path: string, code: string, message: string) => void) {
  if (manifest.manifestVersion !== GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION) return
  validateSectionVersions(manifest.sectionVersions, add)
  validateDependencyGraph(manifest.dependencyGraph, manifest.moduleId, add)
  for (const section of VERSIONED_STANDARD_20_SECTIONS) {
    validateVersionedSection(manifest[section], `$.${section}`, add)
  }
  validateNamespacedItems(manifest.serviceRegistry, '$.serviceRegistry', manifest.moduleId, add)
  validateApiRegistry(manifest.apiRegistry, manifest.moduleId, add)
  validateNamespacedItems(manifest.eventBus, '$.eventBus', manifest.moduleId, add)
  validateHookRegistry(manifest.hookRegistry, manifest.moduleId, add)
  validateCapabilityDiscovery(manifest.capabilityDiscovery, add)
  validatePermissionModel(manifest.permissionModel, add)
  validateNamespacedItems(manifest.jobRegistry, '$.jobRegistry', manifest.moduleId, add)
  validateNamespacedItems(manifest.storageModel, '$.storageModel', manifest.moduleId, add)
  validateNamespacedItems(manifest.widgetRegistry, '$.widgetRegistry', manifest.moduleId, add)
  validateNamespacedItems(manifest.navigationRegistry, '$.navigationRegistry', manifest.moduleId, add)
  validateNamespacedItems(manifest.uiContributions, '$.uiContributions', manifest.moduleId, add)
  validateNamespacedItems(manifest.automationRegistry, '$.automationRegistry', manifest.moduleId, add)
  validateVersionedObject(manifest.offline, '$.offline', add)
  validateVersionedObject(manifest.realtime, '$.realtime', add)
  validateVersionedObject(manifest.versioning, '$.versioning', add)
  validateCompatibilityMatrix(manifest.compatibilityMatrix, add)
  validateVersionedObject(manifest.marketplace, '$.marketplace', add)
  validateEngineReadiness(manifest.engineReadiness, add)
  validateExtensionProduct(manifest.extensionProduct, manifest.moduleId, manifest.standardVersion, add)
}

const EXTENSION_PRODUCT_KINDS = new Set<string>(MODULA_EXTENSION_PRODUCT_KINDS)
const EXTENSION_CONTRIBUTION_KINDS = new Set<string>(MODULA_EXTENSION_CONTRIBUTION_KINDS)
const TARGET_REQUIRED_PRODUCT_KINDS = new Set(['addon', 'plugin', 'function', 'tool', 'widget'])
const SAFE_CONTRACT_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/

function validateExtensionProduct(
  value: any,
  moduleId: string,
  standardVersion: string,
  add: (path: string, code: string, message: string) => void,
) {
  if (value === undefined) return
  if (standardVersion !== MODULA_MODULE_STANDARD_VERSION) {
    add('$.extensionProduct', 'EXTENSION_PRODUCT_REQUIRES_STANDARD_2_1', `extensionProduct requires Standard ${MODULA_MODULE_STANDARD_VERSION}`)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    add('$.extensionProduct', 'INVALID_EXTENSION_PRODUCT', 'extensionProduct must be an object')
    return
  }
  rejectUnknown(value, '$.extensionProduct', ['version', 'kind', 'targets', 'extensionPoints', 'contributions', 'retention', 'graphPolicy'], add)
  if (!isSemver(value.version)) add('$.extensionProduct.version', 'INVALID_SEMVER', 'extensionProduct version must be semantic')
  const kind = String(value.kind)
  if (!EXTENSION_PRODUCT_KINDS.has(kind)) add('$.extensionProduct.kind', 'INVALID_EXTENSION_PRODUCT_KIND', 'Unsupported extension product kind')

  if (!Array.isArray(value.targets) || value.targets.length > 40) {
    add('$.extensionProduct.targets', 'INVALID_EXTENSION_TARGETS', 'targets must be a bounded array')
  } else {
    if (TARGET_REQUIRED_PRODUCT_KINDS.has(kind) && value.targets.length === 0) add('$.extensionProduct.targets', 'MISSING_EXTENSION_TARGET', `${kind} products require a target`)
    if (kind === 'module' && value.targets.length > 0) add('$.extensionProduct.targets', 'MODULE_TARGETS_PRODUCT', 'Modules must remain independently usable')
    value.targets.forEach((target: any, index: number) => {
      const path = `$.extensionProduct.targets[${index}]`
      if (!target || typeof target !== 'object' || Array.isArray(target)) {
        add(path, 'INVALID_EXTENSION_TARGET', 'Extension targets must be objects')
        return
      }
      rejectUnknown(target, path, ['productId', 'versionRange', 'requiredCapabilities', 'requiredExtensionPoints'], add)
      if (!isGreenfieldModuleId(target.productId)) add(`${path}.productId`, 'INVALID_PRODUCT_ID', 'Target productId must be a reverse-domain ID')
      if (target.productId === moduleId) add(`${path}.productId`, 'SELF_EXTENSION_TARGET', 'A product cannot target itself')
      if (!isSemverRange(target.versionRange)) add(`${path}.versionRange`, 'INVALID_SEMVER_RANGE', 'Target versionRange must be semantic')
      validateContractIds(target.requiredCapabilities, `${path}.requiredCapabilities`, add)
      validateContractIds(target.requiredExtensionPoints, `${path}.requiredExtensionPoints`, add)
    })
  }

  if (!Array.isArray(value.extensionPoints) || value.extensionPoints.length > 200) {
    add('$.extensionProduct.extensionPoints', 'INVALID_EXTENSION_POINTS', 'extensionPoints must be a bounded array')
  } else {
    value.extensionPoints.forEach((point: any, index: number) => {
      const path = `$.extensionProduct.extensionPoints[${index}]`
      if (!point || typeof point !== 'object' || Array.isArray(point)) {
        add(path, 'INVALID_EXTENSION_POINT', 'Extension points must be objects')
        return
      }
      rejectUnknown(point, path, ['id', 'title', 'contributionKinds', 'requiredCapability', 'platforms', 'maxContributions'], add)
      if (typeof point.id !== 'string' || !point.id.startsWith(`${moduleId}.`)) add(`${path}.id`, 'EXTENSION_POINT_OUTSIDE_NAMESPACE', 'Extension points must use the product namespace')
      checkBoundedString(point.title, `${path}.title`, 1, 160, add)
      validateKinds(point.contributionKinds, `${path}.contributionKinds`, EXTENSION_CONTRIBUTION_KINDS, add)
      if (point.requiredCapability !== undefined) validateContractId(point.requiredCapability, `${path}.requiredCapability`, add)
      validatePlatforms(point.platforms, `${path}.platforms`, add)
      if (point.maxContributions !== undefined && (!Number.isInteger(point.maxContributions) || point.maxContributions < 1 || point.maxContributions > 100)) {
        add(`${path}.maxContributions`, 'INVALID_EXTENSION_POINT_LIMIT', 'maxContributions must be 1..100')
      }
    })
  }

  if (!Array.isArray(value.contributions) || value.contributions.length > 500) {
    add('$.extensionProduct.contributions', 'INVALID_EXTENSION_CONTRIBUTIONS', 'contributions must be a bounded array')
  } else {
    if (kind === 'module' && value.contributions.length > 0) add('$.extensionProduct.contributions', 'MODULE_CROSS_PRODUCT_CONTRIBUTION', 'Core module UI stays in its own registries')
    value.contributions.forEach((contribution: any, index: number) => validateExtensionContribution(contribution, index, moduleId, add))
  }

  if (!value.retention || typeof value.retention !== 'object' || Array.isArray(value.retention)) {
    add('$.extensionProduct.retention', 'INVALID_EXTENSION_RETENTION', 'retention is required')
  } else {
    rejectUnknown(value.retention, '$.extensionProduct.retention', ['defaultMode', 'supportsUserChoice', 'metadataNamespace'], add)
    if (!['KEEP_DATA', 'DELETE_DATA'].includes(value.retention.defaultMode)) add('$.extensionProduct.retention.defaultMode', 'INVALID_RETENTION_MODE', 'Retention must be KEEP_DATA or DELETE_DATA')
    if (typeof value.retention.supportsUserChoice !== 'boolean') add('$.extensionProduct.retention.supportsUserChoice', 'INVALID_BOOLEAN', 'supportsUserChoice must be boolean')
    if (value.retention.metadataNamespace !== undefined && value.retention.metadataNamespace !== moduleId) add('$.extensionProduct.retention.metadataNamespace', 'INVALID_METADATA_NAMESPACE', 'Metadata namespace must equal the owning product ID')
  }
  if (value.graphPolicy !== undefined) {
    if (!value.graphPolicy || typeof value.graphPolicy !== 'object' || Array.isArray(value.graphPolicy)) {
      add('$.extensionProduct.graphPolicy', 'INVALID_GRAPH_POLICY', 'graphPolicy must be an object')
    } else {
      rejectUnknown(value.graphPolicy, '$.extensionProduct.graphPolicy', ['maxDepth', 'maxNodes'], add)
      if (!Number.isInteger(value.graphPolicy.maxDepth) || value.graphPolicy.maxDepth < 1 || value.graphPolicy.maxDepth > 16) add('$.extensionProduct.graphPolicy.maxDepth', 'INVALID_GRAPH_DEPTH', 'maxDepth must be 1..16')
      if (!Number.isInteger(value.graphPolicy.maxNodes) || value.graphPolicy.maxNodes < 1 || value.graphPolicy.maxNodes > 256) add('$.extensionProduct.graphPolicy.maxNodes', 'INVALID_GRAPH_NODES', 'maxNodes must be 1..256')
    }
  }
}

function validateExtensionContribution(value: any, index: number, moduleId: string, add: (path: string, code: string, message: string) => void) {
  const path = `$.extensionProduct.contributions[${index}]`
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    add(path, 'INVALID_EXTENSION_CONTRIBUTION', 'Extension contributions must be objects')
    return
  }
  rejectUnknown(value, path, ['id', 'title', 'kind', 'extensionPoint', 'actionId', 'functionId', 'viewId', 'widgetId', 'requiredCapability', 'availability', 'priority'], add)
  if (typeof value.id !== 'string' || !value.id.startsWith(`${moduleId}.`)) add(`${path}.id`, 'CONTRIBUTION_OUTSIDE_NAMESPACE', 'Contribution ID must use the extension namespace')
  checkBoundedString(value.title, `${path}.title`, 1, 160, add)
  if (!EXTENSION_CONTRIBUTION_KINDS.has(value.kind)) add(`${path}.kind`, 'INVALID_EXTENSION_CONTRIBUTION_KIND', 'Unsupported contribution kind')
  validateContractId(value.extensionPoint, `${path}.extensionPoint`, add)
  const contracts = ['actionId', 'functionId', 'viewId', 'widgetId'].filter(field => typeof value[field] === 'string')
  if (contracts.length === 0) add(path, 'MISSING_CONTRIBUTION_CONTRACT', 'A contribution must reference an action, function, view, or widget')
  for (const field of contracts) {
    if (!value[field].startsWith(`${moduleId}.`)) add(`${path}.${field}`, 'CONTRACT_OUTSIDE_NAMESPACE', 'Contribution contracts must use the extension namespace')
  }
  if (value.requiredCapability !== undefined) validateContractId(value.requiredCapability, `${path}.requiredCapability`, add)
  if (value.availability !== undefined) {
    if (!value.availability || typeof value.availability !== 'object' || Array.isArray(value.availability)) add(`${path}.availability`, 'INVALID_AVAILABILITY', 'availability must be an object')
    else {
      rejectUnknown(value.availability, `${path}.availability`, ['platforms', 'requiresOnline', 'requiredCapabilities'], add)
      validatePlatforms(value.availability.platforms, `${path}.availability.platforms`, add)
      validateContractIds(value.availability.requiredCapabilities, `${path}.availability.requiredCapabilities`, add)
    }
  }
}

function validateKinds(value: unknown, path: string, allowed: Set<string>, add: (path: string, code: string, message: string) => void) {
  if (!Array.isArray(value) || value.length < 1 || value.length > allowed.size) add(path, 'INVALID_CONTRIBUTION_KINDS', 'Contribution kinds must be a non-empty bounded array')
  else value.forEach((entry, index) => { if (!allowed.has(String(entry))) add(`${path}[${index}]`, 'INVALID_EXTENSION_CONTRIBUTION_KIND', 'Unsupported contribution kind') })
}

function validateContractIds(value: unknown, path: string, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 120) add(path, 'INVALID_CONTRACT_IDS', 'Contract IDs must be a bounded array')
  else value.forEach((entry, index) => validateContractId(entry, `${path}[${index}]`, add))
}

function validateContractId(value: unknown, path: string, add: (path: string, code: string, message: string) => void) {
  if (typeof value !== 'string' || !SAFE_CONTRACT_ID.test(value)) add(path, 'INVALID_CONTRACT_ID', 'Contract IDs must be lowercase dotted identifiers')
  if (typeof value === 'string' && value.includes('*')) add(path, 'WILDCARD_CONTRACT_DENIED', 'Wildcard contracts are prohibited')
}

function validatePlatforms(value: unknown, path: string, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 5) add(path, 'INVALID_PLATFORMS', 'Platforms must be a bounded array')
  else value.forEach((platform, index) => { if (!PLATFORMS.has(platform)) add(`${path}[${index}]`, 'UNSUPPORTED_PLATFORM', `Unsupported platform ${String(platform)}`) })
}

function rejectUnknown(value: Record<string, unknown>, path: string, allowed: string[], add: (path: string, code: string, message: string) => void) {
  const permitted = new Set(allowed)
  for (const key of Object.keys(value)) if (!permitted.has(key)) add(`${path}.${key}`, 'UNDECLARED_EXTENSION_FIELD', `Undeclared extension field ${key}`)
}

function validateSectionVersions(value: any, add: (path: string, code: string, message: string) => void) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    add('$.sectionVersions', 'MISSING_SECTION_VERSIONS', 'Standard 2.0 manifests must independently version every section')
    return
  }
  for (const section of MODULE_STANDARD_20_SECTION_NAMES) {
    if (!isSemver(value[section])) add(`$.sectionVersions.${section}`, 'INVALID_SECTION_VERSION', `${section} must declare a semantic section version`)
  }
  for (const section of Object.keys(value)) {
    if (!MODULE_STANDARD_20_SECTION_NAMES.includes(section as any)) add(`$.sectionVersions.${section}`, 'UNKNOWN_SECTION_VERSION', `${section} is not a Standard 2.0 section`)
  }
}

function validateVersionedSection(value: any, path: string, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  validateVersionedObject(value, path, add)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  if (value.items !== undefined && (!Array.isArray(value.items) || value.items.length > 200)) {
    add(`${path}.items`, 'INVALID_SECTION_ITEMS', 'Versioned section items must be a bounded array')
  }
}

function validateVersionedObject(value: any, path: string, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    add(path, 'INVALID_VERSIONED_SECTION', 'Standard 2.0 sections must be objects')
    return
  }
  if (!isSemver(value.version)) add(`${path}.version`, 'INVALID_SEMVER', 'Standard 2.0 section version must be semantic')
}

function validateDependencyGraph(value: any, moduleId: string, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    add('$.dependencyGraph', 'INVALID_DEPENDENCY_GRAPH', 'dependencyGraph must be an object')
    return
  }
  if (!isSemver(value.version)) add('$.dependencyGraph.version', 'INVALID_SEMVER', 'dependencyGraph version must be semantic')
  for (const key of ['requires', 'optional', 'recommended'] as const) {
    validateDependencyRefs(value[key], `$.dependencyGraph.${key}`, moduleId, add)
  }
  for (const key of ['conflicts', 'replaces'] as const) {
    validateConflictRefs(value[key], `$.dependencyGraph.${key}`, moduleId, add)
  }
  if (value.provides !== undefined) {
    if (!Array.isArray(value.provides) || value.provides.length > 100) {
      add('$.dependencyGraph.provides', 'INVALID_PROVIDES', 'provides must be a bounded array')
    } else {
      value.provides.forEach((entry: any, index: number) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          add(`$.dependencyGraph.provides[${index}]`, 'INVALID_PROVIDE', 'provides entries must be objects')
          return
        }
        checkBoundedString(entry.id, `$.dependencyGraph.provides[${index}].id`, 1, 200, add)
        checkBoundedString(entry.title, `$.dependencyGraph.provides[${index}].title`, 1, 160, add)
        checkBoundedString(entry.kind, `$.dependencyGraph.provides[${index}].kind`, 1, 80, add)
        if (!isSemver(entry.version)) add(`$.dependencyGraph.provides[${index}].version`, 'INVALID_SEMVER', 'provided contracts must have semantic versions')
      })
    }
  }
}

function validateDependencyRefs(value: any, path: string, moduleId: string, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 100) {
    add(path, 'INVALID_DEPENDENCY_REFS', 'Dependency relation must be a bounded array')
    return
  }
  value.forEach((dependency: any, index: number) => {
    if (!dependency || typeof dependency !== 'object' || Array.isArray(dependency)) {
      add(`${path}[${index}]`, 'INVALID_DEPENDENCY_REF', 'Dependency entries must be objects')
      return
    }
    if (!dependency.moduleId && !dependency.provides) add(`${path}[${index}]`, 'MISSING_DEPENDENCY_TARGET', 'Dependency must target a moduleId or provided contract')
    if (dependency.moduleId !== undefined && !isGreenfieldModuleId(dependency.moduleId)) add(`${path}[${index}].moduleId`, 'INVALID_MODULE_ID', 'Invalid dependency module ID')
    if (dependency.moduleId === moduleId) add(`${path}[${index}].moduleId`, 'SELF_DEPENDENCY', 'Module cannot depend on itself')
    if (dependency.provides !== undefined) checkBoundedString(dependency.provides, `${path}[${index}].provides`, 1, 200, add)
    if (!isSemverRange(dependency.versionRange)) add(`${path}[${index}].versionRange`, 'INVALID_SEMVER_RANGE', 'Dependency version range must be semantic')
  })
}

function validateConflictRefs(value: any, path: string, moduleId: string, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 100) {
    add(path, 'INVALID_CONFLICT_REFS', 'Conflict relation must be a bounded array')
    return
  }
  value.forEach((dependency: any, index: number) => {
    if (!dependency || typeof dependency !== 'object' || Array.isArray(dependency)) {
      add(`${path}[${index}]`, 'INVALID_CONFLICT_REF', 'Conflict entries must be objects')
      return
    }
    if (!dependency.moduleId && !dependency.provides) add(`${path}[${index}]`, 'MISSING_CONFLICT_TARGET', 'Conflict must target a moduleId or provided contract')
    if (dependency.moduleId !== undefined && !isGreenfieldModuleId(dependency.moduleId)) add(`${path}[${index}].moduleId`, 'INVALID_MODULE_ID', 'Invalid conflict module ID')
    if (dependency.moduleId === moduleId) add(`${path}[${index}].moduleId`, 'SELF_CONFLICT', 'Module cannot conflict with itself')
    if (dependency.provides !== undefined) checkBoundedString(dependency.provides, `${path}[${index}].provides`, 1, 200, add)
    if (!isSemverRange(dependency.versionRange)) add(`${path}[${index}].versionRange`, 'INVALID_SEMVER_RANGE', 'Conflict version range must be semantic')
  })
}

function validateNamespacedItems(value: any, path: string, moduleId: string, add: (path: string, code: string, message: string) => void) {
  const items = value?.items
  if (!Array.isArray(items)) return
  items.forEach((item: any, index: number) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      add(`${path}.items[${index}]`, 'INVALID_REGISTRY_ITEM', 'Registry items must be objects')
      return
    }
    if (typeof item.id !== 'string' || !item.id.startsWith(`${moduleId}.`)) {
      add(`${path}.items[${index}].id`, 'ITEM_OUTSIDE_NAMESPACE', 'Registry item IDs must stay inside the module namespace')
    }
    if (item.version !== undefined && !isSemver(item.version)) add(`${path}.items[${index}].version`, 'INVALID_SEMVER', 'Registry item version must be semantic')
  })
}

function validateApiRegistry(value: any, moduleId: string, add: (path: string, code: string, message: string) => void) {
  validateNamespacedItems(value, '$.apiRegistry', moduleId, add)
  const items = value?.items
  if (!Array.isArray(items)) return
  items.forEach((item: any, index: number) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(item.method))) {
      add(`$.apiRegistry.items[${index}].method`, 'INVALID_API_METHOD', 'Module API methods must be standard HTTP verbs')
    }
    if (typeof item.path !== 'string' || !item.path.startsWith(`/api/modula/${moduleId}/`)) {
      add(`$.apiRegistry.items[${index}].path`, 'INVALID_MODULE_API_PATH', 'Module API paths must live under /api/modula/{moduleId}/')
    }
  })
}

function validateHookRegistry(value: any, moduleId: string, add: (path: string, code: string, message: string) => void) {
  validateNamespacedItems(value, '$.hookRegistry', moduleId, add)
  const items = value?.items
  if (!Array.isArray(items)) return
  items.forEach((item: any, index: number) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return
    if (!['before', 'after', 'around'].includes(String(item.phase))) add(`$.hookRegistry.items[${index}].phase`, 'INVALID_HOOK_PHASE', 'Hook phase must be before, after, or around')
    checkBoundedString(item.hook, `$.hookRegistry.items[${index}].hook`, 1, 160, add)
  })
}

function validateCapabilityDiscovery(value: any, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  validateVersionedObject(value, '$.capabilityDiscovery', add)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  for (const [key, entry] of Object.entries(value)) {
    if (key.startsWith('supports') && typeof entry !== 'boolean') add(`$.capabilityDiscovery.${key}`, 'INVALID_CAPABILITY_FLAG', 'Capability discovery flags must be boolean')
  }
}

function validatePermissionModel(value: any, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  validateVersionedObject(value, '$.permissionModel', add)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  if (!value.categories || typeof value.categories !== 'object' || Array.isArray(value.categories)) {
    add('$.permissionModel.categories', 'INVALID_PERMISSION_CATEGORIES', 'permissionModel.categories must be an object')
    return
  }
  for (const [category, permissions] of Object.entries(value.categories)) {
    if (!MODULE_STANDARD_20_PERMISSION_CATEGORIES.includes(category as any)) {
      add(`$.permissionModel.categories.${category}`, 'UNKNOWN_PERMISSION_CATEGORY', 'Unknown Standard 2.0 permission category')
    }
    if (!Array.isArray(permissions) || permissions.length > 100) {
      add(`$.permissionModel.categories.${category}`, 'INVALID_PERMISSION_CATEGORY', 'Permission categories must be bounded arrays')
      continue
    }
    permissions.forEach((permission: any, index: number) => {
      if (!permission || typeof permission !== 'object' || Array.isArray(permission)) {
        add(`$.permissionModel.categories.${category}[${index}]`, 'INVALID_PERMISSION_DECLARATION', 'Permission declarations must be objects')
        return
      }
      checkBoundedString(permission.id, `$.permissionModel.categories.${category}[${index}].id`, 1, 200, add)
      checkBoundedString(permission.reason, `$.permissionModel.categories.${category}[${index}].reason`, 1, 400, add)
      if (typeof permission.id === 'string' && permission.id.includes('*')) add(`$.permissionModel.categories.${category}[${index}].id`, 'WILDCARD_PERMISSION_DENIED', 'Wildcard permissions are not allowed')
    })
  }
}

function validateCompatibilityMatrix(value: any, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  validateVersionedObject(value, '$.compatibilityMatrix', add)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  for (const key of ['modulaVersion', 'greenfieldVersion', 'moduleStandardVersion', 'runtimeVersion', 'backendRuntime', 'connectorRuntime', 'aiRuntime', 'engineRuntime'] as const) {
    if (value[key] !== undefined && !isSemverRange(value[key])) add(`$.compatibilityMatrix.${key}`, 'INVALID_SEMVER_RANGE', `${key} must be a semantic version range`)
  }
  if (value.platforms !== undefined) {
    if (!Array.isArray(value.platforms) || value.platforms.length < 1 || value.platforms.length > 10) {
      add('$.compatibilityMatrix.platforms', 'INVALID_PLATFORMS', 'compatibilityMatrix.platforms must be a bounded array')
    } else {
      value.platforms.forEach((platform: unknown, index: number) => {
        if (!PLATFORMS.has(platform as GreenfieldModulePlatform)) add(`$.compatibilityMatrix.platforms[${index}]`, 'UNSUPPORTED_PLATFORM', `Unsupported platform ${String(platform)}`)
      })
    }
  }
}

function validateEngineReadiness(value: any, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  validateVersionedObject(value, '$.engineReadiness', add)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  if (value.engines !== undefined && (!Array.isArray(value.engines) || value.engines.some((engine: unknown) => typeof engine !== 'string'))) {
    add('$.engineReadiness.engines', 'INVALID_ENGINES', 'engineReadiness.engines must be a string array')
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
