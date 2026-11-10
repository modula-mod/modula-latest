import {randomUUID} from 'node:crypto'
import {resolveCanonicalModuleId, moduleIdFamily} from '@modula/greenfield-contracts'
import {classifyPermissionRisk, getNamespacePrefix, usesReservedNamespace, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import type {
  PublisherReleaseJobCheck,
  PublisherReleaseJobCheckId,
  PublisherReleaseJobPermission,
  PublisherReleaseJobPermissionDelta,
  PublisherReleaseJobPreview,
  PublisherReleaseJobSignature,
  PublisherReleaseJobState,
} from '@modula/greenfield-module-registry-contracts'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {DeveloperService} from '../developers/service.js'
import {GreenfieldModuleCompatibilityService} from '../modules/compatibility-service.js'
import {GreenfieldModuleDependencyResolver} from '../modules/dependency-resolver.js'
import {GreenfieldGithubReleaseSyncService, releaseChannelFromMps, type GithubReleaseSource, type VerifiedGithubRelease} from '../modules/github-release-sync-service.js'
import type {GreenfieldModuleReleaseRecord} from '../modules/module-domain.js'
import {ModuleDomainError} from '../modules/module-errors.js'
import {GreenfieldModulePermissionService} from '../modules/permission-service.js'
import {GreenfieldModuleReleaseService} from '../modules/release-service.js'
import {GreenfieldPublisherSigningKeyService, approvalFactsSha256, buildPublisherReleaseApprovalFacts, buildPublisherReleaseStatement, normalizeSignatureInput, statementBytes, type PublisherReleaseApprovalFacts} from '../modules/release-signing.js'
import {appendLog, appendSigningAudit, isUniqueViolation, loadJob, transitionJob, type ReleaseJobRow} from './release-job-core.js'
import {PublisherConsoleError} from './release-job-core.js'
import {PublisherOnlineSigningAuthority} from './signing-authority.js'
import {SigningProviderError, type PublisherSigningProvider} from './signing-provider.js'

/**
 * Publication seam. Production uses the registry's own publishRelease. The
 * isolated SENTINEL test fixture injects a recorder so tests never write the
 * public catalogue.
 */
export type ReleasePublisher = (moduleId: string, version: string) => Promise<GreenfieldModuleReleaseRecord>

export type ReleaseJobProcessorDeps = {
  source: GithubReleaseSource
  config?: AppConfig
  githubEnabled?: boolean
  publish?: ReleasePublisher
  signingProvider?: PublisherSigningProvider
}

type CheckMap = Map<PublisherReleaseJobCheckId, PublisherReleaseJobCheck>

const CHECK_ORDER: PublisherReleaseJobCheckId[] = [
  'ownership', 'source', 'version_uniqueness', 'package_digest', 'manifest_digest', 'frontend_digest',
  'signature', 'compatibility', 'permissions', 'dependencies', 'packaging', 'policy',
]

/**
 * Executes publisher release console work off the HTTP path: fetchVerified,
 * independent signature verification, registry import/verify/blob storage,
 * and publication through the registry's existing publishRelease.
 */
export class PublisherReleaseJobProcessor {
  private readonly releases: GreenfieldModuleReleaseService
  private readonly sync: GreenfieldGithubReleaseSyncService
  private readonly publishFn: ReleasePublisher

  constructor(private readonly db: ModulaDb, private readonly deps: ReleaseJobProcessorDeps) {
    this.releases = new GreenfieldModuleReleaseService(db)
    this.sync = new GreenfieldGithubReleaseSyncService(db, deps.source)
    this.publishFn = deps.publish ?? ((moduleId, version) => this.releases.publishRelease(moduleId, version))
  }

  // ---- validate ----------------------------------------------------------

  async validate(jobId: string): Promise<PublisherReleaseJobState | null> {
    const job = await loadJob(this.db, jobId)
    if (!job) return null
    if (job.state !== 'fetching') {
      await appendLog(this.db, jobId, 'warn', 'fetch', `Validation work skipped: job is ${job.state}`)
      return job.state as PublisherReleaseJobState
    }
    if (this.deps.githubEnabled === false) {
      return this.finish(job, ['fetching'], 'failed', {error: {code: 'GITHUB_UNAVAILABLE', message: 'GitHub release sync is disabled in this environment'}}, 'error', 'fetch', 'GitHub release sync is disabled')
    }
    await appendLog(this.db, jobId, 'info', 'fetch', `Fetching ${job.source_repository}@${job.release_tag} (provenance, tag commit, package digest)`)
    let verified: VerifiedGithubRelease
    try {
      verified = await this.sync.fetchVerified({repository: job.source_repository, releaseTag: job.release_tag})
    } catch (error) {
      if (error instanceof ModuleDomainError) {
        const code = error.code === 'NOT_FOUND' ? 'INVALID_SOURCE_RELEASE' : 'VALIDATION_FAILED'
        return this.finish(job, ['fetching'], 'failed', {error: {code, message: error.message.slice(0, 1000)}}, 'error', 'fetch', `Fetch failed: ${error.message}`)
      }
      throw error // transient (network, database): the runner retries
    }

    const permissions = verified.manifest.permissions.map(toPermission)
    const preview: PublisherReleaseJobPreview = {
      identity: {moduleId: verified.productId, name: verified.manifest.name ?? null, publisherId: verified.manifest.publisher.publisherId},
      version: verified.version,
      channel: releaseChannelFromMps(verified.mpsBytes),
      permissions,
      digests: {
        package: verified.packageSha256,
        manifest: verified.evidence.manifestSha256 ?? null,
        productManifest: verified.evidence.productManifestSha256 ?? null,
        frontend: verified.evidence.frontendSha256 ?? null,
      },
      commit: verified.releaseCommit,
      releaseTag: verified.releaseTag,
    }
    let validating: ReleaseJobRow | undefined
    try {
      validating = await transitionJob(this.db, jobId, ['fetching'], 'validating', {
        preview, version: verified.version, source_commit: verified.releaseCommit, artifact_sha256: verified.packageSha256, channel: preview.channel,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return this.finish(job, ['fetching'], 'conflicted', {preview, error: {code: 'JOB_IN_FLIGHT', message: `Another job for ${verified.productId}@${verified.version} is in flight`}}, 'error', 'validate', `Conflict: another job for ${verified.productId}@${verified.version} is in flight`)
      }
      throw error
    }
    if (!validating) return this.stopped(jobId, 'validate')
    await appendLog(this.db, jobId, 'info', 'validate', `Fetched ${verified.productId}@${verified.version} at ${verified.releaseCommit}; package sha256 ${verified.packageSha256}`)

    const checks: CheckMap = new Map(CHECK_ORDER.map(id => [id, {id, status: 'pending'} as PublisherReleaseJobCheck]))
    const set = (id: PublisherReleaseJobCheckId, status: 'passed' | 'failed' | 'skipped', message?: string, code?: string) => checks.set(id, {id, status, ...(message ? {message} : {}), ...(code ? {code} : {})})

    // 1. ownership — publisher + module specific, independent of the manifest's own claims.
    const manifest = verified.manifest
    const canonical = resolveCanonicalModuleId(verified.productId)
    const namespace = await this.db.selectFrom('greenfield_publisher_namespaces').select(['publisher_id', 'verified_at', 'revoked_at'])
      .where('namespace', '=', getNamespacePrefix(canonical)).executeTakeFirst()
    const ownershipProblems: string[] = []
    if (canonical !== job.module_id || manifest.moduleId !== verified.productId) ownershipProblems.push(`release identity ${verified.productId} is not module ${job.module_id}`)
    if (manifest.publisher.publisherId !== job.publisher_id) ownershipProblems.push(`release publisher ${manifest.publisher.publisherId} is not ${job.publisher_id}`)
    if (!namespace || namespace.revoked_at || namespace.publisher_id !== job.publisher_id) ownershipProblems.push(`namespace ${getNamespacePrefix(canonical)} is not held by ${job.publisher_id}`)
    try { await new DeveloperService(this.db, this.deps.config as AppConfig).requirePublisherAccess(job.created_by_account_id, job.publisher_id) }
    catch { ownershipProblems.push('job creator no longer has publisher access') }
    set('ownership', ownershipProblems.length ? 'failed' : 'passed', ownershipProblems.join('; ') || undefined, ownershipProblems.length ? 'FORBIDDEN_NOT_PUBLISHER' : undefined)

    // 2. source commit + tag
    const sourceProblems: string[] = []
    if (verified.repository.toLowerCase() !== job.source_repository.toLowerCase()) sourceProblems.push('repository mismatch')
    if (verified.releaseTag !== job.release_tag) sourceProblems.push('release tag mismatch')
    if (!manifest.source.releaseTag || manifest.source.releaseTag !== job.release_tag) sourceProblems.push('manifest source.releaseTag must equal the GitHub release tag')
    if (!/^[0-9a-f]{40}$/.test(verified.releaseCommit) || !verified.checks.includes('tag.commit')) sourceProblems.push('tag commit not verified')
    set('source', sourceProblems.length ? 'failed' : 'passed', sourceProblems.join('; ') || `tag ${job.release_tag} -> ${verified.releaseCommit}`, sourceProblems.length ? 'INVALID_SOURCE_RELEASE' : undefined)

    // 3. immutable version uniqueness
    const existing = await this.releases.getRelease(verified.productId, verified.version)
    let conflicted = false
    if (existing) {
      if (['published', 'superseded'].includes(existing.releaseState)) { conflicted = true; set('version_uniqueness', 'failed', `${verified.productId}@${verified.version} is already ${existing.releaseState}`, 'VERSION_CONFLICT') }
      else if (['quarantined', 'revoked'].includes(existing.releaseState)) set('version_uniqueness', 'failed', `registry release is ${existing.releaseState}`, 'VERSION_CONFLICT')
      else if (existing.sourceRepository.toLowerCase() !== verified.manifest.source.repository.toLowerCase() || existing.sourceCommit !== verified.releaseCommit
        || existing.releaseSha256 !== verified.packageSha256 || existing.manifestSha256 !== verified.evidence.manifestSha256) {
        conflicted = true
        set('version_uniqueness', 'failed', 'registry already holds different bytes for this version; releases are immutable', 'VERSION_CONFLICT')
      } else set('version_uniqueness', 'passed', `continuing existing ${existing.releaseState} registry release`)
    } else set('version_uniqueness', 'passed')

    // 4-6. digests (fetchVerified recomputed every digest server-side)
    set('package_digest', verified.checks.includes('package.sha256') ? 'passed' : 'failed', `sha256 ${verified.packageSha256}`)
    set('manifest_digest', verified.checks.includes('adapterManifest.sha256') && verified.checks.includes('productManifest.sha256') ? 'passed' : 'failed',
      `adapter ${verified.evidence.manifestSha256}; product ${verified.evidence.productManifestSha256}`)
    if (verified.frontend) set('frontend_digest', verified.checks.includes('frontend.sha256') ? 'passed' : 'failed', `sha256 ${verified.evidence.frontendSha256}`)
    else set('frontend_digest', 'skipped', 'release has no frontend artifact')

    // 7. independent signature verification: statement rebuilt from verified facts only.
    const signature = await this.verifySignature(verified)
    if (signature.state === 'verified') set('signature', 'passed', `Ed25519 key ${signature.keyId}`)
    else set('signature', 'failed', signature.detail, signature.state === 'missing' ? 'SIGNATURE_MISSING' : signature.state === 'revokedKey' ? 'SIGNATURE_REVOKED' : 'SIGNATURE_INVALID')

    // 8. compatibility + security/distribution policy (existing compatibility service)
    const publisher = await this.db.selectFrom('greenfield_publishers').selectAll().where('publisher_id', '=', job.publisher_id).executeTakeFirst()
    const synthetic = {releaseState: 'published', manifest} as unknown as GreenfieldModuleReleaseRecord
    const platform = (manifest.compatibility.platforms[0] ?? 'server') as 'server'
    const compat = new GreenfieldModuleCompatibilityService(this.deps.config).evaluate(synthetic, {platform, publisherStatus: publisher?.status})
    const compatReasons = compat.reasons.filter(reason => ['GREENFIELD_VERSION_TOO_OLD', 'HOST_VERSION_TOO_OLD', 'PROTOCOL_UNSUPPORTED', 'PERMISSION_RESTRICTED'].includes(reason))
    if (!manifest.compatibility.platforms.length) compatReasons.push('PLATFORM_UNSUPPORTED')
    set('compatibility', compatReasons.length ? 'failed' : 'passed', compatReasons.join(', ') || `platforms ${manifest.compatibility.platforms.join(', ')}`)
    const policyProblems = compat.reasons.filter(reason => ['LICENSE_NOT_APPROVED', 'PUBLISHER_SUSPENDED'].includes(reason)) as string[]
    if (!publisher) policyProblems.push('publisher not registered')
    const claimsFirstParty = manifest.trust.requestedLevel === 'firstParty' || manifest.license.status === 'firstParty'
    if (claimsFirstParty && (publisher?.trust_level !== 'firstParty' || publisher?.status !== 'verified')) policyProblems.push('first-party trust can only be requested by a verified first-party publisher')
    if (usesReservedNamespace(canonical) && (publisher?.trust_level !== 'firstParty' || publisher.status !== 'verified' || !namespace?.verified_at)) policyProblems.push('reserved namespace lacks authoritative registry policy')
    set('policy', policyProblems.length ? 'failed' : 'passed', policyProblems.join('; ') || undefined)

    // 9. permissions (existing permission service) + delta vs current published baseline
    const permissionService = new GreenfieldModulePermissionService(this.db)
    let permissionProblem: string | null = null
    try { permissionService.review(manifest); permissionService.assertDimonBoundary(manifest) } catch (error) { permissionProblem = (error as Error).message }
    const permissionDelta = await this.permissionDelta(job.module_id, verified.version, permissions)
    set('permissions', permissionProblem ? 'failed' : 'passed', permissionProblem ?? (permissionDelta.reviewRequired ? `review required: ${permissionDelta.reason}` : 'no material permission change'))

    // 10. dependencies (existing resolver)
    try {
      const plan = await new GreenfieldModuleDependencyResolver(this.db).resolve({moduleId: canonical, manifest})
      set('dependencies', plan.errors.length ? 'failed' : 'passed', plan.errors.join('; ') || undefined)
    } catch (error) { set('dependencies', 'failed', (error as Error).message) }

    const preImportFailed = [...checks.values()].filter(check => check.status === 'failed' && check.id !== 'signature' && check.id !== 'packaging')
    const record = (passed: boolean) => ({passed, checks: CHECK_ORDER.map(id => checks.get(id)!)})

    if (conflicted) {
      set('packaging', 'skipped')
      return this.finish(validating, ['validating'], 'conflicted', {validation: record(false), signature, permission_delta: permissionDelta, error: {code: 'VERSION_CONFLICT', message: checks.get('version_uniqueness')!.message ?? 'Version conflict'}}, 'error', 'validate', 'Version conflict: releases are immutable')
    }
    if (preImportFailed.length) {
      set('packaging', 'skipped', 'not imported: validation failed')
      return this.finish(validating, ['validating'], 'validation_failed', {validation: record(false), signature, permission_delta: permissionDelta,
        error: {code: 'VALIDATION_FAILED', message: preImportFailed.map(check => `${check.id}: ${check.message ?? 'failed'}`).join('; ').slice(0, 1000)}}, 'error', 'validate', `Validation failed: ${preImportFailed.map(check => check.id).join(', ')}`)
    }
    const onlineIdentity = this.deps.signingProvider ? await this.db.selectFrom('greenfield_publisher_online_signing_identities')
      .select(['identity_id']).where('publisher_id', '=', job.publisher_id).where('state', '=', 'ACTIVE')
      .where('valid_from', '<=', new Date()).where('valid_until', '>', new Date()).executeTakeFirst() : null
    if (signature.state === 'missing' && this.deps.signingProvider && onlineIdentity) {
      checks.set('signature', {id: 'signature', status: 'pending', message: 'Awaiting publisher-scoped online signing'})
      checks.set('packaging', {id: 'packaging', status: 'pending', message: 'Runs only after independent signature verification'})
      const approvedFacts = approvalFactsForVerified(verified)
      const approvalSha256 = approvalFactsSha256(approvedFacts)
      return this.finish(validating, ['validating'], 'ready_for_signing', {
        validation: record(false),
        signature: {state: 'pending', detail: 'Validated release is approved for publisher-scoped online signing'},
        permission_delta: permissionDelta,
        approved_facts: approvedFacts,
        approval_sha256: approvalSha256,
        approved_at: new Date(),
        error: null,
      }, 'info', 'approve', `Immutable release facts approved for online signing (${approvalSha256})`)
    }
    if (signature.state !== 'verified') {
      set('packaging', 'skipped', 'not imported: signature not verified')
      const to: PublisherReleaseJobState = signature.state === 'missing' ? 'signature_missing' : 'signature_invalid'
      const code = signature.state === 'missing' ? 'SIGNATURE_MISSING' : signature.state === 'revokedKey' ? 'SIGNATURE_REVOKED' : 'SIGNATURE_INVALID'
      return this.finish(validating, ['validating'], to, {validation: record(false), signature, permission_delta: permissionDelta, error: {code, message: signature.detail ?? code}}, 'error', 'signature', `Signature ${signature.state}: ${signature.detail}`)
    }

    const signed = await transitionJob(this.db, jobId, ['validating'], 'signature_verified', {signature, permission_delta: permissionDelta, validation: record(false)})
    if (!signed) return this.stopped(jobId, 'signature')
    await appendLog(this.db, jobId, 'info', 'signature', `Publisher signature independently verified (key ${signature.keyId})`)

    // Packaging: registry import (re-verifies the signature), verify, immutable blob store, MPS ingest. Never publishes.
    let release: GreenfieldModuleReleaseRecord
    try {
      const fresh = await loadJob(this.db, jobId)
      if (fresh?.state !== 'signature_verified') return this.stopped(jobId, 'packaging')
      release = (await this.sync.applyVerified(verified, existing ?? null)).release
      if (release.releaseState !== 'verified') throw new ModuleDomainError('VALIDATION_FAILED', `registry release is ${release.releaseState}, expected verified`)
      const sigRows = await this.db.selectFrom('greenfield_module_release_signatures').select(['verification_state']).where('release_id', '=', release.releaseId).execute()
      if (!sigRows.length || sigRows.some(row => row.verification_state !== 'verified')) throw new ModuleDomainError('VALIDATION_FAILED', 'registry did not record a verified signature for this release')
      set('packaging', 'passed', `imported ${release.releaseId}; package blob stored; MPS ingested`)
    } catch (error) {
      if (!(error instanceof ModuleDomainError)) throw error
      set('packaging', 'failed', error.message.slice(0, 500), 'VALIDATION_FAILED')
      return this.finish(signed, ['signature_verified'], 'validation_failed', {validation: record(false), error: {code: 'VALIDATION_FAILED', message: error.message.slice(0, 1000)}}, 'error', 'packaging', `Packaging failed: ${error.message}`)
    }
    return this.finish(signed, ['signature_verified'], 'ready_for_review', {validation: record(true), release_id: release.releaseId, error: null}, 'info', 'review',
      `All checks passed; ready for publication review${permissionDelta.reviewRequired ? ' (permission change acknowledgement required)' : ''}`)
  }

  // ---- online sign -------------------------------------------------------

  async sign(jobId: string): Promise<PublisherReleaseJobState | null> {
    const provider = this.deps.signingProvider
    const existingJob = await loadJob(this.db, jobId)
    if (!existingJob) return null
    if (!provider) {
      return this.finish(existingJob, ['signing'], 'signing_failed', {error: {code: 'SIGNING_NOT_CONFIGURED', message: 'Online signing provider is not configured'}},
        'error', 'sign', 'Signing failed closed: online signing provider is not configured')
    }
    const claimed = await this.db.updateTable('greenfield_publisher_release_jobs')
      .set({signing_started_at: new Date(), updated_at: new Date()} as never)
      .where('job_id', '=', jobId).where('state', '=', 'signing').where('signing_started_at', 'is', null)
      .returningAll().executeTakeFirst() as ReleaseJobRow | undefined
    if (!claimed) {
      const job = await loadJob(this.db, jobId)
      if (job) await appendLog(this.db, jobId, 'warn', 'sign', `Signing work skipped: job is ${job.state}`)
      return (job?.state ?? null) as PublisherReleaseJobState | null
    }
    const job = claimed
    const approvalSha256 = job.approval_sha256
    const actorAccountId = job.sign_requested_by_account_id
    if (!approvalSha256 || !job.approved_facts || !actorAccountId) {
      return this.finish(job, ['signing'], 'signing_failed', {error: {code: 'INVALID_JOB_STATE', message: 'Signing approval facts are incomplete'}},
        'error', 'sign', 'Signing failed closed: approval facts are incomplete')
    }

    const failClosed = async (code: string, message: string, identityId: string | null = null) => {
      await appendSigningAudit(this.db, {eventType: 'signing_failed', jobId, identityId, publisherId: job.publisher_id, moduleId: job.module_id,
        actorAccountId, approvalSha256, details: {code, message: message.slice(0, 500)}})
      return this.finish(job, ['signing'], 'signing_failed', {error: {code, message: message.slice(0, 1000)}}, 'error', 'sign', `Signing failed closed: ${message}`)
    }

    if (approvalFactsSha256(job.approved_facts as PublisherReleaseApprovalFacts) !== approvalSha256) {
      return failClosed('RELEASE_APPROVAL_INVALIDATED', 'Stored release approval facts do not match their immutable digest')
    }

    try {
      const authorization = await new PublisherOnlineSigningAuthority(this.db, this.deps.config as AppConfig).requireAuthorization({
        accountId: actorAccountId,
        publisherId: job.publisher_id,
        moduleId: job.module_id,
        sourceRepository: job.source_repository,
      })
      await appendSigningAudit(this.db, {eventType: 'signing_started', jobId, publisherId: job.publisher_id, moduleId: job.module_id,
        actorAccountId, approvalSha256, details: {requestId: job.signing_request_id}})

      // Fetch again at execution time. A mutable tag, artifact, manifest or
      // frontend produces a different approval digest and invalidates consent.
      const verified = await this.sync.fetchVerified({repository: job.source_repository, releaseTag: job.release_tag})
      const freshFacts = approvalFactsForVerified(verified)
      const freshApprovalSha256 = approvalFactsSha256(freshFacts)
      if (freshApprovalSha256 !== approvalSha256) {
        await appendSigningAudit(this.db, {eventType: 'release_invalidated', jobId, publisherId: job.publisher_id, moduleId: job.module_id,
          actorAccountId, approvalSha256, details: {observedApprovalSha256: freshApprovalSha256}})
        return this.finish(job, ['signing'], 'validation_failed', {
          approved_facts: null, approval_sha256: null, approved_at: null, signing_started_at: null,
          error: {code: 'RELEASE_APPROVAL_INVALIDATED', message: 'Release contents changed after signing approval; revalidation is required'},
        }, 'error', 'sign', 'Release contents changed after approval; signing authorization invalidated')
      }

      const identity = await provider.resolveAuthorizedIdentity({
        publisherId: job.publisher_id,
        firstParty: authorization.firstParty,
        identities: authorization.identities,
        observedAt: new Date(),
      })
      const [providerPublicKey, registeredKey] = await Promise.all([
        provider.getPublicKey(identity),
        new GreenfieldPublisherSigningKeyService(this.db).get(identity.signingKeyId),
      ])
      if (registeredKey.publisherId !== job.publisher_id || registeredKey.state !== 'ACTIVE'
        || registeredKey.fingerprint !== providerPublicKey.fingerprint || registeredKey.publicKeyPem !== providerPublicKey.publicKeyPem) {
        return failClosed('SIGNING_IDENTITY_UNAVAILABLE', 'Provider public key does not match the active publisher key registration', identity.identityId)
      }

      const statement = {...freshFacts, signingKeyId: identity.signingKeyId}
      const canonical = statementBytes(statement)
      const signed = await provider.signPublisherRelease(identity, canonical)
      await appendSigningAudit(this.db, {eventType: 'signature_created', jobId, identityId: identity.identityId, publisherId: job.publisher_id,
        moduleId: job.module_id, actorAccountId, approvalSha256, details: {provider: provider.kind, providerKeyVersion: signed.providerKeyVersion}})
      if (signed.algorithm !== 'Ed25519' || !await provider.verifyPublisherRelease(identity, canonical, signed.signature)) {
        return failClosed('SIGNING_FAILED', 'Signing provider result failed independent Ed25519 verification', identity.identityId)
      }
      const signatureInput = {algorithm: 'Ed25519' as const, keyId: identity.signingKeyId, value: signed.signature}
      const registryVerification = await new GreenfieldPublisherSigningKeyService(this.db).verify(statement, signatureInput, new Date(), true)
      if (registryVerification.state !== 'verified') {
        return failClosed(registryVerification.state === 'revokedKey' ? 'SIGNATURE_REVOKED' : 'SIGNING_FAILED', registryVerification.detail, identity.identityId)
      }

      const signedVerified: VerifiedGithubRelease = {...verified, evidence: {...verified.evidence, signature: signatureInput}}
      const existing = await this.releases.getRelease(verified.productId, verified.version)
      const release = (await this.sync.applyVerified(signedVerified, existing ?? null)).release
      if (release.releaseState !== 'verified') return failClosed('SIGNING_FAILED', `Registry release is ${release.releaseState}, expected verified`, identity.identityId)
      const signatureRows = await this.db.selectFrom('greenfield_module_release_signatures').select(['verification_state'])
        .where('release_id', '=', release.releaseId).execute()
      if (!signatureRows.length || signatureRows.some(row => row.verification_state !== 'verified')) {
        return failClosed('SIGNING_FAILED', 'Registry did not retain independently verified signature evidence', identity.identityId)
      }

      const verifiedAt = new Date()
      const receipt = {
        receiptId: `psrc_${randomUUID()}`,
        provider: provider.kind,
        identityId: identity.identityId,
        keyId: identity.signingKeyId,
        publicKeyFingerprint: providerPublicKey.fingerprint,
        providerKeyVersion: signed.providerKeyVersion,
        approvalSha256,
        statementSha256: registryVerification.statementSha256,
        verifiedAt: verifiedAt.toISOString(),
      }
      const validation = job.validation as {passed?: boolean; checks?: PublisherReleaseJobCheck[]}
      const checks = (validation.checks ?? []).map(check => check.id === 'signature'
        ? {...check, status: 'passed' as const, code: undefined, message: `Ed25519 key ${identity.signingKeyId}`}
        : check.id === 'packaging' ? {...check, status: 'passed' as const, message: `imported ${release.releaseId}; package blob stored; MPS ingested`} : check)
      const transitioned = await transitionJob(this.db, jobId, ['signing'], 'ready_for_review', {
        signing_identity_id: identity.identityId,
        signed_at: verifiedAt,
        signing_receipt: receipt,
        signature: {
          state: 'verified', keyId: identity.signingKeyId, algorithm: 'Ed25519', publicKeyFingerprint: providerPublicKey.fingerprint,
          statementSha256: registryVerification.statementSha256, verifiedAt: verifiedAt.toISOString(), detail: registryVerification.detail,
        },
        validation: {passed: true, checks},
        release_id: release.releaseId,
        error: null,
      })
      if (!transitioned) return this.stopped(jobId, 'sign')
      await appendSigningAudit(this.db, {eventType: 'signature_verified', jobId, identityId: identity.identityId, publisherId: job.publisher_id,
        moduleId: job.module_id, actorAccountId, approvalSha256, statementSha256: registryVerification.statementSha256, receipt})
      await appendLog(this.db, jobId, 'info', 'sign', `Online signature independently verified with publisher key ${identity.signingKeyId}; ready for publication review`)
      return 'ready_for_review'
    } catch (error) {
      if (error instanceof SigningProviderError && error.code === 'PROVIDER_FAILURE') {
        await this.db.updateTable('greenfield_publisher_release_jobs').set({signing_started_at: null, updated_at: new Date()} as never)
          .where('job_id', '=', jobId).where('state', '=', 'signing').execute()
        await appendSigningAudit(this.db, {eventType: 'signing_failed', jobId, publisherId: job.publisher_id, moduleId: job.module_id,
          actorAccountId, approvalSha256, details: {code: error.code, retryable: true}})
        throw error
      }
      if (error instanceof SigningProviderError) return failClosed('SIGNING_IDENTITY_UNAVAILABLE', error.message)
      if (error instanceof PublisherConsoleError) return failClosed(error.code, error.message)
      if (error instanceof ModuleDomainError) return failClosed('RELEASE_APPROVAL_INVALIDATED', error.message)
      throw error
    }
  }

  // ---- publish -----------------------------------------------------------

  async publish(jobId: string): Promise<PublisherReleaseJobState | null> {
    // Claim publication atomically; a cancel that won the race leaves nothing to claim.
    const claimed = await this.db.updateTable('greenfield_publisher_release_jobs')
      .set({publish_started_at: new Date(), updated_at: new Date()} as never)
      .where('job_id', '=', jobId).where('state', '=', 'publishing').where('publish_started_at', 'is', null)
      .returningAll().executeTakeFirst() as ReleaseJobRow | undefined
    if (!claimed) {
      const job = await loadJob(this.db, jobId)
      if (job) await appendLog(this.db, jobId, 'warn', 'publish', `Publish work skipped: job is ${job.state}`)
      return (job?.state ?? null) as PublisherReleaseJobState | null
    }
    const job = claimed
    const fail = (to: PublisherReleaseJobState, code: string, message: string) =>
      this.finish(job, ['publishing'], to, {error: {code, message}}, 'error', 'publish', `Publication refused: ${message}`)

    try {
      // Ownership re-checked against the account that requested publication.
      try { await new DeveloperService(this.db, this.deps.config as AppConfig).requirePublisherAccess(job.publish_requested_by_account_id ?? '', job.publisher_id) }
      catch { return fail('failed', 'FORBIDDEN_NOT_PUBLISHER', 'requesting account no longer has publisher access') }
      if (job.signing_receipt) {
        try {
          const authorization = await new PublisherOnlineSigningAuthority(this.db, this.deps.config as AppConfig).requireAuthorization({
            accountId: job.publish_requested_by_account_id ?? '', publisherId: job.publisher_id, moduleId: job.module_id, sourceRepository: job.source_repository,
          })
          if (!job.signing_identity_id || !authorization.identities.some(identity => identity.identityId === job.signing_identity_id)) {
            return fail('signature_invalid', 'SIGNATURE_REVOKED', 'online signing identity is no longer active for this publisher')
          }
        } catch {
          return fail('failed', 'SIGNING_AUTHORIZATION_REQUIRED', 'requesting builder no longer has online publication authority')
        }
      }
      if ((job.validation as {passed?: boolean})?.passed !== true) return fail('validation_failed', 'VALIDATION_FAILED', 'validation did not pass')
      if ((job.signature as {state?: string})?.state !== 'verified') return fail('signature_missing', 'SIGNATURE_MISSING', 'no verified publisher signature')
      if (!job.release_id || !job.version || !job.artifact_sha256 || !job.source_commit) return fail('failed', 'INVALID_JOB_STATE', 'job is missing verified release facts')
      const release = await this.releases.getReleaseById(job.release_id)
      if (!release) return fail('failed', 'INVALID_JOB_STATE', 'registry release not found')
      if (['published', 'superseded'].includes(release.releaseState)) return fail('conflicted', 'VERSION_CONFLICT', `${job.module_id}@${job.version} is already ${release.releaseState}`)
      if (release.releaseState !== 'verified') return fail('failed', 'VALIDATION_FAILED', `registry release is ${release.releaseState}`)
      if (release.moduleId !== job.module_id || release.version !== job.version || release.publisherId !== job.publisher_id
        || release.releaseSha256 !== job.artifact_sha256 || release.sourceCommit !== job.source_commit
        || release.sourceRepository.toLowerCase() !== job.source_repository.toLowerCase() || release.manifest.source.releaseTag !== job.release_tag) {
        return fail('failed', 'VALIDATION_FAILED', 'registry release facts no longer match the validated job')
      }
      const publisher = await this.db.selectFrom('greenfield_publishers').select(['status']).where('publisher_id', '=', job.publisher_id).executeTakeFirst()
      if (!publisher || ['suspended', 'revoked'].includes(publisher.status)) return fail('failed', 'FORBIDDEN_NOT_PUBLISHER', 'publisher is not in good standing')
      const namespace = await this.db.selectFrom('greenfield_publisher_namespaces').select(['publisher_id', 'revoked_at']).where('namespace', '=', getNamespacePrefix(job.module_id)).executeTakeFirst()
      if (!namespace || namespace.revoked_at || namespace.publisher_id !== job.publisher_id) return fail('failed', 'FORBIDDEN_NOT_PUBLISHER', 'namespace no longer held by publisher')

      // Independent re-verification over registry facts (rebuilds the statement; quarantines on failure).
      const rows = await this.db.selectFrom('greenfield_module_release_signatures').select(['signature_id']).where('release_id', '=', release.releaseId).execute()
      if (!rows.length) return fail('signature_missing', 'SIGNATURE_MISSING', 'registry release has no publisher signature')
      try {
        const results = await this.releases.verifyReleaseSignatures(release)
        if (!results.length || results.some(result => result.state !== 'verified')) return fail('signature_invalid', 'SIGNATURE_INVALID', 'signature re-verification failed')
      } catch (error) {
        const revoked = /revokedKey/.test((error as Error).message)
        return this.finish(job, ['publishing'], 'signature_invalid', {
          signature: {...(job.signature as object), state: revoked ? 'revokedKey' : 'invalid', detail: (error as Error).message.slice(0, 500)},
          error: {code: revoked ? 'SIGNATURE_REVOKED' : 'SIGNATURE_INVALID', message: (error as Error).message.slice(0, 1000)},
        }, 'error', 'publish', `Publication refused: ${(error as Error).message}`)
      }

      // Permission change visibility re-evaluated against the baseline at publish time.
      const delta = await this.permissionDelta(job.module_id, job.version, release.manifest.permissions.map(toPermission))
      if (delta.reviewRequired && !job.permission_change_acknowledged) {
        return this.finish(job, ['publishing'], 'ready_for_review', {permission_delta: delta, publish_started_at: null, publish_requested_by_account_id: null,
          error: {code: 'PERMISSION_EXPANSION_UNACKNOWLEDGED', message: 'Permission change requires acknowledgement'}}, 'warn', 'publish', 'Publication paused: permission change requires acknowledgement')
      }
      const compat = new GreenfieldModuleCompatibilityService(this.deps.config).evaluate({...release, releaseState: 'published'}, {platform: (release.manifest.compatibility.platforms[0] ?? 'server') as 'server', publisherStatus: publisher.status})
      const blocking = compat.reasons.filter(reason => !['PLATFORM_UNSUPPORTED', 'HOST_VERSION_TOO_NEW'].includes(reason))
      if (blocking.length) return fail('validation_failed', 'VALIDATION_FAILED', `compatibility/policy: ${blocking.join(', ')}`)

      await appendLog(this.db, jobId, 'info', 'publish', `Publishing ${job.module_id}@${job.version} via registry publishRelease`)
      if (job.signing_receipt) await appendSigningAudit(this.db, {eventType: 'publication_authorized', jobId, identityId: job.signing_identity_id,
        publisherId: job.publisher_id, moduleId: job.module_id, actorAccountId: job.publish_requested_by_account_id,
        approvalSha256: job.approval_sha256, statementSha256: (job.signature as {statementSha256?: string})?.statementSha256 ?? null})
      const published = await this.publishFn(job.module_id, job.version)
      if (published.releaseState !== 'published') return fail('failed', 'INTERNAL_ERROR', `registry reported ${published.releaseState}`)
      return this.finish(job, ['publishing'], 'published', {published_at: published.publishedAt ?? new Date(), error: null}, 'info', 'publish', `Published ${job.module_id}@${job.version}`)
    } catch (error) {
      if (error instanceof ModuleDomainError) return fail('failed', error.code === 'CONFLICT' ? 'VERSION_CONFLICT' : 'VALIDATION_FAILED', error.message.slice(0, 1000))
      throw error
    }
  }

  /** Called by the runner when transient retries are exhausted. */
  async markExhausted(jobId: string, message: string) {
    const job = await loadJob(this.db, jobId)
    if (!job || !['fetching', 'validating', 'signing', 'signature_verified', 'publishing'].includes(job.state)) return
    const state = job.state === 'signing' ? 'signing_failed' : 'failed'
    await this.finish(job, [job.state], state, {error: {code: job.state === 'signing' ? 'SIGNING_FAILED' : 'INTERNAL_ERROR', message: message.slice(0, 500)}}, 'error', 'runner', `Runner gave up after retries: ${message}`)
  }

  // ---- helpers -----------------------------------------------------------

  private async verifySignature(verified: VerifiedGithubRelease): Promise<PublisherReleaseJobSignature> {
    let input
    try {
      const fromEvidence = normalizeSignatureInput(verified.evidence.signature)
      const keyId = verified.manifest.integrity.signatureKeyId
      const value = verified.manifest.integrity.signature
      const fromManifest = keyId && value ? normalizeSignatureInput({algorithm: 'Ed25519', keyId, value}) : null
      if (fromEvidence && fromManifest && (fromEvidence.keyId !== fromManifest.keyId || fromEvidence.value !== fromManifest.value)) {
        return {state: 'invalid', detail: 'Manifest integrity signature conflicts with the provenance signature'}
      }
      input = fromEvidence ?? fromManifest
    } catch (error) {
      return {state: 'invalid', detail: (error as Error).message}
    }
    if (!input) return {state: 'missing', detail: 'Release carries no publisher signature'}
    const statement = buildPublisherReleaseStatement({
      manifest: verified.manifest,
      sourceSha: verified.releaseCommit,
      artifactSha256: verified.packageSha256,
      productManifestSha256: verified.evidence.productManifestSha256 ?? null,
      frontendSha256: verified.evidence.frontendSha256 ?? null,
      signingKeyId: input.keyId,
    })
    const result = await new GreenfieldPublisherSigningKeyService(this.db).verify(statement, input, new Date())
    return {
      state: result.state,
      keyId: result.keyId,
      algorithm: 'Ed25519',
      publicKeyFingerprint: result.publicKeyFingerprint,
      statementSha256: result.statementSha256,
      ...(result.state === 'verified' ? {verifiedAt: new Date().toISOString()} : {}),
      detail: result.detail,
    }
  }

  private async permissionDelta(moduleId: string, version: string, next: PublisherReleaseJobPermission[]): Promise<PublisherReleaseJobPermissionDelta> {
    const baseline = await this.db.selectFrom('greenfield_module_releases as r')
      .innerJoin('greenfield_module_versions as v', 'v.module_version_id', 'r.module_version_id')
      .select(['r.version', 'v.manifest']).where('r.module_id', 'in', [...moduleIdFamily(moduleId)])
      .where('r.release_state', '=', 'published').where('r.version', '!=', version).orderBy('r.published_at', 'desc').executeTakeFirst()
    const highRisk = (permission: PublisherReleaseJobPermission) => ['high', 'restricted'].includes(permission.risk)
    if (!baseline) {
      const visible = next.filter(highRisk)
      return {baselineVersion: null, added: next, removed: [], unchanged: [], reviewRequired: visible.length > 0,
        reason: visible.length ? `first release requests ${visible.map(item => item.permission).join(', ')}` : null}
    }
    const previous = ((baseline.manifest as GreenfieldModuleManifest).permissions ?? []).map(toPermission)
    const before = new Map(previous.map(item => [item.permission, item]))
    const after = new Map(next.map(item => [item.permission, item]))
    const added = next.filter(item => !before.has(item.permission))
    const removed = previous.filter(item => !after.has(item.permission))
    const unchanged = next.filter(item => before.has(item.permission))
    const rank = (risk: string) => ['low', 'medium', 'high', 'restricted'].indexOf(risk)
    const escalated = unchanged.filter(item => rank(item.risk) > rank(before.get(item.permission)!.risk))
    const reviewRequired = added.length > 0 || escalated.length > 0
    return {baselineVersion: baseline.version, added, removed, unchanged, reviewRequired,
      reason: reviewRequired ? [added.length ? `adds ${added.map(item => item.permission).join(', ')}` : '', escalated.length ? `raises risk of ${escalated.map(item => item.permission).join(', ')}` : ''].filter(Boolean).join('; ') : null}
  }

  private async finish(job: ReleaseJobRow, from: string[], to: PublisherReleaseJobState, patch: Record<string, unknown>, level: 'info' | 'warn' | 'error', step: string, message: string): Promise<PublisherReleaseJobState | null> {
    const row = await transitionJob(this.db, job.job_id, from, to, patch as never)
    if (!row) return this.stopped(job.job_id, step)
    await appendLog(this.db, job.job_id, level, step, message)
    return to
  }

  private async stopped(jobId: string, step: string): Promise<PublisherReleaseJobState | null> {
    const job = await loadJob(this.db, jobId)
    await appendLog(this.db, jobId, 'warn', step, `Work stopped: job moved to ${job?.state ?? 'unknown'} concurrently`)
    return (job?.state ?? null) as PublisherReleaseJobState | null
  }
}

function toPermission(permission: {permission: string; reason?: string; risk?: string}): PublisherReleaseJobPermission {
  return {permission: permission.permission, reason: permission.reason ?? null, risk: permission.risk ?? classifyPermissionRisk(permission.permission)}
}

function approvalFactsForVerified(verified: VerifiedGithubRelease) {
  return buildPublisherReleaseApprovalFacts({
    manifest: verified.manifest,
    sourceSha: verified.releaseCommit,
    artifactSha256: verified.packageSha256,
    productManifestSha256: verified.evidence.productManifestSha256 ?? null,
    frontendSha256: verified.evidence.frontendSha256 ?? null,
  })
}
