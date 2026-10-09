import {randomBytes, randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {Client, Pool} from 'pg'
import {sql} from 'kysely'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {
  manifestChecksum,
  validateGreenfieldModuleManifest,
  type GreenfieldModuleManifest,
} from '@modula/greenfield-module-manifest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldModuleRuntimeAccessService, type GreenfieldModuleRuntimeContext} from '../src/modules/runtime-access.js'
import {GreenfieldDataLedgerService} from '../src/data-ledger/service.js'
import {GreenfieldBackendEventJobService} from '../src/backend-fabric/event-job-service.js'
import type {ResolvedServiceAssertion} from '../src/modules/backend/token-service.js'
import {handleModuleUninstall} from '../../greenfield-worker/src/modules/uninstall-handler.js'
import {
  ReferenceModuleBackend,
  fixtureProductId,
  fixtureServiceId,
} from '../../../fixtures/modules/module-owned-backend/backend/service.mjs'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const fixtureRoot = resolve(process.cwd(), '../../fixtures/modules/module-owned-backend')
const manifestPath = join(fixtureRoot, 'module.manifest.json')
const migrationPath = join(fixtureRoot, 'backend/migrations/001_records.sql')
const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
const moduleDatabase = `gbv1_module_${suffix}`
const foreignDatabase = `gbv1_foreign_${suffix}`
const moduleRole = `gbv1_module_role_${suffix}`
const foreignRole = `gbv1_foreign_role_${suffix}`
const modulePassword = randomBytes(24).toString('base64url')
const accounts = [`module-owner-a-${suffix}`, `module-owner-b-${suffix}`]
const installations = accounts.map(accountId => `installation:${fixtureProductId}:${accountId}`)
const developmentTrust = {environment: 'development' as const, moduleAllowUntrustedDevelopmentReleases: true}

describeIfDb('Greenfield Backend V1 TEST_ONLY module-owned backend', () => {
  let db: ModulaDb
  let admin: Client
  let modulePool: Pool
  let backend: ReferenceModuleBackend
  let releaseId = ''
  let extensionVersionId = ''
  let contexts: GreenfieldModuleRuntimeContext[] = []
  let resources: Array<{resourceId: string}> = []

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    admin = new Client({connectionString: databaseWithName(databaseUrl!, 'postgres')})
    await admin.connect()
    await provisionDedicatedDatabases(admin)
    modulePool = new Pool({connectionString: databaseWithCredentials(databaseUrl!, moduleDatabase, moduleRole, modulePassword), max: 2})
    await modulePool.query(readFileSync(migrationPath, 'utf8'))
    backend = new ReferenceModuleBackend(modulePool)

    for (let index = 0; index < accounts.length; index += 1) await seedAccount(accounts[index]!, `moduleowner${index}${suffix}`.slice(0, 24))
    const manifest = fixtureManifest()
    const validation = validateGreenfieldModuleManifest(manifest)
    expect(validation.issues).toEqual([])
    const releases = new GreenfieldModuleReleaseService(db)
    const imported = await releases.importPendingReview(manifest)
    const published = await releases.publishRelease(fixtureProductId, manifest.version)
    releaseId = published.releaseId
    extensionVersionId = imported.extensionVersionId

    for (let index = 0; index < accounts.length; index += 1) {
      await db.insertInto('greenfield_extension_installations').values({
        installation_id: installations[index]!,
        extension_version_id: extensionVersionId,
        account_id: accounts[index]!,
        status: 'enabled',
        config: {},
        created_at: new Date(),
        updated_at: new Date(),
      }).execute()
      await db.insertInto('greenfield_module_job_registrations').values({
        job_registration_id: `job-registration:${installations[index]}`,
        installation_id: installations[index]!,
        account_id: accounts[index]!,
        release_id: releaseId,
        module_id: fixtureProductId,
        job_key: `${fixtureProductId}.records.compact`,
        job_kind: 'cleanup',
        function_id: null,
        schedule: null,
        retry_policy: {},
        paused: false,
        status: 'registered',
        declaration: {testOnly: true},
        created_at: new Date(),
        updated_at: new Date(),
      }).execute()
      await db.insertInto('greenfield_module_service_registrations').values({
        service_registration_id: `service-registration:${installations[index]}`,
        installation_id: installations[index]!,
        account_id: accounts[index]!,
        release_id: releaseId,
        module_id: fixtureProductId,
        service_id: fixtureServiceId,
        service_kind: 'module-backend',
        version: '1.0.0',
        contract_ref: `${fixtureProductId}.backend.v1`,
        permissions: sql`${JSON.stringify(['events:subscribe', 'jobs:create'])}::jsonb`,
        capabilities: sql`${JSON.stringify(['events:publish', 'jobs:enqueue'])}::jsonb`,
        input_schema_ref: null,
        output_schema_ref: null,
        status: 'registered',
        health_state: 'healthy',
        timeout_ms: 30_000,
        rate_limit_per_minute: 120,
        invocation_depth_limit: 2,
        declaration: sql`${JSON.stringify({testOnly: true})}::jsonb`,
        created_at: new Date(),
        updated_at: new Date(),
      }).execute()
    }
    contexts = await Promise.all(accounts.map(accountId => new GreenfieldModuleRuntimeAccessService(db, developmentTrust).resolve(accountId, fixtureProductId, {requireEnabled: true})))
    resources = await Promise.all(accounts.map((accountId, index) => new GreenfieldDataLedgerService(db, developmentTrust).register(accountId, fixtureProductId, {
      resourceKey: `${fixtureProductId}.records`,
      installationId: installations[index],
      releaseId,
      schemaId: `${fixtureProductId}.records`,
      schemaVersion: '1.0.0',
      schemaDefinitionSha256: '1'.repeat(64),
      primaryStorageMode: 'dedicated-postgres',
      storageBindings: [{storageMode: 'dedicated-postgres', serviceId: fixtureServiceId, locatorRef: `postgres://binding/${moduleDatabase}`, credentialRef: `secret://product/${fixtureProductId}/database`}],
      backendServiceId: fixtureServiceId,
      retention: {mode: 'DELETE_ON_UNINSTALL', policyVersion: '1.0.0'},
      backup: {responsibility: 'GREENFIELD', mode: 'MANAGED', scheduleRef: 'backup://module-owned-backend/daily'},
      exportHandler: `${fixtureProductId}.data.export`,
      deleteHandler: `${fixtureProductId}.data.delete`,
      encryptionClassification: 'restricted',
      idempotencyKey: `module-owned-records-${accountId}`,
    })))
  })

  afterAll(async () => {
    await modulePool?.end()
    await db?.destroy()
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${identifier(moduleDatabase)} WITH (FORCE)`)
      await admin.query(`DROP DATABASE IF EXISTS ${identifier(foreignDatabase)} WITH (FORCE)`)
      await admin.query(`DROP ROLE IF EXISTS ${identifier(moduleRole)}`)
      await admin.query(`DROP ROLE IF EXISTS ${identifier(foreignRole)}`)
      await admin.end()
    }
  })

  it('declares a test-only frontend, backend contract, and authoritative dedicated storage binding', async () => {
    expect(JSON.parse(readFileSync(manifestPath, 'utf8'))).toMatchObject({moduleId: fixtureProductId, backend: {mode: 'module-managed'}})
    expect(readFileSync(join(fixtureRoot, 'frontend/index.mjs'), 'utf8')).toContain(fixtureProductId)
    expect(resources).toHaveLength(2)
    for (let index = 0; index < resources.length; index += 1) {
      const resource = await new GreenfieldDataLedgerService(db, developmentTrust).get(accounts[index]!, fixtureProductId, resources[index]!.resourceId)
      expect(resource).toMatchObject({ownerAccountId: accounts[index], installationId: installations[index], primaryStorageMode: 'dedicated-postgres', backendServiceId: fixtureServiceId})
      expect(resource.storageBindings[0]).toMatchObject({credentialRef: `secret://product/${fixtureProductId}/database`})
    }
  })

  it('performs dedicated-database CRUD and rejects cross-account and cross-database access', async () => {
    const first = await backend.create(serviceContext(0), {title: 'Account A record', body: 'Private A body'})
    const second = await backend.create(serviceContext(1), {title: 'Account B record', body: 'Private B body'})
    expect((await backend.list(serviceContext(0))).map((record: any) => record.recordId)).toEqual([first.recordId])
    expect((await backend.list(serviceContext(1))).map((record: any) => record.recordId)).toEqual([second.recordId])
    await expect(backend.get(serviceContext(1), first.recordId)).rejects.toMatchObject({code: 'NOT_FOUND'})
    expect((await backend.update(serviceContext(0), first.recordId, {title: 'Account A updated', body: 'Updated A body'})).title).toBe('Account A updated')

    const forbidden = new Client({connectionString: databaseWithCredentials(databaseUrl!, foreignDatabase, moduleRole, modulePassword), connectionTimeoutMillis: 2_000})
    await expect(forbidden.connect()).rejects.toMatchObject({code: '42501'})
    await forbidden.end().catch(() => undefined)
  })

  it('publishes scoped events and completes a declared service job through Greenfield', async () => {
    const fabric = new GreenfieldBackendEventJobService(db)
    const assertion = serviceAssertion(0)
    const eventId = `event:${randomUUID()}`
    expect(await fabric.publishEvent(assertion, contexts[0]!, {
      eventId,
      eventType: 'test.modula.module-owned-backend.record.created.v1',
      schemaVersion: '1.0.0',
      producer: fixtureServiceId,
      accountId: accounts[0]!,
      installationId: installations[0]!,
      occurredAt: new Date().toISOString(),
      traceId: `trace:${suffix}`,
      classification: 'private',
      payload: {recordCount: 1},
    })).toEqual({accepted: true, eventId})

    const jobId = `job:${randomUUID()}`
    const action = `${fixtureProductId}.records.compact`
    expect((await fabric.enqueueJob(assertion, contexts[0]!, {jobId, ownerAccountId: accounts[0]!, productId: fixtureProductId, installationId: installations[0]!, action, serviceId: fixtureServiceId, maximumAttempts: 3, timeoutMs: 5_000, idempotencyKey: `compact:${suffix}`, traceId: `trace:${suffix}`, input: {maximumRecords: 100}})).state).toBe('QUEUED')
    expect((await fabric.claimJobs(assertion, contexts[0]!, {actions: [action]})).jobs[0]?.state).toBe('LEASED')
    expect((await fabric.startJob(assertion, contexts[0]!, jobId)).state).toBe('RUNNING')
    expect((await fabric.succeedJob(assertion, contexts[0]!, jobId, `artifact://module-owned-backend/${jobId}`)).state).toBe('SUCCEEDED')
  })

  it('exports only the installation scope and deleteData uninstall preserves the other account', async () => {
    const exported = await backend.exportData(serviceContext(0))
    expect(exported.records).toHaveLength(1)
    expect(exported.records[0]).toMatchObject({accountId: accounts[0], title: 'Account A updated'})
    expect(JSON.stringify(exported)).not.toContain('Private B body')

    expect(await backend.deleteInstallationData(serviceContext(0))).toEqual({deleted: 1})
    await handleModuleUninstall(db as any, {installationId: installations[0], moduleId: fixtureProductId, dataRetentionChoice: 'deleteData'})
    expect(await backend.list(serviceContext(0))).toEqual([])
    expect((await backend.list(serviceContext(1))).map((record: any) => record.title)).toEqual(['Account B record'])
    const states = await db.selectFrom('greenfield_extension_installations').select(['installation_id', 'status']).where('installation_id', 'in', installations).execute()
    expect(states.find(row => row.installation_id === installations[0])?.status).toBe('removed')
    expect(states.find(row => row.installation_id === installations[1])?.status).toBe('enabled')
    expect((await new GreenfieldDataLedgerService(db, developmentTrust).get(accounts[0]!, fixtureProductId, resources[0]!.resourceId)).lifecycleState).toBe('DELETE_PENDING')
  })

  function serviceContext(index: number) {
    return {accountId: accounts[index]!, installationId: installations[index]!, productId: fixtureProductId, serviceId: fixtureServiceId}
  }

  function serviceAssertion(index: number): ResolvedServiceAssertion {
    const now = new Date()
    return {
      issuer: 'https://api.test.modula.digital',
      subject: fixtureServiceId,
      consumerProductId: fixtureProductId,
      consumerInstallationId: installations[index]!,
      targetServiceId: fixtureServiceId,
      targetProductId: fixtureProductId,
      targetInstallationId: installations[index]!,
      actionId: `${fixtureProductId}.records.compact`,
      accountId: accounts[index]!,
      actorId: null,
      capabilities: ['events:publish', 'jobs:enqueue'],
      scope: {accountId: accounts[index]!, productId: fixtureProductId, installationId: installations[index]!, operations: ['events:publish', 'jobs:enqueue']},
      audience: `modula-service:${fixtureServiceId}`,
      jti: `assertion:${randomUUID()}`,
      requestId: `request:${suffix}`,
      traceId: `trace:${suffix}`,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60_000),
    }
  }

  async function seedAccount(accountId: string, handle: string) {
    await db.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: handle, status: 'active', created_at: new Date(), updated_at: new Date()}).execute()
  }
})

function fixtureManifest(): GreenfieldModuleManifest {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as GreenfieldModuleManifest
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

async function provisionDedicatedDatabases(admin: Client) {
  await admin.query(`CREATE ROLE ${identifier(moduleRole)} LOGIN PASSWORD ${literal(modulePassword)}`)
  await admin.query(`CREATE ROLE ${identifier(foreignRole)} LOGIN PASSWORD ${literal(randomBytes(24).toString('base64url'))}`)
  await admin.query(`CREATE DATABASE ${identifier(moduleDatabase)} OWNER ${identifier(moduleRole)}`)
  await admin.query(`CREATE DATABASE ${identifier(foreignDatabase)} OWNER ${identifier(foreignRole)}`)
  await admin.query(`REVOKE CONNECT ON DATABASE ${identifier(moduleDatabase)} FROM PUBLIC`)
  await admin.query(`REVOKE CONNECT ON DATABASE ${identifier(foreignDatabase)} FROM PUBLIC`)
  await admin.query(`GRANT CONNECT ON DATABASE ${identifier(moduleDatabase)} TO ${identifier(moduleRole)}`)
}

function databaseWithName(input: string, name: string) {
  const url = new URL(input)
  url.pathname = `/${name}`
  return url.toString()
}

function databaseWithCredentials(input: string, database: string, user: string, password: string) {
  const url = new URL(input)
  url.pathname = `/${database}`
  url.username = user
  url.password = password
  return url.toString()
}

function identifier(value: string) {
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(value)) throw new Error('Unsafe PostgreSQL identifier')
  return `"${value}"`
}

function literal(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function configureTestEnv() {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_PUBLIC_API_URL = 'https://api.test.modula.digital'
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital'
  process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'greenfield-module-owned-backend-test-key'
}
