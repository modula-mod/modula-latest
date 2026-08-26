import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldDataLedgerService} from '../src/data-ledger/index.js'
import {projectStandard2Runtime, setStandard2RuntimeStatus} from '../../greenfield-worker/src/modules/standard2-runtime-registration.js'
import {handleModuleUninstall} from '../../greenfield-worker/src/modules/uninstall-handler.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)
const accountA = `data-ledger-account-a-${suffix}`
const accountB = `data-ledger-account-b-${suffix}`
const productId = `test.modula.data-ledger-${suffix}`
const installationId = `installation:${productId}:${accountA}`
const releaseId = `release:${productId}:1.0.0`
const extensionId = `extension:${productId}`
const extensionVersionId = `${productId}@1.0.0`
const moduleVersionId = `module-version:${productId}:1.0.0`
const publisherId = `publisher:data-ledger-${suffix}`

describeIfDb('Greenfield Backend V1 authoritative data ledger', () => {
  let db: ModulaDb
  let ledger: GreenfieldDataLedgerService

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    ledger = new GreenfieldDataLedgerService(db)
    const now = new Date()
    for (const [accountId, handle] of [[accountA, `ledgera${suffix}`], [accountB, `ledgerb${suffix}`]] as const) {
      await db.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: handle, status: 'active', created_at: now, updated_at: now}).execute()
    }
    await db.insertInto('greenfield_publishers').values({
      publisher_id: publisherId,
      display_name: 'Data Ledger Test Publisher',
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
    const manifest = {
      permissions: [],
      contributions: {},
      storageModel: {
        version: '1.0.0',
        items: [{id: `${productId}.declared-records`, kind: 'structured-records', version: '1.0.0', retention: 'retain'}],
      },
      backend: {data: {backupResponsibility: 'greenfield'}},
    }
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
      source_repository: 'modula-mod/test-data-ledger',
      source_commit: 'a'.repeat(40),
      manifest_path: 'manifest.json',
      manifest_sha256: 'b'.repeat(64),
      release_sha256: 'c'.repeat(64),
      signature_key_id: 'test-key',
      signature: 'test-signature',
      compatibility: {},
      license_status: 'firstParty',
      trust_level: 'firstParty',
      product_kind: 'module',
      extension_product: {},
      published_at: now,
      quarantined_at: null,
      revoked_at: null,
      superseded_at: null,
      created_at: now,
      updated_at: now,
    }).execute()
    await db.insertInto('greenfield_extension_installations').values({installation_id: installationId, extension_version_id: extensionVersionId, account_id: accountA, status: 'installedDisabled', config: {}, created_at: now, updated_at: now}).execute()
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('grants all ledger tables to API, worker and backup roles', async () => {
    const tables = [
      'greenfield_data_resources',
      'greenfield_data_resource_owners',
      'greenfield_data_storage_bindings',
      'greenfield_data_schema_versions',
      'greenfield_data_migration_history',
      'greenfield_data_retention_policies',
      'greenfield_data_backup_policies',
    ]
    for (const role of ['modula_api', 'modula_worker']) {
      for (const table of tables) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          const result = await sql<{allowed: boolean}>`SELECT has_table_privilege(${role}, ${`public.${table}`}, ${privilege}) AS allowed`.execute(db)
          expect(result.rows[0]?.allowed, `${role} ${privilege} on ${table}`).toBe(true)
        }
      }
    }
    for (const table of tables) {
      const result = await sql<{allowed: boolean}>`SELECT has_table_privilege('modula_backup', ${`public.${table}`}, 'SELECT') AS allowed`.execute(db)
      expect(result.rows[0]?.allowed, `modula_backup SELECT on ${table}`).toBe(true)
    }
  })

  it('projects declared storage, registers dynamic resources, versions schemas and preserves truthful deletion state', async () => {
    await projectStandard2Runtime(db as any, {
      installationId,
      accountId: accountA,
      moduleId: productId,
      releaseId,
      status: 'disabled',
      jobsPaused: true,
    })
    let listed = await ledger.list(accountA, productId)
    expect(listed.items).toHaveLength(1)
    expect(listed.items[0]).toMatchObject({
      resourceKey: `${productId}.declared-records`,
      lifecycleState: 'DISABLED',
      primaryStorageMode: 'greenfield-records',
      retentionPolicy: {mode: 'RETAIN'},
      backupPolicy: {responsibility: 'GREENFIELD', mode: 'MANAGED'},
    })

    await setStandard2RuntimeStatus(db as any, {
      installationId,
      accountId: accountA,
      moduleId: productId,
      releaseId,
      action: 'enable',
      status: 'registered',
      jobsPaused: false,
    })
    expect((await ledger.get(accountA, productId, listed.items[0]!.resourceId)).lifecycleState).toBe('ACTIVE')

    const registered = await ledger.register(accountA, productId, {
      resourceKey: `${productId}.customer-records`,
      schemaId: `${productId}.customer-records`,
      schemaVersion: '1.0.0',
      schemaDefinitionSha256: 'd'.repeat(64),
      schemaCompatibility: 'FULL',
      primaryStorageMode: 'greenfield-records',
      storageBindings: [{storageMode: 'greenfield-records', locatorRef: `greenfield://records/${installationId}/customers`}],
      retention: {mode: 'RETAIN', policyVersion: '1.0.0'},
      backup: {responsibility: 'GREENFIELD', mode: 'MANAGED'},
      exportHandler: `${productId}.data.export`,
      deleteHandler: `${productId}.data.delete`,
      encryptionClassification: 'private',
      idempotencyKey: `register-customers-${suffix}`,
    })
    const retried = await ledger.register(accountA, productId, {
      resourceKey: `${productId}.customer-records`,
      schemaId: `${productId}.customer-records`,
      schemaVersion: '1.0.0',
      schemaDefinitionSha256: 'd'.repeat(64),
      schemaCompatibility: 'FULL',
      primaryStorageMode: 'greenfield-records',
      storageBindings: [{storageMode: 'greenfield-records', locatorRef: `greenfield://records/${installationId}/customers`}],
      retention: {mode: 'RETAIN', policyVersion: '1.0.0'},
      backup: {responsibility: 'GREENFIELD', mode: 'MANAGED'},
      exportHandler: `${productId}.data.export`,
      deleteHandler: `${productId}.data.delete`,
      encryptionClassification: 'private',
      idempotencyKey: `register-customers-${suffix}`,
    })
    expect(retried.resourceId).toBe(registered.resourceId)

    await expect(ledger.get(accountB, productId, registered.resourceId)).rejects.toMatchObject({code: 'NOT_FOUND'})
    await ledger.declareSchemaVersion(accountA, productId, registered.resourceId, {
      schemaId: `${productId}.customer-records`,
      version: '2.0.0',
      definitionSha256: 'e'.repeat(64),
      compatibility: 'BACKWARD',
    })
    const migration = await ledger.recordMigration(accountA, productId, registered.resourceId, {
      migrationId: `${productId}.customer-records.1-to-2`,
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      migrationSha256: 'f'.repeat(64),
      reversible: true,
      state: 'SUCCEEDED',
      attempt: 1,
      auditRef: `audit:test:${suffix}`,
      startedAt: new Date(),
      finishedAt: new Date(),
    })
    expect(migration).toMatchObject({state: 'SUCCEEDED', toVersion: '2.0.0'})
    expect((await ledger.get(accountA, productId, registered.resourceId)).schemaVersion).toBe('2.0.0')

    const dedicated = await ledger.register(accountA, productId, {
      resourceKey: `${productId}.dedicated-records`,
      schemaId: `${productId}.dedicated-records`,
      schemaVersion: '1.0.0',
      schemaDefinitionSha256: '1'.repeat(64),
      primaryStorageMode: 'dedicated-postgres',
      storageBindings: [{
        storageMode: 'dedicated-postgres',
        locatorRef: `postgres://binding/${suffix}`,
        credentialRef: `secret://product/${productId}/database`,
      }],
      retention: {mode: 'DELETE_ON_UNINSTALL', policyVersion: '1.0.0'},
      backup: {responsibility: 'PRODUCT_SERVICE', mode: 'DECLARED'},
      exportHandler: `${productId}.data.export`,
      deleteHandler: `${productId}.data.delete`,
      encryptionClassification: 'restricted',
      idempotencyKey: `register-dedicated-${suffix}`,
    })

    await handleModuleUninstall(db as any, {installationId, moduleId: productId, dataRetentionChoice: 'deleteData'})
    expect((await ledger.get(accountA, productId, registered.resourceId)).lifecycleState).toBe('DELETED')
    expect((await ledger.get(accountA, productId, dedicated.resourceId)).lifecycleState).toBe('DELETE_PENDING')
    listed = await ledger.list(accountA, productId)
    expect(listed.items).toHaveLength(3)
  })

  it('rejects scope forgery, arbitrary storage URLs and plaintext-secret metadata', async () => {
    await expect(db.insertInto('greenfield_data_resources').values({
      resource_id: `forged-resource:${suffix}`,
      resource_key: `${productId}.forged`,
      owner_account_id: accountB,
      product_id: productId,
      installation_id: installationId,
      release_id: releaseId,
      schema_id: `${productId}.forged`,
      schema_version: '1.0.0',
      primary_storage_mode: 'greenfield-records',
      backend_service_id: null,
      export_handler: `${productId}.data.export`,
      delete_handler: `${productId}.data.delete`,
      encryption_classification: 'private',
      lifecycle_state: 'ACTIVE',
      idempotency_key: `forged-${suffix}`,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    }).execute()).rejects.toMatchObject({code: '23514'})

    await expect(ledger.register(accountA, productId, {
      resourceKey: `${productId}.unsafe-url`,
      schemaId: `${productId}.unsafe-url`,
      schemaVersion: '1.0.0',
      primaryStorageMode: 'external-service',
      storageBindings: [{storageMode: 'external-service', serviceId: 'unsafe-service', locatorRef: 'https://attacker.example/data'}],
      retention: {mode: 'RETAIN', policyVersion: '1.0.0'},
      backup: {responsibility: 'EXTERNAL_PROVIDER', mode: 'EXTERNAL'},
      exportHandler: `${productId}.data.export`,
      deleteHandler: `${productId}.data.delete`,
      encryptionClassification: 'private',
      idempotencyKey: `unsafe-url-${suffix}`,
    })).rejects.toMatchObject({code: 'VALIDATION_FAILED'})

    await expect(ledger.register(accountA, productId, {
      resourceKey: `${productId}.unsafe-secret`,
      schemaId: `${productId}.unsafe-secret`,
      schemaVersion: '1.0.0',
      primaryStorageMode: 'object-storage',
      storageBindings: [{storageMode: 'object-storage', locatorRef: `object://binding/${suffix}`, metadata: {apiKey: 'sk-plaintext-forbidden'}}],
      retention: {mode: 'RETAIN', policyVersion: '1.0.0'},
      backup: {responsibility: 'EXTERNAL_PROVIDER', mode: 'EXTERNAL'},
      exportHandler: `${productId}.data.export`,
      deleteHandler: `${productId}.data.delete`,
      encryptionClassification: 'sensitive',
      idempotencyKey: `unsafe-secret-${suffix}`,
    })).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
  })
})
