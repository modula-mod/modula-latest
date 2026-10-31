import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql, type Kysely} from 'kysely'
import {manifestChecksum, type GreenfieldModuleManifestV1} from '@modula/greenfield-module-manifest'
import type {GreenfieldModuleCollectionDefinition} from '@modula/greenfield-module-ui-contracts'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import type {Database} from '../src/database/types.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {createDb as createWorkerDb, type ModulaWorkerDb} from '../../greenfield-worker/src/database.js'
import {loadConfig as loadWorkerConfig} from '../../greenfield-worker/src/config.js'
import {handleModuleUpdate} from '../../greenfield-worker/src/modules/update-handler.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

describeIf('MODULE-PLATFORM-02 generic Tasks records', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let workerDb: ModulaWorkerDb
  let token = ''
  let accountId = ''
  let otherToken = ''
  let alpha: ModuleFixture
  let beta: ModuleFixture
  let alphaRecordId = ''
  let alphaSecondRecordId = ''
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
    workerDb = createWorkerDb(databaseUrl!)
    await app.ready()

    const suffix = Date.now().toString(36)
    alphaRecordId = `alpha-${suffix}`
    alphaSecondRecordId = `alpha-second-${suffix}`
    betaRecordId = `beta-${suffix}`
    const account = await registerAccount(`mp02-${suffix}@example.com`, `mp02${suffix}`.slice(0, 20))
    token = account.token
    accountId = account.accountId
    alpha = await seedModule(db, accountId, `audit.module.tasks-${suffix}`, alphaCollection())
    beta = await seedModule(db, accountId, `audit.module.beta-${suffix}`, betaCollection())
    const other = await registerAccount(`mp02-other-${suffix}@example.com`, `mp02o${suffix}`.slice(0, 20))
    otherToken = other.token
    await installModuleForAccount(db, other.accountId, alpha)
  })

  afterAll(async () => {
    await app?.close()
    await workerDb?.destroy()
    await db?.destroy()
  })

  it('provides typed Tasks CRUD, queries, isolation, idempotent OCC, history, restore, and cursor sync', async () => {
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
        description: 'Founder launch task',
        status: 'todo',
        dueDate: '2030-01-01T12:00:00.000Z',
        link: {record: {moduleId: beta.moduleId, recordType: 'entity', recordId: betaRecordId}},
      },
    }
    const invalidTask = await request('POST', `/v1/modules/${alpha.moduleId}/records/tasks`, {
      mutationId: 'alpha-invalid-1', recordId: `invalid-${alphaRecordId}`, data: {title: 'Incomplete'},
    })
    expect(invalidTask.statusCode).toBe(400)
    expect(invalidTask.json().error.code).toBe('VALIDATION_FAILED')

    const alphaCreate = await request('POST', `/v1/modules/${alpha.moduleId}/records/tasks`, alphaPayload)
    expect(alphaCreate.statusCode).toBe(201)
    expect(alphaCreate.json().data.revision).toBe(1)

    const attachmentId = `task-asset-${alphaRecordId}`
    await seedAttachment(db, accountId, attachmentId)
    const mediaBinding = await request('POST', `/v1/modules/${alpha.moduleId}/records/tasks/${alphaRecordId}/media`, {
      assetId: attachmentId, role: 'attachment', caption: 'Task reference', order: 0,
    })
    expect(mediaBinding.statusCode).toBe(201)
    const media = await request('GET', `/v1/modules/${alpha.moduleId}/records/tasks/${alphaRecordId}/media`)
    expect(media.json().data.bindings).toEqual([expect.objectContaining({assetId: attachmentId, caption: 'Task reference'})])

    const replay = await request('POST', `/v1/modules/${alpha.moduleId}/records/tasks`, alphaPayload)
    expect(replay.statusCode).toBe(201)
    expect(replay.json().data.record_id).toBe(alphaRecordId)
    expect(await mutationCount(db, alpha.installationId, 'alpha-create-1')).toBe(1)

    const mutationConflict = await request('POST', `/v1/modules/${alpha.moduleId}/records/tasks`, {
      ...alphaPayload,
      data: {...alphaPayload.data, title: 'Different payload'},
    })
    expect(mutationConflict.statusCode).toBe(409)
    expect(mutationConflict.json().error.code).toBe('MUTATION_REUSE_CONFLICT')

    const secondCreate = await request('POST', `/v1/modules/${alpha.moduleId}/records/tasks`, {
      mutationId: 'alpha-create-2',
      recordId: alphaSecondRecordId,
      data: {title: 'Beta follow-up', description: 'Second task', status: 'todo', dueDate: '2030-01-02T12:00:00.000Z'},
    })
    expect(secondCreate.statusCode).toBe(201)

    const firstPage = await request('GET', `/v1/modules/${alpha.moduleId}/records/tasks?sort=dueDate&direction=asc&limit=1`)
    expect(firstPage.statusCode).toBe(200)
    expect(firstPage.json().data.items.map((item: {record_id: string}) => item.record_id)).toEqual([alphaRecordId])
    expect(firstPage.json().data.nextCursor).toBe('1')
    const secondPage = await request('GET', `/v1/modules/${alpha.moduleId}/records/tasks?sort=dueDate&direction=asc&limit=1&cursor=1`)
    expect(secondPage.json().data.items.map((item: {record_id: string}) => item.record_id)).toEqual([alphaSecondRecordId])
    expect(secondPage.json().data.nextCursor).toBeNull()

    const search = await request('GET', `/v1/modules/${alpha.moduleId}/records/tasks?q=founder`)
    expect(search.json().data.items.map((item: {record_id: string}) => item.record_id)).toEqual([alphaRecordId])
    const todoFilter = encodeURIComponent(JSON.stringify('todo'))
    const filtered = await request('GET', `/v1/modules/${alpha.moduleId}/records/tasks?filter.status=${todoFilter}&sort=dueDate&direction=asc`)
    expect(filtered.json().data.items.map((item: {record_id: string}) => item.record_id)).toEqual([alphaRecordId, alphaSecondRecordId])

    const foreignGet = await requestAs(otherToken, 'GET', `/v1/modules/${alpha.moduleId}/records/tasks/${alphaRecordId}`)
    expect(foreignGet.statusCode).toBe(404)
    const foreignList = await requestAs(otherToken, 'GET', `/v1/modules/${alpha.moduleId}/records/tasks`)
    expect(foreignList.json().data.items).toEqual([])
    const wrongModule = await request('GET', `/v1/modules/${beta.moduleId}/records/entity/${alphaRecordId}`)
    expect(wrongModule.statusCode).toBe(404)

    const forward = await request('GET', `/v1/modules/${alpha.moduleId}/records/tasks/${alphaRecordId}/references?fieldPath=link`)
    expect(forward.statusCode).toBe(200)
    expect(forward.json().data.references).toEqual([
      {fieldPath: 'link', ordinal: 0, record: {moduleId: beta.moduleId, recordType: 'entity', recordId: betaRecordId}},
    ])

    const reverse = await request('GET', `/v1/modules/${beta.moduleId}/records/entity/${betaRecordId}/reverse-references?fieldPath=link`)
    expect(reverse.statusCode).toBe(200)
    expect(reverse.json().data.references[0].source).toEqual({moduleId: alpha.moduleId, recordType: 'tasks', recordId: alphaRecordId})

    await setGrantedPermissions(db, alpha, [])
    const hiddenReverse = await request('GET', `/v1/modules/${beta.moduleId}/records/entity/${betaRecordId}/reverse-references`)
    expect(hiddenReverse.statusCode).toBe(200)
    expect(hiddenReverse.json().data.references).toEqual([])
    await setGrantedPermissions(db, alpha, alpha.permissions)

    const update = await request('PATCH', `/v1/modules/${alpha.moduleId}/records/tasks/${alphaRecordId}`, {
      mutationId: 'alpha-update-1',
      expectedRevision: 1,
      data: {title: 'Alpha second', status: 'done'},
    })
    expect(update.statusCode).toBe(200)
    expect(update.json().data.revision).toBe(2)
    expect(update.json().data.data).toMatchObject({description: 'Founder launch task', status: 'done', dueDate: '2030-01-01T12:00:00.000Z'})

    const doneFilter = encodeURIComponent(JSON.stringify('done'))
    const completed = await request('GET', `/v1/modules/${alpha.moduleId}/records/tasks?filter.status=${doneFilter}`)
    expect(completed.json().data.items.map((item: {record_id: string}) => item.record_id)).toEqual([alphaRecordId])

    const concurrent = await Promise.all([
      request('PATCH', `/v1/modules/${alpha.moduleId}/records/tasks/${alphaRecordId}`, {
        mutationId: 'alpha-update-race-a', expectedRevision: 2, data: {title: 'Race A'},
      }),
      request('PATCH', `/v1/modules/${alpha.moduleId}/records/tasks/${alphaRecordId}`, {
        mutationId: 'alpha-update-race-b', expectedRevision: 2, data: {title: 'Race B'},
      }),
    ])
    expect(concurrent.map(response => response.statusCode).sort()).toEqual([200, 409])
    expect(concurrent.find(response => response.statusCode === 409)?.json().error.code).toBe('REVISION_CONFLICT')

    const history = await request('GET', `/v1/modules/${alpha.moduleId}/records/tasks/${alphaRecordId}/revisions`)
    expect(history.statusCode).toBe(200)
    expect(history.json().data.revisions.map((revision: {revision: number}) => revision.revision)).toEqual([3, 2, 1])

    const restore = await request('POST', `/v1/modules/${alpha.moduleId}/records/tasks/${alphaRecordId}/restore`, {
      mutationId: 'alpha-restore-1', expectedRevision: 3, sourceRevision: 1,
    })
    expect(restore.statusCode).toBe(200)
    expect(restore.json().data.revision).toBe(4)
    expect(restore.json().data.data.title).toBe('Alpha source')
    expect(restore.json().data.data.status).toBe('todo')

    const restoredRevision = await request('GET', `/v1/modules/${alpha.moduleId}/records/tasks/${alphaRecordId}/revisions/4`)
    expect(restoredRevision.statusCode).toBe(200)
    expect(restoredRevision.json().data.operation).toBe('restore')
    expect(restoredRevision.json().data.baseRevision).toBe(3)

    const compatibleReleaseId = await seedCompatibleModuleUpdate(db, alpha)
    const updatePlan = await app.inject({
      method: 'POST',
      url: `/v1/modules/${alpha.moduleId}/update`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': 'alpha-compatible-update-1'},
      payload: {version: '1.1.0'},
    })
    expect(updatePlan.statusCode, updatePlan.body).toBe(202)
    await handleModuleUpdate(workerDb, loadWorkerConfig(), {
      installationId: alpha.installationId,
      targetReleaseId: compatibleReleaseId,
      previousStatus: 'enabled',
      moduleId: alpha.moduleId,
      accountId,
      planId: updatePlan.json().data.planId,
    })
    const preserved = await request('GET', `/v1/modules/${alpha.moduleId}/records/tasks/${alphaRecordId}`)
    expect(preserved.statusCode).toBe(200)
    expect(preserved.json().data).toMatchObject({record_id: alphaRecordId, revision: 4, data: {title: 'Alpha source', status: 'todo'}})

    const syncBeforeDelete = await request('GET', `/v1/modules/${alpha.moduleId}/records/sync`)
    expect(syncBeforeDelete.statusCode).toBe(200)
    expect(syncBeforeDelete.json().data.changes.length).toBeGreaterThan(0)
    const cursor = syncBeforeDelete.json().data.nextCursor as string

    const deleted = await request('DELETE', `/v1/modules/${alpha.moduleId}/records/tasks/${alphaRecordId}`, {
      mutationId: 'alpha-delete-1', expectedRevision: 4,
    })
    expect(deleted.statusCode).toBe(200)
    expect(deleted.json().data).toEqual({deleted: true, recordId: alphaRecordId, revision: 5})

    const delta = await request('GET', `/v1/modules/${alpha.moduleId}/records/sync?after=${encodeURIComponent(cursor)}`)
    expect(delta.statusCode).toBe(200)
    expect(delta.json().data.changes).toEqual([])
    expect(delta.json().data.tombstones).toEqual([
      expect.objectContaining({moduleId: alpha.moduleId, recordType: 'tasks', recordId: alphaRecordId, revision: 5}),
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
    return requestAs(token, method, url, payload)
  }

  async function requestAs(authToken: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) {
    return app.inject({method, url, headers: {authorization: `Bearer ${authToken}`}, payload})
  }
})

type ModuleFixture = {
  moduleId: string
  releaseId: string
  extensionVersionId: string
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
  const permissions = [
    ...['read', 'write', 'delete'].map(operation => `records:module.${moduleId}.${collection.collection}:${operation}`),
    ...['read', 'write'].map(operation => `media:module.${moduleId}.${collection.collection}:${operation}`),
  ]
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
  return {moduleId, releaseId: published.releaseId, extensionVersionId: imported.extensionVersionId, installationId, reviewId, permissions}
}

async function seedCompatibleModuleUpdate(db: Kysely<Database>, fixture: ModuleFixture): Promise<string> {
  const collection = alphaCollection()
  const manifest = moduleManifest(fixture.moduleId, collection, fixture.permissions, '1.1.0')
  const releases = new GreenfieldModuleReleaseService(db)
  await releases.importPendingReview(manifest)
  const published = await releases.publishRelease(fixture.moduleId, manifest.version)
  await db.insertInto('greenfield_module_record_collections').values({
    collection_id: `collection:${published.releaseId}:${collection.collection}`,
    release_id: published.releaseId,
    module_id: fixture.moduleId,
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
  return published.releaseId
}

async function seedAttachment(db: Kysely<Database>, accountId: string, attachmentId: string): Promise<void> {
  const now = new Date()
  await db.insertInto('attachments').values({
    attachment_id: attachmentId,
    owner_account_id: accountId,
    kind: 'image',
    mime_type: 'image/png',
    original_filename: 'task-reference.png',
    byte_size: '128',
    checksum: null,
    storage_key: null,
    storage_provider: 'local',
    status: 'ready',
    width: null,
    height: null,
    duration_seconds: null,
    page_count: null,
    thumbnail_key: null,
    preview_key: null,
    metadata: {},
    attached_at: null,
    created_at: now,
    updated_at: now,
  }).execute()
}

async function installModuleForAccount(db: Kysely<Database>, accountId: string, fixture: ModuleFixture): Promise<void> {
  const installationId = `mp02-installation:${fixture.moduleId}:${accountId}`
  await db.insertInto('greenfield_extension_installations').values({
    installation_id: installationId,
    extension_version_id: fixture.extensionVersionId,
    account_id: accountId,
    status: 'enabled',
    config: {},
    created_at: new Date(),
    updated_at: new Date(),
  }).execute()
  await db.insertInto('greenfield_module_permission_reviews').values({
    review_id: `mp02-review:${fixture.moduleId}:${accountId}`,
    installation_id: installationId,
    release_id: fixture.releaseId,
    account_id: accountId,
    granted_permissions: jsonb(fixture.permissions),
    denied_permissions: jsonb([]),
    high_risk_increase: false,
    idempotency_key: `review:${fixture.moduleId}:${accountId}`,
    reviewed_at: new Date(),
  }).execute()
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
  version = '1.0.0',
): GreenfieldModuleManifestV1 {
  const manifest: GreenfieldModuleManifestV1 = {
    manifestVersion: 1,
    moduleId,
    name: moduleId,
    description: 'Synthetic MODULE-PLATFORM-02 fixture.',
    version,
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
    collection: 'tasks',
    schemaRef: 'schemas/audit-tasks.v1.schema.json',
    defaultVisibility: 'private',
    fields: [
      {fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true},
      {fieldId: 'description', name: 'description', type: 'text', label: 'Description', required: true},
      {fieldId: 'status', name: 'status', type: 'singleSelect', label: 'Status', required: true, options: [
        {value: 'todo', label: 'To do'},
        {value: 'in-progress', label: 'In progress'},
        {value: 'done', label: 'Done'},
      ]},
      {fieldId: 'dueDate', name: 'dueDate', type: 'dateTime', label: 'Due date', required: true},
      {fieldId: 'link', name: 'link', type: 'recordReference', label: 'Linked record', required: false},
    ],
    searchableFields: ['title', 'description'],
    filterableFields: ['status', 'link'],
    sortableFields: ['createdAt', 'updatedAt', 'title', 'dueDate'],
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
