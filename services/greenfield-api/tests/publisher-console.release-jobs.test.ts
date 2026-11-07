import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {DeveloperService} from '../src/developers/service.js'
import {GreenfieldPublisherSigningKeyService} from '../src/modules/release-signing.js'
import {PublisherReleaseJobProcessor} from '../src/publisher/release-job-processor.js'
import {PublisherReleaseJobRunner} from '../src/publisher/release-job-runner.js'
import {PublisherReleaseConsoleService} from '../src/publisher/release-job-service.js'
import {configureRegistryTestEnv, registerAccount} from './helpers/registry-fixtures.js'
import {
  BUILDER_TEST_COMMIT,
  BUILDER_TEST_MODULE_ID,
  BUILDER_TEST_NAMESPACE,
  BUILDER_TEST_PUBLISHER_ID,
  BUILDER_TEST_REPOSITORY,
  FixtureGithubSource,
  addFixtureRelease,
  newEd25519,
  recordingPublisher,
  type FixtureSigner,
} from './helpers/builder-release-fixture.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)

describeIfDb('BUILDER-01 publisher release console', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let owner: {accountId: string; token: string}
  let otherPublisher: {accountId: string; token: string}
  let founderAdmin: {accountId: string; token: string}
  let source: FixtureGithubSource
  let runner: PublisherReleaseJobRunner
  let publisher: ReturnType<typeof recordingPublisher>
  let signer: FixtureSigner
  let patch = 0
  let previousNamespace: {publisher_id: string; revoked_at: Date | null} | null = null
  const adminHandle = `bfounder${suffix}`.slice(0, 20)
  const nextPatch = () => ++patch

  const api = (token: string | null, method: 'GET' | 'POST', url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    app.inject({method, url, payload: payload as any, headers: {...(token ? {authorization: `Bearer ${token}`} : {}), ...headers}})

  const consoleCode = (response: {json: () => any}) => response.json().error?.details?.publisherConsoleCode

  async function createJob(tag: string, headers: Record<string, string> = {}) {
    const response = await api(owner.token, 'POST', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/release-jobs`, {sourceRepository: BUILDER_TEST_REPOSITORY, releaseTag: tag}, headers)
    expect([200, 202], response.body).toContain(response.statusCode)
    return response
  }

  async function drain() {
    let guard = 0
    while (await runner.runOnce()) if (++guard > 20) throw new Error('runner did not drain')
  }

  async function getJob(jobId: string, token = owner.token) {
    const response = await api(token, 'GET', `/v1/publisher/release-jobs/${jobId}`)
    expect(response.statusCode, response.body).toBe(200)
    return response.json().data
  }

  async function validatedJob(options: Parameters<typeof addFixtureRelease>[2] = {signer}) {
    const release = addFixtureRelease(source, nextPatch(), options)
    const created = await createJob(release.tag)
    const jobId = created.json().data.jobId
    const validate = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/validate`)
    expect(validate.statusCode, validate.body).toBe(202)
    await drain()
    return {jobId, release, job: await getJob(jobId)}
  }

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4063')
    process.env.MODULA_ADMIN_HANDLES = adminHandle
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    owner = await registerAccount(app, `bowner-${suffix}@example.com`, `bowner${suffix}`.slice(0, 20), db)
    otherPublisher = await registerAccount(app, `bother-${suffix}@example.com`, `bother${suffix}`.slice(0, 20), db)
    founderAdmin = await registerAccount(app, `bfounder-${suffix}@example.com`, adminHandle, db)

    // Isolated reserved fixture identities (idempotent across runs on one disposable DB).
    const now = new Date()
    await db.insertInto('greenfield_publishers').values({publisher_id: BUILDER_TEST_PUBLISHER_ID, display_name: 'Builder Test Publisher', website: null, status: 'verified', trust_level: 'verifiedPublisher', created_at: now, updated_at: now, verified_at: now, suspended_at: null, revoked_at: null})
      .onConflict(oc => oc.column('publisher_id').doNothing()).execute()
    await db.insertInto('greenfield_publisher_owners').values({publisher_owner_id: randomUUID(), publisher_id: BUILDER_TEST_PUBLISHER_ID, owner_type: 'ACCOUNT', account_id: owner.accountId, organisation_id: null, created_at: now}).execute()
    // `test.modula` is shared with other suites on the same disposable DB: borrow it for this suite and restore it in afterAll.
    previousNamespace = await db.selectFrom('greenfield_publisher_namespaces').selectAll().where('namespace', '=', BUILDER_TEST_NAMESPACE).executeTakeFirst() ?? null
    await db.insertInto('greenfield_publisher_namespaces').values({namespace: BUILDER_TEST_NAMESPACE, publisher_id: BUILDER_TEST_PUBLISHER_ID, verification_method: 'operatorReview', verification_evidence: {fixture: 'builder-01'}, verified_at: now, revoked_at: null, created_at: now})
      .onConflict(oc => oc.column('namespace').doUpdateSet({publisher_id: BUILDER_TEST_PUBLISHER_ID, revoked_at: null})).execute()
    await db.insertInto('greenfield_developer_products').values({product_id: BUILDER_TEST_MODULE_ID, publisher_id: BUILDER_TEST_PUBLISHER_ID, owner_account_id: owner.accountId, owner_organisation_id: null, extension_id: null, kind: 'module', display_name: 'Builder Release Fixture', description: 'BUILDER-01 isolated test fixture', visibility: 'PRIVATE', state: 'DRAFT', created_at: now, updated_at: now} as never)
      .onConflict(oc => oc.column('product_id').doNothing()).execute()
    await db.insertInto('greenfield_developer_source_connections').values({source_connection_id: randomUUID(), product_id: BUILDER_TEST_MODULE_ID, provider: 'github', repository: `https://github.com/${BUILDER_TEST_REPOSITORY}`, repository_id: null, default_branch: 'main', credential_ref: null, state: 'ACTIVE', created_by_account_id: owner.accountId, created_at: now, updated_at: now, revoked_at: null})
      .onConflict(oc => oc.columns(['product_id', 'provider', 'repository']).doNothing()).execute()
    // A second, unrelated publisher owned by another account.
    await new DeveloperService(db, loadConfig()).createPublisher(otherPublisher.accountId, {publisherId: `test.builder-b-${suffix}`, displayName: 'Other Publisher'})

    const keys = newEd25519()
    signer = {keyId: `builder-${suffix}-main`, privateKey: keys.privateKey}
    await new GreenfieldPublisherSigningKeyService(db).register(BUILDER_TEST_PUBLISHER_ID, {keyId: signer.keyId, publicKeyPem: keys.publicKeyPem}, null)

    source = new FixtureGithubSource()
    publisher = recordingPublisher(db)
    const processor = new PublisherReleaseJobProcessor(db, {source, config: loadConfig(), githubEnabled: true, publish: publisher})
    runner = new PublisherReleaseJobRunner(db, processor, {workerId: `test-runner-${suffix}`})
    // Drain any stale runner work from earlier runs of this suite.
    await db.updateTable('background_jobs').set({status: 'CANCELLED'} as never).where('dispatch_mode', '=', 'PUBLISHER_RELEASE_RUNNER' as never).where('status', 'in', ['QUEUED', 'RETRYING']).execute()
  })

  afterAll(async () => {
    if (db) {
      if (previousNamespace && previousNamespace.publisher_id !== BUILDER_TEST_PUBLISHER_ID) {
        await db.updateTable('greenfield_publisher_namespaces').set({publisher_id: previousNamespace.publisher_id, revoked_at: previousNamespace.revoked_at}).where('namespace', '=', BUILDER_TEST_NAMESPACE).execute()
      } else if (!previousNamespace || previousNamespace.publisher_id === BUILDER_TEST_PUBLISHER_ID) {
        await db.deleteFrom('greenfield_publisher_namespaces').where('namespace', '=', BUILDER_TEST_NAMESPACE).where('publisher_id', '=', BUILDER_TEST_PUBLISHER_ID).execute()
      }
    }
    await app?.close()
    await db?.destroy()
  })

  describe('authentication and publisher-specific ownership', () => {
    it('requires an authenticated session', async () => {
      const response = await api(null, 'GET', '/v1/publisher/modules')
      expect(response.statusCode).toBe(401)
      expect(consoleCode(response)).toBe('UNAUTHENTICATED')
    })

    it('lists only modules the caller can publish and shows public key halves only', async () => {
      const mine = await api(owner.token, 'GET', '/v1/publisher/modules')
      expect(mine.statusCode, mine.body).toBe(200)
      expect(mine.json().data.map((m: any) => m.moduleId)).toContain(BUILDER_TEST_MODULE_ID)
      const theirs = await api(otherPublisher.token, 'GET', '/v1/publisher/modules')
      expect(theirs.json().data.map((m: any) => m.moduleId)).not.toContain(BUILDER_TEST_MODULE_ID)
      const detail = await api(owner.token, 'GET', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}`)
      expect(detail.statusCode, detail.body).toBe(200)
      expect(detail.json().data.sourceRepositories).toContain(BUILDER_TEST_REPOSITORY)
      expect(detail.json().data.signingKeys.some((k: any) => k.keyId === signer.keyId)).toBe(true)
      expect(detail.body).not.toMatch(/PRIVATE KEY/)
    })

    it('publisher B cannot read, create, validate, publish, cancel or resume publisher A jobs', async () => {
      const {jobId} = await validatedJob()
      for (const [method, url] of [
        ['GET', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}`],
        ['GET', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/versions`],
        ['GET', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/release-jobs`],
        ['GET', `/v1/publisher/release-jobs/${jobId}`],
        ['GET', `/v1/publisher/release-jobs/${jobId}/logs`],
        ['POST', `/v1/publisher/release-jobs/${jobId}/validate`],
        ['POST', `/v1/publisher/release-jobs/${jobId}/publish`],
        ['POST', `/v1/publisher/release-jobs/${jobId}/cancel`],
        ['POST', `/v1/publisher/release-jobs/${jobId}/resume`],
      ] as const) {
        const response = await api(otherPublisher.token, method, url, method === 'POST' ? {} : undefined)
        expect(response.statusCode, `${method} ${url} ${response.body}`).toBe(403)
        expect(consoleCode(response)).toBe('FORBIDDEN_NOT_PUBLISHER')
      }
      const create = await api(otherPublisher.token, 'POST', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/release-jobs`, {sourceRepository: BUILDER_TEST_REPOSITORY, releaseTag: 'x-v1'})
      expect(create.statusCode).toBe(403)
      expect((await getJob(jobId)).state).toBe('ready_for_review')
    })

    it('a founder admin handle that is not a publisher owner/org role is rejected on this path', async () => {
      expect(loadConfig().adminHandles).toContain(adminHandle) // genuinely an admin-handle account
      const {jobId} = await validatedJob()
      const list = await api(founderAdmin.token, 'GET', '/v1/publisher/modules')
      expect(list.statusCode).toBe(200)
      expect(list.json().data).toEqual([])
      for (const [method, url] of [
        ['GET', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}`],
        ['POST', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/release-jobs`],
        ['GET', `/v1/publisher/release-jobs/${jobId}`],
        ['POST', `/v1/publisher/release-jobs/${jobId}/publish`],
      ] as const) {
        const body = url.endsWith('/publish') ? {permissionChangeAcknowledged: true} : {sourceRepository: BUILDER_TEST_REPOSITORY, releaseTag: 'x'}
        const response = await api(founderAdmin.token, method, url, method === 'POST' ? body : undefined)
        expect(response.statusCode, `${method} ${url} ${response.body}`).toBe(403)
        expect(consoleCode(response)).toBe('FORBIDDEN_NOT_PUBLISHER')
      }
      expect((await getJob(jobId)).state).toBe('ready_for_review')
    })

    it('unknown jobs and modules are 404', async () => {
      expect(consoleCode(await api(owner.token, 'GET', `/v1/publisher/release-jobs/prj_${randomUUID()}`))).toBe('JOB_NOT_FOUND')
      expect(consoleCode(await api(owner.token, 'GET', `/v1/publisher/modules/test.nowhere.${suffix}`))).toBe('MODULE_NOT_FOUND')
    })

    it('refuses a source repository that is not registered for the module', async () => {
      const response = await api(owner.token, 'POST', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/release-jobs`, {sourceRepository: 'someone-else/repo', releaseTag: 'v1.0.0'})
      expect(response.statusCode).toBe(400)
      expect(consoleCode(response)).toBe('INVALID_SOURCE_RELEASE')
    })
  })

  describe('asynchronous lifecycle', () => {
    it('create/validate never download in-request; the runner validates, then publishes only after review', async () => {
      const release = addFixtureRelease(source, nextPatch(), {signer})
      const downloadsBefore = source.downloads.length
      const created = await createJob(release.tag)
      expect(created.statusCode).toBe(202)
      expect(created.json().data).toMatchObject({state: 'created', moduleId: BUILDER_TEST_MODULE_ID, publisherId: BUILDER_TEST_PUBLISHER_ID, releaseTag: release.tag})
      const jobId = created.json().data.jobId
      const validate = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/validate`)
      expect(validate.statusCode).toBe(202)
      expect(validate.json().data.state).toBe('fetching')
      expect(source.downloads.length).toBe(downloadsBefore)
      const queued = await db.selectFrom('background_jobs').select(['job_type', 'dispatch_mode', 'status']).where('trace_id', '=', jobId).execute()
      expect(queued).toEqual([{job_type: 'publisher.release-job.validate', dispatch_mode: 'PUBLISHER_RELEASE_RUNNER', status: 'QUEUED'}])

      await drain()
      const job = await getJob(jobId)
      expect(job.state).toBe('ready_for_review')
      expect(job.sourceCommit).toBe(BUILDER_TEST_COMMIT)
      expect(job.version).toBe(release.version)
      expect(job.artifactSha256).toBe(release.packageSha256)
      expect(job.preview).toMatchObject({identity: {moduleId: BUILDER_TEST_MODULE_ID, publisherId: BUILDER_TEST_PUBLISHER_ID}, version: release.version, commit: BUILDER_TEST_COMMIT, releaseTag: release.tag, digests: {package: release.packageSha256}})
      expect(job.signature).toMatchObject({state: 'verified', keyId: signer.keyId, algorithm: 'Ed25519'})
      expect(job.validation.passed).toBe(true)
      expect(job.validation.checks.every((c: any) => c.status === 'passed' || c.status === 'skipped')).toBe(true)
      expect(job.permissionDelta).toMatchObject({reviewRequired: false})
      expect(job.logSummary.length).toBeGreaterThan(0)
      expect(job.actions).toMatchObject({canPublish: true, canResume: false})
      expect(job.releaseId).toBeTruthy()
      const registry = await db.selectFrom('greenfield_module_releases').select(['release_state']).where('release_id', '=', job.releaseId).executeTakeFirstOrThrow()
      expect(registry.release_state).toBe('verified')

      const publish = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/publish`, {})
      expect(publish.statusCode, publish.body).toBe(202)
      expect(publish.json().data.state).toBe('publishing')
      expect(publisher.calls.filter(c => c.version === release.version)).toHaveLength(0)
      await drain()
      const done = await getJob(jobId)
      expect(done.state).toBe('published')
      expect(publisher.calls.filter(c => c.version === release.version)).toHaveLength(1)
      // The isolated fixture never writes the public catalogue.
      const catalogue = await db.selectFrom('greenfield_extension_catalogue').select(['extension_id']).where('extension_id', '=', BUILDER_TEST_MODULE_ID).executeTakeFirst()
      expect(catalogue).toBeUndefined()

      const logs = await api(owner.token, 'GET', `/v1/publisher/release-jobs/${jobId}/logs`)
      expect(logs.json().data.entries.map((e: any) => e.step)).toEqual(expect.arrayContaining(['create', 'validate', 'fetch', 'signature', 'review', 'publish']))
      const history = await api(owner.token, 'GET', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/release-jobs`)
      expect(history.json().data.map((j: any) => j.jobId)).toContain(jobId)
      // Published is terminal.
      expect(consoleCode(await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/cancel`))).toBe('CANCEL_NOT_ALLOWED')
      expect(consoleCode(await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/resume`))).toBe('RESUME_NOT_ALLOWED')
      await expect(db.updateTable('greenfield_publisher_release_jobs').set({state: 'cancelled', cancelled_at: new Date()} as never).where('job_id', '=', jobId).execute()).rejects.toThrow(/terminal/)
    })

    it('lists valid tagged GitHub source releases as metadata only', async () => {
      const service = new PublisherReleaseConsoleService(db, loadConfig(), source, {githubEnabled: true})
      const before = source.downloads.length
      const releases = await service.githubReleases(owner.accountId, BUILDER_TEST_MODULE_ID)
      expect(releases.length).toBeGreaterThan(0)
      expect(releases.every(r => r.repository === BUILDER_TEST_REPOSITORY && r.valid && r.hasProvenance)).toBe(true)
      expect(source.downloads.length).toBe(before)
      await expect(service.githubReleases(otherPublisher.accountId, BUILDER_TEST_MODULE_ID)).rejects.toMatchObject({code: 'FORBIDDEN_NOT_PUBLISHER'})
    })
  })

  describe('signatures on the trusted path', () => {
    it('an unsigned release stops at signature_missing, is not imported and cannot be published', async () => {
      const {jobId, release, job} = await validatedJob({signer: null})
      expect(job.state).toBe('signature_missing')
      expect(job.signature.state).toBe('missing')
      expect(job.releaseId).toBeNull()
      const publish = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/publish`, {permissionChangeAcknowledged: true})
      expect(publish.statusCode).toBe(409)
      expect(consoleCode(publish)).toBe('SIGNATURE_MISSING')
      expect((await getJob(jobId)).state).toBe('signature_missing')
      expect(await db.selectFrom('greenfield_module_releases').select('release_id').where('module_id', '=', BUILDER_TEST_MODULE_ID).where('version', '=', release.version).executeTakeFirst()).toBeUndefined()
      expect(publisher.calls.some(c => c.version === release.version)).toBe(false)
    })

    it('an invalid signature stops at signature_invalid and cannot be published', async () => {
      const {jobId, release, job} = await validatedJob({signer, tamperSignedArtifact: true})
      expect(job.state).toBe('signature_invalid')
      expect(job.signature.state).toBe('invalid')
      const publish = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/publish`, {})
      expect(consoleCode(publish)).toBe('SIGNATURE_INVALID')
      expect((await getJob(jobId)).state).toBe('signature_invalid')
      expect(publisher.calls.some(c => c.version === release.version)).toBe(false)
    })

    it('a signature by an unknown key is invalid', async () => {
      const stranger = newEd25519()
      const {job} = await validatedJob({signer: {keyId: `builder-${suffix}-unregistered`, privateKey: stranger.privateKey}})
      expect(job.state).toBe('signature_invalid')
      expect(job.signature.state).toBe('unknownKey')
    })

    it('a revoked key cannot publish, before validation or between review and publication', async () => {
      const keys = newEd25519()
      const revokedSigner = {keyId: `builder-${suffix}-revoked`, privateKey: keys.privateKey}
      const signing = new GreenfieldPublisherSigningKeyService(db)
      await signing.register(BUILDER_TEST_PUBLISHER_ID, {keyId: revokedSigner.keyId, publicKeyPem: keys.publicKeyPem}, null)
      const late = await validatedJob({signer: revokedSigner})
      expect(late.job.state).toBe('ready_for_review')
      await signing.revoke(BUILDER_TEST_PUBLISHER_ID, revokedSigner.keyId, 'compromised (test)', null)

      const early = await validatedJob({signer: revokedSigner})
      expect(early.job.state).toBe('signature_invalid')
      expect(early.job.signature.state).toBe('revokedKey')
      expect(consoleCode(await api(owner.token, 'POST', `/v1/publisher/release-jobs/${early.jobId}/publish`, {}))).toBe('SIGNATURE_REVOKED')

      const publish = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${late.jobId}/publish`, {})
      expect(publish.statusCode).toBe(202)
      await drain()
      const after = await getJob(late.jobId)
      expect(after.state).toBe('signature_invalid')
      expect(after.error.code).toBe('SIGNATURE_REVOKED')
      expect(publisher.calls.some(c => c.version === late.release.version)).toBe(false)
    })
  })

  describe('validation and permission review gates', () => {
    it('failed validation cannot transition to published', async () => {
      const base = (await import('./helpers/registry-fixtures.js')).adapterManifest('x.y', '1.0.0')
      const {jobId, release, job} = await validatedJob({signer, manifestOverrides: {compatibility: {...base.compatibility, protocolVersions: ['greenfield.v999']}} as any})
      expect(job.state).toBe('validation_failed')
      expect(job.validation.passed).toBe(false)
      expect(job.validation.checks.find((c: any) => c.id === 'compatibility').status).toBe('failed')
      const publish = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/publish`, {permissionChangeAcknowledged: true})
      expect(publish.statusCode).toBe(409)
      expect(consoleCode(publish)).toBe('VALIDATION_FAILED')
      // Even a direct runner publish call is a no-op unless the job is in publishing.
      const processor = new PublisherReleaseJobProcessor(db, {source, config: loadConfig(), publish: publisher})
      expect(await processor.publish(jobId)).toBe('validation_failed')
      expect((await getJob(jobId)).state).toBe('validation_failed')
      expect(publisher.calls.some(c => c.version === release.version)).toBe(false)
    })

    it('a permission change requires permissionChangeAcknowledged, and no other field name is accepted', async () => {
      const {jobId, job} = await validatedJob({signer, permissions: [{permission: 'jobs:create', reason: 'Schedules fixture work', risk: 'high'}] as any})
      expect(job.state).toBe('ready_for_review')
      expect(job.permissionDelta.reviewRequired).toBe(true)
      expect(job.permissionDelta.added.map((p: any) => p.permission)).toEqual(['jobs:create'])
      const missing = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/publish`, {})
      expect(missing.statusCode).toBe(409)
      expect(consoleCode(missing)).toBe('PERMISSION_EXPANSION_UNACKNOWLEDGED')
      for (const wrong of [{acknowledgePermissionExpansion: true}, {acknowledgePermissionChanges: true}]) {
        const response = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/publish`, wrong)
        expect(response.statusCode).toBe(400)
        expect(consoleCode(response)).toBe('INVALID_REQUEST')
      }
      expect((await getJob(jobId)).state).toBe('ready_for_review')
      const ok = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/publish`, {permissionChangeAcknowledged: true})
      expect(ok.statusCode, ok.body).toBe(202)
      expect(ok.json().data).toMatchObject({state: 'publishing', permissionChangeAcknowledged: true})
      await drain()
      expect((await getJob(jobId)).state).toBe('published')
    })
  })

  describe('idempotency and concurrency', () => {
    it('the same natural key or Idempotency-Key returns the existing job', async () => {
      const release = addFixtureRelease(source, nextPatch(), {signer})
      const key = `idem-${suffix}`
      const first = await createJob(release.tag, {'idempotency-key': key})
      expect(first.statusCode).toBe(202)
      const again = await createJob(release.tag, {'idempotency-key': key})
      expect(again.statusCode).toBe(200)
      expect(again.json().data.jobId).toBe(first.json().data.jobId)
      const natural = await createJob(release.tag)
      expect(natural.json().data.jobId).toBe(first.json().data.jobId)
      const other = addFixtureRelease(source, nextPatch(), {signer})
      const reuse = await api(owner.token, 'POST', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/release-jobs`, {sourceRepository: BUILDER_TEST_REPOSITORY, releaseTag: other.tag}, {'idempotency-key': key})
      expect(reuse.statusCode).toBe(409)
      expect(consoleCode(reuse)).toBe('IDEMPOTENCY_KEY_CONFLICT')
      const parallel = await Promise.all([1, 2, 3].map(() => api(owner.token, 'POST', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/release-jobs`, {sourceRepository: BUILDER_TEST_REPOSITORY, releaseTag: other.tag})))
      expect(new Set(parallel.map(r => r.json().data.jobId)).size).toBe(1)
      const rows = await db.selectFrom('greenfield_publisher_release_jobs').select('job_id').where('module_id', '=', BUILDER_TEST_MODULE_ID).where('release_tag', '=', other.tag).execute()
      expect(rows).toHaveLength(1)
      // Concurrent validate requests enqueue one unit of work.
      const jobId = parallel[0]!.json().data.jobId
      await Promise.all([1, 2, 3].map(() => api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/validate`)))
      const work = await db.selectFrom('background_jobs').select('id').where('trace_id', '=', jobId).execute()
      expect(work).toHaveLength(1)
      await drain()
    })

    it('two in-flight jobs for the same moduleId@version: the second is conflicted', async () => {
      const patchNo = nextPatch()
      const first = await (async () => {
        const release = addFixtureRelease(source, patchNo, {signer})
        const created = await createJob(release.tag)
        await api(owner.token, 'POST', `/v1/publisher/release-jobs/${created.json().data.jobId}/validate`)
        await drain()
        return created.json().data.jobId as string
      })()
      expect((await getJob(first)).state).toBe('ready_for_review')
      const twin = addFixtureRelease(source, patchNo, {signer, tagSuffix: '-twin'})
      const created = await createJob(twin.tag)
      const second = created.json().data.jobId
      await api(owner.token, 'POST', `/v1/publisher/release-jobs/${second}/validate`)
      await drain()
      const job = await getJob(second)
      expect(job.state).toBe('conflicted')
      expect(['JOB_IN_FLIGHT', 'VERSION_CONFLICT']).toContain(job.error.code)
      expect(consoleCode(await api(owner.token, 'POST', `/v1/publisher/release-jobs/${second}/publish`, {}))).toBe('INVALID_JOB_STATE')
      expect(consoleCode(await api(owner.token, 'POST', `/v1/publisher/release-jobs/${second}/resume`))).toBe('RESUME_NOT_ALLOWED')
      expect(consoleCode(await api(owner.token, 'POST', `/v1/publisher/release-jobs/${second}/cancel`))).toBe('CANCEL_NOT_ALLOWED')
      // The schema itself refuses a second in-flight row for the same version.
      await expect(db.updateTable('greenfield_publisher_release_jobs').set({state: 'ready_for_review', version: (await getJob(first)).version} as never).where('job_id', '=', second).execute()).rejects.toThrow(/duplicate key/)
    })
  })

  describe('cancel and resume', () => {
    it('resume from cancelled-at-created re-runs validation from fetching via the runner (fetchVerified not skipped)', async () => {
      const release = addFixtureRelease(source, nextPatch(), {signer})
      const jobId = (await createJob(release.tag)).json().data.jobId
      const cancelled = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/cancel`)
      expect(cancelled.json().data).toMatchObject({state: 'cancelled', cancelledFromState: 'created', actions: {canResume: true}})
      const downloads = source.downloads.length
      const resumed = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/resume`)
      expect(resumed.statusCode, resumed.body).toBe(202)
      expect(resumed.json().data.state).toBe('fetching')
      expect(source.downloads.length).toBe(downloads)
      expect(await db.selectFrom('background_jobs').select('job_type').where('trace_id', '=', jobId).execute()).toEqual([{job_type: 'publisher.release-job.validate'}])
      await drain()
      expect(source.downloads.length).toBeGreaterThan(downloads)
      expect((await getJob(jobId)).state).toBe('ready_for_review')
    })

    it('resume from cancelled-at-ready_for_review or publishing returns to ready_for_review without publishing', async () => {
      const {jobId, release} = await validatedJob()
      await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/cancel`)
      const resumed = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/resume`)
      expect(resumed.json().data.state).toBe('ready_for_review')

      const publish = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/publish`, {})
      expect(publish.json().data.state).toBe('publishing')
      const cancel = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/cancel`)
      expect(cancel.json().data).toMatchObject({state: 'cancelled', cancelledFromState: 'publishing'})
      await drain() // queued publish work finds the job cancelled and does nothing
      expect(publisher.calls.some(c => c.version === release.version)).toBe(false)
      const back = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/resume`)
      expect(back.statusCode, back.body).toBe(202)
      expect(back.json().data).toMatchObject({state: 'ready_for_review', permissionChangeAcknowledged: false})
      await drain()
      expect((await getJob(jobId)).state).toBe('ready_for_review')
      expect(publisher.calls.some(c => c.version === release.version)).toBe(false)
    })

    it('signature_missing / signature_invalid / validation_failed are not resume targets; validate is the retry path', async () => {
      const {jobId} = await validatedJob({signer: null})
      expect(consoleCode(await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/resume`))).toBe('RESUME_NOT_ALLOWED')
      await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/cancel`)
      expect(consoleCode(await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/resume`))).toBe('RESUME_NOT_ALLOWED')
      const {jobId: other} = await validatedJob({signer: null})
      const revalidate = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${other}/validate`)
      expect(revalidate.statusCode).toBe(202)
      expect(revalidate.json().data.state).toBe('fetching')
      await drain()
      expect((await getJob(other)).state).toBe('signature_missing')
    })

    it('a cancelled job cannot be resumed once its version was published elsewhere', async () => {
      const patchNo = nextPatch()
      const release = addFixtureRelease(source, patchNo, {signer})
      const cancelledJob = (await createJob(release.tag)).json().data.jobId
      await api(owner.token, 'POST', `/v1/publisher/release-jobs/${cancelledJob}/validate`)
      await drain()
      await api(owner.token, 'POST', `/v1/publisher/release-jobs/${cancelledJob}/cancel`)
      // Simulate the version becoming published in the registry (direct test-DB write, no catalogue).
      const job = await getJob(cancelledJob)
      await db.updateTable('greenfield_module_releases').set({release_state: 'published', published_at: new Date()}).where('release_id', '=', job.releaseId).execute()
      const resume = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${cancelledJob}/resume`)
      expect(resume.statusCode).toBe(409)
      expect(consoleCode(resume)).toBe('VERSION_CONFLICT')
      expect((await getJob(cancelledJob)).state).toBe('cancelled')
    })
  })
})
