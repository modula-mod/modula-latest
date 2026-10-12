import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql, type Kysely} from 'kysely'
import {manifestChecksum, type GreenfieldModuleManifestV1} from '@modula/greenfield-module-manifest'
import type {GreenfieldModuleCollectionDefinition} from '@modula/greenfield-module-ui-contracts'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import type {Database} from '../src/database/types.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldModuleMediaBindingService} from '../src/modules/media-binding-service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

describeIf('MODULE-PLATFORM-02B media binding and record sharing', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let owner: AccountFixture
  let recipient: AccountFixture
  let module: ModuleFixture
  let suffix = ''
  let recordId = ''
  let registrationIndex = 10

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES = 'true'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4025'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4025'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    process.env.MODULA_TRUST_PROXY = 'true'
    process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'mp02b-media-sharing-cursor-key'
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    suffix = Date.now().toString(36)
    recordId = `record-${suffix}`
    owner = await registerAccount(`mp02b-owner-${suffix}@example.com`, `m2o${suffix}`.slice(0, 20))
    recipient = await registerAccount(`mp02b-recipient-${suffix}@example.com`, `m2r${suffix}`.slice(0, 20))
    module = await seedModule(db, [owner.accountId, recipient.accountId], `audit.module.alpha-${suffix}`)
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('binds, lists, reorders, updates and unbinds media without granting foreign access', async () => {
    await createRecord(recordId, 'Owner record')
    await seedAttachment(owner.accountId, `asset-a-${suffix}`, 'a.png')
    await seedAttachment(owner.accountId, `asset-b-${suffix}`, 'b.png')

    const foreign = await request(recipient.token, 'POST', `/v1/modules/${module.moduleId}/records/item/${recordId}/media`, {assetId: `asset-a-${suffix}`})
    expect(foreign.statusCode).toBe(404)

    const first = await request(owner.token, 'POST', `/v1/modules/${module.moduleId}/records/item/${recordId}/media`, {assetId: `asset-a-${suffix}`, order: 0, caption: 'First'})
    const second = await request(owner.token, 'POST', `/v1/modules/${module.moduleId}/records/item/${recordId}/media`, {assetId: `asset-b-${suffix}`, order: 1})
    expect(first.statusCode).toBe(201)
    expect(second.statusCode).toBe(201)
    const firstId = first.json().data.bindingId as string
    const secondId = second.json().data.bindingId as string

    const listed = await request(owner.token, 'GET', `/v1/modules/${module.moduleId}/records/item/${recordId}/media`)
    expect(listed.json().data.bindings.map((item: {assetId: string}) => item.assetId)).toEqual([`asset-a-${suffix}`, `asset-b-${suffix}`])

    const reordered = await request(owner.token, 'PUT', `/v1/modules/${module.moduleId}/records/item/${recordId}/media/order`, {bindings: [{bindingId: firstId, order: 1}, {bindingId: secondId, order: 0}]})
    expect(reordered.statusCode).toBe(200)
    const metadata = await request(owner.token, 'PATCH', `/v1/modules/${module.moduleId}/records/item/${recordId}/media/${firstId}`, {caption: 'Updated', role: 'cover'})
    expect(metadata.json().data).toEqual(expect.objectContaining({caption: 'Updated', role: 'cover'}))
    const unbound = await request(owner.token, 'DELETE', `/v1/modules/${module.moduleId}/records/item/${recordId}/media/${secondId}`)
    expect(unbound.json().data.unbound).toBe(true)

    const sync = await request(owner.token, 'GET', `/v1/modules/${module.moduleId}/records/sync`)
    expect(sync.json().data.resourceChanges.map((item: {operation: string}) => item.operation)).toEqual(expect.arrayContaining(['bind', 'reorder', 'metadata', 'unbind']))
  })

  it('enforces read, edit, history actor, shared-editor media, revoke and expiry visibility loss', async () => {
    const share = await request(owner.token, 'POST', `/v1/modules/${module.moduleId}/records/item/${recordId}/shares`, {
      mutationId: `share-${suffix}`, recipientAccountId: recipient.accountId, permission: 'read',
    })
    expect(share.statusCode).toBe(201)
    const shareId = share.json().data.shareId as string
    const replay = await request(owner.token, 'POST', `/v1/modules/${module.moduleId}/records/item/${recordId}/shares`, {
      mutationId: `share-${suffix}`, recipientAccountId: recipient.accountId, permission: 'read',
    })
    expect(replay.json().data.shareId).toBe(shareId)
    const conflict = await request(owner.token, 'POST', `/v1/modules/${module.moduleId}/records/item/${recordId}/shares`, {
      mutationId: `share-${suffix}`, recipientAccountId: recipient.accountId, permission: 'edit',
    })
    expect(conflict.json().error.code).toBe('MUTATION_REUSE_CONFLICT')

    expect((await request(recipient.token, 'GET', `/v1/modules/${module.moduleId}/record-shares/${shareId}`)).statusCode).toBe(200)
    expect((await request(recipient.token, 'PATCH', `/v1/modules/${module.moduleId}/record-shares/${shareId}/record`, {
      mutationId: `recipient-denied-${suffix}`, expectedRevision: 1, data: {title: 'Denied'},
    })).statusCode).toBe(404)

    expect((await request(owner.token, 'PATCH', `/v1/modules/${module.moduleId}/record-shares/${shareId}`, {permission: 'edit'})).statusCode).toBe(200)
    const edited = await request(recipient.token, 'PATCH', `/v1/modules/${module.moduleId}/record-shares/${shareId}/record`, {
      mutationId: `recipient-edit-${suffix}`, expectedRevision: 1, data: {title: 'Recipient edit'},
    })
    expect(edited.json().data.revision).toBe(2)
    const history = await request(recipient.token, 'GET', `/v1/modules/${module.moduleId}/record-shares/${shareId}/revisions`)
    expect(history.json().data.revisions).toHaveLength(1)
    expect(history.json().data.revisions[0]).toEqual(expect.objectContaining({revision: 2, actorId: `actor-${recipient.accountId}`}))

    await seedAttachment(recipient.accountId, `asset-shared-${suffix}`, 'shared.png')
    const sharedBind = await request(recipient.token, 'POST', `/v1/modules/${module.moduleId}/records/item/${recordId}/media`, {assetId: `asset-shared-${suffix}`})
    expect(sharedBind.statusCode).toBe(201)
    const binding = await db.selectFrom('greenfield_module_record_media_bindings').selectAll().where('binding_id', '=', sharedBind.json().data.bindingId).executeTakeFirstOrThrow()
    expect(binding.asset_owner_account_id).toBe(recipient.accountId)
    expect(binding.record_owner_account_id).toBe(owner.accountId)

    const beforeRevoke = await request(recipient.token, 'GET', `/v1/modules/${module.moduleId}/records/sync`)
    const cursor = beforeRevoke.json().data.nextCursor as string
    expect((await request(owner.token, 'DELETE', `/v1/modules/${module.moduleId}/record-shares/${shareId}`)).statusCode).toBe(200)
    expect((await request(recipient.token, 'GET', `/v1/modules/${module.moduleId}/record-shares/${shareId}`)).statusCode).toBe(404)
    const revokedSync = await request(recipient.token, 'GET', `/v1/modules/${module.moduleId}/records/sync?after=${encodeURIComponent(cursor)}`)
    expect(revokedSync.json().data.tombstones).toEqual([expect.objectContaining({recordId, reason: 'visibility-lost'})])

    const expiringRecordId = `expiring-${suffix}`
    await createRecord(expiringRecordId, 'Expiring')
    const expiring = await request(owner.token, 'POST', `/v1/modules/${module.moduleId}/records/item/${expiringRecordId}/shares`, {
      mutationId: `expiry-${suffix}`, recipientAccountId: recipient.accountId, permission: 'read', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    await db.updateTable('greenfield_module_record_shares').set({expires_at: new Date(Date.now() - 1_000)}).where('share_id', '=', expiring.json().data.shareId).execute()
    expect((await request(recipient.token, 'GET', `/v1/modules/${module.moduleId}/record-shares/${expiring.json().data.shareId}`)).statusCode).toBe(404)
    const expiredSync = await request(recipient.token, 'GET', `/v1/modules/${module.moduleId}/records/sync`)
    expect(expiredSync.json().data.tombstones).toEqual(expect.arrayContaining([expect.objectContaining({recordId: expiringRecordId, reason: 'visibility-lost'})]))
  })

  it('rolls binding and sharing state back when transactional side effects fail', async () => {
    const failureAsset = `asset-failure-${suffix}`
    await seedAttachment(owner.accountId, failureAsset, 'failure.png')
    await sql.raw(`CREATE FUNCTION mp02b_fail_change_${suffix}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.details->>'bindingId' = 'failure-binding-${suffix}' THEN RAISE EXCEPTION 'controlled media failure'; END IF; RETURN NEW; END $$`).execute(db)
    await sql.raw(`CREATE TRIGGER mp02b_fail_change_${suffix} BEFORE INSERT ON greenfield_module_record_changes FOR EACH ROW EXECUTE FUNCTION mp02b_fail_change_${suffix}()`).execute(db)
    try {
      expect((await request(owner.token, 'POST', `/v1/modules/${module.moduleId}/records/item/${recordId}/media`, {bindingId: `failure-binding-${suffix}`, assetId: failureAsset})).statusCode).toBe(500)
      expect(await db.selectFrom('greenfield_module_record_media_bindings').select('binding_id').where('binding_id', '=', `failure-binding-${suffix}`).executeTakeFirst()).toBeUndefined()
    } finally {
      await sql.raw(`DROP TRIGGER mp02b_fail_change_${suffix} ON greenfield_module_record_changes`).execute(db)
      await sql.raw(`DROP FUNCTION mp02b_fail_change_${suffix}()`).execute(db)
    }

    const failureRecordId = `share-failure-${suffix}`
    await createRecord(failureRecordId, 'Share failure')
    await sql.raw(`CREATE FUNCTION mp02b_fail_audit_${suffix}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type = 'module.record.share.created' AND NEW.resource_id = '${failureRecordId}' THEN RAISE EXCEPTION 'controlled share failure'; END IF; RETURN NEW; END $$`).execute(db)
    await sql.raw(`CREATE TRIGGER mp02b_fail_audit_${suffix} BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION mp02b_fail_audit_${suffix}()`).execute(db)
    try {
      expect((await request(owner.token, 'POST', `/v1/modules/${module.moduleId}/records/item/${failureRecordId}/shares`, {mutationId: `share-failure-${suffix}`, recipientAccountId: recipient.accountId, permission: 'read'})).statusCode).toBe(500)
      expect(await db.selectFrom('greenfield_module_record_shares').select('share_id').where('record_id', '=', failureRecordId).executeTakeFirst()).toBeUndefined()
    } finally {
      await sql.raw(`DROP TRIGGER mp02b_fail_audit_${suffix} ON audit_events`).execute(db)
      await sql.raw(`DROP FUNCTION mp02b_fail_audit_${suffix}()`).execute(db)
    }
  })

  it('fails closed for missing review, disabled installation and production-untrusted release', async () => {
    await db.deleteFrom('greenfield_module_permission_reviews').where('review_id', '=', module.recipientReviewId).execute()
    const missing = await request(recipient.token, 'GET', `/v1/modules/${module.moduleId}/records/shares/received`)
    expect(missing.json().error.code).toBe('PERMISSION_REVIEW_REQUIRED')
    await insertReview(db, recipient.accountId, module.recipientInstallationId, module.releaseId, module.recipientReviewId, module.permissions)
    await db.updateTable('greenfield_extension_installations').set({status: 'disabled'}).where('installation_id', '=', module.recipientInstallationId).execute()
    const disabled = await request(recipient.token, 'GET', `/v1/modules/${module.moduleId}/records/shares/received`)
    expect(disabled.json().error.code).toBe('INSTALLATION_DISABLED')
    await db.updateTable('greenfield_extension_installations').set({status: 'enabled'}).where('installation_id', '=', module.recipientInstallationId).execute()
    const strict = new GreenfieldModuleMediaBindingService(db, {environment: 'production', moduleAllowUntrustedDevelopmentReleases: false})
    await expect(strict.list(owner.accountId, module.moduleId, 'item', recordId)).rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})
  })

  async function registerAccount(email: string, handle: string): Promise<AccountFixture> {
    const password = 'secure-pass-word-1'
    const headers = {'x-forwarded-for': `198.51.100.${registrationIndex++}`}
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register', headers, payload: {email, password, handle, displayName: handle, acceptedTerms: true, inviteCode: 'test-invite'}})
    expect(register.statusCode).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', headers, payload: {token: register.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', headers, payload: {email, password}})
    return {accountId: register.json().data.accountId, token: session.json().data.accessToken}
  }

  async function createRecord(id: string, title: string) {
    const response = await request(owner.token, 'POST', `/v1/modules/${module.moduleId}/records/item`, {mutationId: `create-${id}`, recordId: id, data: {title}})
    expect(response.statusCode).toBe(201)
  }

  async function seedAttachment(accountId: string, attachmentId: string, filename: string) {
    const now = new Date()
    await db.insertInto('attachments').values({attachment_id: attachmentId, owner_account_id: accountId, kind: 'image', mime_type: 'image/png', original_filename: filename, byte_size: '128', checksum: null, storage_key: null, storage_provider: 'local', status: 'ready', width: null, height: null, duration_seconds: null, page_count: null, thumbnail_key: null, preview_key: null, metadata: {}, attached_at: null, created_at: now, updated_at: now}).execute()
  }

  async function request(token: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: unknown) {
    return app.inject({method, url, headers: {authorization: `Bearer ${token}`}, payload})
  }
})

type AccountFixture = {accountId: string; token: string}
type ModuleFixture = {moduleId: string; releaseId: string; recipientInstallationId: string; recipientReviewId: string; permissions: string[]}

async function seedModule(db: Kysely<Database>, accountIds: string[], moduleId: string): Promise<ModuleFixture> {
  const collection = moduleCollection()
  const permissions = [
    ...['read', 'write', 'delete'].map(operation => `records:module.${moduleId}.${collection.collection}:${operation}`),
    ...['read', 'write'].map(operation => `media:module.${moduleId}.${collection.collection}:${operation}`),
    ...['read', 'write'].map(operation => `sharing:module.${moduleId}.${collection.collection}:${operation}`),
  ]
  const manifest = moduleManifest(moduleId, collection, permissions)
  const releases = new GreenfieldModuleReleaseService(db)
  const imported = await releases.importPendingReview(manifest)
  const published = await releases.publishRelease(moduleId, manifest.version)
  await db.insertInto('greenfield_module_record_collections').values({collection_id: `collection:${published.releaseId}:item`, release_id: published.releaseId, module_id: moduleId, collection: 'item', schema_ref: collection.schemaRef, default_visibility: 'private', fields: jsonb(collection.fields), searchable_fields: jsonb(collection.searchableFields), filterable_fields: jsonb([]), sortable_fields: jsonb(collection.sortableFields), folder_field: null, reference_fields: jsonb([]), schema_definition: jsonb({}), retention_policy: 'keepOnUninstall', registration_status: 'registered', created_at: new Date(), updated_at: new Date()}).execute()
  let recipientInstallationId = ''
  let recipientReviewId = ''
  for (const [index, accountId] of accountIds.entries()) {
    const installationId = `mp02b-installation:${moduleId}:${accountId}`
    const reviewId = `mp02b-review:${moduleId}:${accountId}`
    await db.insertInto('greenfield_extension_installations').values({installation_id: installationId, extension_version_id: imported.extensionVersionId, account_id: accountId, status: 'enabled', config: {}, created_at: new Date(), updated_at: new Date()}).execute()
    await insertReview(db, accountId, installationId, published.releaseId, reviewId, permissions)
    if (index === 1) { recipientInstallationId = installationId; recipientReviewId = reviewId }
  }
  return {moduleId, releaseId: published.releaseId, recipientInstallationId, recipientReviewId, permissions}
}

async function insertReview(db: Kysely<Database>, accountId: string, installationId: string, releaseId: string, reviewId: string, permissions: string[]) {
  await db.insertInto('greenfield_module_permission_reviews').values({review_id: reviewId, installation_id: installationId, release_id: releaseId, account_id: accountId, granted_permissions: jsonb(permissions), denied_permissions: jsonb([]), high_risk_increase: false, idempotency_key: `review:${reviewId}`, reviewed_at: new Date()}).execute()
}

function moduleManifest(moduleId: string, collection: GreenfieldModuleCollectionDefinition, permissions: string[]): GreenfieldModuleManifestV1 {
  const manifest: GreenfieldModuleManifestV1 = {manifestVersion: 1, moduleId, name: moduleId, description: 'Synthetic MP02B media/sharing fixture.', version: '1.0.0', publisher: {publisherId: 'audit', displayName: 'Audit Fixtures'}, source: {provider: 'github', repository: `modula-mod/${moduleId.replaceAll('.', '-')}`, commit: '0123456789abcdef0123456789abcdef01234567', manifestPath: 'module.manifest.json'}, license: {status: 'firstParty', evidenceIds: ['mp02b-synthetic-fixture']}, trust: {requestedLevel: 'firstParty'}, compatibility: {minimumGreenfieldVersion: '0.1.0', minimumModulaHostVersion: '0.1.0', protocolVersions: ['greenfield.v1'], platforms: ['server', 'web', 'ios', 'android']}, permissions: permissions.map(permission => ({permission, reason: 'Synthetic MP02B acceptance', risk: 'medium'})), contributions: {schemas: [{id: `${moduleId}.schemas.item`, title: 'item', schemaRef: collection.schemaRef, collection: 'item', defaultVisibility: 'private'}]}, extensions: {}, integrity: {manifestSha256: 'a'.repeat(64), releaseSha256: 'b'.repeat(64)}}
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

function moduleCollection(): GreenfieldModuleCollectionDefinition {
  return {collection: 'item', schemaRef: 'schemas/audit-alpha-item.v1.schema.json', defaultVisibility: 'private', fields: [{fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true}], searchableFields: ['title'], filterableFields: [], sortableFields: ['createdAt', 'updatedAt', 'title'], referenceFields: [], retentionPolicy: 'keepOnUninstall'}
}
