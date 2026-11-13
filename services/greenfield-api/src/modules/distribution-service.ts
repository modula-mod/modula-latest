import {createHash} from 'node:crypto'
import {compareSemver, satisfiesSemverRange} from '@modula/greenfield-module-manifest'
import {
  MODULE_DISTRIBUTION_DESCRIPTOR_VERSION,
  MODULE_RELEASE_SIGNATURE_PAYLOAD_VERSION,
  type HostCapabilityRequirement as DistributionCapabilityRequirement,
  type ModuleArtifactDescriptor,
  type ModuleCompatibilityReason,
  type ModuleCompatibilityResult,
  type ModuleInstallPlan,
  type ModuleInstallationDescriptor,
  type ModuleReleaseDescriptor,
  type ModuleUpdateFeed,
  type ModuleUpdatePlan,
  type PackageLockfile,
  type PackageReleaseDescriptor,
} from '@modula/greenfield-module-registry-contracts'
import {
  negotiateHostCapabilities,
  parseHostCapabilityReference,
  type HostCapabilityDescriptor,
} from '@modula/greenfield-module-ui-contracts'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {moduleIdFamily, resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import {moduleError} from './module-errors.js'
import type {GreenfieldModuleInstallationRow, GreenfieldModuleReleaseRecord} from './module-domain.js'
import {NOT_INSTALLED_STATUSES} from './installation-status.js'
import {GreenfieldModuleInstallationService} from './installation-service.js'
import {GreenfieldModuleRegistryService} from './registry-service.js'
import {
  evaluateCompatibility,
  GreenfieldRegistryTrustService,
  signatureState,
} from './registry-trust-service.js'
import {
  dataSchemaDiff,
  GreenfieldModuleVersionSwitchService,
  permissionDiff,
} from './version-switch-service.js'
import {allRuntimePermissionKeys} from './runtime2-service.js'
import {resolvePackageClosure} from './package-closure-resolver.js'
import {presentationAssetsMissingBlobs} from './presentation-blob-gaps.js'

export type DistributionHostContext = {
  hostVersion?: string | null
  platform?: string | null
  moduleSdkVersion?: string | null
  productUiContractVersion?: string | null
  hostCapabilities?: HostCapabilityDescriptor[] | null
}

type InstallationPolicy = {
  mode: 'automaticStable' | 'followChannel' | 'lockedVersion' | 'manual'
  channel: 'stable' | 'beta' | 'rc' | 'dev'
  lockedVersion: string | null
}

type FeedInstallationRow = {
  installation_id: string
  account_id: string
  status: string
  extension_version_id: string
  module_id: string
  version: string
  release_id: string
  update_policy: InstallationPolicy['mode']
  release_channel: InstallationPolicy['channel']
  locked_version: string | null
  updated_at: Date
}

type FeedArtifactRow = {
  artifact_id: string
  release_id: string
  kind: ModuleArtifactDescriptor['kind']
  sha256: string
  filename: string
  access_class: 'public' | 'installation'
  required_for_offline_launch: boolean
  byte_size: number
  media_type: string
}

type FeedReleaseFacts = {
  release: GreenfieldModuleReleaseRecord
  publisherStatus: string
  integrity: {verified_at: Date | null; mismatch_at: Date | null} | null
  product: {manifest_sha256: string; manifest: unknown} | null
  frontend: {
    artifact_sha256: string
    schema_version: '1.0.0'
    compatibility: unknown
    required_capabilities: unknown
    runtime_projection: unknown
  } | null
  signatures: Array<{
    signature_key_id: string
    signature: string
    algorithm: string
    verified_at: Date | null
    revoked_at: Date | null
    verification_state: string | null
    public_key_fingerprint: string | null
    verification_detail: string | null
    statement: unknown
    statement_sha256: string | null
    signing_key_publisher_id: string | null
    signing_key_state: string | null
    signing_key_revoked_at: Date | null
  }>
  artifacts: FeedArtifactRow[]
  revoked: boolean
  quarantined: boolean
}

export class GreenfieldModuleDistributionService {
  private readonly registry: GreenfieldModuleRegistryService
  private readonly trust: GreenfieldRegistryTrustService
  private readonly installations: GreenfieldModuleInstallationService

  constructor(private readonly db: ModulaDb, private readonly config: AppConfig) {
    this.registry = new GreenfieldModuleRegistryService(db, {publicApiUrl: config.publicApiUrl})
    this.trust = new GreenfieldRegistryTrustService(db)
    this.installations = new GreenfieldModuleInstallationService(db, config)
  }

  async releaseDescriptorById(releaseId: string, context: DistributionHostContext = {}): Promise<ModuleReleaseDescriptor> {
    const row = await this.db.selectFrom('greenfield_module_releases')
      .select(['module_id', 'version'])
      .where('release_id', '=', releaseId)
      .executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'Module release not found')
    return this.releaseDescriptor(await this.registry.getVersion(row.module_id, row.version), context)
  }

  async releaseDescriptor(release: GreenfieldModuleReleaseRecord, context: DistributionHostContext = {}): Promise<ModuleReleaseDescriptor> {
    const [trust, artifacts, signature, frontend] = await Promise.all([
      this.trust.forRelease(release, {hostVersion: context.hostVersion ?? null, platform: platform(context.platform)}),
      this.db.selectFrom('greenfield_release_artifacts as artifact')
        .innerJoin('greenfield_release_asset_blobs as blob', 'blob.sha256', 'artifact.sha256')
        .select([
          'artifact.artifact_id', 'artifact.kind', 'artifact.sha256', 'artifact.filename',
          'artifact.access_class', 'artifact.required_for_offline_launch',
          'blob.byte_size', 'blob.media_type',
        ])
        .where('artifact.release_id', '=', release.releaseId)
        .orderBy('artifact.required_for_offline_launch', 'desc')
        .orderBy('artifact.kind')
        .orderBy('artifact.artifact_id')
        .execute(),
      this.db.selectFrom('greenfield_module_release_signatures')
        .select(['signature_key_id', 'signature', 'algorithm', 'statement_sha256', 'verification_state'])
        .where('release_id', '=', release.releaseId)
        .orderBy('verified_at', 'desc')
        .executeTakeFirst(),
      this.db.selectFrom('greenfield_release_frontends')
        .select(['schema_version', 'required_capabilities', 'runtime_projection'])
        .where('release_id', '=', release.releaseId)
        .executeTakeFirst(),
    ])
    const packageArtifact = artifacts.find(artifact => artifact.kind === 'module-package')
    if (!release.releaseSha256 || !packageArtifact || packageArtifact.sha256 !== release.releaseSha256) {
      throw moduleError('NOT_FOUND', 'Release has no complete immutable package artifact')
    }
    if (!signature || signature.algorithm !== 'Ed25519') {
      throw moduleError('UNTRUSTED_RELEASE', 'Release has no canonical Ed25519 signature')
    }
    const {required, optional} = capabilityRequirements(frontend?.required_capabilities, frontend?.runtime_projection)
    const compatibility = compatibilityResult(release, trust.compatibility, trust.revocation.revoked, {
      ...context,
      required,
      optional,
      productUiContract: frontend?.schema_version ?? null,
    })
    // The compatibility result is intentionally computed here even though it is
    // returned on mutable install/update objects. Building it also validates
    // that requirement metadata is portable and versioned.
    void compatibility
    return {
      descriptorVersion: MODULE_DISTRIBUTION_DESCRIPTOR_VERSION,
      moduleId: release.moduleId,
      version: release.version,
      releaseId: release.releaseId,
      channel: release.releaseChannel,
      manifestDigest: release.manifestSha256,
      packageDigest: release.releaseSha256,
      ...(trust.digests.frontendSha256 ? {frontendDigest: trust.digests.frontendSha256} : {}),
      signature: {
        algorithm: 'Ed25519',
        keyId: signature.signature_key_id,
        signature: signature.signature,
        signaturePayloadVersion: MODULE_RELEASE_SIGNATURE_PAYLOAD_VERSION,
        statementDigest: signature.statement_sha256,
      },
      trust: {
        verified: trust.verified,
        signatureState: trust.signature.state,
        publisherVerified: trust.publisher.verified,
        signerRevoked: trust.signature.state === 'revokedKey',
        warnings: trust.warnings.map(warning => warning.code),
      },
      artifacts: artifacts.map(artifact => this.artifactDescriptor(artifact)),
      moduleSdk: moduleSdkRequirement(release),
      ...(frontend?.schema_version ? {productUiContract: frontend.schema_version} : {}),
      requiredHostCapabilities: required,
      optionalHostCapabilities: optional,
      requestedPermissions: declaredPermissions(release),
      publishedAt: requiredPublishedAt(release),
      provenance: {
        provider: 'github',
        repository: trust.provenance.repository,
        commit: trust.provenance.commit,
        releaseTag: trust.provenance.releaseTag,
        releaseAssetName: trust.provenance.releaseAssetName,
      },
      revoked: trust.revocation.revoked,
    }
  }

  async installationDescriptor(accountId: string, moduleId: string, context: DistributionHostContext = {}): Promise<ModuleInstallationDescriptor> {
    const installed = await this.installations.getInstalled(accountId, moduleId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    return this.installationDescriptorFor(installed, context)
  }

  private async installationDescriptorFor(installed: GreenfieldModuleInstallationRow, context: DistributionHostContext): Promise<ModuleInstallationDescriptor> {
    const release = await this.registry.getVersion(installed.moduleId, installed.version)
    const [currentRelease, review, policyRow, trust, frontend] = await Promise.all([
      this.releaseDescriptor(release, context),
      this.db.selectFrom('greenfield_module_permission_reviews')
        .select(['granted_permissions', 'denied_permissions'])
        .where('account_id', '=', installed.accountId)
        .where('installation_id', '=', installed.installationId)
        .where('release_id', '=', release.releaseId)
        .orderBy('reviewed_at', 'desc')
        .orderBy('review_id', 'desc')
        .executeTakeFirst(),
      this.db.selectFrom('greenfield_extension_installations')
        .select(['update_policy', 'release_channel', 'locked_version', 'updated_at'])
        .where('installation_id', '=', installed.installationId)
        .where('account_id', '=', installed.accountId)
        .executeTakeFirstOrThrow(),
      this.trust.forRelease(release, {hostVersion: context.hostVersion ?? null, platform: platform(context.platform)}),
      this.db.selectFrom('greenfield_release_frontends')
        .select(['schema_version', 'required_capabilities', 'runtime_projection'])
        .where('release_id', '=', release.releaseId)
        .executeTakeFirst(),
    ])
    const {required, optional} = capabilityRequirements(frontend?.required_capabilities, frontend?.runtime_projection)
    const compatibility = compatibilityResult(release, trust.compatibility, trust.revocation.revoked, {
      ...context,
      required,
      optional,
      productUiContract: frontend?.schema_version ?? null,
    })
    const granted = arrayOfStrings(review?.granted_permissions).filter(permission => currentRelease.requestedPermissions.includes(permission)).sort()
    const denied = arrayOfStrings(review?.denied_permissions)
    const permissionStatus = !review
      ? 'review-required' as const
      : currentRelease.requestedPermissions.length > 0
        && granted.length === 0
        && currentRelease.requestedPermissions.every(permission => denied.includes(permission))
        ? 'denied' as const
        : 'approved' as const
    const policy: ModuleInstallationDescriptor['updatePolicy'] = {
      mode: policyRow.update_policy,
      channel: policyRow.release_channel,
      lockedVersion: policyRow.locked_version,
    }
    const body = {
      descriptorVersion: MODULE_DISTRIBUTION_DESCRIPTOR_VERSION,
      installationId: installed.installationId,
      moduleId: installed.moduleId,
      enabled: installed.status === 'enabled',
      currentRelease,
      compatibility,
      permissionReview: {releaseId: release.releaseId, status: permissionStatus, effectiveCapabilities: granted},
      updatePolicy: policy,
      launchEligible: installed.status === 'enabled' && review !== undefined && currentRelease.trust.verified
        && !currentRelease.revoked && compatibility.compatible !== false,
      updatedAt: policyRow.updated_at.toISOString(),
    }
    return {...body, descriptorRevision: installationRevision(body)}
  }

  async installPlan(accountId: string, moduleId: string, version: string | null, context: DistributionHostContext = {}): Promise<ModuleInstallPlan> {
    const release = version
      ? await this.registry.getVersion(resolveCanonicalModuleId(moduleId), version)
      : await this.latestEligibleRelease(resolveCanonicalModuleId(moduleId), 'stable', context)
    const [targetRelease, trust, frontend] = await Promise.all([
      this.releaseDescriptor(release, context),
      this.trust.forRelease(release, {hostVersion: context.hostVersion ?? null, platform: platform(context.platform)}),
      this.db.selectFrom('greenfield_release_frontends').select(['schema_version', 'required_capabilities', 'runtime_projection'])
        .where('release_id', '=', release.releaseId).executeTakeFirst(),
    ])
    const {required, optional} = capabilityRequirements(frontend?.required_capabilities, frontend?.runtime_projection)
    const compatibility = compatibilityResult(release, trust.compatibility, trust.revocation.revoked, {
      ...context, required, optional, productUiContract: frontend?.schema_version ?? null,
    })
    const blockers = distributionBlockers(targetRelease, compatibility)
    const permissionReviewRequired = targetRelease.requestedPermissions.length > 0
    return {
      moduleId: release.moduleId,
      targetRelease,
      compatibility,
      permissionReviewRequired,
      requestedCapabilities: targetRelease.requestedPermissions,
      downloadBytes: targetRelease.artifacts.filter(artifact => artifact.requiredForOfflineLaunch).reduce((sum, artifact) => sum + artifact.size, 0),
      allowed: blockers.length === 0,
      blockers,
    }
  }

  /** Resolve exact optional bytes from MPS ingestions linked to signed releases.
   * This uses the existing release and artifact tables; it does not create a
   * second registry or accept caller-supplied release metadata.
   */
  async packageInstallPlan(accountId: string | null, moduleId: string, version: string | null, context: DistributionHostContext,
                           cachedPublicDigests: readonly string[] = []): Promise<{lock: PackageLockfile; lockSha256: string}> {
    if (cachedPublicDigests.length > 4096 || cachedPublicDigests.some(digest => !/^[a-f0-9]{64}$/.test(digest))) {
      throw moduleError('VALIDATION_FAILED', 'Invalid cached artifact digest list')
    }
    const ingestions = await this.db.selectFrom('greenfield_mps_ingestions')
      .select(['product_id', 'version', 'release_id', 'manifest'])
      .where('release_id', 'is not', null)
      .execute()
    const packaged = ingestions.filter(row => {
      const manifest = row.manifest as Record<string, unknown> | null
      return manifest?.distribution != null
    })
    if (!packaged.some(row => row.product_id === moduleId)) {
      throw moduleError('NOT_FOUND', `No optional package release exists for ${moduleId}`)
    }
    if (!context.hostVersion || !context.platform) throw moduleError('VALIDATION_FAILED', 'Host version and platform are required for a package plan')
    const releases = await Promise.allSettled(packaged.map(async row => {
      const manifest = row.manifest as Record<string, any>
      const distribution = manifest.distribution as Record<string, any>
      if (manifest.identity?.id !== row.product_id || manifest.identity?.version !== row.version ||
          distribution?.schema !== 'modula.package.1' || !row.release_id) return null
      const signed = await this.releaseDescriptorById(row.release_id, context)
      if (signed.moduleId !== row.product_id || signed.version !== row.version) return null
      const artifact = signed.artifacts.find(item => item.digest === distribution.artifact?.sha256 &&
        item.size === distribution.artifact?.compressedSizeBytes && item.contentType === distribution.artifact?.mediaType)
      if (!artifact) return null
      const candidate: PackageReleaseDescriptor = {
        schemaVersion: 'modula.package.1', packageId: signed.moduleId,
        publisherId: manifest.publisher?.id,
        category: distribution.category, version: signed.version, releaseId: signed.releaseId,
        artifact: {sha256: artifact.digest, compressedSizeBytes: artifact.size,
          installedSizeEstimateBytes: distribution.artifact.installedSizeEstimateBytes,
          mediaType: artifact.contentType, download: artifact.download},
        signature: {algorithm: 'Ed25519', keyId: signed.signature.keyId, signature: signed.signature.signature,
          statementDigest: signed.signature.statementDigest},
        trust: {verified: signed.trust.verified && signed.trust.signatureState === 'verified',
          publisherVerified: signed.trust.publisherVerified, revoked: signed.revoked || signed.trust.signerRevoked},
        minimumHostVersion: distribution.minimumHostVersion,
        platforms: distribution.platforms, dependencies: distribution.dependencies ?? [],
        requiredCapabilities: distribution.requiredCapabilities ?? [],
        cachePolicy: distribution.cachePolicy, sharing: distribution.sharing,
        ...(distribution.executionProvider ? {executionProvider: distribution.executionProvider} : {}),
      }
      return candidate
    }))
    const available = releases.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])
    if (!available.some(release => release.packageId === moduleId)) {
      // NOT_FOUND is reserved for historical releases with no package contract.
      // A declared package whose signature/artifact cannot be verified must
      // never fall through the legacy install path.
      throw moduleError('UNTRUSTED_RELEASE', `No signed optional package release exists for ${moduleId}`)
    }
    const lock = resolvePackageClosure({
      requested: [{packageId: moduleId, versionRange: version ? `=${version}` : '*'}], available,
      hostVersion: context.hostVersion, platform: context.platform,
      hostCapabilities: new Set((context.hostCapabilities ?? []).filter(item => item.status === 'available').map(item => item.id)),
      trustedPublishers: new Set(available.filter(item => item.trust.publisherVerified).map(item => item.publisherId)),
      installedPublicDigests: new Set(cachedPublicDigests),
    })
    await this.assertPackageEntitlements(accountId, lock.packages.map(item => item.packageId))
    const lockSha256 = createHash('sha256').update(canonicalJsonStringify(lock)).digest('hex')
    return {lock, lockSha256}
  }

  async updatePlan(accountId: string, moduleId: string, targetVersion: string | null, context: DistributionHostContext = {}): Promise<ModuleUpdatePlan> {
    const installed = await this.installations.getInstalled(accountId, moduleId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    const currentDescriptor = await this.installationDescriptorFor(installed, context)
    const current = await this.registry.getVersion(installed.moduleId, installed.version)
    const policy = currentDescriptor.updatePolicy
    const target = await this.resolveUpdateTarget(current, policy, targetVersion, context)
    const currentCompatibility = currentDescriptor.compatibility
    const rollbackCandidateReleaseId = await this.rollbackCandidate(installed, current, context)
    if (!target) {
      return {
        installationId: installed.installationId,
        moduleId: installed.moduleId,
        expectedDescriptorRevision: currentDescriptor.descriptorRevision,
        currentRelease: currentDescriptor.currentRelease,
        targetRelease: null,
        allowed: false,
        blockers: [{code: 'TARGET_NOT_FOUND', message: 'No eligible release matches the installation update policy.'}],
        compatibility: currentCompatibility,
        permissionDelta: {unchanged: [], removed: [], added: [], changedSemantics: [], reviewRequired: false},
        targetArtifacts: [],
        downloadBytes: 0,
        rollbackCandidateReleaseId,
        dataMigration: {required: false, supported: true, missingCollections: [], olderCollections: []},
        permissionReviewRequired: false,
      }
    }
    const [evaluation, targetRelease, targetTrust, targetFrontend] = await Promise.all([
      new GreenfieldModuleVersionSwitchService(this.db, this.config).evaluate(accountId, installed, target.version, context),
      this.releaseDescriptor(target, context),
      this.trust.forRelease(target, {hostVersion: context.hostVersion ?? null, platform: platform(context.platform)}),
      this.db.selectFrom('greenfield_release_frontends').select(['schema_version', 'required_capabilities', 'runtime_projection'])
        .where('release_id', '=', target.releaseId).executeTakeFirst(),
    ])
    const requirements = capabilityRequirements(targetFrontend?.required_capabilities, targetFrontend?.runtime_projection)
    const compatibility = compatibilityResult(target, targetTrust.compatibility, targetTrust.revocation.revoked, {
      ...context,
      ...requirements,
      productUiContract: targetFrontend?.schema_version ?? null,
    })
    const newDigests = new Set(currentDescriptor.currentRelease.artifacts.map(artifact => artifact.digest))
    const targetArtifacts = targetRelease.artifacts.filter(artifact => !newDigests.has(artifact.digest))
    const permissionDelta = {
      unchanged: evaluation.permissions.retained,
      removed: evaluation.permissions.removed,
      added: evaluation.permissions.added.map(item => item.permission),
      changedSemantics: [] as string[],
      reviewRequired: evaluation.permissions.requiresConsent.length > 0,
    }
    const blockers = [
      ...evaluation.blockers.map(blocker => normalizeBlocker(blocker, targetRelease)),
      ...distributionBlockers(targetRelease, compatibility),
    ].filter(uniqueBlocker)
    if (permissionDelta.reviewRequired) blockers.push({code: 'PERMISSION_REVIEW_REQUIRED', message: 'The target release requests new permissions.'})
    return {
      installationId: installed.installationId,
      moduleId: installed.moduleId,
      expectedDescriptorRevision: currentDescriptor.descriptorRevision,
      currentRelease: currentDescriptor.currentRelease,
      targetRelease,
      allowed: blockers.length === 0,
      blockers,
      compatibility,
      permissionDelta,
      targetArtifacts,
      downloadBytes: targetArtifacts.filter(artifact => artifact.requiredForOfflineLaunch).reduce((sum, artifact) => sum + artifact.size, 0),
      rollbackCandidateReleaseId,
      dataMigration: {
        required: evaluation.dataSchema.fromCollections.join('\0') !== evaluation.dataSchema.toCollections.join('\0'),
        supported: !evaluation.dataSchema.older,
        missingCollections: evaluation.dataSchema.missingInTarget,
        olderCollections: evaluation.dataSchema.olderInTarget,
      },
      permissionReviewRequired: permissionDelta.reviewRequired,
    }
  }

  async updateFeed(accountId: string, context: DistributionHostContext = {}): Promise<ModuleUpdateFeed> {
    const {installations, releases, reviews} = await this.loadUpdateFeedFacts(accountId)
    const byModule = new Map<string, FeedReleaseFacts[]>()
    for (const facts of releases.values()) {
      const moduleId = resolveCanonicalModuleId(facts.release.moduleId)
      byModule.set(moduleId, [...(byModule.get(moduleId) ?? []), facts])
    }
    const items = installations.map(installation => {
      const moduleId = resolveCanonicalModuleId(installation.module_id)
      const current = releases.get(installation.release_id)
      if (!current) {
        return missingFeedItem(installation, moduleId, context, 'TARGET_NOT_FOUND')
      }
      const currentTrust = feedTrust(current)
      const currentCompatibility = feedCompatibility(current, context)
      const review = reviews.get(`${installation.installation_id}:${current.release.releaseId}`)
      const currentPermissions = declaredPermissions(current.release)
      const granted = arrayOfStrings(review?.granted_permissions).filter(permission => currentPermissions.includes(permission)).sort()
      const denied = arrayOfStrings(review?.denied_permissions)
      const permissionStatus = !review
        ? 'review-required' as const
        : currentPermissions.length > 0 && granted.length === 0 && currentPermissions.every(permission => denied.includes(permission))
          ? 'denied' as const
          : 'approved' as const
      const policy: ModuleInstallationDescriptor['updatePolicy'] = {
        mode: installation.update_policy,
        channel: installation.release_channel,
        lockedVersion: installation.locked_version,
      }
      const currentDescriptor = this.feedReleaseDescriptor(current, currentTrust)
      const body = currentDescriptor ? {
        descriptorVersion: MODULE_DISTRIBUTION_DESCRIPTOR_VERSION,
        installationId: installation.installation_id,
        moduleId,
        enabled: installation.status === 'enabled',
        currentRelease: currentDescriptor,
        compatibility: currentCompatibility,
        permissionReview: {releaseId: current.release.releaseId, status: permissionStatus, effectiveCapabilities: granted},
        updatePolicy: policy,
        launchEligible: installation.status === 'enabled' && review !== undefined && currentTrust.verified
          && !currentTrust.revoked && currentCompatibility.compatible !== false,
        updatedAt: installation.updated_at.toISOString(),
      } : null
      const descriptorRevision = body
        ? installationRevision(body)
        : revision({
          installationId: installation.installation_id,
          releaseId: current.release.releaseId,
          status: installation.status,
          policy,
          updatedAt: installation.updated_at.toISOString(),
          trust: currentTrust,
          review: review ?? null,
          context,
        })

      const target = selectFeedTarget(current, byModule.get(moduleId) ?? [], policy)
      if (!target) {
        return {
          installationId: installation.installation_id,
          moduleId,
          currentReleaseId: current.release.releaseId,
          currentVersion: current.release.version,
          currentTrust: {
            verified: currentTrust.verified,
            signerRevoked: currentTrust.signatureState === 'revokedKey',
            releaseRevoked: currentTrust.revoked,
          },
          availableTargetReleaseId: null,
          availableTargetVersion: null,
          descriptorRevision,
          permissionReviewRequired: false,
          compatibility: currentCompatibility,
          blockedReasonCodes: ['TARGET_NOT_FOUND'],
        }
      }

      const targetTrust = feedTrust(target)
      const compatibility = feedCompatibility(target, context)
      const permission = permissionDiff(current.release, target.release, granted)
      const permissionReviewRequired = permission.requiresConsent.length > 0
      const blockedReasonCodes: string[] = []
      if (targetTrust.revoked) blockedReasonCodes.push('RELEASE_REVOKED')
      if (targetTrust.signatureState === 'revokedKey') blockedReasonCodes.push('SIGNER_REVOKED')
      else if (!targetTrust.verified) blockedReasonCodes.push('UNTRUSTED_RELEASE')
      if (!hasCompletePackage(target)) blockedReasonCodes.push('TARGET_NOT_FOUND')
      if (compatibility.compatible === false) {
        blockedReasonCodes.push(...compatibility.reasons.map(reason => reason.code === 'CAPABILITY_UNAVAILABLE' ? reason.code : 'INCOMPATIBLE_HOST'))
      }
      if (permissionReviewRequired) blockedReasonCodes.push('PERMISSION_REVIEW_REQUIRED')
      return {
        installationId: installation.installation_id,
        moduleId,
        currentReleaseId: current.release.releaseId,
        currentVersion: current.release.version,
        currentTrust: {
          verified: currentTrust.verified,
          signerRevoked: currentTrust.signatureState === 'revokedKey',
          releaseRevoked: currentTrust.revoked,
        },
        availableTargetReleaseId: target.release.releaseId,
        availableTargetVersion: target.release.version,
        descriptorRevision,
        permissionReviewRequired,
        compatibility,
        blockedReasonCodes: [...new Set(blockedReasonCodes)],
      }
    })
    return {revision: revision(items), generatedAt: new Date().toISOString(), items}
  }

  /**
   * Load an account update feed in a fixed number of queries. The previous
   * implementation built a full update plan for every installation, causing
   * query count to grow linearly (and steeply) with account size.
   */
  private async loadUpdateFeedFacts(accountId: string) {
    const rawInstallations = await this.db.selectFrom('greenfield_extension_installations as installation')
      .innerJoin('greenfield_module_releases as release', 'release.extension_version_id', 'installation.extension_version_id')
      .select([
        'installation.installation_id', 'installation.account_id', 'installation.status', 'installation.extension_version_id',
        'installation.update_policy', 'installation.release_channel', 'installation.locked_version', 'installation.updated_at',
        'release.module_id', 'release.version', 'release.release_id',
      ])
      .where('installation.account_id', '=', accountId)
      .where('installation.status', 'not in', [...NOT_INSTALLED_STATUSES])
      .orderBy('release.module_id')
      .execute() as FeedInstallationRow[]
    const installations = collapseFeedInstallations(rawInstallations)
    if (!installations.length) {
      return {installations, releases: new Map<string, FeedReleaseFacts>(), reviews: new Map<string, {granted_permissions: unknown; denied_permissions: unknown}>()}
    }
    const moduleIds = [...new Set(installations.flatMap(row => moduleIdFamily(resolveCanonicalModuleId(row.module_id))))]
    const releaseRows = await this.db.selectFrom('greenfield_module_releases as release')
      .innerJoin('greenfield_module_versions as version', 'version.module_version_id', 'release.module_version_id')
      .innerJoin('greenfield_publishers as publisher', 'publisher.publisher_id', 'release.publisher_id')
      .select([
        'release.release_id', 'release.extension_id', 'release.extension_version_id', 'release.module_id', 'release.version',
        'release.publisher_id', 'release.release_state', 'release.release_channel', 'release.manifest_sha256',
        'release.release_sha256', 'release.signature_key_id', 'release.signature', 'release.source_repository',
        'release.source_commit', 'release.manifest_path', 'release.license_status', 'release.trust_level', 'release.published_at',
        'version.manifest', 'publisher.status as publisher_status',
      ])
      .where('release.module_id', 'in', moduleIds)
      .execute() as Array<Record<string, any>>
    const releaseIds = releaseRows.map(row => String(row.release_id))
    const installationIds = installations.map(row => row.installation_id)
    const publisherIds = [...new Set(releaseRows.map(row => String(row.publisher_id)))]
    const [integrityRows, productRows, frontendRows, signatureRows, artifactRows, revocationRows, quarantineRows, reviewRows] = await Promise.all([
      this.db.selectFrom('greenfield_module_release_integrity').select(['release_id', 'verified_at', 'mismatch_at'])
        .where('release_id', 'in', releaseIds).execute(),
      this.db.selectFrom('greenfield_mps_ingestions').select(['release_id', 'manifest_sha256', 'manifest', 'ingested_at'])
        .where('release_id', 'in', releaseIds).orderBy('ingested_at', 'desc').execute(),
      this.db.selectFrom('greenfield_release_frontends').select([
        'release_id', 'artifact_sha256', 'schema_version', 'compatibility', 'required_capabilities', 'runtime_projection',
      ]).where('release_id', 'in', releaseIds).execute(),
      this.db.selectFrom('greenfield_module_release_signatures as signature')
        .leftJoin('greenfield_publisher_signing_keys as signing_key', 'signing_key.key_id', 'signature.signature_key_id')
        .selectAll('signature').select([
          'signing_key.publisher_id as signing_key_publisher_id', 'signing_key.state as signing_key_state',
          'signing_key.revoked_at as signing_key_revoked_at',
        ]).where('signature.release_id', 'in', releaseIds)
        .orderBy('signature.release_id').orderBy('signature.verified_at', 'desc').execute(),
      this.db.selectFrom('greenfield_release_artifacts as artifact')
        .innerJoin('greenfield_release_asset_blobs as blob', 'blob.sha256', 'artifact.sha256')
        .select([
          'artifact.artifact_id', 'artifact.release_id', 'artifact.kind', 'artifact.sha256', 'artifact.filename',
          'artifact.access_class', 'artifact.required_for_offline_launch', 'blob.byte_size', 'blob.media_type',
        ]).where('artifact.release_id', 'in', releaseIds)
        .orderBy('artifact.release_id').orderBy('artifact.required_for_offline_launch', 'desc')
        .orderBy('artifact.kind').orderBy('artifact.artifact_id').execute(),
      this.db.selectFrom('greenfield_module_revocations').select(['scope', 'target_id'])
        .where(eb => eb.or([
          eb.and([eb('scope', '=', 'release'), eb('target_id', 'in', releaseIds)]),
          eb.and([eb('scope', '=', 'module'), eb('target_id', 'in', moduleIds)]),
          eb.and([eb('scope', '=', 'publisher'), eb('target_id', 'in', publisherIds)]),
        ])).execute(),
      this.db.selectFrom('greenfield_module_quarantines').select(['release_id'])
        .where('release_id', 'in', releaseIds).where('lifted_at', 'is', null).execute(),
      this.db.selectFrom('greenfield_module_permission_reviews')
        .select(['installation_id', 'release_id', 'granted_permissions', 'denied_permissions', 'reviewed_at', 'review_id'])
        .where('account_id', '=', accountId).where('installation_id', 'in', installationIds)
        .orderBy('reviewed_at', 'desc').orderBy('review_id', 'desc').execute(),
    ])
    const firstByRelease = <T extends {release_id: string | null}>(rows: T[]) => {
      const output = new Map<string, T>()
      for (const row of rows) if (row.release_id && !output.has(row.release_id)) output.set(row.release_id, row)
      return output
    }
    const integrity = firstByRelease(integrityRows)
    const products = firstByRelease(productRows)
    const frontends = firstByRelease(frontendRows)
    const signatures = groupBy(signatureRows, row => row.release_id)
    const artifacts = groupBy(artifactRows as FeedArtifactRow[], row => row.release_id)
    const quarantines = new Set(quarantineRows.map(row => row.release_id))
    const revocations = new Set(revocationRows.map(row => `${row.scope}:${row.target_id}`))
    const releases = new Map<string, FeedReleaseFacts>()
    for (const row of releaseRows) {
      const release: GreenfieldModuleReleaseRecord = {
        releaseId: row.release_id,
        extensionId: row.extension_id,
        extensionVersionId: row.extension_version_id,
        moduleId: resolveCanonicalModuleId(row.module_id),
        version: row.version,
        publisherId: row.publisher_id,
        releaseState: row.release_state,
        releaseChannel: row.release_channel ?? 'stable',
        manifest: row.manifest,
        manifestSha256: row.manifest_sha256,
        releaseSha256: row.release_sha256,
        signatureKeyId: row.signature_key_id,
        signature: row.signature,
        sourceRepository: row.source_repository,
        sourceCommit: row.source_commit,
        manifestPath: row.manifest_path,
        licenseStatus: row.license_status,
        trustLevel: row.trust_level,
        publishedAt: row.published_at,
      }
      const product = products.get(release.releaseId)
      const frontend = frontends.get(release.releaseId)
      const integrityRow = integrity.get(release.releaseId)
      releases.set(release.releaseId, {
        release,
        publisherStatus: row.publisher_status,
        integrity: integrityRow ? {verified_at: integrityRow.verified_at, mismatch_at: integrityRow.mismatch_at} : null,
        product: product ? {manifest_sha256: product.manifest_sha256, manifest: product.manifest} : null,
        frontend: frontend ? {
          artifact_sha256: frontend.artifact_sha256,
          schema_version: frontend.schema_version,
          compatibility: frontend.compatibility,
          required_capabilities: frontend.required_capabilities,
          runtime_projection: frontend.runtime_projection,
        } : null,
        signatures: (signatures.get(release.releaseId) ?? []) as FeedReleaseFacts['signatures'],
        artifacts: artifacts.get(release.releaseId) ?? [],
        revoked: release.releaseState === 'revoked'
          || revocations.has(`release:${release.releaseId}`)
          || revocations.has(`module:${row.module_id}`)
          || revocations.has(`module:${release.moduleId}`)
          || revocations.has(`publisher:${release.publisherId}`),
        quarantined: release.releaseState === 'quarantined' || quarantines.has(release.releaseId),
      })
    }
    const reviews = new Map<string, {granted_permissions: unknown; denied_permissions: unknown}>()
    for (const row of reviewRows) {
      if (!row.installation_id) continue
      const key = `${row.installation_id}:${row.release_id}`
      if (!reviews.has(key)) reviews.set(key, row)
    }
    return {installations, releases, reviews}
  }

  private feedReleaseDescriptor(facts: FeedReleaseFacts, trust: ReturnType<typeof feedTrust>): ModuleReleaseDescriptor | null {
    const signature = facts.signatures[0]
    if (!signature || signature.algorithm !== 'Ed25519' || !facts.release.releaseSha256 || !hasCompletePackage(facts)) return null
    const requirements = capabilityRequirements(facts.frontend?.required_capabilities, facts.frontend?.runtime_projection)
    return {
      descriptorVersion: MODULE_DISTRIBUTION_DESCRIPTOR_VERSION,
      moduleId: facts.release.moduleId,
      version: facts.release.version,
      releaseId: facts.release.releaseId,
      channel: facts.release.releaseChannel,
      manifestDigest: facts.release.manifestSha256,
      packageDigest: facts.release.releaseSha256,
      ...(facts.frontend?.artifact_sha256 ? {frontendDigest: facts.frontend.artifact_sha256} : {}),
      signature: {
        algorithm: 'Ed25519',
        keyId: signature.signature_key_id,
        signature: signature.signature,
        signaturePayloadVersion: MODULE_RELEASE_SIGNATURE_PAYLOAD_VERSION,
        statementDigest: signature.statement_sha256 ?? '',
      },
      trust: {
        verified: trust.verified,
        signatureState: trust.signatureState,
        publisherVerified: facts.publisherStatus === 'verified',
        signerRevoked: trust.signatureState === 'revokedKey',
        warnings: [],
      },
      artifacts: facts.artifacts.map(artifact => this.artifactDescriptor(artifact)),
      moduleSdk: moduleSdkRequirement(facts.release),
      ...(facts.frontend?.schema_version ? {productUiContract: facts.frontend.schema_version} : {}),
      requiredHostCapabilities: requirements.required,
      optionalHostCapabilities: requirements.optional,
      requestedPermissions: declaredPermissions(facts.release),
      publishedAt: facts.release.publishedAt?.toISOString() ?? '',
      provenance: {
        provider: 'github',
        repository: facts.release.sourceRepository,
        commit: facts.release.sourceCommit,
        releaseTag: facts.release.manifest.source.releaseTag ?? null,
        releaseAssetName: null,
      },
      revoked: trust.revoked,
    }
  }

  async setUpdatePolicy(accountId: string, installationId: string, input: Partial<InstallationPolicy>): Promise<ModuleInstallationDescriptor> {
    const row = await this.db.selectFrom('greenfield_extension_installations as installation')
      .innerJoin('greenfield_module_releases as release', 'release.extension_version_id', 'installation.extension_version_id')
      .select(['installation.update_policy', 'installation.release_channel', 'installation.locked_version', 'release.module_id'])
      .where('installation.installation_id', '=', installationId)
      .where('installation.account_id', '=', accountId)
      .executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'Module installation not found')
    const mode = input.mode ?? row.update_policy
    const channel = input.channel ?? row.release_channel
    const lockedVersion = input.lockedVersion === undefined ? row.locked_version : input.lockedVersion
    if (mode === 'lockedVersion' && !lockedVersion) throw moduleError('VALIDATION_FAILED', 'lockedVersion policy requires a version')
    if (lockedVersion) await this.registry.getVersion(row.module_id, lockedVersion)
    await this.db.updateTable('greenfield_extension_installations').set({
      update_policy: mode,
      release_channel: channel,
      locked_version: mode === 'lockedVersion' ? lockedVersion : null,
      updated_at: new Date(),
    }).where('installation_id', '=', installationId).where('account_id', '=', accountId).execute()
    await new AuditRepository(this.db).append('module.update-policy.changed', {mode, channel, lockedVersion: mode === 'lockedVersion' ? lockedVersion : null}, {type: 'moduleInstallation', id: installationId})
    return this.installationDescriptor(accountId, row.module_id)
  }

  async readArtifact(sha256: string, accountId: string | null) {
    if (!/^[0-9a-f]{64}$/.test(sha256)) throw moduleError('NOT_FOUND', 'Artifact not found')
    const rows = await this.db.selectFrom('greenfield_release_artifacts as artifact')
      .innerJoin('greenfield_release_asset_blobs as blob', 'blob.sha256', 'artifact.sha256')
      .innerJoin('greenfield_module_releases as release', 'release.release_id', 'artifact.release_id')
      .select([
        'artifact.release_id', 'artifact.access_class', 'artifact.filename', 'artifact.kind',
        'blob.sha256', 'blob.media_type', 'blob.byte_size', 'blob.bytes',
        'release.module_id', 'release.version', 'release.release_state',
      ])
      .where('artifact.sha256', '=', sha256)
      .where('release.release_state', 'in', ['published', 'superseded'])
      .execute()
    if (!rows.length) throw moduleError('NOT_FOUND', 'Artifact not found')
    const publicArtifact = rows.find(row => row.access_class === 'public')
    if (publicArtifact) return this.verifyStoredArtifact(publicArtifact)
    if (accountId) {
      for (const artifact of rows) {
        const installed = await this.installations.getInstalled(accountId, artifact.module_id)
        if (!installed) continue
        const release = await this.registry.getVersion(artifact.module_id, artifact.version)
        if ((await this.trust.forRelease(release)).verified) return this.verifyStoredArtifact(artifact)
      }
    }
    await new AuditRepository(this.db).append('module.artifact.authorization-denied', {digest: sha256, authenticated: Boolean(accountId)}, {type: 'releaseArtifact', id: sha256})
    // Do not reveal whether a private/module-restricted digest exists.
    throw moduleError('NOT_FOUND', 'Artifact not found')
  }

  private async assertPackageEntitlements(accountId: string | null, packageIds: readonly string[]): Promise<void> {
    const products = [...new Set(packageIds)]
    if (!products.length) return
    const offers = await this.db.selectFrom('greenfield_offers')
      .select(['product_id', 'kind'])
      .where('product_id', 'in', products)
      .where('state', '=', 'ACTIVE')
      .execute()
    const offerKinds = new Map<string, Set<string>>()
    for (const offer of offers) {
      const kinds = offerKinds.get(offer.product_id) ?? new Set<string>()
      kinds.add(offer.kind)
      offerKinds.set(offer.product_id, kinds)
    }
    const gated = products.filter(productId => {
      const kinds = offerKinds.get(productId)
      return kinds && kinds.size > 0 && !kinds.has('FREE') && !kinds.has('FREEMIUM')
    })
    if (!gated.length) return
    if (!accountId) throw moduleError('FORBIDDEN', 'An active product entitlement is required')
    const now = new Date()
    const entitled = await this.db.selectFrom('greenfield_entitlements')
      .select('product_id')
      .distinct()
      .where('owner_account_id', '=', accountId)
      .where('product_id', 'in', gated)
      .where('state', 'in', ['TRIAL', 'ACTIVE', 'GRACE'])
      .where('started_at', '<=', now)
      .where(eb => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', now)]))
      .execute()
    const allowed = new Set(entitled.map(row => row.product_id))
    if (gated.some(productId => !allowed.has(productId))) {
      throw moduleError('FORBIDDEN', 'An active product entitlement is required')
    }
  }

  private async verifyStoredArtifact<T extends {sha256: string; byte_size: number; bytes: Buffer; release_id: string}>(artifact: T): Promise<T> {
    const observed = createHash('sha256').update(artifact.bytes).digest('hex')
    if (artifact.byte_size === artifact.bytes.length && observed === artifact.sha256) return artifact
    await new AuditRepository(this.db).append('module.artifact.integrity-failed', {
      expectedDigest: artifact.sha256,
      observedDigest: observed,
      declaredBytes: artifact.byte_size,
      observedBytes: artifact.bytes.length,
    }, {type: 'moduleRelease', id: artifact.release_id})
    throw moduleError('ARTIFACT_DIGEST_MISMATCH', 'Stored artifact failed integrity verification')
  }

  async orphanArtifactReport() {
    const rows = await this.db.selectFrom('greenfield_release_asset_blobs as blob')
      .leftJoin('greenfield_release_artifacts as artifact', 'artifact.sha256', 'blob.sha256')
      .leftJoin('greenfield_module_releases as release', 'release.release_sha256', 'blob.sha256')
      .leftJoin('greenfield_release_presentation_assets as presentation', 'presentation.sha256', 'blob.sha256')
      .select(['blob.sha256', 'blob.media_type', 'blob.byte_size', 'blob.created_at'])
      .where('artifact.artifact_id', 'is', null)
      .where('release.release_id', 'is', null)
      .where('presentation.asset_id', 'is', null)
      .orderBy('blob.created_at')
      .execute()
    // GF-MOD-02 (G004): the inverse gap, metadata that references missing bytes.
    const missingPresentation = await presentationAssetsMissingBlobs(this.db)
    return {
      mode: 'DRY_RUN' as const,
      count: rows.length,
      bytes: rows.reduce((sum, row) => sum + row.byte_size, 0),
      artifacts: rows.map(row => ({sha256: row.sha256, contentType: row.media_type, size: row.byte_size, createdAt: row.created_at.toISOString()})),
      missingPresentationBlobs: {
        count: missingPresentation.length,
        releases: new Set(missingPresentation.map(gap => gap.releaseId ?? `${gap.productId}@${gap.version}`)).size,
        assets: missingPresentation,
      },
    }
  }

  private artifactDescriptor(row: {
    artifact_id: string
    kind: ModuleArtifactDescriptor['kind']
    sha256: string
    byte_size: number
    media_type: string
    access_class: 'public' | 'installation'
    required_for_offline_launch: boolean
  }): ModuleArtifactDescriptor {
    const path = `/v1/registry/artifacts/${row.sha256}`
    return {
      artifactId: row.artifact_id,
      kind: row.kind,
      digest: row.sha256,
      digestAlgorithm: 'sha256',
      size: row.byte_size,
      contentType: row.media_type,
      immutable: true,
      requiredForOfflineLaunch: row.required_for_offline_launch,
      access: row.access_class,
      download: {
        method: 'GET',
        pathOrUrl: this.config.publicApiUrl ? `${this.config.publicApiUrl.replace(/\/+$/, '')}${path}` : path,
        authorization: row.access_class === 'public' ? 'none' : 'bearer',
        range: true,
      },
    }
  }

  private async resolveUpdateTarget(
    current: GreenfieldModuleReleaseRecord,
    policy: ModuleInstallationDescriptor['updatePolicy'],
    targetVersion: string | null,
    context: DistributionHostContext,
  ): Promise<GreenfieldModuleReleaseRecord | null> {
    if (targetVersion) return this.registry.getVersion(current.moduleId, targetVersion)
    if (policy.mode === 'manual') return null
    if (policy.mode === 'lockedVersion') {
      if (!policy.lockedVersion || policy.lockedVersion === current.version) return null
      return this.registry.getVersion(current.moduleId, policy.lockedVersion)
    }
    const channel = policy.mode === 'automaticStable' ? 'stable' : policy.channel
    const releases = (await this.registry.listVersions(current.moduleId))
      .filter(release => release.releaseState === 'published' && release.releaseChannel === channel)
      .filter(release => compareSemver(release.version, current.version) > 0)
      .sort((left, right) => compareSemver(right.version, left.version))
    for (const release of releases) {
      try {
        const descriptor = await this.releaseDescriptor(release, context)
        if (descriptor.trust.verified && !descriptor.revoked) return release
      } catch {
        // An incomplete or untrusted release is never selected automatically.
      }
    }
    return null
  }

  private async latestEligibleRelease(moduleId: string, channel: 'stable' | 'beta' | 'rc' | 'dev', context: DistributionHostContext) {
    const releases = (await this.registry.listVersions(moduleId))
      .filter(release => release.releaseState === 'published' && release.releaseChannel === channel)
      .sort((left, right) => compareSemver(right.version, left.version))
    for (const release of releases) {
      try {
        const descriptor = await this.releaseDescriptor(release, context)
        if (descriptor.trust.verified && !descriptor.revoked) return release
      } catch {
        // Continue to the next complete trusted release.
      }
    }
    throw moduleError('NOT_FOUND', `No trusted ${channel} release is available`)
  }

  private async rollbackCandidate(installed: GreenfieldModuleInstallationRow, current: GreenfieldModuleReleaseRecord, context: DistributionHostContext): Promise<string | null> {
    const releases = (await this.registry.listVersions(current.moduleId))
      .filter(release => ['published', 'superseded'].includes(release.releaseState))
      .filter(release => compareSemver(release.version, current.version) < 0)
      .sort((left, right) => compareSemver(right.version, left.version))
    for (const candidate of releases) {
      if (dataSchemaDiff(current, candidate).older) continue
      try {
        const evaluation = await new GreenfieldModuleVersionSwitchService(this.db, this.config).evaluate(installed.accountId, installed, candidate.version, context)
        const descriptor = await this.releaseDescriptor(candidate, context)
        if (evaluation.allowed && descriptor.trust.verified && !descriptor.revoked && !evaluation.permissions.requiresConsent.length) return candidate.releaseId
      } catch {
        // A rollback candidate must satisfy every gate; skip failures.
      }
    }
    return null
  }
}

function compatibilityResult(
  release: GreenfieldModuleReleaseRecord,
  base: {evaluated: boolean; compatible: boolean | null; hostVersion: string | null; platform: string | null; reasons: Array<{code: string; message: string}>},
  revoked: boolean,
  input: DistributionHostContext & {
    required: DistributionCapabilityRequirement[]
    optional: DistributionCapabilityRequirement[]
    productUiContract: string | null
  },
): ModuleCompatibilityResult {
  const reasons: ModuleCompatibilityReason[] = base.reasons.map(reason => ({...reason}))
  const sdk = moduleSdkRequirement(release)
  if (input.moduleSdkVersion && sdk.min && !satisfiesSemverRange(input.moduleSdkVersion, `>=${sdk.min}`)) {
    reasons.push({code: 'MODULE_SDK_TOO_NEW', message: `Module SDK ${sdk.min} is required; host provides ${input.moduleSdkVersion}.`, required: sdk.min, actual: input.moduleSdkVersion})
  }
  if (input.moduleSdkVersion && sdk.max && !satisfiesSemverRange(input.moduleSdkVersion, `<=${sdk.max}`)) {
    reasons.push({code: 'MODULE_SDK_TOO_OLD', message: `Module supports Module SDK through ${sdk.max}; host provides ${input.moduleSdkVersion}.`, required: sdk.max, actual: input.moduleSdkVersion})
  }
  if (input.productUiContract && input.productUiContractVersion
    && !satisfiesSemverRange(input.productUiContractVersion, `^${input.productUiContract}`)) {
    reasons.push({
      code: 'PRODUCT_UI_CONTRACT_UNSUPPORTED',
      message: `Product UI ${input.productUiContract} is required; host provides ${input.productUiContractVersion}.`,
      required: input.productUiContract,
      actual: input.productUiContractVersion,
    })
  }
  if (input.hostCapabilities) {
    const negotiation = negotiateHostCapabilities({
      host: input.hostCapabilities,
      required: input.required.map(toUiRequirement),
      optional: input.optional.map(toUiRequirement),
    })
    if (!negotiation.ok && negotiation.error) {
      reasons.push({
        code: 'CAPABILITY_UNAVAILABLE',
        message: negotiation.error.message,
        required: negotiation.error.capability.version,
        capability: negotiation.error.capability.id,
      })
    }
  }
  if (revoked) reasons.push({code: 'RELEASE_REVOKED', message: 'The registry revoked this release.'})
  const evaluated = base.evaluated || Boolean(input.moduleSdkVersion || input.productUiContractVersion || input.hostCapabilities) || revoked
  return {
    evaluated,
    compatible: evaluated ? reasons.length === 0 : null,
    reasons,
    actual: {
      hostVersion: base.hostVersion,
      platform: base.platform,
      moduleSdk: input.moduleSdkVersion ?? null,
      productUiContract: input.productUiContractVersion ?? null,
      hostCapabilities: (input.hostCapabilities ?? []).filter(item => item.status !== 'unavailable').map(item => `${item.id}@${item.version}`).sort(),
    },
  }
}

function feedTrust(facts: FeedReleaseFacts) {
  const signature = signatureState(
    facts.signatures as Parameters<typeof signatureState>[0],
    facts.release,
    facts.product?.manifest_sha256 ?? null,
    facts.frontend?.artifact_sha256 ?? null,
  )
  const integrityOk = Boolean(facts.integrity && !facts.integrity.mismatch_at)
  const verified = ['published', 'superseded'].includes(facts.release.releaseState)
    && Boolean(facts.release.releaseSha256 && facts.release.manifestSha256)
    && integrityOk
    && facts.publisherStatus === 'verified'
    && signature.state === 'verified'
    && !facts.revoked
    && !facts.quarantined
  return {verified, signatureState: signature.state, revoked: facts.revoked, quarantined: facts.quarantined}
}

function feedCompatibility(facts: FeedReleaseFacts, context: DistributionHostContext): ModuleCompatibilityResult {
  const product = record(facts.product?.manifest)
  const productCompatibility = record(product?.compatibility)
  const frontendCompatibility = record(facts.frontend?.compatibility)
  const base = evaluateCompatibility(facts.release, {
    hostVersion: context.hostVersion ?? null,
    platform: platform(context.platform),
  }, {
    host: stringOrNull(productCompatibility?.host),
    frontendHostRuntime: stringOrNull(frontendCompatibility?.versionRange) ?? stringOrNull(frontendCompatibility?.range),
    platforms: Array.isArray(productCompatibility?.platforms)
      ? productCompatibility.platforms.map(String)
      : facts.release.manifest.compatibility?.platforms ?? [],
    requiredCapabilities: Array.isArray(facts.frontend?.required_capabilities) ? facts.frontend.required_capabilities : [],
  })
  const requirements = capabilityRequirements(facts.frontend?.required_capabilities, facts.frontend?.runtime_projection)
  return compatibilityResult(facts.release, base, facts.revoked, {
    ...context,
    ...requirements,
    productUiContract: facts.frontend?.schema_version ?? null,
  })
}

function selectFeedTarget(
  current: FeedReleaseFacts,
  candidates: FeedReleaseFacts[],
  policy: ModuleInstallationDescriptor['updatePolicy'],
): FeedReleaseFacts | null {
  if (policy.mode === 'manual') return null
  if (policy.mode === 'lockedVersion') {
    if (!policy.lockedVersion || policy.lockedVersion === current.release.version) return null
    return candidates.find(candidate => candidate.release.version === policy.lockedVersion) ?? null
  }
  const channel = policy.mode === 'automaticStable' ? 'stable' : policy.channel
  return candidates
    .filter(candidate => candidate.release.releaseState === 'published' && candidate.release.releaseChannel === channel)
    .filter(candidate => compareSemver(candidate.release.version, current.release.version) > 0)
    .filter(candidate => feedTrust(candidate).verified && hasCompletePackage(candidate))
    .sort((left, right) => compareSemver(right.release.version, left.release.version))[0] ?? null
}

function hasCompletePackage(facts: FeedReleaseFacts) {
  return Boolean(facts.release.releaseSha256 && facts.artifacts.some(artifact =>
    artifact.kind === 'module-package'
      && artifact.required_for_offline_launch
      && artifact.sha256 === facts.release.releaseSha256))
}

function installationRevision(input: Omit<ModuleInstallationDescriptor, 'descriptorRevision'> | {
  descriptorVersion: typeof MODULE_DISTRIBUTION_DESCRIPTOR_VERSION
  installationId: string
  moduleId: string
  enabled: boolean
  currentRelease: ModuleReleaseDescriptor
  compatibility: ModuleCompatibilityResult
  permissionReview: ModuleInstallationDescriptor['permissionReview']
  updatePolicy: ModuleInstallationDescriptor['updatePolicy']
  launchEligible: boolean
  updatedAt: string
}) {
  const release = input.currentRelease
  return revision({
    descriptorVersion: input.descriptorVersion,
    installationId: input.installationId,
    moduleId: input.moduleId,
    enabled: input.enabled,
    release: {
      moduleId: release.moduleId,
      version: release.version,
      releaseId: release.releaseId,
      channel: release.channel,
      manifestDigest: release.manifestDigest,
      packageDigest: release.packageDigest,
      frontendDigest: release.frontendDigest ?? null,
      signature: {
        keyId: release.signature.keyId,
        signaturePayloadVersion: release.signature.signaturePayloadVersion,
        statementDigest: release.signature.statementDigest,
      },
      trust: {
        verified: release.trust.verified,
        signatureState: release.trust.signatureState,
        publisherVerified: release.trust.publisherVerified,
        signerRevoked: release.trust.signerRevoked,
      },
      artifacts: release.artifacts.map(artifact => ({
        artifactId: artifact.artifactId,
        kind: artifact.kind,
        digest: artifact.digest,
        size: artifact.size,
        contentType: artifact.contentType,
        requiredForOfflineLaunch: artifact.requiredForOfflineLaunch,
        access: artifact.access,
      })),
      moduleSdk: release.moduleSdk,
      productUiContract: release.productUiContract ?? null,
      requiredHostCapabilities: release.requiredHostCapabilities,
      optionalHostCapabilities: release.optionalHostCapabilities,
      requestedPermissions: release.requestedPermissions,
      publishedAt: release.publishedAt,
      revoked: release.revoked,
    },
    compatibility: input.compatibility,
    permissionReview: input.permissionReview,
    updatePolicy: input.updatePolicy,
    launchEligible: input.launchEligible,
    updatedAt: input.updatedAt,
  })
}

function collapseFeedInstallations(rows: FeedInstallationRow[]): FeedInstallationRow[] {
  const grouped = new Map<string, FeedInstallationRow[]>()
  for (const row of rows) {
    const canonical = resolveCanonicalModuleId(row.module_id)
    grouped.set(canonical, [...(grouped.get(canonical) ?? []), row])
  }
  return [...grouped.entries()].map(([canonical, family]) => ({
    ...(family.find(row => row.status === 'enabled') ?? family[0]!),
    module_id: canonical,
  })).sort((left, right) => left.module_id.localeCompare(right.module_id))
}

function groupBy<T, K>(values: T[], key: (value: T) => K): Map<K, T[]> {
  const output = new Map<K, T[]>()
  for (const value of values) {
    const itemKey = key(value)
    output.set(itemKey, [...(output.get(itemKey) ?? []), value])
  }
  return output
}

function missingFeedItem(
  installation: FeedInstallationRow,
  moduleId: string,
  context: DistributionHostContext,
  code: string,
): ModuleUpdateFeed['items'][number] {
  return {
    installationId: installation.installation_id,
    moduleId,
    currentReleaseId: installation.release_id,
    currentVersion: installation.version,
    currentTrust: {verified: false, signerRevoked: false, releaseRevoked: false},
    availableTargetReleaseId: null,
    availableTargetVersion: null,
    descriptorRevision: revision({installationId: installation.installation_id, releaseId: installation.release_id, code}),
    permissionReviewRequired: false,
    compatibility: unevaluatedCompatibility(context),
    blockedReasonCodes: [code],
  }
}

function capabilityRequirements(requiredRaw: unknown, runtimeProjection: unknown): {
  required: DistributionCapabilityRequirement[]
  optional: DistributionCapabilityRequirement[]
} {
  const runtime = record(runtimeProjection)
  const capabilities = record(runtime?.capabilities)
  return {
    required: parseRequirements(requiredRaw, true),
    optional: parseRequirements(capabilities?.optional, false),
  }
}

function parseRequirements(value: unknown, required: boolean): DistributionCapabilityRequirement[] {
  const output: DistributionCapabilityRequirement[] = []
  for (const raw of Array.isArray(value) ? value : []) {
    const parsed = parseHostCapabilityReference(raw as any)
    if (!parsed) continue
    output.push({
      capability: parsed.id,
      versionRange: parsed.version,
      required,
      ...(parsed.fallback ? {fallback: `${parsed.fallback.id}@${parsed.fallback.version}`} : {}),
    })
  }
  return output.sort((left, right) => left.capability.localeCompare(right.capability))
}

function toUiRequirement(value: DistributionCapabilityRequirement) {
  const fallback = value.fallback ? parseHostCapabilityReference(value.fallback) : undefined
  return {
    id: value.capability,
    version: value.versionRange ?? '1',
    ...(fallback ? {fallback: {id: fallback.id, version: fallback.version}} : {}),
  }
}

function moduleSdkRequirement(release: GreenfieldModuleReleaseRecord): {min: string; max?: string} {
  const manifest = release.manifest as {manifestVersion: number; standardVersion?: string}
  return {
    min: manifest.manifestVersion === 2 && manifest.standardVersion ? manifest.standardVersion : '1.0.0',
  }
}

function declaredPermissions(release: GreenfieldModuleReleaseRecord): string[] {
  return [...new Set([
    ...release.manifest.permissions.map(permission => permission.permission),
    ...allRuntimePermissionKeys(release.manifest),
  ])].sort()
}

function distributionBlockers(release: ModuleReleaseDescriptor, compatibility: ModuleCompatibilityResult) {
  const blockers: Array<{code: string; message: string}> = []
  if (release.revoked) blockers.push({code: 'RELEASE_REVOKED', message: 'The target release is revoked.'})
  if (release.trust.signatureState === 'revokedKey') blockers.push({code: 'SIGNER_REVOKED', message: 'The target release signer is revoked.'})
  else if (!release.trust.verified) blockers.push({code: 'UNTRUSTED_RELEASE', message: 'The target release is not production-trusted.'})
  if (compatibility.compatible === false) {
    for (const reason of compatibility.reasons) blockers.push({code: reason.code === 'CAPABILITY_UNAVAILABLE' ? reason.code : 'INCOMPATIBLE_HOST', message: reason.message})
  }
  if (!release.artifacts.some(artifact => artifact.kind === 'module-package' && artifact.requiredForOfflineLaunch)) {
    blockers.push({code: 'TARGET_NOT_FOUND', message: 'The target release has no complete offline artifact set.'})
  }
  return blockers.filter(uniqueBlocker)
}

function normalizeBlocker(blocker: {code: string; message: string}, release: ModuleReleaseDescriptor) {
  if (blocker.code === 'INCOMPATIBLE') return {code: 'INCOMPATIBLE_HOST', message: blocker.message}
  if (blocker.code === 'UNTRUSTED_RELEASE' && release.trust.signatureState === 'revokedKey') return {code: 'SIGNER_REVOKED', message: blocker.message}
  return blocker
}

function uniqueBlocker(value: {code: string; message: string}, index: number, all: Array<{code: string; message: string}>) {
  return all.findIndex(item => item.code === value.code && item.message === value.message) === index
}

function revision(value: unknown) {
  return createHash('sha256').update(canonicalJsonStringify(value)).digest('hex')
}

function requiredPublishedAt(release: GreenfieldModuleReleaseRecord): string {
  if (!release.publishedAt) throw moduleError('NOT_FOUND', 'Release has never been published')
  return release.publishedAt.toISOString()
}

function unevaluatedCompatibility(context: DistributionHostContext): ModuleCompatibilityResult {
  return {
    evaluated: false,
    compatible: null,
    reasons: [],
    actual: {
      hostVersion: context.hostVersion ?? null,
      platform: context.platform ?? null,
      moduleSdk: context.moduleSdkVersion ?? null,
      productUiContract: context.productUiContractVersion ?? null,
      hostCapabilities: [],
    },
  }
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function platform(value: unknown): 'ios' | 'android' | 'web' | 'desktop' | 'server' | null {
  return typeof value === 'string' && ['ios', 'android', 'web', 'desktop', 'server'].includes(value)
    ? value as 'ios' | 'android' | 'web' | 'desktop' | 'server'
    : null
}
