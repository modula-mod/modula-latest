import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql, type Kysely} from 'kysely'
import {manifestChecksum, type GreenfieldModuleManifestV1} from '@modula/greenfield-module-manifest'
import type {GreenfieldModuleCollectionDefinition} from '@modula/greenfield-module-ui-contracts'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import type {Database} from '../src/database/types.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

describeIf('MODULE-PLATFORM-02 generic records', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let token = ''
  let accountId = ''
  let alpha: ModuleFixture
  let beta: ModuleFixture
  let alphaRecordId = ''
  let betaRecordId = ''

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES = 'true'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4024'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4024'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'mp02-records-test-cursor-signing-key'
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()

    const suffix = Date.now().toString(36)
    alphaRecordId = `alpha-${suffix}`
    betaRecordId = `beta-${suffix}`
    const account = await registerAccount(`mp02-${suffix}@example.com`, `mp02${suffix}`.slice(0, 20))
    token = account.token
    accountId = account.accountId
    alpha = await seedModule(db, accountId, `audit.module.alpha-${suffix}`, alphaCollection())
    beta = await seedModule(db, accountId, `audit.module.beta-${suffix}`, betaCollection())
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('provides idempotent OCC mutations, secure references, history, restore, and cursor sync', async () => {
    const betaCreate = await request('POST', `/v1/modules/${beta.moduleId}/records/entity`, {
      mutationId: 'beta-create-1',
      recordId: betaRecordId,
      data: {title: 'Beta target'},
    })
    expect(betaCreate.statusCode).toBe(201)
    expect(betaCreate.json().data.revision).toBe(1)

    const alphaPayload = {
      mutationId: 'alpha-create-1',
      recordId: alphaRecordId,
      data: {
        title: 'Alpha source',
        link: {record: {moduleId: beta.moduleId, recordType: 'entity', recordId: betaRecordId}},
      },
    }
    const alphaCreate = await request('POST', `/v1/modules/${alpha.moduleId}/records/item`, alphaPayload)
    expect(alphaCreate.statusCode).toBe(201)
    expect(alphaCreate.json().data.revision).toBe(1)

    const replay = await request('POST', `/v1/modules/${alpha.moduleId}/records/item`, alphaPayload)
    expect(replay.statusCode).toBe(201)
    expect(replay.json().data.record_id).toBe(alphaRecordId)
    expect(await mutationCount(db, alpha.installationId, 'alpha-create-1')).toBe(1)

    const mutationConflict = await request('POST', `/v1/modules/${alpha.moduleId}/records/item`, {
      ...alphaPayload,
      data: {...alphaPayload.data, title: 'Different payload'},
    })
    expect(mutationConflict.statusCode).toBe(409)
    expect(mutationConflict.json().error.code).toBe('MUTATION_REUSE_CONFLICT')

    const forward = await request('GET', `/v1/modules/${alpha.moduleId}/records/item/${alphaRecordId}/references?fieldPath=link`)
    expect(forward.statusCode).toBe(200)
    expect(forward.json().data.references).toEqual([
      {fieldPath: 'link', ordinal: 0, record: {moduleId: beta.moduleId, recordType: 'entity', recordId: betaRecordId}},
    ])

    const reverse = await request('GET', `/v1/modules/${beta.moduleId}/records/entity/${betaRecordId}/reverse-references?fieldPath=link`)
    expect(reverse.statusCode).toBe(200)
    expect(reverse.json().data.references[0].source).toEqual({moduleId: alpha.moduleId, recordType: 'item', recordId: alphaRecordId})

    await setGrantedPermissions(db, alpha, [])
    const hiddenReverse = await request('GET', `/v1/modules/${beta.moduleId}/records/entity/${betaRecordId}/reverse-references`)
    expect(hiddenReverse.statusCode).toBe(200)
    expect(hiddenReverse.json().data.references).toEqual([])
    await setGrantedPermissions(db, alpha, alpha.permissions)

    const update = await request('PATCH', `/v1/modules/${alpha.moduleId}/records/item/${alphaRecordId}`, {
      mutationId: 'alpha-update-1',
      expectedRevision: 1,
      data: {title: 'Alpha second'},
    })
    expect(update.statusCode).toBe(200)
    expect(update.json().data.revision).toBe(2)

    const concurrent = await Promise.all([
      request('PATCH', `/v1/modules/${alpha.moduleId}/records/item/${alphaRecordId}`, {
        mutationId: 'alpha-update-race-a', expectedRevision: 2, data: {title: 'Race A'},
      }),
      request('PATCH', `/v1/modules/${alpha.moduleId}/records/item/${alphaRecordId}`, {
        mutationId: 'alpha-update-race-b', expectedRevision: 2, data: {title: 'Race B'},
      }),
    ])
    expect(concurrent.map(response => response.statusCode).sort()).toEqual([200, 409])
    expect(concurrent.find(response => response.statusCode === 409)?.json().error.code).toBe('REVISION_CONFLICT')

    const history = await request('GET', `/v1/modules/${alpha.moduleId}/records/item/${alphaRecordId}/revisions`)
    expect(history.statusCode).toBe(200)
    expect(history.json().data.revisions.map((revision: {revision: number}) => revision.revision)).toEqual([3, 2, 1])

    const restore = await request('POST', `/v1/modules/${alpha.moduleId}/records/item/${alphaRecordId}/restore`, {
      mutationId: 'alpha-restore-1', expectedRevision: 3, sourceRevision: 1,
    })
    expect(restore.statusCode).toBe(200)
    expect(restore.json().data.revision).toBe(4)
    expect(restore.json().data.data.title).toBe('Alpha source')

    const restoredRevision = await request('GET', `/v1/modules/${alpha.moduleId}/records/item/${alphaRecordId}/revisions/4`)
    expect(restoredRevision.statusCode).toBe(200)
    expect(restoredRevision.json().data.operation).toBe('restore')
    expect(restoredRevision.json().data.baseRevision).toBe(3)

    const syncBeforeDelete = await request('GET', `/v1/modules/${alpha.moduleId}/records/sync`)
    expect(syncBeforeDelete.statusCode).toBe(200)
    expect(syncBeforeDelete.json().data.changes.length).toBeGreaterThan(0)
    const cursor = syncBeforeDelete.json().data.nextCursor as string

    const deleted = await request('DELETE', `/v1/modules/${alpha.moduleId}/records/item/${alphaRecordId}`, {
      mutationId: 'alpha-delete-1', expectedRevision: 4,
    })
    expect(deleted.statusCode).toBe(200)
    expect(deleted.json().data).toEqual({deleted: true, recordId: alphaRecordId, revision: 5})

    const delta = await request('GET', `/v1/modules/${alpha.moduleId}/records/sync?after=${encodeURIComponent(cursor)}`)
    expect(delta.statusCode).toBe(200)
    expect(delta.json().data.changes).toEqual([])
    expect(delta.json().data.tombstones).toEqual([
      expect.objectContaining({moduleId: alpha.moduleId, recordType: 'item', recordId: alphaRecordId, revision: 5}),
    ])

    const invalidCursor = await request('GET', `/v1/modules/${beta.moduleId}/records/sync?after=${encodeURIComponent(cursor)}`)
    expect(invalidCursor.statusCode).toBe(400)
    expect(invalidCursor.json().error.code).toBe('INVALID_CURSOR')
  })

  async function registerAccount(email: string, handle: string) {
    const password = 'secure-pass-word-1'
    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, displayName: 'MP02 Records User', acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(session.statusCode).toBe(200)
    return {accountId: register.json().data.accountId as string, token: session.json().data.accessToken as string}
  }

  async function request(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) {
    return app.inject({method, url, headers: {authorization: `Bearer ${token}`}, payload})
  }
})

type ModuleFixture = {
  moduleId: string
  releaseId: string
  installationId: string
  reviewId: string
  permissions: string[]
}

async function seedModule(
  db: Kysely<Database>,
  accountId: string,
  moduleId: string,
  collection: GreenfieldModuleCollectionDefinition,
): Promise<ModuleFixture> {
  const permissions = ['read', 'write', 'delete'].map(operation => `records:module.${moduleId}.${collection.collection}:${operation}`)
  const manifest = moduleManifest(moduleId, collection, permissions)
  const releases = new GreenfieldModuleReleaseService(db)
  const imported = await releases.importPendingReview(manifest)
  const published = await releases.publishRelease(moduleId, manifest.version)
  const installationId = `mp02-installation:${moduleId}:${accountId}`
  const reviewId = `mp02-review:${moduleId}:${accountId}`
  await db.insertInto('greenfield_module_record_collections').values({
    collection_id: `collection:${published.releaseId}:${collection.collection}`,
    release_id: published.releaseId,
    module_id: moduleId,
    collection: collection.collection,
    schema_ref: collection.schemaRef,
    default_visibility: collection.defaultVisibility,
    fields: jsonb(collection.fields),
    searchable_fields: jsonb(collection.searchableFields),
    filterable_fields: jsonb(collection.filterableFields),
    sortable_fields: jsonb(collection.sortableFields),
    folder_field: collection.folderField ?? null,
    reference_fields: jsonb(collection.referenceFields ?? []),
    schema_definition: jsonb({}),
    retention_policy: collection.retentionPolicy ?? 'keepOnUninstall',
    registration_status: 'registered',
    created_at: new Date(),
    updated_at: new Date(),
  }).execute()
  await db.insertInto('greenfield_extension_installations').values({
    installation_id: installationId,
    extension_version_id: imported.extensionVersionId,
    account_id: accountId,
    status: 'enabled',
    config: {},
    created_at: new Date(),
    updated_at: new Date(),
  }).execute()
  await db.insertInto('greenfield_module_permission_reviews').values({
    review_id: reviewId,
    installation_id: installationId,
    release_id: published.releaseId,
    account_id: accountId,
    granted_permissions: jsonb(permissions),
    denied_permissions: jsonb([]),
    high_risk_increase: false,
    idempotency_key: `review:${moduleId}`,
    reviewed_at: new Date(),
  }).execute()
  return {moduleId, releaseId: published.releaseId, installationId, reviewId, permissions}
}

async function setGrantedPermissions(db: Kysely<Database>, fixture: ModuleFixture, permissions: string[]): Promise<void> {
  await db.updateTable('greenfield_module_permission_reviews')
    .set({granted_permissions: jsonb(permissions), reviewed_at: new Date()})
    .where('review_id', '=', fixture.reviewId)
    .execute()
}

async function mutationCount(db: Kysely<Database>, installationId: string, mutationId: string): Promise<number> {
  const result = await db.selectFrom('greenfield_module_record_mutations')
    .select(({fn}) => fn.countAll<number>().as('count'))
    .where('installation_id', '=', installationId)
    .where('mutation_id', '=', mutationId)
    .executeTakeFirstOrThrow()
  return Number(result.count)
}

function moduleManifest(
  moduleId: string,
  collection: GreenfieldModuleCollectionDefinition,
  permissions: string[],
): GreenfieldModuleManifestV1 {
  const manifest: GreenfieldModuleManifestV1 = {
    manifestVersion: 1,
    moduleId,
    name: moduleId,
    description: 'Synthetic MODULE-PLATFORM-02 fixture.',
    version: '1.0.0',
    publisher: {publisherId: 'audit', displayName: 'Audit Fixtures'},
    source: {
      provider: 'github',
      repository: `modula-mod/${moduleId.replaceAll('.', '-')}`,
      commit: '0123456789abcdef0123456789abcdef01234567',
      manifestPath: 'module.manifest.json',
    },
    license: {status: 'firstParty', evidenceIds: ['mp02-synthetic-fixture']},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {
      minimumGreenfieldVersion: '0.1.0',
      minimumModulaHostVersion: '0.1.0',
      protocolVersions: ['greenfield.v1'],
      platforms: ['server', 'web', 'ios', 'android'],
    },
    permissions: permissions.map(permission => ({permission, reason: 'Synthetic generic record acceptance', risk: 'medium'})),
    contributions: {
      schemas: [{
        id: `${moduleId}.schemas.${collection.collection}`,
        title: collection.collection,
        schemaRef: collection.schemaRef,
        collection: collection.collection,
        defaultVisibility: 'private',
      }],
    },
    extensions: {},
    integrity: {manifestSha256: 'a'.repeat(64), releaseSha256: 'b'.repeat(64)},
  }
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

function alphaCollection(): GreenfieldModuleCollectionDefinition {
  return {
    collection: 'item',
    schemaRef: 'schemas/audit-alpha-item.v1.schema.json',
    defaultVisibility: 'private',
    fields: [
      {fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true},
      {fieldId: 'link', name: 'link', type: 'recordReference', label: 'Linked record', required: true},
    ],
    searchableFields: ['title'],
    filterableFields: ['link'],
    sortableFields: ['createdAt', 'updatedAt', 'title'],
    referenceFields: ['link'],
    retentionPolicy: 'keepOnUninstall',
  }
}

function betaCollection(): GreenfieldModuleCollectionDefinition {
  return {
    collection: 'entity',
    schemaRef: 'schemas/audit-beta-entity.v1.schema.json',
    defaultVisibility: 'private',
    fields: [{fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true}],
    searchableFields: ['title'],
    filterableFields: [],
    sortableFields: ['createdAt', 'updatedAt', 'title'],
    referenceFields: [],
    retentionPolicy: 'keepOnUninstall',
  }
}
