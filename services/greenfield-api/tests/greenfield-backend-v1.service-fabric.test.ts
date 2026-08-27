import {randomUUID} from 'node:crypto'
import {createServer as createHttpServer, type Server} from 'node:http'
import type {AddressInfo} from 'node:net'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'
import {migrateUp} from '../src/database/migrate.js'
import {ModuleBackendTokenService} from '../src/modules/backend/token-service.js'
import {GreenfieldModuleRuntimeAccessService} from '../src/modules/runtime-access.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)
const productId = `test.modula.service-fabric-${suffix}`
const accountA = `service-account-a-${suffix}`
const accountB = `service-account-b-${suffix}`
const actorA = `service-actor-a-${suffix}`
const installationId = `installation:${productId}:${accountA}`
const releaseId = `release:${productId}:1.0.0`
const extensionId = `extension:${productId}`
const extensionVersionId = `${productId}@1.0.0`
const moduleVersionId = `module-version:${productId}:1.0.0`
const publisherId = `publisher:service-fabric-${suffix}`
const readRecords = `records:module.${productId}.entry:read`
const writeRecords = `records:module.${productId}.entry:write`
const deleteRecords = `records:module.${productId}.entry:delete`
const readData = `data:module.${productId}:read`
const writeData = `data:module.${productId}:write`
const useSecrets = 'secrets.use'
const publishEvents = 'events.publish'
const enqueueJobs = 'jobs.enqueue'
const claimJobs = 'jobs.claim'
const executeJobs = 'jobs.execute'
const readJobResults = 'jobs.result'
const cancelJobs = 'jobs.cancel'
const jobAction = `${productId}.jobs.sync`
const eventType = `${productId}.entry.created.v1`
const fullOperations = [
  readRecords,
  writeRecords,
  deleteRecords,
  readData,
  writeData,
  useSecrets,
  publishEvents,
  enqueueJobs,
  claimJobs,
  executeJobs,
  readJobResults,
  cancelJobs,
]

describeIfDb('Greenfield Backend V1 service fabric boundary', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let brokerServer: Server
  let brokerRequests = 0
  let brokerAssertion = ''

  beforeAll(async () => {
    configureTestEnv()
    brokerServer = createHttpServer(async (request, response) => {
      brokerRequests += 1
      brokerAssertion = String(request.headers['x-modula-service-assertion'] ?? '')
      expect(request.headers.authorization).toBeUndefined()
      expect(request.url).toBe('/v1/secrets/lease')
      for await (const chunk of request) void chunk
      response.writeHead(201, {'content-type': 'application/json', 'cache-control': 'no-store'})
      response.end(JSON.stringify({ok: true, data: {
        reference: 'secret://engine.ai/provider/test/primary', namespace: 'engine.ai', version: 'v1', state: 'CURRENT',
        manifestCommit: 'e'.repeat(40), environment: 'test', leaseId: `lease:${suffix}`,
        expiresAt: new Date(Date.now() + 30_000).toISOString(), useToken: `use-token-${'x'.repeat(40)}`,
      }}))
    })
    await new Promise<void>(resolve => brokerServer.listen(0, '127.0.0.1', resolve))
    process.env.MODULA_SECRETS_SERVICE_URL = `http://127.0.0.1:${(brokerServer.address() as AddressInfo).port}`
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    await seedPlatformState()
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
    await new Promise<void>(resolve => brokerServer?.close(() => resolve()))
  })

  it('requires a verified service assertion and rejects raw bearer forwarding', async () => {
    const missing = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/identity/context`})
    expect(missing.statusCode).toBe(401)
    expect(missing.json().error.code).toBe('UNAUTHENTICATED')

    const rawBearer = await app.inject({
      method: 'GET',
      url: `/v1/backend/products/${productId}/identity/context`,
      headers: await serviceHeaders({authorization: 'Bearer raw-user-token'}),
    })
    expect(rawBearer.statusCode).toBe(401)
    expect(rawBearer.json().error.message).toContain('Raw user bearer forwarding is forbidden')

    const crossProduct = await app.inject({
      method: 'GET',
      url: `/v1/backend/products/test.modula.other-${suffix}/identity/context`,
      headers: await serviceHeaders(),
    })
    expect(crossProduct.statusCode).toBe(401)
    expect(crossProduct.json().error.code).toBe('UNAUTHENTICATED')
  })

  it('returns only assertion-scoped identity, account, installation and capabilities', async () => {
    const identity = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/identity/context`, headers: await serviceHeaders()})
    expect(identity.statusCode, identity.body).toBe(200)
    expect(identity.json().data).toEqual({
      requestId: identity.json().meta.requestId,
      traceId: expect.stringMatching(/^service-fabric-trace-/),
      accountId: accountA,
      organisationId: null,
      productId,
      releaseId,
      installationId,
      serviceId: `service.${productId}.backend`,
    })

    const account = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/accounts/${accountA}`, headers: await serviceHeaders()})
    expect(account.statusCode, account.body).toBe(200)
    expect(account.json().data).toMatchObject({accountId: accountA, status: 'active'})
    expect(account.json().data).not.toHaveProperty('primaryHandle')

    const crossAccount = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/accounts/${accountB}`, headers: await serviceHeaders()})
    expect(crossAccount.statusCode).toBe(403)

    const installation = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/installations/${encodeURIComponent(installationId)}`, headers: await serviceHeaders()})
    expect(installation.statusCode, installation.body).toBe(200)
    expect(installation.json().data).toMatchObject({installationId, productId, releaseId, status: 'enabled'})

    const wrongInstallation = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/installations/${encodeURIComponent(`installation:other:${suffix}`)}`, headers: await serviceHeaders()})
    expect(wrongInstallation.statusCode).toBe(403)

    const capabilities = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/installations/${encodeURIComponent(installationId)}/capabilities`, headers: await serviceHeaders()})
    expect(capabilities.statusCode, capabilities.body).toBe(200)
    expect(capabilities.json().data.map((grant: {capabilityId: string}) => grant.capabilityId)).toEqual(expect.arrayContaining([readRecords, writeRecords, deleteRecords, readData, writeData]))

    const deniedCapability = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/capabilities/check`,
      headers: await serviceHeaders({}, [readRecords]),
      payload: {installationId, capability: writeData},
    })
    expect(deniedCapability.statusCode, deniedCapability.body).toBe(200)
    expect(deniedCapability.json().data).toEqual({allowed: false, grant: null})

    const deniedMutation = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/resources`,
      headers: await serviceHeaders({'idempotency-key': `read-only-resource-${suffix}`}, [readRecords]),
      payload: {},
    })
    expect(deniedMutation.statusCode).toBe(403)
    expect(deniedMutation.json().error.code).toBe('FORBIDDEN')
  })

  it('executes account-isolated records with idempotency conflict detection', async () => {
    const key = `record-create-${suffix}`
    const create = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/records/entry`,
      headers: await serviceHeaders({'idempotency-key': key}),
      payload: {title: 'Service fabric entry', body: 'Account A private content'},
    })
    expect(create.statusCode, create.body).toBe(201)
    expect(create.json().data).toMatchObject({account_id: accountA, module_id: productId, collection: 'entry', revision: 1})

    const replay = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/records/entry`,
      headers: await serviceHeaders({'idempotency-key': key}),
      payload: {title: 'Service fabric entry', body: 'Account A private content'},
    })
    expect(replay.statusCode, replay.body).toBe(201)
    expect(replay.json().data.record_id).toBe(create.json().data.record_id)

    const changedReplay = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/records/entry`,
      headers: await serviceHeaders({'idempotency-key': key}),
      payload: {title: 'Changed payload', body: 'Must conflict'},
    })
    expect(changedReplay.statusCode).toBe(409)
    expect(changedReplay.json().error.code).toBe('CONFLICT')

    const list = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/records/entry`, headers: await serviceHeaders()})
    expect(list.statusCode, list.body).toBe(200)
    expect(list.json().data.items).toHaveLength(1)
    expect(list.json().data.items[0].data.body).toBe('Account A private content')
  })

  it('registers and reads ledger resources only within the target installation', async () => {
    const key = `resource-register-${suffix}`
    const payload = {
      resourceKey: `${productId}.entries`,
      installationId,
      releaseId,
      schemaId: `${productId}.entries`,
      schemaVersion: '1.0.0',
      schemaDefinitionSha256: 'd'.repeat(64),
      schemaCompatibility: 'FULL',
      primaryStorageMode: 'greenfield-records',
      storageBindings: [{storageMode: 'greenfield-records', locatorRef: `greenfield://records/${installationId}/entries`}],
      retention: {mode: 'RETAIN', policyVersion: '1.0.0'},
      backup: {responsibility: 'GREENFIELD', mode: 'MANAGED'},
      exportHandler: `${productId}.data.export`,
      deleteHandler: `${productId}.data.delete`,
      encryptionClassification: 'private',
    }
    const registered = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/resources`,
      headers: await serviceHeaders({'idempotency-key': key}),
      payload,
    })
    expect(registered.statusCode, registered.body).toBe(201)
    expect(registered.json().data).toMatchObject({ownerAccountId: accountA, owningProductId: productId, installationId})

    const replay = await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/resources`, headers: await serviceHeaders({'idempotency-key': key}), payload})
    expect(replay.statusCode, replay.body).toBe(201)
    expect(replay.json().data.resourceId).toBe(registered.json().data.resourceId)

    const listed = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/installations/${encodeURIComponent(installationId)}/resources`, headers: await serviceHeaders()})
    expect(listed.statusCode, listed.body).toBe(200)
    expect(listed.json().data.items).toHaveLength(1)
    expect(listed.json().data.items[0].resourceId).toBe(registered.json().data.resourceId)
  })

  it('publishes versioned events with immutable service, release and trace provenance', async () => {
    const eventId = `event:${suffix}:entry-created`
    const traceId = `trace:${suffix}:event`
    const payload = {
      eventId,
      eventType,
      schemaVersion: '1.0.0',
      producer: `service.${productId}.backend`,
      accountId: accountA,
      installationId,
      occurredAt: new Date().toISOString(),
      traceId,
      classification: 'private',
      payload: {recordId: `record:${suffix}`},
    }
    const published = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/events`,
      headers: await serviceHeaders({'idempotency-key': eventId}, [publishEvents]),
      payload,
    })
    expect(published.statusCode, published.body).toBe(202)
    expect(published.json().data).toEqual({accepted: true, eventId})

    const replay = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/events`,
      headers: await serviceHeaders({'idempotency-key': eventId}, [publishEvents]),
      payload,
    })
    expect(replay.statusCode, replay.body).toBe(202)
    expect(replay.json().data.eventId).toBe(eventId)

    const row = await db.selectFrom('greenfield_domain_events').selectAll().where('event_id', '=', eventId).executeTakeFirstOrThrow()
    expect(row).toMatchObject({
      producer_kind: 'service',
      producer_id: `service.${productId}.backend`,
      product_id: productId,
      installation_id: installationId,
      release_id: releaseId,
      trace_id: traceId,
      account_id: accountA,
    })
    expect(await db.selectFrom('greenfield_event_deliveries').select(db.fn.countAll<number>().as('count')).where('event_id', '=', eventId).executeTakeFirstOrThrow()).toMatchObject({count: '1'})

    const impersonated = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/events`,
      headers: await serviceHeaders({'idempotency-key': `event:${suffix}:impersonated`}, [publishEvents]),
      payload: {...payload, eventId: `event:${suffix}:impersonated`, producer: 'service.attacker'},
    })
    expect(impersonated.statusCode).toBe(403)

    const rawCredential = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/events`,
      headers: await serviceHeaders({'idempotency-key': `event:${suffix}:secret`}, [publishEvents]),
      payload: {...payload, eventId: `event:${suffix}:secret`, payload: {apiKey: 'plaintext-forbidden'}},
    })
    expect(rawCredential.statusCode).toBe(400)
    expect(rawCredential.json().error.message).toContain('secret:// handle')
  })

  it('executes declared service-pull jobs through canonical lease, retry, result, cancel and dead-letter states', async () => {
    const successfulId = `job:${suffix}:successful`
    const successful = jobPayload(successfulId, `idem:${suffix}:successful`, 3)
    const undeclared = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/jobs`,
      headers: await serviceHeaders({'idempotency-key': `idem:${suffix}:undeclared`}, [enqueueJobs]),
      payload: {...successful, jobId: `job:${suffix}:undeclared`, action: `${productId}.jobs.undeclared`, idempotencyKey: `idem:${suffix}:undeclared`},
    })
    expect(undeclared.statusCode).toBe(403)

    const enqueued = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/jobs`,
      headers: await serviceHeaders({'idempotency-key': successful.idempotencyKey}, [enqueueJobs]),
      payload: successful,
    })
    expect(enqueued.statusCode, enqueued.body).toBe(201)
    expect(enqueued.json().data).toMatchObject({jobId: successfulId, state: 'QUEUED', attempt: 0, input: {recordId: `record:${suffix}`}})

    const firstClaim = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/jobs/claim`,
      headers: await serviceHeaders({}, [claimJobs]),
      payload: {actions: [jobAction], maxJobs: 1},
    })
    expect(firstClaim.statusCode, firstClaim.body).toBe(200)
    expect(firstClaim.json().data.jobs[0]).toMatchObject({jobId: successfulId, state: 'LEASED', attempt: 1})

    const started = await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs/${encodeURIComponent(successfulId)}/start`, headers: await serviceHeaders({}, [executeJobs])})
    expect(started.statusCode, started.body).toBe(200)
    expect(started.json().data.state).toBe('RUNNING')

    const retry = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/jobs/${encodeURIComponent(successfulId)}/fail`,
      headers: await serviceHeaders({}, [executeJobs]),
      payload: {errorClass: 'TRANSIENT_PROVIDER_FAILURE', retryable: true},
    })
    expect(retry.statusCode, retry.body).toBe(200)
    expect(retry.json().data.state).toBe('RETRYING')
    await db.updateTable('background_jobs').set({available_at: new Date(0)}).where('id', '=', successfulId).execute()

    const secondClaim = await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs/claim`, headers: await serviceHeaders({}, [claimJobs]), payload: {actions: [jobAction]}})
    expect(secondClaim.json().data.jobs[0]).toMatchObject({jobId: successfulId, state: 'LEASED', attempt: 2})
    const restarted = await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs/${encodeURIComponent(successfulId)}/start`, headers: await serviceHeaders({}, [executeJobs])})
    expect(restarted.json().data.state).toBe('RUNNING')
    const resultReference = `artifact://jobs/${successfulId}`
    const succeeded = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/jobs/${encodeURIComponent(successfulId)}/succeed`,
      headers: await serviceHeaders({}, [executeJobs]),
      payload: {resultReference},
    })
    expect(succeeded.statusCode, succeeded.body).toBe(200)
    expect(succeeded.json().data).toMatchObject({jobId: successfulId, state: 'SUCCEEDED', resultReference, result: null, errorClass: null})
    const result = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/jobs/${encodeURIComponent(successfulId)}/result`, headers: await serviceHeaders({}, [readJobResults])})
    expect(result.statusCode, result.body).toBe(200)
    expect(result.json().data.resultReference).toBe(resultReference)

    const cancelledId = `job:${suffix}:cancelled`
    const cancelledJob = jobPayload(cancelledId, `idem:${suffix}:cancelled`, 2)
    await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs`, headers: await serviceHeaders({'idempotency-key': cancelledJob.idempotencyKey}, [enqueueJobs]), payload: cancelledJob})
    const cancelled = await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs/${encodeURIComponent(cancelledId)}/cancel`, headers: await serviceHeaders({}, [cancelJobs])})
    expect(cancelled.statusCode, cancelled.body).toBe(200)
    expect(cancelled.json().data).toEqual({cancelled: true})

    const deadId = `job:${suffix}:dead-letter`
    const deadJob = jobPayload(deadId, `idem:${suffix}:dead-letter`, 1)
    await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs`, headers: await serviceHeaders({'idempotency-key': deadJob.idempotencyKey}, [enqueueJobs]), payload: deadJob})
    const deadClaim = await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs/claim`, headers: await serviceHeaders({}, [claimJobs]), payload: {actions: [jobAction]}})
    expect(deadClaim.json().data.jobs[0].jobId).toBe(deadId)
    await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs/${encodeURIComponent(deadId)}/start`, headers: await serviceHeaders({}, [executeJobs])})
    const failed = await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs/${encodeURIComponent(deadId)}/fail`, headers: await serviceHeaders({}, [executeJobs]), payload: {errorClass: 'PROVIDER_UNAVAILABLE', retryable: true}})
    expect(failed.statusCode, failed.body).toBe(200)
    expect(failed.json().data.state).toBe('DEAD_LETTER')
    const failure = await db.selectFrom('job_failures').selectAll().where('job_id', '=', deadId).executeTakeFirstOrThrow()
    expect(failure.payload).toEqual({})
    expect(failure.payload_fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(failure.error_message).not.toContain('record')

    const permanentId = `job:${suffix}:failed`
    const permanentJob = jobPayload(permanentId, `idem:${suffix}:failed`, 2)
    await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs`, headers: await serviceHeaders({'idempotency-key': permanentJob.idempotencyKey}, [enqueueJobs]), payload: permanentJob})
    await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs/claim`, headers: await serviceHeaders({}, [claimJobs]), payload: {actions: [jobAction]}})
    await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs/${encodeURIComponent(permanentId)}/start`, headers: await serviceHeaders({}, [executeJobs])})
    const permanent = await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/jobs/${encodeURIComponent(permanentId)}/fail`, headers: await serviceHeaders({}, [executeJobs]), payload: {errorClass: 'INPUT_REJECTED', retryable: false}})
    expect(permanent.statusCode, permanent.body).toBe(200)
    expect(permanent.json().data.state).toBe('FAILED')
  })

  it('stores only token hashes and records zero raw user bearer forwarding', async () => {
    const sessions = await db.selectFrom('module_backend_sessions').select(['token_hash']).where('installation_id', '=', installationId).execute()
    expect(sessions.length).toBeGreaterThan(0)
    expect(sessions.every(session => /^[0-9a-f]{64}$/.test(session.token_hash))).toBe(true)
    const rows = await db.selectFrom('greenfield_extension_service_assertions').select(['raw_user_bearer_forwarded', 'consumed_at']).where('target_installation_id', '=', installationId).execute()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => row.raw_user_bearer_forwarded === false)).toBe(true)
    expect(rows.some(row => row.consumed_at !== null)).toBe(true)
  })

  it('brokers a value-free, single-use secret lease through the trusted configured service', async () => {
    const brokerHeaders = await serviceHeaders()
    const leased = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/secrets/lease`,
      headers: brokerHeaders,
      payload: {reference: 'secret://engine.ai/provider/test/primary', purpose: 'ai.generate'},
    })
    expect(leased.statusCode, leased.body).toBe(201)
    expect(leased.json().data).toMatchObject({
      reference: 'secret://engine.ai/provider/test/primary',
      namespace: 'engine.ai',
      state: 'CURRENT',
      manifestCommit: 'e'.repeat(40),
    })
    expect(leased.json().data).not.toHaveProperty('value')
    expect(brokerRequests).toBe(1)
    expect(brokerAssertion).toBe(brokerHeaders['x-modula-service-assertion'])

    const replayedAssertion = await app.inject({
      method: 'GET',
      url: `/v1/backend/products/${productId}/identity/context`,
      headers: brokerHeaders,
    })
    expect(replayedAssertion.statusCode).toBe(401)

    const denied = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/secrets/lease`,
      headers: await serviceHeaders({}, [readRecords]),
      payload: {reference: 'secret://engine.ai/provider/test/primary', purpose: 'ai.generate'},
    })
    expect(denied.statusCode).toBe(403)
    expect(brokerRequests).toBe(1)
  })

  async function seedPlatformState(): Promise<void> {
    const now = new Date()
    for (const [accountId, handle] of [[accountA, `servicea${suffix}`], [accountB, `serviceb${suffix}`]] as const) {
      await db.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: handle, status: 'active', created_at: now, updated_at: now}).execute()
    }
    await db.insertInto('actors').values({id: actorA, account_id: accountA, kind: 'person', created_at: now, updated_at: now, deleted_at: null, version: 1}).execute()
    await db.insertInto('greenfield_publishers').values({
      publisher_id: publisherId,
      display_name: 'Service Fabric Test Publisher',
      website: null,
      status: 'verified',
      trust_level: 'firstParty',
      created_at: now,
      updated_at: now,
      verified_at: now,
      suspended_at: null,
      revoked_at: null,
    }).execute()
    await db.insertInto('greenfield_extensions').values({extension_id: extensionId, slug: productId, publisher_account_id: null, status: 'published', created_at: now, updated_at: now}).execute()
    const manifest = {permissions: [], contributions: {events: []}}
    await db.insertInto('greenfield_extension_versions').values({extension_version_id: extensionVersionId, extension_id: extensionId, version: '1.0.0', manifest, status: 'published', created_at: now}).execute()
    await db.insertInto('greenfield_module_versions').values({module_version_id: moduleVersionId, extension_version_id: extensionVersionId, module_id: productId, version: '1.0.0', publisher_id: publisherId, manifest, status: 'published', created_at: now, updated_at: now}).execute()
    await db.insertInto('greenfield_module_releases').values({
      release_id: releaseId,
      module_version_id: moduleVersionId,
      extension_id: extensionId,
      extension_version_id: extensionVersionId,
      module_id: productId,
      version: '1.0.0',
      publisher_id: publisherId,
      release_state: 'published',
      source_repository: 'modula-mod/test-service-fabric',
      source_commit: 'a'.repeat(40),
      manifest_path: 'manifest.json',
      manifest_sha256: 'b'.repeat(64),
      release_sha256: 'c'.repeat(64),
      signature_key_id: 'test-key',
      signature: 'test-signature',
      compatibility: {},
      license_status: 'firstParty',
      trust_level: 'firstParty',
      product_kind: 'service',
      extension_product: {},
      published_at: now,
      quarantined_at: null,
      revoked_at: null,
      superseded_at: null,
      created_at: now,
      updated_at: now,
    }).execute()
    await db.insertInto('greenfield_extension_installations').values({installation_id: installationId, extension_version_id: extensionVersionId, account_id: accountA, status: 'enabled', config: {}, created_at: now, updated_at: now}).execute()
    await db.insertInto('greenfield_module_permission_reviews').values({
      review_id: `permission-review:${suffix}`,
      installation_id: installationId,
      release_id: releaseId,
      account_id: accountA,
      granted_permissions: jsonb([readRecords, writeRecords, deleteRecords, readData, writeData]),
      denied_permissions: jsonb([]),
      high_risk_increase: false,
      idempotency_key: `permission-review:${suffix}`,
      reviewed_at: now,
    }).execute()
    await db.insertInto('greenfield_module_record_collections').values({
      collection_id: `collection:${releaseId}:entry`,
      release_id: releaseId,
      module_id: productId,
      collection: 'entry',
      schema_ref: `${productId}.schemas.entry.v1`,
      default_visibility: 'private',
      fields: jsonb([
        {fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true},
        {fieldId: 'body', name: 'body', type: 'multilineText', label: 'Body', required: true},
      ]),
      searchable_fields: jsonb(['title', 'body']),
      filterable_fields: jsonb([]),
      sortable_fields: jsonb(['title']),
      folder_field: null,
      reference_fields: jsonb([]),
      schema_definition: jsonb({type: 'object'}),
      retention_policy: 'keepOnUninstall',
      registration_status: 'registered',
      created_at: now,
      updated_at: now,
    }).execute()
    await db.insertInto('greenfield_module_job_registrations').values({
      job_registration_id: `job-registration:${suffix}`,
      installation_id: installationId,
      account_id: accountA,
      release_id: releaseId,
      module_id: productId,
      job_key: jobAction,
      job_kind: 'queue',
      function_id: null,
      schedule: null,
      retry_policy: jsonb({maximumAttempts: 3}),
      paused: false,
      status: 'registered',
      declaration: jsonb({action: jobAction}),
      created_at: now,
      updated_at: now,
    }).execute()
    await db.insertInto('greenfield_module_service_registrations').values({
      service_registration_id: `service-registration:${suffix}`,
      installation_id: installationId,
      account_id: accountA,
      release_id: releaseId,
      module_id: productId,
      service_id: `service.${productId}.backend`,
      service_kind: 'module-backend',
      version: '1.0.0',
      contract_ref: `${productId}.backend.v1`,
      permissions: jsonb(fullOperations),
      capabilities: jsonb(fullOperations),
      input_schema_ref: null,
      output_schema_ref: null,
      status: 'registered',
      health_state: 'healthy',
      timeout_ms: 30_000,
      rate_limit_per_minute: 120,
      invocation_depth_limit: 4,
      declaration: jsonb({serviceId: `service.${productId}.backend`}),
      created_at: now,
      updated_at: now,
    }).execute()
    await db.insertInto('greenfield_event_subscriptions').values({
      subscription_id: `event-subscription:${suffix}`,
      event_type: eventType,
      subscriber_id: `test-subscriber:${suffix}`,
      target_type: 'internal-subscriber',
      target_key: `test.target.${suffix}`,
      filters: jsonb({accountId: accountA}),
      enabled: true,
      permitted_visibility: ['account'],
      permitted_classifications: ['private'],
      subscriber_timeout_ms: 30_000,
      max_concurrency: 1,
      created_at: now,
      updated_at: now,
    }).execute()
  }

  function jobPayload(jobId: string, idempotencyKey: string, maximumAttempts: number) {
    return {
      jobId,
      ownerAccountId: accountA,
      productId,
      installationId,
      action: jobAction,
      serviceId: `service.${productId}.backend`,
      maximumAttempts,
      timeoutMs: 30_000,
      idempotencyKey,
      traceId: `trace:${jobId}`,
      input: {recordId: `record:${suffix}`},
    }
  }

  async function serviceHeaders(extra: Record<string, string> = {}, operations = fullOperations): Promise<Record<string, string>> {
    const context = await new GreenfieldModuleRuntimeAccessService(db).resolve(accountA, productId, {requireEnabled: true})
    const identity = randomUUID()
    const issued = await new ModuleBackendTokenService(db, loadConfig()).issue({
      context,
      actorId: actorA,
      permissions: operations,
      capabilities: operations,
      requestId: `service-fabric-request-${identity}`,
      traceId: `service-fabric-trace-${identity}`,
      backend: {
        mode: 'module-managed',
        authentication: {tokenExchangeRequired: true, audience: `service.${productId}`, tokenTtlSeconds: 300},
      } as any,
      extensionInvocation: {
        consumerProductId: productId,
        targetProductId: productId,
        targetInstallationId: installationId,
        actionId: `${productId}.backend.request`,
        serviceId: `service.${productId}.backend`,
        scope: {type: 'installation', ref: installationId},
      },
    })
    return {'x-modula-service-assertion': issued.token, ...extra}
  }
})

function configureTestEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4051'
  process.env.MODULA_PUBLIC_API_URL = 'https://api.test.modula.digital'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
  process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'greenfield-backend-v1-service-fabric-test-signing-key'
}

function jsonb(value: unknown) {
  return sql`${JSON.stringify(value)}::jsonb`
}
