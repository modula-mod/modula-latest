import {createHash, randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {sql} from 'kysely'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldAccountDataService} from '../src/account-data/service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
const accountA = `account-data-a-${suffix}`
const accountB = `account-data-b-${suffix}`
const accountDelete = `account-data-delete-${suffix}`
const accountHold = `account-data-hold-${suffix}`
const productId = `test.modula.account-data-${suffix}`
const extensionId = `extension:${productId}`
const extensionVersionId = `${productId}@1.0.0`
const moduleVersionId = `module-version:${productId}:1.0.0`
const releaseId = `release:${productId}:1.0.0`
const publisherId = `publisher:account-data-${suffix}`

describeIfDb('Greenfield Backend V1 account export and deletion orchestration', () => {
  let db: ModulaDb
  let service: GreenfieldAccountDataService

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    service = new GreenfieldAccountDataService(db)
    const now = new Date()
    await db.insertInto('greenfield_accounts').values([
      {account_id: accountA, primary_handle: `accountdataa${suffix}`, status: 'active', created_at: now, updated_at: now},
      {account_id: accountB, primary_handle: `accountdatab${suffix}`, status: 'active', created_at: now, updated_at: now},
      {account_id: accountDelete, primary_handle: `accountdatad${suffix}`, status: 'active', created_at: now, updated_at: now},
      {account_id: accountHold, primary_handle: `accountdatah${suffix}`, status: 'active', created_at: now, updated_at: now},
    ]).execute()
    await seedProduct(now)
    await seedResources(accountA, false, now)
    await seedResources(accountHold, true, now)
  })

  afterAll(async () => db?.destroy())

  it('exports real core and record data, excludes connector credentials and waits for scoped product artifacts', async () => {
    const connectionId = `connection:${suffix}`
    await db.insertInto('greenfield_connector_providers').values({
      provider_id: `fixture-${suffix}`, display_name: 'Fixture', provider_type: 'generic', connector_kinds: jsonb([]), capabilities: jsonb([]), authorisation_method: 'oauth2', required_configuration: jsonb([]),
      configured_status: 'configured', availability_status: 'available', health_status: 'healthy', icon_ref: 'fixture', privacy_summary: 'Test only', data_access_summary: 'Test only',
      supported_actions: jsonb([]), sync_support: jsonb({}), webhook_support: jsonb({}), rate_limit_policy: jsonb({}), adapter_trusted: true, operational: true, created_at: new Date(), updated_at: new Date(),
    }).execute()
    await db.insertInto('greenfield_connections').values({
      connection_id: connectionId, account_id: accountA, provider_id: `fixture-${suffix}`, display_name: 'Fixture connection', external_account_id: 'fixture-owner', external_account_label: 'owner@example.test', external_identity_metadata: {},
      state: 'connected', enabled: true, health_status: 'healthy', health_checked_at: new Date(), health_reason_code: null, connected_at: new Date(), last_refreshed_at: null,
      last_used_at: null, expires_at: null, revoked_at: null, revocation_reason: null, revoked_by: null, revocation_metadata: {}, failure_code: null, last_transition_idempotency_key: null,
      created_at: new Date(), updated_at: new Date(),
    }).execute()
    await db.insertInto('greenfield_connection_credentials').values({
      credential_id: `credential:${suffix}`, connection_id: connectionId, key_version: 'test-v1', encryption_algorithm: 'AES-256-GCM', nonce: Buffer.alloc(12), auth_tag: Buffer.alloc(16),
      encrypted_payload: Buffer.from('ciphertext-not-exportable'), encrypted_access_token: null, encrypted_refresh_token: Buffer.from('legacy-ciphertext-not-exportable'), encrypted_auxiliary_data: null,
      token_type: 'Bearer', expires_at: null, created_at: new Date(), updated_at: new Date(),
    }).execute()

    const request = await service.requestExport(accountA, `export-${suffix}`)
    await expect(service.get(accountB, request.data_request_id)).rejects.toMatchObject({code: 'NOT_FOUND'})
    const collecting = await service.advance(accountA, request.data_request_id)
    expect(collecting.request.state).toBe('COLLECTING')
    expect(collecting.domains.filter(domain => domain.state === 'SUCCEEDED')).toHaveLength(2)
    expect(await service.claimServiceDomains({accountId: accountA, productId: `other.${productId}`, installationId: installation(accountA), serviceId: 'service.wrong'}, 'EXPORT')).toEqual([])

    const firstClaim = await service.claimServiceDomains(context(accountA, 'service.first'), 'EXPORT')
    expect(firstClaim).toHaveLength(1)
    await db.updateTable('greenfield_account_data_request_domains').set({claim_expires_at: new Date(0)}).where('data_request_domain_id', '=', firstClaim[0]!.domainId).execute()
    const reclaimed = await service.claimServiceDomains(context(accountA, 'service.recovered'), 'EXPORT')
    expect(reclaimed.map(domain => domain.domainId)).toEqual([firstClaim[0]!.domainId])
    await expect(service.completeServiceDomain(context(accountA, 'service.recovered'), reclaimed[0]!.domainId, 'DELETE', {state: 'SUCCEEDED'})).rejects.toMatchObject({code: 'FORBIDDEN'})
    await service.completeServiceDomain(context(accountA, 'service.recovered'), reclaimed[0]!.domainId, 'EXPORT', {
      state: 'SUCCEEDED', artifactRef: `artifact://exports/${suffix}`, sha256: 'a'.repeat(64), mediaType: 'application/json', byteLength: 128,
    })

    const result = await service.get(accountA, request.data_request_id)
    expect(result.request.state).toBe('READY')
    const artifacts = await service.artifacts(accountA, request.data_request_id)
    expect(artifacts.artifacts).toHaveLength(3)
    const core = artifacts.artifacts.find(artifact => artifact.domainKey === 'greenfield.core')!
    expect(core.payload).toMatchObject({account: {account_id: accountA}, connections: [{connection_id: connectionId}]})
    expect(JSON.stringify(core.payload)).not.toContain('ciphertext-not-exportable')
    expect(JSON.stringify(core.payload)).not.toContain('encrypted_value')
    expect(core.sha256).toBe(createHash('sha256').update(canonicalJsonStringify(core.payload)).digest('hex'))
    const records = artifacts.artifacts.find(artifact => artifact.domainKey.includes('records'))!
    expect(records.payload).toMatchObject({records: [{data: {title: 'Private export fixture'}}]})
    expect(records.payload.records[0]).not.toHaveProperty('account_id')
    expect(result.request.integrity_manifest).toMatchObject({requestType: 'EXPORT'})
  })

  it('requires explicit recent step-up, enforces the retention window and completes deletion with a tombstone', async () => {
    await expect(service.requestDeletion(accountDelete, `delete-unconfirmed-${suffix}`, {at: new Date(), strength: 'strong'}, false)).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    await expect(service.requestDeletion(accountDelete, `delete-stale-${suffix}`, {at: new Date(0), strength: 'strong'}, true)).rejects.toMatchObject({code: 'FORBIDDEN'})
    const request = await service.requestDeletion(accountDelete, `delete-${suffix}`, {at: new Date(), strength: 'strong'}, true)
    await expect(service.advance(accountDelete, request.data_request_id)).rejects.toMatchObject({code: 'CONFLICT'})
    await db.updateTable('greenfield_account_data_requests').set({not_before: new Date(0)}).where('data_request_id', '=', request.data_request_id).execute()
    const completed = await service.advance(accountDelete, request.data_request_id)
    expect(completed.request.state).toBe('COMPLETED')
    expect((await db.selectFrom('greenfield_accounts').select('status').where('account_id', '=', accountDelete).executeTakeFirstOrThrow()).status).toBe('deleted')
    expect(await db.selectFrom('greenfield_account_deletion_tombstones').selectAll().where('account_id', '=', accountDelete).executeTakeFirst()).toBeTruthy()
    expect(await db.selectFrom('greenfield_domain_events').selectAll().where('event_type', '=', 'account.deleted.v1').where('account_id', '=', accountDelete).executeTakeFirst()).toBeTruthy()
  })

  it('retains held product data while deleting only the owning account domain', async () => {
    const request = await service.requestDeletion(accountHold, `delete-hold-${suffix}`, {at: new Date(), strength: 'phishing_resistant'}, true)
    await db.updateTable('greenfield_account_data_requests').set({not_before: new Date(0)}).where('data_request_id', '=', request.data_request_id).execute()
    const completed = await service.advance(accountHold, request.data_request_id)
    expect(completed.request.state).toBe('COMPLETED')
    expect(completed.domains.find(domain => domain.domain_key.includes('records'))).toMatchObject({state: 'RETAINED', retention_decision: 'RETAIN_LEGAL_HOLD'})
    expect(await db.selectFrom('greenfield_module_records').select('deleted_at').where('account_id', '=', accountHold).executeTakeFirstOrThrow()).toMatchObject({deleted_at: null})
    expect(await db.selectFrom('greenfield_data_resources').select('lifecycle_state').where('owner_account_id', '=', accountHold).executeTakeFirstOrThrow()).toMatchObject({lifecycle_state: 'RETAINED'})
    expect((await db.selectFrom('greenfield_accounts').select('status').where('account_id', '=', accountA).executeTakeFirstOrThrow()).status).toBe('active')
  })

  async function seedProduct(now: Date) {
    const manifest = {permissions: [], contributions: {}, backend: {data: {backupResponsibility: 'greenfield'}}}
    await db.insertInto('greenfield_publishers').values({publisher_id: publisherId, display_name: 'Account Data Fixture', website: null, status: 'verified', trust_level: 'firstParty', created_at: now, updated_at: now, verified_at: now, suspended_at: null, revoked_at: null}).execute()
    await db.insertInto('greenfield_extensions').values({extension_id: extensionId, slug: productId, publisher_account_id: null, status: 'published', created_at: now, updated_at: now}).execute()
    await db.insertInto('greenfield_extension_versions').values({extension_version_id: extensionVersionId, extension_id: extensionId, version: '1.0.0', manifest, status: 'published', created_at: now}).execute()
    await db.insertInto('greenfield_module_versions').values({module_version_id: moduleVersionId, extension_version_id: extensionVersionId, module_id: productId, version: '1.0.0', publisher_id: publisherId, manifest, status: 'published', created_at: now, updated_at: now}).execute()
    await db.insertInto('greenfield_module_releases').values({release_id: releaseId, module_version_id: moduleVersionId, extension_id: extensionId, extension_version_id: extensionVersionId, module_id: productId, version: '1.0.0', publisher_id: publisherId, release_state: 'published', source_repository: 'modula-mod/account-data-fixture', source_commit: 'a'.repeat(40), manifest_path: 'manifest.json', manifest_sha256: 'b'.repeat(64), release_sha256: 'c'.repeat(64), signature_key_id: 'test-key', signature: 'test-signature', compatibility: {}, license_status: 'firstParty', trust_level: 'firstParty', product_kind: 'module', extension_product: {}, published_at: now, quarantined_at: null, revoked_at: null, superseded_at: null, created_at: now, updated_at: now}).execute()
    for (const accountId of [accountA, accountHold]) await db.insertInto('greenfield_extension_installations').values({installation_id: installation(accountId), extension_version_id: extensionVersionId, account_id: accountId, status: 'enabled', config: {}, created_at: now, updated_at: now}).execute()
  }

  async function seedResources(accountId: string, legalHold: boolean, now: Date) {
    const recordsId = `resource:records:${accountId}`
    await db.insertInto('greenfield_data_resources').values({resource_id: recordsId, resource_key: `${productId}.records`, owner_account_id: accountId, product_id: productId, installation_id: installation(accountId), release_id: releaseId, schema_id: `${productId}.records`, schema_version: '1.0.0', primary_storage_mode: 'greenfield-records', backend_service_id: null, export_handler: `${productId}.data.export`, delete_handler: `${productId}.data.delete`, encryption_classification: 'private', lifecycle_state: 'ACTIVE', idempotency_key: `records-${accountId}`, created_at: now, updated_at: now, deleted_at: null}).execute()
    await db.insertInto('greenfield_data_retention_policies').values({retention_policy_id: `retention:${recordsId}`, resource_id: recordsId, mode: legalHold ? 'LEGAL_HOLD' : 'DELETE_ON_UNINSTALL', ttl_days: null, legal_hold: legalHold, policy_version: '1.0.0', metadata: {}, created_at: now, updated_at: now}).execute()
    await db.insertInto('greenfield_module_records').values({record_id: `record:${accountId}`, account_id: accountId, module_id: productId, installation_id: installation(accountId), collection: 'entry', schema_ref: `${productId}.records.v1`, visibility: 'private', data: {title: legalHold ? 'Held fixture' : 'Private export fixture'}, search_text: 'fixture', folder_ref: null, source_uri: null, retained_after_uninstall: false, revision: 1, created_at: now, updated_at: now, deleted_at: null}).execute()
    if (!legalHold) {
      const externalId = `resource:external:${accountId}`
      await db.insertInto('greenfield_data_resources').values({resource_id: externalId, resource_key: `${productId}.external`, owner_account_id: accountId, product_id: productId, installation_id: installation(accountId), release_id: releaseId, schema_id: `${productId}.external`, schema_version: '1.0.0', primary_storage_mode: 'dedicated-postgres', backend_service_id: `service.${productId}.backend`, export_handler: `${productId}.data.export`, delete_handler: `${productId}.data.delete`, encryption_classification: 'restricted', lifecycle_state: 'ACTIVE', idempotency_key: `external-${accountId}`, created_at: now, updated_at: now, deleted_at: null}).execute()
      await db.insertInto('greenfield_data_retention_policies').values({retention_policy_id: `retention:${externalId}`, resource_id: externalId, mode: 'DELETE_ON_UNINSTALL', ttl_days: null, legal_hold: false, policy_version: '1.0.0', metadata: {}, created_at: now, updated_at: now}).execute()
    }
  }
})

function installation(accountId: string) { return `installation:${productId}:${accountId}` }
function context(accountId: string, serviceId: string) { return {accountId, productId, installationId: installation(accountId), serviceId} }
function jsonb(value: unknown) { return sql<unknown>`${JSON.stringify(value)}::jsonb` }
