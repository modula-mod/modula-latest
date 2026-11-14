import {randomUUID} from 'node:crypto'
import {symbols} from 'pino'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {DeveloperService} from '../src/developers/service.js'
import {GreenfieldPublisherSigningKeyService} from '../src/modules/release-signing.js'
import {PublisherReleaseJobProcessor} from '../src/publisher/release-job-processor.js'
import {PublisherReleaseJobRunner} from '../src/publisher/release-job-runner.js'
import {PublisherOnlineSigningIdentityService} from '../src/publisher/signing-identity-service.js'
import {DisposableEd25519SigningProvider} from '../src/publisher/signing-provider.js'
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
  let onlineIdentityId: string
  let onlineSigningKeyId: string
  let onlineIdentityLifecycle: PublisherOnlineSigningIdentityService
  const onlineSigningProvider = new DisposableEd25519SigningProvider({allowInsecureTestProvider: true})
  const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { throw new Error('Live network forbidden in BUILDER-01 fixture suite') })
  const requestLogs: string[] = []
  let logWrite: ReturnType<typeof vi.spyOn>
  let patch = 0
  let previousNamespace: {
    publisher_id: string
    verification_method: string
    verification_evidence: unknown
    verified_at: Date | null
    revoked_at: Date | null
  } | null = null
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
    source = new FixtureGithubSource()
    const created = await createServer(loadConfig(), {publisherConsole: {
      githubReleaseSource: source,
      // The app creates its pool; bind the recorder immediately after construction.
      publisher: (moduleId, version) => publisher(moduleId, version),
      signingProvider: onlineSigningProvider,
    }})
    app = created.app
    db = created.db
    // Capture the real Pino destination, including request child loggers, not just job logs.
    const logStream = (app.log as any)[symbols.streamSym]
    const write = logStream.write.bind(logStream)
    logWrite = vi.spyOn(logStream, 'write').mockImplementation((...args: any[]) => {
      requestLogs.push(String(args[0]))
      return write(...args)
    })
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
      .onConflict(oc => oc.column('namespace').doUpdateSet({
        publisher_id: BUILDER_TEST_PUBLISHER_ID,
        verification_method: 'operatorReview',
        verification_evidence: {fixture: 'builder-01'},
        verified_at: now,
        revoked_at: null,
      })).execute()
    await db.insertInto('greenfield_developer_products').values({product_id: BUILDER_TEST_MODULE_ID, publisher_id: BUILDER_TEST_PUBLISHER_ID, owner_account_id: owner.accountId, owner_organisation_id: null, extension_id: null, kind: 'module', display_name: 'Builder Release Fixture', description: 'BUILDER-01 isolated test fixture', visibility: 'PRIVATE', state: 'DRAFT', created_at: now, updated_at: now} as never)
      .onConflict(oc => oc.column('product_id').doUpdateSet({
        publisher_id: BUILDER_TEST_PUBLISHER_ID, owner_account_id: owner.accountId, owner_organisation_id: null,
        state: 'DRAFT', updated_at: now,
      })).execute()
    await db.insertInto('greenfield_developer_source_connections').values({source_connection_id: randomUUID(), product_id: BUILDER_TEST_MODULE_ID, provider: 'github', repository: `https://github.com/${BUILDER_TEST_REPOSITORY}`, repository_id: null, default_branch: 'main', credential_ref: null, state: 'ACTIVE', created_by_account_id: owner.accountId, created_at: now, updated_at: now, revoked_at: null})
      .onConflict(oc => oc.columns(['product_id', 'provider', 'repository']).doNothing()).execute()
    // A second, unrelated publisher owned by another account.
    await new DeveloperService(db, loadConfig()).createPublisher(otherPublisher.accountId, {publisherId: `test.builder-b-${suffix}`, displayName: 'Other Publisher'})

    const keys = newEd25519()
    signer = {keyId: `builder-${suffix}-main`, privateKey: keys.privateKey}
    await new GreenfieldPublisherSigningKeyService(db).register(BUILDER_TEST_PUBLISHER_ID, {keyId: signer.keyId, publicKeyPem: keys.publicKeyPem}, null)

    publisher = recordingPublisher(db)
    runner = created.publisherReleaseJobRunner!
    expect(runner).toBeDefined()
    // Drain any stale runner work from earlier runs of this suite.
    await db.updateTable('background_jobs').set({status: 'CANCELLED'} as never).where('dispatch_mode', '=', 'PUBLISHER_RELEASE_RUNNER' as never).where('status', 'in', ['QUEUED', 'RETRYING']).execute()
  })

  afterAll(async () => {
    if (db) {
      if (onlineIdentityId) {
        const now = new Date()
        await db.updateTable('greenfield_publisher_online_signing_identities').set({
          state: 'REVOKED', suspended_at: null, suspension_reason: null, revoked_at: now,
          revocation_reason: 'disposable fixture teardown', updated_at: now,
        }).where('identity_id', '=', onlineIdentityId).where('state', '!=', 'REVOKED').execute()
        await db.updateTable('greenfield_publisher_signing_authorizations').set({
          state: 'REVOKED', suspended_at: null, revoked_at: now, updated_at: now,
        }).where('publisher_id', '=', BUILDER_TEST_PUBLISHER_ID).where('account_id', '=', owner.accountId).where('state', '!=', 'REVOKED').execute()
      }
      if (previousNamespace && previousNamespace.publisher_id !== BUILDER_TEST_PUBLISHER_ID) {
        await db.updateTable('greenfield_publisher_namespaces').set({
          publisher_id: previousNamespace.publisher_id,
          verification_method: previousNamespace.verification_method,
          verification_evidence: previousNamespace.verification_evidence,
          verified_at: previousNamespace.verified_at,
          revoked_at: previousNamespace.revoked_at,
        }).where('namespace', '=', BUILDER_TEST_NAMESPACE).execute()
      } else if (!previousNamespace || previousNamespace.publisher_id === BUILDER_TEST_PUBLISHER_ID) {
        await db.deleteFrom('greenfield_publisher_namespaces').where('namespace', '=', BUILDER_TEST_NAMESPACE).where('publisher_id', '=', BUILDER_TEST_PUBLISHER_ID).execute()
      }
    }
    await app?.close()
    await db?.destroy()
    logWrite?.mockRestore()
    network.mockRestore()
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
        ['GET', `/v1/publisher/release-jobs/${jobId}/signing`],
        ['POST', `/v1/publisher/release-jobs/${jobId}/validate`],
        ['POST', `/v1/publisher/release-jobs/${jobId}/sign`],
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

  describe('write body allowlists', () => {
    const syntheticValue = 'TEST_SYNTHETIC_PRIVATE_KEY_DO_NOT_USE'
    const createPath = `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/release-jobs`

    function rejected(response: Awaited<ReturnType<typeof api>>, fields: string[]) {
      expect(response.statusCode, response.body).toBe(400)
      expect(response.json()).toMatchObject({ok: false, error: {code: 'VALIDATION_FAILED', details: {publisherConsoleCode: 'INVALID_REQUEST', fields}}})
      expect(response.body).not.toContain(syntheticValue)
      expect(requestLogs.length).toBeGreaterThan(0)
      expect(requestLogs.join('')).not.toContain(syntheticValue)
    }

    it('rejects synthetic privateKey before create, idempotency or natural-key replay; valid two-field create is 202', async () => {
      const release = addFixtureRelease(source, nextPatch(), {signer})
      const body = {sourceRepository: BUILDER_TEST_REPOSITORY, releaseTag: release.tag}
      const headers = {'idempotency-key': `unknown-keys-${suffix}`}
      const bad = {...body, privateKey: syntheticValue}
      rejected(await api(owner.token, 'POST', createPath, bad, headers), ['privateKey'])
      expect(await db.selectFrom('greenfield_publisher_release_jobs').select('job_id').where('module_id', '=', BUILDER_TEST_MODULE_ID).where('release_tag', '=', release.tag).execute()).toHaveLength(0)
      const valid = await api(owner.token, 'POST', createPath, body, headers)
      expect(valid.statusCode, valid.body).toBe(202)
      const jobId = valid.json().data.jobId
      // Neither replay route may bypass body rejection.
      rejected(await api(owner.token, 'POST', createPath, bad, headers), ['privateKey'])
      rejected(await api(owner.token, 'POST', createPath, bad), ['privateKey'])
      for (const fields of [['signingKey'], ['secret'], ['syntheticExtra'], ['privateKey', 'signingKey', 'secret']]) {
        rejected(await api(owner.token, 'POST', createPath, {...body, ...Object.fromEntries(fields.map(field => [field, syntheticValue]))}), fields)
      }
      // Unknown fields also take precedence over malformed/missing source fields.
      rejected(await api(owner.token, 'POST', createPath, {privateKey: syntheticValue}), ['privateKey'])
      const logs = await api(owner.token, 'GET', `/v1/publisher/release-jobs/${jobId}/logs`)
      expect(logs.statusCode).toBe(200)
      expect(logs.body).not.toContain(syntheticValue)
      expect(JSON.stringify(await db.selectFrom('greenfield_publisher_release_jobs').selectAll().where('job_id', '=', jobId).executeTakeFirst())).not.toContain(syntheticValue)
      expect((await getJob(jobId)).state).toBe('created')
    })

    it.each(['validate', 'cancel', 'resume'])('%s rejects every extra field before state processing without logging values', async action => {
      const release = addFixtureRelease(source, nextPatch(), {signer})
      const jobId = (await createJob(release.tag)).json().data.jobId
      const url = `/v1/publisher/release-jobs/${jobId}/${action}`
      rejected(await api(owner.token, 'POST', url, {syntheticExtra: syntheticValue}), ['syntheticExtra'])
      rejected(await api(owner.token, 'POST', `/v1/publisher/release-jobs/prj_${randomUUID()}/${action}`, {syntheticExtra: syntheticValue}), ['syntheticExtra'])
      expect((await getJob(jobId)).state).toBe('created')
      expect(await db.selectFrom('background_jobs').select('id').where('trace_id', '=', jobId).execute()).toHaveLength(0)
      const logs = await api(owner.token, 'GET', `/v1/publisher/release-jobs/${jobId}/logs`)
      expect(logs.body).not.toContain(syntheticValue)
    })

    it.each([undefined, {}])('validate/cancel/resume accept omitted body or empty object (%j)', async body => {
      const release = addFixtureRelease(source, nextPatch(), {signer})
      const jobId = (await createJob(release.tag)).json().data.jobId
      const path = `/v1/publisher/release-jobs/${jobId}`
      expect((await api(owner.token, 'POST', `${path}/validate`, body)).statusCode).toBe(202)
      await drain()
      expect((await api(owner.token, 'POST', `${path}/cancel`, body)).statusCode).toBe(200)
      const resumed = await api(owner.token, 'POST', `${path}/resume`, body)
      expect(resumed.statusCode, resumed.body).toBe(202)
      expect(resumed.json().data.state).toBe('ready_for_review')
    })

    it('all write bodies must be non-array objects', async () => {
      for (const url of [createPath, ...['validate', 'publish', 'cancel', 'resume'].map(action => `/v1/publisher/release-jobs/prj_${randomUUID()}/${action}`)]) {
        for (const body of [[], 'synthetic', 42, true, null]) {
          const response = await api(owner.token, 'POST', url, JSON.stringify(body), {'content-type': 'application/json'})
          expect(response.statusCode, response.body).toBe(400)
          expect(consoleCode(response)).toBe('INVALID_REQUEST')
          expect(response.json().error.message).toBe('Body must be an object')
        }
      }
    })

    it('missing or malformed allowed create fields remain INVALID_SOURCE_RELEASE', async () => {
      for (const body of [{}, {sourceRepository: BUILDER_TEST_REPOSITORY}, {releaseTag: 'v1.0.0'}, {sourceRepository: 42, releaseTag: 'v1.0.0'}, {sourceRepository: BUILDER_TEST_REPOSITORY, releaseTag: false}]) {
        const response = await api(owner.token, 'POST', createPath, body)
        expect(response.statusCode, response.body).toBe(400)
        expect(consoleCode(response)).toBe('INVALID_SOURCE_RELEASE')
      }
    })

    it('publish still rejects synthetic privateKey and preserves its accepted field', async () => {
      const {jobId} = await validatedJob()
      rejected(await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/publish`, {permissionChangeAcknowledged: true, privateKey: syntheticValue}), ['privateKey'])
      expect((await getJob(jobId)).state).toBe('ready_for_review')
      const logs = await api(owner.token, 'GET', `/v1/publisher/release-jobs/${jobId}/logs`)
      expect(logs.body).not.toContain(syntheticValue)
    })
  })

  describe('asynchronous lifecycle', () => {
    it('injected HTTP create/validate never download in-request; the app runner validates and uses the recording publisher', async () => {
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
      expect(source.downloads.length).toBeGreaterThan(downloadsBefore)
      expect(network).not.toHaveBeenCalled()
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
      expect((await db.selectFrom('greenfield_module_releases').select('release_state').where('release_id', '=', job.releaseId).executeTakeFirstOrThrow()).release_state).toBe('verified')
      expect(network).not.toHaveBeenCalled()

      const logs = await api(owner.token, 'GET', `/v1/publisher/release-jobs/${jobId}/logs`)
      expect(logs.json().data.entries.map((e: any) => e.step)).toEqual(expect.arrayContaining(['create', 'validate', 'fetch', 'signature', 'review', 'publish']))
      const history = await api(owner.token, 'GET', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/release-jobs`)
      expect(history.json().data.map((j: any) => j.jobId)).toContain(jobId)
      // Published is terminal.
      expect(consoleCode(await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/cancel`))).toBe('CANCEL_NOT_ALLOWED')
      expect(consoleCode(await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/resume`))).toBe('RESUME_NOT_ALLOWED')
      await expect(db.updateTable('greenfield_publisher_release_jobs').set({state: 'cancelled', cancelled_at: new Date()} as never).where('job_id', '=', jobId).execute()).rejects.toThrow(/terminal/)
    })

    it('lists injected GitHub releases over HTTP as metadata only, with no network', async () => {
      const release = addFixtureRelease(source, nextPatch(), {signer})
      const before = source.downloads.length
      const response = await api(owner.token, 'GET', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/github-releases`)
      expect(response.statusCode, response.body).toBe(200)
      const releases = response.json().data
      expect(releases.some((r: any) => r.releaseTag === release.tag)).toBe(true)
      expect(releases.every((r: any) => r.repository === BUILDER_TEST_REPOSITORY && r.valid && r.hasProvenance)).toBe(true)
      expect(source.downloads.length).toBe(before)
      const forbidden = await api(otherPublisher.token, 'GET', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/github-releases`)
      expect(consoleCode(forbidden)).toBe('FORBIDDEN_NOT_PUBLISHER')
      expect(network).not.toHaveBeenCalled()
    })

    it('does not construct an in-process runner when test hooks are omitted', async () => {
      const productionShape = await createServer(loadConfig())
      try {
        expect(productionShape.publisherReleaseJobRunner).toBeUndefined()
        expect(network).not.toHaveBeenCalled()
      } finally {
        await productionShape.app.close()
        await productionShape.db.destroy()
      }
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

  describe('publisher-scoped online signing', () => {
    beforeAll(async () => {
      const now = new Date()
      onlineIdentityId = `psi_${randomUUID()}`
      onlineSigningKeyId = `builder-${suffix}-online-1`
      const providerKeyRef = `test/builder-${suffix}-online-1`
      onlineSigningProvider.createIdentity({providerKeyRef})
      await db.updateTable('greenfield_developer_products').set({state: 'ACTIVE', updated_at: now} as never)
        .where('product_id', '=', BUILDER_TEST_MODULE_ID).execute()
      await db.insertInto('greenfield_developer_profiles').values({
        account_id: owner.accountId, display_name: 'Builder Signing Fixture', biography: '', website: null,
        status: 'ACTIVE', created_at: now, updated_at: now,
      }).onConflict(oc => oc.column('account_id').doUpdateSet({status: 'ACTIVE', updated_at: now})).execute()
      await db.insertInto('greenfield_developer_programme_memberships').values({
        programme_membership_id: randomUUID(), account_id: owner.accountId, organisation_id: null, state: 'ACTIVE',
        state_reason: null, started_at: now, ended_at: null, created_at: now, updated_at: now,
      }).onConflict(oc => oc.columns(['account_id', 'organisation_id']).doUpdateSet({state: 'ACTIVE', started_at: now, ended_at: null, updated_at: now})).execute()
      onlineIdentityLifecycle = new PublisherOnlineSigningIdentityService(db, loadConfig(), onlineSigningProvider)
      const registeredIdentity = await onlineIdentityLifecycle.register({
        actorAccountId: founderAdmin.accountId,
        publisherId: BUILDER_TEST_PUBLISHER_ID,
        signingKeyId: onlineSigningKeyId,
        providerKeyRef,
        purpose: 'PUBLISHER',
        firstPartyAuthorized: false,
        validFrom: new Date(now.getTime() - 60_000),
        validUntil: new Date(now.getTime() + 24 * 60 * 60_000),
      })
      onlineIdentityId = registeredIdentity.identityId
      await db.insertInto('greenfield_publisher_signing_authorizations').values({
        authorization_id: `psa_${randomUUID()}`, publisher_id: BUILDER_TEST_PUBLISHER_ID, product_id: BUILDER_TEST_MODULE_ID,
        account_id: owner.accountId, state: 'ACTIVE', first_party_authorized: false,
        valid_from: new Date(now.getTime() - 60_000), valid_until: new Date(now.getTime() + 24 * 60 * 60_000),
        granted_by_account_id: founderAdmin.accountId, suspended_at: null, revoked_at: null,
        reason: 'GREENFIELD-SIGNER-01 disposable integration fixture', created_at: now, updated_at: now,
      }).execute()
    })

    it('lists only public permitted identity facts and rejects arbitrary signing payloads', async () => {
      const identities = await api(owner.token, 'GET', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/signing-identities`)
      expect(identities.statusCode, identities.body).toBe(200)
      expect(identities.json().data).toEqual([expect.objectContaining({
        identityId: onlineIdentityId,
        publisherId: BUILDER_TEST_PUBLISHER_ID,
        signingKeyId: onlineSigningKeyId,
        provider: 'DISPOSABLE_TEST',
        purpose: 'PUBLISHER',
        state: 'ACTIVE',
        publicKeyFingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      })])
      expect(identities.body).not.toMatch(/PRIVATE KEY|providerKeyRef/)

      const {jobId, job} = await validatedJob({signer: null})
      expect(job).toMatchObject({state: 'ready_for_signing', actions: {canRequestSigning: true}, signing: {approval: {sha256: expect.stringMatching(/^[0-9a-f]{64}$/)}}})
      for (const body of [
        {keyId: onlineSigningKeyId},
        {payload: 'arbitrary-bytes'},
        {digest: 'f'.repeat(64)},
        {signingKeyId: onlineSigningKeyId, permissionChangeAcknowledged: true},
      ]) {
        const response = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/sign`, body)
        expect(response.statusCode, response.body).toBe(400)
        expect(consoleCode(response)).toBe('INVALID_REQUEST')
      }
      expect((await getJob(jobId)).state).toBe('ready_for_signing')
    })

    it('signs, independently verifies and publishes the exact approved release idempotently', async () => {
      const {jobId, release, job} = await validatedJob({signer: null})
      expect(job.state).toBe('ready_for_signing')
      const idempotencyKey = `sign-${suffix}-${jobId}`
      const responses = await Promise.all([1, 2, 3].map(() => api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/sign`, {}, {'idempotency-key': idempotencyKey})))
      expect(responses.every(response => response.statusCode === 202), responses.map(response => response.body).join('\n')).toBe(true)
      expect(new Set(responses.map(response => response.json().data.jobId))).toEqual(new Set([jobId]))
      expect(await db.selectFrom('background_jobs').select('id').where('trace_id', '=', jobId).where('job_type', '=', 'publisher.release-job.sign').execute()).toHaveLength(1)
      await drain()

      const signed = await getJob(jobId)
      expect(signed).toMatchObject({
        state: 'ready_for_review',
        signature: {state: 'verified', keyId: onlineSigningKeyId, algorithm: 'Ed25519', publicKeyFingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/)},
        validation: {passed: true},
        signing: {requestId: expect.stringMatching(/^psr_/), identityId: onlineIdentityId, receipt: {
          provider: 'DISPOSABLE_TEST', identityId: onlineIdentityId, keyId: onlineSigningKeyId,
          approvalSha256: job.signing.approval.sha256, statementSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        }},
      })
      expect(signed.signing.receipt.statementSha256).not.toBe(signed.signing.receipt.approvalSha256)
      expect(signed.releaseId).toBeTruthy()
      const signatures = await db.selectFrom('greenfield_module_release_signatures').select(['signature_key_id', 'verification_state'])
        .where('release_id', '=', signed.releaseId).execute()
      expect(signatures).toEqual([{signature_key_id: onlineSigningKeyId, verification_state: 'verified'}])

      const status = await api(owner.token, 'GET', `/v1/publisher/release-jobs/${jobId}/signing`)
      expect(status.statusCode, status.body).toBe(200)
      expect(status.json().data.receipt).toMatchObject({identityId: onlineIdentityId, keyId: onlineSigningKeyId})
      expect(status.json().data.auditHistory.map((event: any) => event.eventType)).toEqual(expect.arrayContaining([
        'signing_requested', 'signing_started', 'signature_created', 'signature_verified',
      ]))
      const auditEvent = await db.selectFrom('greenfield_publisher_signing_audit_events').select('event_id').where('job_id', '=', jobId).executeTakeFirstOrThrow()
      await expect(db.updateTable('greenfield_publisher_signing_audit_events').set({details: {tampered: true}} as never)
        .where('event_id', '=', auditEvent.event_id).execute()).rejects.toThrow(/append-only/)

      const publish = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/publish`, {})
      expect(publish.statusCode, publish.body).toBe(202)
      await drain()
      expect((await getJob(jobId)).state).toBe('published')
      expect(publisher.calls.filter(call => call.version === release.version)).toHaveLength(1)
      expect((await api(owner.token, 'GET', `/v1/publisher/release-jobs/${jobId}/signing`)).json().data.auditHistory.map((event: any) => event.eventType))
        .toContain('publication_authorized')
    })

    it('does not let another publisher inspect identities or sign the release', async () => {
      const {jobId} = await validatedJob({signer: null})
      const identities = await api(otherPublisher.token, 'GET', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/signing-identities`)
      expect(identities.statusCode).toBe(403)
      expect(consoleCode(identities)).toBe('FORBIDDEN_NOT_PUBLISHER')
      const sign = await api(otherPublisher.token, 'POST', `/v1/publisher/release-jobs/${jobId}/sign`, {})
      expect(sign.statusCode).toBe(403)
      expect(consoleCode(sign)).toBe('FORBIDDEN_NOT_PUBLISHER')
      expect((await getJob(jobId)).state).toBe('ready_for_signing')
    })

    it('does not infer elevated first-party signing authority from ordinary publisher ownership', async () => {
      const {jobId} = await validatedJob({signer: null})
      await db.updateTable('greenfield_publishers').set({trust_level: 'firstParty', updated_at: new Date()})
        .where('publisher_id', '=', BUILDER_TEST_PUBLISHER_ID).execute()
      try {
        const response = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/sign`, {})
        expect(response.statusCode, response.body).toBe(403)
        expect(consoleCode(response)).toBe('SIGNING_AUTHORIZATION_REQUIRED')
        expect((await getJob(jobId)).state).toBe('ready_for_signing')
      } finally {
        await db.updateTable('greenfield_publishers').set({trust_level: 'verifiedPublisher', updated_at: new Date()})
          .where('publisher_id', '=', BUILDER_TEST_PUBLISHER_ID).execute()
      }
    })

    it('rejects a suspended Builder Programme member', async () => {
      const {jobId} = await validatedJob({signer: null})
      await db.updateTable('greenfield_developer_programme_memberships').set({state: 'SUSPENDED', updated_at: new Date()} as never)
        .where('account_id', '=', owner.accountId).execute()
      const response = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/sign`, {})
      expect(response.statusCode, response.body).toBe(403)
      expect(consoleCode(response)).toBe('SIGNING_AUTHORIZATION_REQUIRED')
      expect((await getJob(jobId)).state).toBe('ready_for_signing')
      await db.updateTable('greenfield_developer_programme_memberships').set({state: 'ACTIVE', updated_at: new Date()} as never)
        .where('account_id', '=', owner.accountId).execute()
    })

    it('operator suspension fails closed and rotation rebinds the identity to a new public key', async () => {
      await onlineIdentityLifecycle.suspend(founderAdmin.accountId, onlineIdentityId, 'isolated suspension coverage')
      const suspended = await api(owner.token, 'GET', `/v1/publisher/modules/${BUILDER_TEST_MODULE_ID}/signing-identities`)
      expect(suspended.statusCode, suspended.body).toBe(409)
      expect(consoleCode(suspended)).toBe('SIGNING_IDENTITY_UNAVAILABLE')
      await onlineIdentityLifecycle.resume(founderAdmin.accountId, onlineIdentityId)

      const previousKeyId = onlineSigningKeyId
      const newKeyId = `builder-${suffix}-online-2`
      const rotated = await onlineIdentityLifecycle.rotate(
        founderAdmin.accountId,
        onlineIdentityId,
        newKeyId,
        new Date(Date.now() + 24 * 60 * 60_000),
      )
      onlineSigningKeyId = newKeyId
      expect(rotated).toMatchObject({identityId: onlineIdentityId, signingKeyId: newKeyId, state: 'ACTIVE'})
      expect(await new GreenfieldPublisherSigningKeyService(db).get(previousKeyId)).toMatchObject({state: 'ROTATED', rotatedToKeyId: newKeyId})
      expect(await db.selectFrom('greenfield_publisher_online_signing_identities').select(['signing_key_id', 'state'])
        .where('identity_id', '=', onlineIdentityId).executeTakeFirst()).toEqual({signing_key_id: newKeyId, state: 'ACTIVE'})
      expect((await db.selectFrom('greenfield_publisher_signing_audit_events').select('event_type')
        .where('identity_id', '=', onlineIdentityId).execute()).map(row => row.event_type)).toEqual(expect.arrayContaining([
        'identity_registered', 'identity_suspended', 'identity_resumed', 'identity_rotated',
      ]))
    })

    it('invalidates approval when source, manifest or artifacts change after validation', async () => {
      const patchNo = nextPatch()
      const release = addFixtureRelease(source, patchNo, {signer: null})
      const created = await createJob(release.tag)
      const jobId = created.json().data.jobId
      await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/validate`)
      await drain()
      expect((await getJob(jobId)).state).toBe('ready_for_signing')

      // Same tag/version, different manifest and package bytes.
      addFixtureRelease(source, patchNo, {signer: null, permissions: [{permission: 'jobs:create', reason: 'post-approval mutation', risk: 'high'}] as any})
      expect((await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/sign`, {})).statusCode).toBe(202)
      await drain()
      const invalidated = await getJob(jobId)
      expect(invalidated).toMatchObject({state: 'validation_failed', error: {code: 'RELEASE_APPROVAL_INVALIDATED'}, signing: {approval: null, receipt: null}})
      expect(await db.selectFrom('greenfield_module_releases').select('release_id').where('module_id', '=', BUILDER_TEST_MODULE_ID).where('version', '=', release.version).executeTakeFirst()).toBeUndefined()
    })

    it('keeps publication closed when the signing service fails', async () => {
      const {jobId, release} = await validatedJob({signer: null})
      onlineSigningProvider.simulateSigningFailure('simulated isolated provider outage')
      expect((await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/sign`, {})).statusCode).toBe(202)
      const processor = new PublisherReleaseJobProcessor(db, {source, config: loadConfig(), publish: publisher, signingProvider: onlineSigningProvider})
      await expect(processor.sign(jobId)).rejects.toMatchObject({code: 'PROVIDER_FAILURE'})
      onlineSigningProvider.simulateSigningFailure(null)
      expect((await getJob(jobId)).state).toBe('signing')
      await processor.markExhausted(jobId, 'simulated signing retries exhausted')
      await drain()
      expect(await getJob(jobId)).toMatchObject({state: 'signing_failed', error: {code: 'SIGNING_FAILED'}})
      expect(await db.selectFrom('greenfield_module_releases').select('release_id').where('module_id', '=', BUILDER_TEST_MODULE_ID).where('version', '=', release.version).executeTakeFirst()).toBeUndefined()
      expect(publisher.calls.some(call => call.version === release.version)).toBe(false)
    })

    it('refuses new signatures after the registered publisher key is revoked', async () => {
      const {jobId, release} = await validatedJob({signer: null})
      await onlineIdentityLifecycle.revoke(founderAdmin.accountId, onlineIdentityId, 'GREENFIELD-SIGNER-01 test revocation')
      const response = await api(owner.token, 'POST', `/v1/publisher/release-jobs/${jobId}/sign`, {})
      expect(response.statusCode, response.body).toBe(409)
      expect(consoleCode(response)).toBe('SIGNING_IDENTITY_UNAVAILABLE')
      expect((await getJob(jobId)).state).toBe('ready_for_signing')
      expect(await db.selectFrom('greenfield_module_releases').select('release_id').where('module_id', '=', BUILDER_TEST_MODULE_ID).where('version', '=', release.version).executeTakeFirst()).toBeUndefined()
    })
  })
})
