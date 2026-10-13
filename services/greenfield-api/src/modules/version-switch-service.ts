import {classifyPermissionRisk, compareSemver, satisfiesSemverRange} from '@modula/greenfield-module-manifest'
import {resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {GreenfieldModuleCompatibilityService} from './compatibility-service.js'
import {GreenfieldExtensionFabricService} from './extension-fabric-service.js'
import {GreenfieldInstallDescriptorService, type IssuedInstallDescriptor} from './install-descriptor-service.js'
import type {GreenfieldModuleInstallationRow, GreenfieldModuleReleaseRecord} from './module-domain.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleRegistryService} from './registry-service.js'
import {GreenfieldRegistryTrustService, type RegistryTrustBlock, type RegistryTrustOptions} from './registry-trust-service.js'
import {allRuntimePermissionKeys} from './runtime2-service.js'

/**
 * Version switching for an installed module: move an installation to any
 * published (or superseded-but-still-published), non-revoked, compatible
 * release, either newer (upgrade) or older (downgrade). The registry stays the
 * trust authority: every target is gated on its registry release state, trust
 * block and compatibility, and the answer carries the immutable install
 * descriptor for the target release. Module data is never touched here; the
 * worker only rebinds the installation to the target release.
 */

/** Release states a user may switch to. Superseded releases stay immutable and published. */
export const SWITCHABLE_RELEASE_STATES = ['published', 'superseded'] as const
const PLATFORMS = ['ios', 'android', 'web', 'desktop', 'server'] as const
type Platform = typeof PLATFORMS[number]

export type VersionSwitchDirection = 'upgrade' | 'downgrade' | 'none'

export type VersionSwitchBlocker = {code: string; message: string}

export type VersionSwitchPermission = {permission: string; risk: string; reason: string | null}

export type VersionSwitchEvaluation = {
  moduleId: string
  installationId: string
  installationStatus: string
  fromVersion: string
  toVersion: string
  fromReleaseId: string
  toReleaseId: string
  direction: VersionSwitchDirection
  noop: boolean
  allowed: boolean
  blockers: VersionSwitchBlocker[]
  permissions: {
    added: VersionSwitchPermission[]
    removed: string[]
    retained: string[]
    requiresConsent: string[]
    highRiskIncrease: boolean
  }
  dataSchema: {
    fromCollections: string[]
    toCollections: string[]
    missingInTarget: string[]
    olderInTarget: Array<{collection: string; from: string; to: string}>
    older: boolean
  }
  warnings: Array<{code: string; message: string}>
  trust: RegistryTrustBlock
  descriptor: IssuedInstallDescriptor
  incompatibleExtensions: Array<{productId: string; installationId: string; versionRange: string}>
  /** Permissions the installation holds after the switch when consent is given. */
  projectedGrants: {granted: string[]; denied: string[]}
}

export type VersionSwitchOptions = {hostVersion?: string | null; platform?: string | null}
export type VersionSwitchEvaluationOptions = VersionSwitchOptions & {retainReviewedGrantsOnly?: boolean}

export class GreenfieldModuleVersionSwitchService {
  private readonly registry: GreenfieldModuleRegistryService
  private readonly trust: GreenfieldRegistryTrustService
  private readonly descriptors: GreenfieldInstallDescriptorService
  private readonly extensionFabric: GreenfieldExtensionFabricService

  constructor(private readonly db: ModulaDb, private readonly config: AppConfig) {
    this.registry = new GreenfieldModuleRegistryService(db, {publicApiUrl: config.publicApiUrl})
    this.trust = new GreenfieldRegistryTrustService(db)
    this.descriptors = new GreenfieldInstallDescriptorService(db, config.publicApiUrl)
    this.extensionFabric = new GreenfieldExtensionFabricService(db)
  }

  /**
   * Versions the account can see for a module, each annotated relative to the
   * account's installation (upgrade/downgrade/current) and gated on trust and
   * compatibility. Only switchable releases are listed, plus the installed one.
   */
  async options(installed: GreenfieldModuleInstallationRow | undefined, moduleId: string, options: VersionSwitchOptions = {}) {
    const canonicalId = resolveCanonicalModuleId(installed?.moduleId ?? moduleId)
    const releases = await this.registry.listVersions(canonicalId)
    const latest = releases.find(release => release.releaseState === 'published') ?? null
    const listed = releases.filter(release =>
      (SWITCHABLE_RELEASE_STATES as readonly string[]).includes(release.releaseState) || release.version === installed?.version)
    const trustOptions = this.trustOptions(options)
    const versions = await Promise.all(listed.map(async release => {
      const [trust, product] = await Promise.all([
        this.trust.forRelease(release, trustOptions, latest?.version ?? null),
        this.registry.productProjectionFor(release.releaseId),
      ])
      const blockers = this.releaseBlockers(release, trust, options)
      const direction: VersionSwitchDirection | 'install' = !installed ? 'install' : directionOf(installed.version, release.version)
      return {
        version: release.version,
        releaseId: release.releaseId,
        releaseState: release.releaseState,
        publishedAt: isoOrNull(release.publishedAt),
        releaseNotes: typeof product?.release?.notes === 'string' ? product.release.notes : null,
        trust: {
          verified: trust.verified,
          publisherVerified: trust.publisher.verified,
          signatureState: trust.signature.state,
          signatureKeyId: trust.signature.keyId,
          revoked: trust.revocation.revoked,
          quarantined: trust.quarantine.quarantined,
          warnings: trust.warnings.map(warning => warning.code),
        },
        digests: trust.digests,
        compatibility: {evaluated: trust.compatibility.evaluated, compatible: trust.compatibility.compatible, reasons: trust.compatibility.reasons},
        direction,
        current: installed?.version === release.version,
        latest: latest?.version === release.version,
        switchable: Boolean(installed) && installed!.version !== release.version && blockers.length === 0,
        blockers,
      }
    }))
    return {
      moduleId: canonicalId,
      installationId: installed?.installationId ?? null,
      installedVersion: installed?.version ?? null,
      installationStatus: installed?.status ?? null,
      latestVersion: latest?.version ?? null,
      updateAvailable: Boolean(installed && latest && directionOf(installed.version, latest.version) === 'upgrade'),
      versions,
    }
  }

  /** Everything a client needs to confirm a switch, without changing anything. */
  async evaluate(accountId: string, installed: GreenfieldModuleInstallationRow, targetVersion: string | null | undefined, options: VersionSwitchEvaluationOptions = {}): Promise<VersionSwitchEvaluation> {
    const canonicalId = resolveCanonicalModuleId(installed.moduleId)
    const current = await this.registry.getVersion(canonicalId, installed.version)
    const target = targetVersion ? await this.registry.getVersion(canonicalId, targetVersion) : await this.registry.latestPublished(canonicalId)
    const latestPublished = (await this.registry.listVersions(canonicalId)).find(release => release.releaseState === 'published')?.version ?? null
    const trust = await this.trust.forRelease(target, this.trustOptions(options), latestPublished)
    const direction = directionOf(current.version, target.version)
    const blockers = this.releaseBlockers(target, trust, options)

    const targetReview = await this.extensionFabric.targetReview(accountId, target)
    for (const error of targetReview.errors) blockers.push({code: 'EXTENSION_TARGET_INCOMPATIBLE', message: error})
    const dependants = await this.extensionFabric.activeDependants(accountId, canonicalId, {recursive: false})
    const incompatibleExtensions = dependants
      .filter(dependant => !satisfiesRange(target.version, dependant.versionRange))
      .map(dependant => ({productId: dependant.productId, installationId: dependant.installationId, versionRange: dependant.versionRange}))

    const permissions = permissionDiff(current, target, installed.grantedPermissions ?? [])
    const dataSchema = dataSchemaDiff(current, target)
    const warnings: Array<{code: string; message: string}> = trust.warnings.map(warning => ({code: warning.code, message: warning.message}))
    if (direction === 'downgrade' && dataSchema.older) {
      const parts = [
        dataSchema.missingInTarget.length ? `${dataSchema.missingInTarget.join(', ')} ${dataSchema.missingInTarget.length === 1 ? 'is' : 'are'} not declared by ${target.version}` : null,
        dataSchema.olderInTarget.length ? `${dataSchema.olderInTarget.map(item => `${item.collection} ${item.from} → ${item.to}`).join(', ')} use an older schema` : null,
      ].filter(Boolean)
      warnings.push({
        code: 'DATA_SCHEMA_OLDER',
        message: `Version ${target.version} declares an older data schema than ${current.version} (${parts.join('; ')}). Your records are kept, but the older version may not show or edit them until you upgrade again.`,
      })
    }
    if (direction === 'downgrade') warnings.push({code: 'DOWNGRADE', message: `This moves ${canonicalId} back from ${current.version} to ${target.version}.`})
    if (incompatibleExtensions.length) {
      warnings.push({code: 'EXTENSIONS_INCOMPATIBLE', message: `${incompatibleExtensions.map(item => item.productId).join(', ')} will be marked incompatible with ${target.version}.`})
    }

    const projectedGrants = {
      // Administrative legacy exits retain only previously reviewed grants.
      // Newly requested permissions remain denied until the owner reviews them.
      granted: [...new Set([
        ...permissions.retained.filter(permission => (installed.grantedPermissions ?? []).includes(permission)),
        ...(options.retainReviewedGrantsOnly ? [] : permissions.requiresConsent),
      ])].sort(),
      denied: [] as string[],
    }
    const declared = targetDeclared(target)
    projectedGrants.denied = declared.filter(permission => !projectedGrants.granted.includes(permission))
    const descriptor = await this.descriptors.build(target, {
      installationId: installed.installationId,
      grantedPermissions: projectedGrants.granted,
      deniedPermissions: projectedGrants.denied,
      trustOptions: this.trustOptions(options),
      trustBlock: trust,
    })

    return {
      moduleId: canonicalId,
      installationId: installed.installationId,
      installationStatus: installed.status,
      fromVersion: current.version,
      toVersion: target.version,
      fromReleaseId: current.releaseId,
      toReleaseId: target.releaseId,
      direction,
      noop: direction === 'none',
      allowed: direction !== 'none' && blockers.length === 0,
      blockers,
      permissions,
      dataSchema,
      warnings,
      trust,
      descriptor,
      incompatibleExtensions,
      projectedGrants,
    }
  }

  /** Throws the first blocker as the domain error a route maps to HTTP. */
  static assertAllowed(evaluation: VersionSwitchEvaluation) {
    const blocker = evaluation.blockers[0]
    if (!blocker) return
    if (blocker.code === 'UNTRUSTED_RELEASE') throw moduleError('UNTRUSTED_RELEASE', blocker.message)
    const forbidden = ['RELEASE_NOT_SWITCHABLE', 'RELEASE_REVOKED', 'RELEASE_QUARANTINED']
    throw moduleError(forbidden.includes(blocker.code) ? 'FORBIDDEN' : 'VALIDATION_FAILED', `${blocker.code}: ${blocker.message}`)
  }

  private releaseBlockers(release: GreenfieldModuleReleaseRecord, trust: RegistryTrustBlock, options: VersionSwitchOptions): VersionSwitchBlocker[] {
    const blockers: VersionSwitchBlocker[] = []
    if (release.releaseState === 'revoked' || trust.revocation.revoked) blockers.push({code: 'RELEASE_REVOKED', message: `${release.version} was revoked by the registry.`})
    if (release.releaseState === 'quarantined' || trust.quarantine.quarantined) blockers.push({code: 'RELEASE_QUARANTINED', message: `${release.version} is quarantined.`})
    if (!(SWITCHABLE_RELEASE_STATES as readonly string[]).includes(release.releaseState) && !blockers.length) {
      blockers.push({code: 'RELEASE_NOT_SWITCHABLE', message: `${release.version} is ${release.releaseState}, not published.`})
    }
    const allowDevelopmentRelease = this.config.environment === 'development' && this.config.moduleAllowUntrustedDevelopmentReleases
    if (!trust.verified && !allowDevelopmentRelease) blockers.push({code: 'UNTRUSTED_RELEASE', message: `The release is not production-trusted (signature: ${trust.signature.state}).`})
    if (trust.compatibility.evaluated && trust.compatibility.compatible === false) {
      blockers.push({code: 'HOST_INCOMPATIBLE', message: trust.compatibility.reasons.map(reason => `${reason.code}: ${reason.message}`).join(' ')})
    }
    const platform = platformOf(options.platform)
    if (platform) {
      const compatibility = new GreenfieldModuleCompatibilityService(this.config).evaluate(release, {platform})
      // Release state is gated above (superseded stays switchable); keep the other reasons.
      const reasons = compatibility.reasons.filter(reason => !['RELEASE_NOT_PUBLISHED', 'RELEASE_QUARANTINED', 'RELEASE_REVOKED'].includes(reason))
      if (reasons.length) blockers.push({code: 'INCOMPATIBLE', message: reasons.join(', ')})
    }
    return blockers
  }

  private trustOptions(options: VersionSwitchOptions): RegistryTrustOptions {
    return {hostVersion: options.hostVersion ?? null, platform: platformOf(options.platform)}
  }
}

export function directionOf(fromVersion: string, toVersion: string): VersionSwitchDirection {
  const order = compareVersions(toVersion, fromVersion)
  return order > 0 ? 'upgrade' : order < 0 ? 'downgrade' : 'none'
}

/** Numeric semver comparison; a pre-release sorts below its release. */
export function compareVersions(left: string, right: string): number {
  return compareSemver(left, right)
}

function targetDeclared(release: GreenfieldModuleReleaseRecord): string[] {
  return [...new Set([
    ...release.manifest.permissions.map(permission => permission.permission),
    ...allRuntimePermissionKeys(release.manifest),
  ])].sort()
}

export function permissionDiff(current: GreenfieldModuleReleaseRecord, target: GreenfieldModuleReleaseRecord, granted: string[]) {
  const currentSet = new Set(targetDeclared(current))
  const next = targetDeclared(target)
  const nextSet = new Set(next)
  const describe = (permission: string): VersionSwitchPermission => {
    const declared = target.manifest.permissions.find(item => item.permission === permission)
    return {permission, risk: declared?.risk ?? classifyPermissionRisk(permission), reason: (declared as {reason?: string} | undefined)?.reason ?? null}
  }
  const added = next.filter(permission => !currentSet.has(permission)).map(describe)
  return {
    added,
    removed: [...currentSet].filter(permission => !nextSet.has(permission)).sort(),
    retained: next.filter(permission => currentSet.has(permission)),
    // Anything the account never saw needs fresh consent, whichever direction the switch goes.
    requiresConsent: added.map(item => item.permission).filter(permission => !granted.includes(permission)),
    highRiskIncrease: added.some(item => ['high', 'restricted'].includes(item.risk)),
  }
}

/**
 * Compares the data schemas each release declares (contributions.schemas):
 * collections the target no longer declares, and per-collection schema versions
 * when the manifest states them. Only declared facts are compared.
 */
export function dataSchemaDiff(current: GreenfieldModuleReleaseRecord, target: GreenfieldModuleReleaseRecord) {
  const schemas = (release: GreenfieldModuleReleaseRecord) => {
    const declared = (release.manifest as {contributions?: {schemas?: unknown}}).contributions?.schemas
    const map = new Map<string, string | null>()
    for (const item of Array.isArray(declared) ? declared : []) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      const collection = typeof record.collection === 'string' ? record.collection : typeof record.id === 'string' ? record.id : null
      if (!collection) continue
      const version = [record.version, record.schemaVersion, record.dataVersion].find(value => typeof value === 'string' && value.trim()) as string | undefined
      map.set(collection, version ?? null)
    }
    return map
  }
  const from = schemas(current)
  const to = schemas(target)
  const missingInTarget = [...from.keys()].filter(collection => !to.has(collection)).sort()
  const olderInTarget = [...from.entries()]
    .filter(([collection, version]) => version && to.get(collection) && compareVersions(to.get(collection)!, version) < 0)
    .map(([collection, version]) => ({collection, from: version!, to: to.get(collection)!}))
  return {
    fromCollections: [...from.keys()].sort(),
    toCollections: [...to.keys()].sort(),
    missingInTarget,
    olderInTarget,
    older: missingInTarget.length > 0 || olderInTarget.length > 0,
  }
}

function satisfiesRange(version: string, range: string): boolean {
  return satisfiesSemverRange(version, range)
}

function platformOf(value: unknown): Platform | null {
  return typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value) ? value as Platform : null
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return typeof value === 'string' ? value : null
}
