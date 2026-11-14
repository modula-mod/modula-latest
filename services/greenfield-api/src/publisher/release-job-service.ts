import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import {resolveCanonicalModuleId, moduleIdFamily} from '@modula/greenfield-contracts'
import type {
  CreatePublisherReleaseJobRequest,
  PublishPublisherReleaseJobRequest,
  RequestPublisherReleaseSigningRequest,
  PublisherOnlineSigningIdentityPublicView,
  PublisherReleaseSigningStatus,
  PublisherGithubSourceRelease,
  PublisherModuleDetail,
  PublisherModuleSummary,
  PublisherModuleVersion,
  PublisherReleaseJob,
  PublisherReleaseJobLogPage,
  PublisherReleaseJobState,
  PublisherSigningKeyPublicView,
} from '@modula/greenfield-module-registry-contracts'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {DeveloperService} from '../developers/service.js'
import {normalizeRepository, normalizeTag, type GithubReleaseSource} from '../modules/github-release-sync-service.js'
import {GreenfieldPublisherSigningKeyService} from '../modules/release-signing.js'
import {
  IN_FLIGHT_STATES,
  PublisherConsoleError,
  RELEASE_JOB_PUBLISH,
  RELEASE_JOB_SIGN,
  RELEASE_JOB_VALIDATE,
  appendLog,
  appendSigningAudit,
  consoleError,
  enqueueReleaseJobWork,
  isUniqueViolation,
  loadJob,
  loadLogs,
  toJobDto,
  transitionJob,
  type ReleaseJobRow,
} from './release-job-core.js'
import {PublisherOnlineSigningAuthority} from './signing-authority.js'

type OwnedModule = {moduleId: string; publisherId: string; repositories: string[]; name: string | null; description: string | null}

const VALIDATE_FROM: PublisherReleaseJobState[] = ['created', 'signature_missing', 'signature_invalid', 'signing_failed', 'validation_failed', 'failed']
const RESUME_TO_FETCHING: PublisherReleaseJobState[] = ['created', 'fetching', 'validating', 'signature_verified']
const RESUME_TO_SIGNING: PublisherReleaseJobState[] = ['ready_for_signing', 'signing']
const RESUME_TO_REVIEW: PublisherReleaseJobState[] = ['ready_for_review', 'publishing']

/**
 * HTTP-facing publisher release console. Every method authenticates the
 * caller's publisher authority for the specific module via
 * DeveloperService.requirePublisherAccess. It never downloads packages, never
 * calls fetchVerified and never publishes: it persists job state and enqueues
 * runner work.
 */
export class PublisherReleaseConsoleService {
  private readonly developers: DeveloperService
  private readonly signingAuthority: PublisherOnlineSigningAuthority
  constructor(private readonly db: ModulaDb, config: AppConfig, private readonly github: GithubReleaseSource, private readonly options: {githubEnabled: boolean; onlineSigningEnabled?: boolean}) {
    this.developers = new DeveloperService(db, config)
    this.signingAuthority = new PublisherOnlineSigningAuthority(db, config)
  }

  // ---- authority -------------------------------------------------------

  async requireOwnedModule(accountId: string, rawModuleId: string): Promise<OwnedModule> {
    const moduleId = resolveCanonicalModuleId(String(rawModuleId ?? '').trim().toLowerCase())
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(moduleId) || moduleId.length > 160) consoleError('MODULE_NOT_FOUND', 'Module not found')
    const family = [...moduleIdFamily(moduleId)]
    const [releases, product] = await Promise.all([
      this.db.selectFrom('greenfield_module_releases as r')
        .innerJoin('greenfield_module_versions as v', 'v.module_version_id', 'r.module_version_id')
        .select(['r.publisher_id', 'r.source_repository', 'r.created_at', 'v.manifest'])
        .where('r.module_id', 'in', family).orderBy('r.created_at', 'desc').execute(),
      this.db.selectFrom('greenfield_developer_products').selectAll().where('product_id', '=', moduleId).executeTakeFirst(),
    ])
    const publisherIds = new Set(releases.map(row => row.publisher_id))
    if (product) publisherIds.add(product.publisher_id)
    if (publisherIds.size === 0) consoleError('MODULE_NOT_FOUND', 'Module not found')
    // A module whose releases or product disagree on publisher is never self-servable.
    if (publisherIds.size > 1) consoleError('FORBIDDEN_NOT_PUBLISHER', 'Module publisher ownership is ambiguous; contact registry operations')
    const publisherId = [...publisherIds][0]!
    await this.requirePublisher(accountId, publisherId)
    const repositories = new Set<string>()
    for (const row of releases) { const repo = toOwnerName(row.source_repository); if (repo) repositories.add(repo) }
    if (product) {
      const sources = await this.db.selectFrom('greenfield_developer_source_connections').select(['repository'])
        .where('product_id', '=', moduleId).where('provider', '=', 'github').where('state', '=', 'ACTIVE').execute()
      for (const source of sources) { const repo = toOwnerName(source.repository); if (repo) repositories.add(repo) }
    }
    const manifest = (releases[0]?.manifest ?? null) as {name?: string; description?: string} | null
    return {moduleId, publisherId, repositories: [...repositories], name: manifest?.name ?? product?.display_name ?? null, description: manifest?.description ?? product?.description ?? null}
  }

  private async requirePublisher(accountId: string, publisherId: string) {
    try {
      await this.developers.requirePublisherAccess(accountId, publisherId)
    } catch (error) {
      if ((error as {code?: string})?.code === 'FORBIDDEN') consoleError('FORBIDDEN_NOT_PUBLISHER', 'Publisher access denied for this module')
      throw error
    }
  }

  private async requireOwnedJob(accountId: string, jobId: string): Promise<ReleaseJobRow> {
    if (!/^prj_[0-9a-f-]{36}$/.test(String(jobId))) consoleError('JOB_NOT_FOUND', 'Release job not found')
    const job = await loadJob(this.db, jobId)
    if (!job) consoleError('JOB_NOT_FOUND', 'Release job not found')
    await this.requirePublisher(accountId, job.publisher_id)
    return job
  }

  private async accessiblePublisherIds(accountId: string): Promise<string[]> {
    const memberships = await this.db.selectFrom('greenfield_developer_organisation_memberships').select(['organisation_id'])
      .where('account_id', '=', accountId).where('state', '=', 'ACTIVE').where('role', 'in', ['OWNER', 'ADMIN', 'DEVELOPER', 'RELEASE_MANAGER']).execute()
    const orgIds = memberships.map(row => row.organisation_id)
    const owners = await this.db.selectFrom('greenfield_publisher_owners').select(['publisher_id'])
      .where(eb => orgIds.length ? eb.or([eb('account_id', '=', accountId), eb('organisation_id', 'in', orgIds)]) : eb('account_id', '=', accountId)).execute()
    const candidates = [...new Set(owners.map(row => row.publisher_id))]
    const allowed: string[] = []
    for (const publisherId of candidates) {
      try { await this.developers.requirePublisherAccess(accountId, publisherId); allowed.push(publisherId) } catch { /* not authorised */ }
    }
    return allowed
  }

  // ---- reads -----------------------------------------------------------

  async listModules(accountId: string): Promise<PublisherModuleSummary[]> {
    const publisherIds = await this.accessiblePublisherIds(accountId)
    if (!publisherIds.length) return []
    const [releaseModules, products] = await Promise.all([
      this.db.selectFrom('greenfield_module_releases').select(['module_id']).distinct().where('publisher_id', 'in', publisherIds).execute(),
      this.db.selectFrom('greenfield_developer_products').select(['product_id']).where('publisher_id', 'in', publisherIds).execute(),
    ])
    const ids = [...new Set([...releaseModules.map(row => resolveCanonicalModuleId(row.module_id)), ...products.map(row => row.product_id)])].sort()
    const result: PublisherModuleSummary[] = []
    for (const id of ids) {
      try { result.push(await this.summary(await this.requireOwnedModule(accountId, id))) } catch (error) {
        if (!(error instanceof PublisherConsoleError)) throw error
      }
    }
    return result
  }

  async moduleDetail(accountId: string, moduleId: string): Promise<PublisherModuleDetail> {
    const owned = await this.requireOwnedModule(accountId, moduleId)
    const [summary, versions, publisher, keys, jobs] = await Promise.all([
      this.summary(owned),
      this.versionsFor(owned),
      this.db.selectFrom('greenfield_publishers').selectAll().where('publisher_id', '=', owned.publisherId).executeTakeFirst(),
      new GreenfieldPublisherSigningKeyService(this.db).listForPublisher(owned.publisherId),
      this.jobsFor(owned, 10),
    ])
    return {
      ...summary,
      description: owned.description,
      publisher: {publisherId: owned.publisherId, displayName: publisher?.display_name ?? null, status: publisher?.status ?? null, trustLevel: publisher?.trust_level ?? null},
      versions,
      signingKeys: keys.keys.map((key): PublisherSigningKeyPublicView => ({
        keyId: key.keyId, algorithm: key.algorithm, publicKeyPem: key.publicKeyPem, fingerprint: key.fingerprint,
        state: key.state, validFrom: key.validFrom, validUntil: key.validUntil, revokedAt: key.revokedAt,
      })),
      recentJobs: jobs,
    }
  }

  async versions(accountId: string, moduleId: string): Promise<PublisherModuleVersion[]> {
    return this.versionsFor(await this.requireOwnedModule(accountId, moduleId))
  }

  async listJobs(accountId: string, moduleId: string, limit = 50): Promise<PublisherReleaseJob[]> {
    return this.jobsFor(await this.requireOwnedModule(accountId, moduleId), limit)
  }

  async githubReleases(accountId: string, moduleId: string): Promise<PublisherGithubSourceRelease[]> {
    const owned = await this.requireOwnedModule(accountId, moduleId)
    if (!this.options.githubEnabled) consoleError('GITHUB_UNAVAILABLE', 'GitHub release sync is disabled in this environment')
    if (!this.github.listReleases) consoleError('GITHUB_UNAVAILABLE', 'GitHub release listing is not available')
    const jobs = await this.db.selectFrom('greenfield_publisher_release_jobs').select(['job_id', 'release_tag', 'source_repository', 'state'])
      .where('module_id', '=', owned.moduleId).orderBy('created_at', 'desc').execute()
    const result: PublisherGithubSourceRelease[] = []
    for (const repository of owned.repositories) {
      let listing
      try {
        listing = await this.github.listReleases!(repository, 30)
      } catch (error) {
        consoleError('GITHUB_UNAVAILABLE', `GitHub release listing failed for ${repository}`, {repository, reason: (error as Error).message?.slice(0, 200)})
      }
      for (const release of listing) {
        const provenance = release.assets.some(asset => asset.name === `${release.tagName}.provenance.json`)
        const pkg = release.assets.find(asset => /\.tgz$/.test(asset.name)) ?? null
        const invalidReason = release.draft ? 'Draft releases cannot be ingested'
          : !provenance ? `Release is missing ${release.tagName}.provenance.json`
          : !pkg ? 'Release has no .tgz package asset' : null
        const job = jobs.find(row => row.release_tag === release.tagName && row.source_repository.toLowerCase() === repository.toLowerCase())
        result.push({
          repository, releaseTag: release.tagName, name: release.name, draft: release.draft, prerelease: release.prerelease,
          publishedAt: release.publishedAt, hasProvenance: provenance, packageAssetName: pkg?.name ?? null,
          valid: invalidReason === null, invalidReason, existingJobId: job?.job_id ?? null,
        })
      }
    }
    return result
  }

  async getJob(accountId: string, jobId: string): Promise<PublisherReleaseJob> {
    return this.dto(await this.requireOwnedJob(accountId, jobId))
  }

  async signingIdentities(accountId: string, moduleId: string): Promise<PublisherOnlineSigningIdentityPublicView[]> {
    const owned = await this.requireOwnedModule(accountId, moduleId)
    if (!this.options.onlineSigningEnabled) consoleError('SIGNING_NOT_CONFIGURED', 'Online signing is not enabled in this environment')
    if (!owned.repositories.length) consoleError('SIGNING_AUTHORIZATION_REQUIRED', 'The module has no active verified source repository')
    return this.signingAuthority.listPermittedIdentities({
      accountId,
      publisherId: owned.publisherId,
      moduleId: owned.moduleId,
      sourceRepository: owned.repositories[0]!,
    })
  }

  async signingStatus(accountId: string, jobId: string): Promise<PublisherReleaseSigningStatus> {
    return this.signingAuthority.signingStatus(accountId, jobId)
  }

  async logs(accountId: string, jobId: string, query: {after?: unknown; limit?: unknown}): Promise<PublisherReleaseJobLogPage> {
    const job = await this.requireOwnedJob(accountId, jobId)
    const after = query.after !== undefined && /^\d+$/.test(String(query.after)) ? Number(query.after) : undefined
    const limit = query.limit !== undefined && /^\d+$/.test(String(query.limit)) ? Number(query.limit) : 200
    const entries = await loadLogs(this.db, job.job_id, {after, limit})
    return {jobId: job.job_id, entries, nextAfter: entries.length ? entries.at(-1)!.sequence : (after ?? null)}
  }

  // ---- mutations -------------------------------------------------------

  async createJob(accountId: string, moduleId: string, body: Partial<CreatePublisherReleaseJobRequest> | undefined, idempotencyKey: string | null): Promise<{job: PublisherReleaseJob; replayed: boolean}> {
    const owned = await this.requireOwnedModule(accountId, moduleId)
    let repository: string
    let releaseTag: string
    try {
      repository = normalizeRepository(body?.sourceRepository)
      releaseTag = normalizeTag(body?.releaseTag)
    } catch (error) {
      consoleError('INVALID_SOURCE_RELEASE', (error as Error).message)
    }
    if (!owned.repositories.some(repo => repo.toLowerCase() === repository.toLowerCase())) {
      consoleError('INVALID_SOURCE_RELEASE', 'sourceRepository is not a registered source repository for this module', {registeredRepositories: owned.repositories})
    }
    if (idempotencyKey !== null && (idempotencyKey.length < 1 || idempotencyKey.length > 180)) consoleError('INVALID_SOURCE_RELEASE', 'Idempotency-Key must be 1-180 characters')

    const replay = async (): Promise<{job: PublisherReleaseJob; replayed: boolean} | null> => {
      if (idempotencyKey) {
        const byKey = await this.db.selectFrom('greenfield_publisher_release_jobs').selectAll()
          .where('module_id', '=', owned.moduleId).where('idempotency_key', '=', idempotencyKey).executeTakeFirst()
        if (byKey) {
          if (byKey.release_tag !== releaseTag || byKey.source_repository.toLowerCase() !== repository.toLowerCase()) {
            consoleError('IDEMPOTENCY_KEY_CONFLICT', 'Idempotency-Key was already used for a different release', {existingJobId: byKey.job_id})
          }
          return {job: await this.dto(byKey as ReleaseJobRow), replayed: true}
        }
      }
      // Natural key: an in-flight or published job for this module + tag is returned rather than duplicated.
      const byTag = await this.db.selectFrom('greenfield_publisher_release_jobs').selectAll()
        .where('module_id', '=', owned.moduleId).where('release_tag', '=', releaseTag)
        .where('state', 'in', [...IN_FLIGHT_STATES, 'published']).orderBy('created_at', 'desc').executeTakeFirst()
      return byTag ? {job: await this.dto(byTag as ReleaseJobRow), replayed: true} : null
    }

    const existing = await replay()
    if (existing) return existing
    const jobId = `prj_${randomUUID()}`
    const now = new Date()
    try {
      await this.db.transaction().execute(async trx => {
        await trx.insertInto('greenfield_publisher_release_jobs').values({
          job_id: jobId, module_id: owned.moduleId, publisher_id: owned.publisherId, created_by_account_id: accountId,
          source_repository: repository, release_tag: releaseTag, source_commit: null, version: null, channel: null,
          artifact_sha256: null, release_id: null, state: 'created', cancelled_from_state: null, permission_delta: null,
          error: null, idempotency_key: idempotencyKey, publish_requested_by_account_id: null, publish_started_at: null,
          created_at: now, updated_at: now, published_at: null, cancelled_at: null,
        } as never).execute()
        await appendLog(trx, jobId, 'info', 'create', `Release job created for ${repository}@${releaseTag}`)
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await replay()
        if (raced) return raced
        consoleError('JOB_IN_FLIGHT', 'Another release job for this module and tag is in flight')
      }
      throw error
    }
    return {job: await this.dto((await loadJob(this.db, jobId))!), replayed: false}
  }

  async validate(accountId: string, jobId: string): Promise<PublisherReleaseJob> {
    const job = await this.requireOwnedJob(accountId, jobId)
    if (job.state === 'fetching' || job.state === 'validating') return this.dto(job)
    if (!VALIDATE_FROM.includes(job.state as PublisherReleaseJobState)) {
      consoleError('INVALID_JOB_STATE', `Validation cannot start from ${job.state}`, {state: job.state, jobId})
    }
    return this.startFetching(accountId, job, VALIDATE_FROM, 'Validation requested; queued for the release runner')
  }

  async requestSigning(accountId: string, jobId: string, body: Partial<RequestPublisherReleaseSigningRequest> | undefined, idempotencyKey: string | null): Promise<PublisherReleaseJob> {
    if (!this.options.onlineSigningEnabled) consoleError('SIGNING_NOT_CONFIGURED', 'Online signing is not enabled in this environment')
    const job = await this.requireOwnedJob(accountId, jobId)
    if (idempotencyKey !== null && (idempotencyKey.length < 1 || idempotencyKey.length > 180)) consoleError('INVALID_REQUEST', 'Idempotency-Key must be 1-180 characters')
    if (job.signing_request_id && ['signing', 'signature_verified', 'ready_for_review', 'publishing', 'published'].includes(job.state)) return this.dto(job)
    if (job.state === 'signing_failed') consoleError('SIGNING_FAILED', 'Signing failed closed; revalidate the release before requesting a new signature', {jobId, state: job.state})
    if (job.state !== 'ready_for_signing' || !job.approval_sha256 || !job.approved_at || !job.approved_facts) {
      consoleError('INVALID_JOB_STATE', `Signing cannot start from ${job.state}; validate an unsigned immutable release first`, {jobId, state: job.state})
    }
    const delta = job.permission_delta as {reviewRequired?: boolean} | null
    const acknowledged = body?.permissionChangeAcknowledged === true
    if (delta?.reviewRequired && !acknowledged) {
      consoleError('PERMISSION_EXPANSION_UNACKNOWLEDGED', 'Permission review must be acknowledged before signing', {jobId, permissionDelta: delta})
    }
    await this.signingAuthority.requireAuthorization({accountId, publisherId: job.publisher_id, moduleId: job.module_id, sourceRepository: job.source_repository})

    if (idempotencyKey) {
      const previous = await this.db.selectFrom('greenfield_publisher_release_jobs').selectAll()
        .where('sign_requested_by_account_id', '=', accountId).where('signing_idempotency_key', '=', idempotencyKey).executeTakeFirst()
      if (previous && previous.job_id !== jobId) consoleError('IDEMPOTENCY_KEY_CONFLICT', 'Signing Idempotency-Key was already used for another release job', {existingJobId: previous.job_id})
      if (previous) return this.dto(previous as ReleaseJobRow)
    }

    const updated = await this.db.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${'publisher-online-signing:' + accountId}))`.execute(trx)
      const fresh = await trx.selectFrom('greenfield_publisher_release_jobs').selectAll().where('job_id', '=', jobId).forUpdate().executeTakeFirst() as ReleaseJobRow | undefined
      if (!fresh) return undefined
      if (fresh.signing_request_id && ['signing', 'signature_verified', 'ready_for_review', 'publishing', 'published'].includes(fresh.state)) return fresh
      if (fresh.state !== 'ready_for_signing' || fresh.approval_sha256 !== job.approval_sha256) return undefined
      const recent = await trx.selectFrom('greenfield_publisher_signing_audit_events').select(({fn}) => fn.countAll().as('count'))
        .where('actor_account_id', '=', accountId).where('event_type', '=', 'signing_requested')
        .where('created_at', '>', new Date(Date.now() - 60 * 60_000)).executeTakeFirstOrThrow()
      if (Number(recent.count) >= 10) consoleError('SIGNING_RATE_LIMITED', 'Online signing request limit exceeded; retry later', {retryAfterSeconds: 3600})
      const requestId = `psr_${randomUUID()}`
      const row = await transitionJob(trx, jobId, ['ready_for_signing'], 'signing', {
        signing_request_id: requestId,
        signing_idempotency_key: idempotencyKey,
        sign_requested_by_account_id: accountId,
        signing_identity_id: null,
        signing_started_at: null,
        signed_at: null,
        signing_receipt: null,
        permission_change_acknowledged: acknowledged,
        error: null,
      }, fresh.revision)
      if (!row) return undefined
      await appendSigningAudit(trx, {eventType: 'signing_requested', jobId, publisherId: job.publisher_id, moduleId: job.module_id,
        actorAccountId: accountId, approvalSha256: job.approval_sha256, details: {requestId}})
      await appendLog(trx, jobId, 'info', 'sign', 'Online release signing approved and queued; the server will resolve the publisher identity')
      await enqueueReleaseJobWork(trx, {jobId, workType: RELEASE_JOB_SIGN, accountId, moduleId: job.module_id})
      return row
    })
    if (!updated) consoleError('INVALID_JOB_STATE', 'The signing request lost a concurrent state change; reload the job', {jobId})
    return this.dto(updated)
  }

  async publish(accountId: string, jobId: string, body: Partial<PublishPublisherReleaseJobRequest> | undefined): Promise<PublisherReleaseJob> {
    const job = await this.requireOwnedJob(accountId, jobId)
    if (job.state === 'publishing' || job.state === 'published') return this.dto(job)
    const signature = (job.signature ?? {}) as {state?: string}
    const validation = (job.validation ?? {}) as {passed?: boolean}
    if (job.state === 'signature_missing') consoleError('SIGNATURE_MISSING', 'A verified publisher signature is required before publication', {state: job.state, jobId})
    if (job.state === 'signature_invalid') {
      consoleError(signature.state === 'revokedKey' ? 'SIGNATURE_REVOKED' : 'SIGNATURE_INVALID', 'The publisher signature did not verify; this job cannot be published', {state: job.state, jobId})
    }
    if (job.state === 'validation_failed') consoleError('VALIDATION_FAILED', 'Validation failed; this job cannot be published', {state: job.state, jobId})
    if (job.state !== 'ready_for_review') consoleError('INVALID_JOB_STATE', `Publication cannot start from ${job.state}`, {state: job.state, jobId})
    if (signature.state !== 'verified') consoleError('SIGNATURE_MISSING', 'A verified publisher signature is required before publication', {jobId})
    if (validation.passed !== true) consoleError('VALIDATION_FAILED', 'All validation checks must pass before publication', {jobId})
    const delta = job.permission_delta as {reviewRequired?: boolean} | null
    const acknowledged = body?.permissionChangeAcknowledged === true || job.permission_change_acknowledged
    if (delta?.reviewRequired && !acknowledged) {
      consoleError('PERMISSION_EXPANSION_UNACKNOWLEDGED', 'This version changes requested permissions; resend with permissionChangeAcknowledged: true after review', {jobId, permissionDelta: delta})
    }
    const published = await this.db.selectFrom('greenfield_module_releases').select(['release_state'])
      .where('module_id', 'in', [...moduleIdFamily(job.module_id)]).where('version', '=', job.version ?? '')
      .where('release_state', 'in', ['published', 'superseded']).executeTakeFirst()
    if (published) {
      await transitionJob(this.db, job.job_id, ['ready_for_review'], 'conflicted', {error: {code: 'VERSION_CONFLICT', message: `${job.module_id}@${job.version} is already published`}})
      consoleError('VERSION_CONFLICT', `${job.module_id}@${job.version} is already published; versions are immutable`, {jobId})
    }
    const updated = await this.db.transaction().execute(async trx => {
      const row = await transitionJob(trx, job.job_id, ['ready_for_review'], 'publishing', {
        permission_change_acknowledged: acknowledged,
        publish_requested_by_account_id: accountId,
        publish_started_at: null,
        error: null,
      }, job.revision)
      if (!row) return null
      await appendLog(trx, job.job_id, 'info', 'publish', `Publication requested${acknowledged ? ' (permission change acknowledged)' : ''}; queued for the release runner`)
      await enqueueReleaseJobWork(trx, {jobId: job.job_id, workType: RELEASE_JOB_PUBLISH, accountId, moduleId: job.module_id})
      return row
    })
    if (!updated) consoleError('INVALID_JOB_STATE', 'The job changed concurrently; reload and retry', {jobId})
    return this.dto(updated)
  }

  async cancel(accountId: string, jobId: string): Promise<PublisherReleaseJob> {
    const job = await this.requireOwnedJob(accountId, jobId)
    if (job.state === 'cancelled') return this.dto(job)
    if (job.state === 'published' || job.state === 'conflicted') consoleError('CANCEL_NOT_ALLOWED', `A ${job.state} job cannot be cancelled`, {state: job.state, jobId})
    const from = job.state
    const row = await this.db.transaction().execute(async trx => {
      // A publishing job can only be cancelled before the runner has started publication.
      let query = trx.selectFrom('greenfield_publisher_release_jobs').select(['job_id']).where('job_id', '=', job.job_id).where('state', '=', from)
      if (from === 'publishing') query = query.where('publish_started_at', 'is', null)
      if (from === 'signing') query = query.where('signing_started_at', 'is', null)
      const lockable = await query.forUpdate().executeTakeFirst()
      if (!lockable) return null
      const updated = await transitionJob(trx, job.job_id, [from], 'cancelled', {cancelled_from_state: from})
      if (updated) await appendLog(trx, job.job_id, 'warn', 'cancel', `Cancelled from ${from}`)
      return updated
    })
    if (!row) consoleError('CANCEL_NOT_ALLOWED', 'The job can no longer be cancelled (signing/publication already started or state changed)', {jobId})
    return this.dto(row)
  }

  async resume(accountId: string, jobId: string): Promise<PublisherReleaseJob> {
    const job = await this.requireOwnedJob(accountId, jobId)
    if (job.state !== 'cancelled') consoleError('RESUME_NOT_ALLOWED', `Only cancelled jobs can be resumed (job is ${job.state})`, {state: job.state, jobId})
    if (job.published_at) consoleError('RESUME_NOT_ALLOWED', 'A published job cannot be resumed', {jobId})
    const from = job.cancelled_from_state as PublisherReleaseJobState | null
    if (!from || (!RESUME_TO_FETCHING.includes(from) && !RESUME_TO_SIGNING.includes(from) && !RESUME_TO_REVIEW.includes(from))) {
      consoleError('RESUME_NOT_ALLOWED', `A job cancelled from ${from ?? 'unknown'} cannot be resumed; start validation on a new job`, {jobId})
    }
    if (job.version) {
      const registry = await this.db.selectFrom('greenfield_module_releases').select(['release_id', 'release_state'])
        .where('module_id', 'in', [...moduleIdFamily(job.module_id)]).where('version', '=', job.version).executeTakeFirst()
      if (registry && ['published', 'superseded'].includes(registry.release_state)) {
        consoleError('VERSION_CONFLICT', `${job.module_id}@${job.version} is already published; versions are immutable`, {jobId})
      }
      if (registry && ['quarantined', 'revoked'].includes(registry.release_state)) {
        consoleError('RESUME_NOT_ALLOWED', `Registry release is ${registry.release_state}`, {jobId})
      }
      if (RESUME_TO_REVIEW.includes(from) && (!registry || registry.release_id !== job.release_id || registry.release_state !== 'verified')) {
        consoleError('RESUME_NOT_ALLOWED', 'The verified registry release behind this job is no longer available; create a new job', {jobId})
      }
    }
    if (RESUME_TO_FETCHING.includes(from)) {
      return this.startFetching(accountId, job, ['cancelled'], `Resumed from ${from}; validation re-runs from fetching`)
    }
    if (RESUME_TO_SIGNING.includes(from)) {
      const row = await transitionJob(this.db, job.job_id, ['cancelled'], 'ready_for_signing', {
        cancelled_from_state: null, signing_request_id: null, signing_idempotency_key: null, sign_requested_by_account_id: null,
        signing_identity_id: null, signing_started_at: null, signed_at: null, signing_receipt: null, error: null,
      }, job.revision)
      if (!row) consoleError('INVALID_JOB_STATE', 'The job changed concurrently; reload and retry', {jobId})
      await appendLog(this.db, job.job_id, 'info', 'resume', `Resumed from ${from}; signing must be requested again`)
      return this.dto(row)
    }
    // ready_for_review / publishing -> ready_for_review. Never auto-publishes; acknowledgement must be given again.
    let row: ReleaseJobRow | null | undefined
    try {
      row = await this.db.transaction().execute(async trx => {
        const updated = await transitionJob(trx, job.job_id, ['cancelled'], 'ready_for_review', {
          cancelled_from_state: null, permission_change_acknowledged: false, publish_requested_by_account_id: null, publish_started_at: null,
        }, job.revision)
        if (updated) await appendLog(trx, job.job_id, 'info', 'resume', `Resumed from ${from}; returned to ready_for_review (publication must be requested again)`)
        return updated
      })
    } catch (error) {
      if (isUniqueViolation(error)) consoleError('JOB_IN_FLIGHT', 'Another job for this module version or tag is in flight', {jobId})
      throw error
    }
    if (!row) consoleError('INVALID_JOB_STATE', 'The job changed concurrently; reload and retry', {jobId})
    return this.dto(row)
  }

  // ---- helpers ---------------------------------------------------------

  private async startFetching(accountId: string, job: ReleaseJobRow, from: readonly string[], message: string): Promise<PublisherReleaseJob> {
    let row: ReleaseJobRow | undefined
    try {
      row = await this.db.transaction().execute(async trx => {
        const updated = await transitionJob(trx, job.job_id, from, 'fetching', {
          cancelled_from_state: null, error: null, preview: {}, signature: {state: 'pending'}, validation: {passed: false, checks: []},
          permission_delta: null, permission_change_acknowledged: false, publish_requested_by_account_id: null, publish_started_at: null,
          approved_facts: null, approval_sha256: null, approved_at: null, signing_request_id: null, signing_idempotency_key: null,
          sign_requested_by_account_id: null, signing_identity_id: null, signing_started_at: null, signed_at: null, signing_receipt: null,
        }, job.revision)
        if (!updated) return undefined
        await appendLog(trx, job.job_id, 'info', 'validate', message)
        await enqueueReleaseJobWork(trx, {jobId: job.job_id, workType: RELEASE_JOB_VALIDATE, accountId, moduleId: job.module_id})
        return updated
      })
    } catch (error) {
      if (isUniqueViolation(error)) consoleError('JOB_IN_FLIGHT', 'Another job for this module version or tag is in flight', {jobId: job.job_id})
      throw error
    }
    if (!row) consoleError('INVALID_JOB_STATE', 'The job changed concurrently; reload and retry', {jobId: job.job_id})
    return this.dto(row)
  }

  private async dto(row: ReleaseJobRow): Promise<PublisherReleaseJob> {
    return toJobDto(row, await loadLogs(this.db, row.job_id, {limit: 20, tail: true}))
  }

  private async jobsFor(owned: OwnedModule, limit: number): Promise<PublisherReleaseJob[]> {
    const rows = await this.db.selectFrom('greenfield_publisher_release_jobs').selectAll().where('module_id', '=', owned.moduleId)
      .orderBy('created_at', 'desc').limit(Math.max(1, Math.min(200, limit))).execute()
    return Promise.all(rows.map(row => this.dto(row as ReleaseJobRow)))
  }

  private async summary(owned: OwnedModule): Promise<PublisherModuleSummary> {
    const [latestPublished, latest, active] = await Promise.all([
      this.db.selectFrom('greenfield_module_releases').select(['version', 'updated_at']).where('module_id', 'in', [...moduleIdFamily(owned.moduleId)])
        .where('release_state', '=', 'published').orderBy('published_at', 'desc').executeTakeFirst(),
      this.db.selectFrom('greenfield_module_releases').select(['version', 'updated_at']).where('module_id', 'in', [...moduleIdFamily(owned.moduleId)])
        .orderBy('created_at', 'desc').executeTakeFirst(),
      this.db.selectFrom('greenfield_publisher_release_jobs').select(({fn}) => fn.countAll().as('count')).where('module_id', '=', owned.moduleId)
        .where('state', 'in', [...IN_FLIGHT_STATES]).executeTakeFirstOrThrow(),
    ])
    return {
      moduleId: owned.moduleId, publisherId: owned.publisherId, name: owned.name,
      latestPublishedVersion: latestPublished?.version ?? null, latestVersion: latest?.version ?? null,
      sourceRepositories: owned.repositories, activeJobCount: Number(active.count),
      updatedAt: latest?.updated_at ? new Date(latest.updated_at).toISOString() : null,
    }
  }

  private async versionsFor(owned: OwnedModule): Promise<PublisherModuleVersion[]> {
    const family = [...moduleIdFamily(owned.moduleId)]
    const [releases, jobs] = await Promise.all([
      this.db.selectFrom('greenfield_module_releases as r')
        .leftJoin('greenfield_module_sources as s', 's.release_id', 'r.release_id')
        .select(['r.release_id', 'r.version', 'r.release_state', 'r.release_channel', 'r.source_commit', 'r.published_at', 's.release_tag'])
        .where('r.module_id', 'in', family).orderBy('r.created_at', 'desc').execute(),
      this.db.selectFrom('greenfield_publisher_release_jobs').selectAll().where('module_id', '=', owned.moduleId)
        .where('state', 'in', [...IN_FLIGHT_STATES]).where('version', 'is not', null).execute(),
    ])
    const signatures = releases.length ? await this.db.selectFrom('greenfield_module_release_signatures').select(['release_id', 'verification_state'])
      .where('release_id', 'in', releases.map(row => row.release_id)).execute() : []
    const versions: PublisherModuleVersion[] = releases.map(row => {
      const sig = signatures.filter(s => s.release_id === row.release_id)
      const job = jobs.find(j => j.release_id === row.release_id)
      return {
        version: row.version, origin: 'registry', releaseId: row.release_id, releaseState: row.release_state,
        jobId: job?.job_id ?? null, jobState: (job?.state ?? null) as PublisherReleaseJobState | null,
        channel: row.release_channel, releaseTag: row.release_tag ?? null, sourceCommit: row.source_commit,
        publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
        signatureState: sig.length === 0 ? 'unsigned' : (sig.every(s => s.verification_state === 'verified') ? 'verified'
          : (sig.find(s => s.verification_state && s.verification_state !== 'verified')?.verification_state ?? 'pending')) as PublisherModuleVersion['signatureState'],
      }
    })
    for (const job of jobs) {
      if (job.release_id && releases.some(row => row.release_id === job.release_id)) continue
      versions.push({
        version: job.version!, origin: 'job', releaseId: null, releaseState: null, jobId: job.job_id, jobState: job.state as PublisherReleaseJobState,
        channel: job.channel, releaseTag: job.release_tag, sourceCommit: job.source_commit, publishedAt: null,
        signatureState: ((job.signature as {state?: string})?.state === 'verified' ? 'verified' : 'pending'),
      })
    }
    return versions
  }
}

function toOwnerName(value: string): string | null {
  const text = String(value ?? '').trim()
  const fromUrl = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/.exec(text)
  const candidate = fromUrl ? fromUrl[1]! : text
  return /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(candidate) ? candidate : null
}
