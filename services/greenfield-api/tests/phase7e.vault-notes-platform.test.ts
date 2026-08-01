import {randomUUID} from 'node:crypto'
import {readdirSync, readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname, join, resolve} from 'node:path'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {manifestChecksum, type GreenfieldModuleManifestV1} from '@modula/greenfield-module-manifest'
import {
  validateGreenfieldModuleAction,
  validateGreenfieldModuleCollection,
  validateGreenfieldModuleView,
  type GreenfieldModuleAction,
  type GreenfieldModuleCollectionDefinition,
  type GreenfieldModuleFieldDefinition,
} from '@modula/greenfield-module-ui-contracts'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldSearchService} from '../src/domains/search/index.js'
import {GreenfieldModuleInstallationService} from '../src/modules/installation-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {createDb as createWorkerDb, type ModulaWorkerDb} from '../../greenfield-worker/src/database.js'
import {processOneEventDelivery} from '../../greenfield-worker/src/events/runner.js'
import type {WorkerConfig} from '../../greenfield-worker/src/config.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const vaultNotesRoot = resolve(workspaceRoot, '../modula-mod/modula-vault-notes')
const moduleId = 'modula.vault-notes'
const moduleVersion = '1.1.0'
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

describe('Phase 7E Vault Notes external module declarations', () => {
  it('keeps Vault Notes outside hardcoded app feature paths', () => {
    expect(readJson('modula.module.json').id).toBe(moduleId)
    expect(readJson('modula.module.json').standardVersion).toBe('1.2.0')
    expect(() => readFileSync(join(workspaceRoot, 'src/features/vault-notes/index.ts'), 'utf8')).toThrow()
    expect(() => readFileSync(join(workspaceRoot, 'app/vault-notes.tsx'), 'utf8')).toThrow()
  })
})

describeIfDb('Phase 7E Vault Notes registry, lifecycle, data integrity and search', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let workerDb: ModulaWorkerDb
  let token = ''
  let accountId = ''
  let otherToken = ''
  let otherAccountId = ''
  let installationId = ''
  let search: GreenfieldSearchService
  const suffix = randomUUID().slice(0, 8)

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    workerDb = createWorkerDb(databaseUrl!)
    search = new GreenfieldSearchService(db, loadConfig())
    await app.ready()
    await importVaultNotesRelease()
    const primary = await registerAccount(`vault-${suffix}@example.com`, `vault${suffix}`.slice(0, 20))
    token = primary.token
    accountId = primary.accountId
    const other = await registerAccount(`vault-other-${suffix}@example.com`, `vaulto${suffix}`.slice(0, 20))
    otherToken = other.token
    otherAccountId = other.accountId
  })

  afterAll(async () => {
    await app?.close()
    await workerDb?.destroy()
    await db?.destroy()
  })

  it('installs, enables, edits, exports, disables and re-enables through generic module host APIs', async () => {
    const preview = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/install-preview`,
      headers: {authorization: `Bearer ${token}`},
      payload: {version: moduleVersion},
    })
    expect(preview.statusCode).toBe(200)
    expect(preview.json().data.compatible).toBe(true)

    const install = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/install`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `install-${suffix}`},
      payload: {version: moduleVersion},
    })
    expect(install.statusCode).toBe(202)
    installationId = install.json().data.installationId
    const installations = new GreenfieldModuleInstallationService(db, loadConfig())
    await installations.setWorkerStatus(installationId, 'installedDisabled')
    const enable = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/enable`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `enable-${suffix}`},
    })
    expect(enable.statusCode).toBe(202)
    await installations.setWorkerStatus(installationId, 'enabled')

    const views = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/views`, headers: {authorization: `Bearer ${token}`}})
    expect(views.statusCode).toBe(200)
    expect(views.json().data.views.map((view: any) => view.viewId)).toEqual(expect.arrayContaining(['modula.vault-notes.views.home', 'modula.vault-notes.views.editor', 'modula.vault-notes.views.settings']))

    const settings = await app.inject({
      method: 'PATCH',
      url: `/v1/modules/${moduleId}/settings`,
      headers: {authorization: `Bearer ${token}`},
      payload: {values: {defaultSort: 'title', autosaveDelayMs: 900, includeArchivedNotesInSearch: false}},
    })
    expect(settings.statusCode).toBe(200)
    expect(settings.json().data.values.defaultSort).toBe('title')

    const folder = await createRecord('folder', {
      id: `folder-${suffix}`,
      name: 'Founder notes',
      position: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const tag = await createRecord('tag', {
      id: `tag-${suffix}`,
      name: 'Strategy',
      normalizedName: `strategy-${suffix}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const note = await createRecord('note', noteData({
      title: `Vault Alpha ${suffix}`,
      text: `Vault searchable phrase ${suffix}`,
      folderId: folder.record_id,
      tagIds: [tag.record_id],
    }))
    expect(note.revision).toBe(1)
    await drainSearchDeliveries(16)
    await expectSearch(`searchable phrase ${suffix}`, note.record_id, true)

    const autosaved = await patchRecord('note', note.record_id, {
      expectedRevision: 1,
      data: noteData({title: `Vault Alpha Saved ${suffix}`, text: `Vault saved phrase ${suffix}`, folderId: folder.record_id, tagIds: [tag.record_id]}),
    })
    expect(autosaved.revision).toBe(2)
    const stale = await app.inject({
      method: 'PATCH',
      url: `/v1/modules/${moduleId}/records/note/${note.record_id}`,
      headers: {authorization: `Bearer ${token}`},
      payload: {expectedRevision: 1, data: {title: 'stale'}},
    })
    expect(stale.statusCode).toBe(409)
    expect(stale.json().error.code).toBe('NOTE_REVISION_CONFLICT')

    const duplicate = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/actions/modula.vault-notes.actions.note.duplicate`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `duplicate-${suffix}`},
      payload: {input: noteData({title: `Vault Copy ${suffix}`, text: `Vault copy phrase ${suffix}`, folderId: folder.record_id, tagIds: [tag.record_id]})},
    })
    expect(duplicate.statusCode).toBe(200)
    expect(duplicate.json().data.result.revision).toBe(1)

    const moved = await runAction('modula.vault-notes.actions.note.move', {recordId: note.record_id, expectedRevision: 2, folderId: folder.record_id})
    expect(moved.result.data.folderId).toBe(folder.record_id)
    const pinned = await runAction('modula.vault-notes.actions.note.pin', {recordId: note.record_id, expectedRevision: 3, pinned: true})
    expect(pinned.result.data.pinned).toBe(true)
    const favourited = await runAction('modula.vault-notes.actions.note.favourite', {recordId: note.record_id, expectedRevision: 4, favourite: true})
    expect(favourited.result.data.favourite).toBe(true)
    const archived = await runAction('modula.vault-notes.actions.note.archive', {recordId: note.record_id, expectedRevision: 5, archived: true})
    expect(archived.result.data.archived).toBe(true)

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/modules/${moduleId}/records/note/${note.record_id}`,
      headers: {authorization: `Bearer ${token}`},
      payload: {expectedRevision: 6},
    })
    expect(deleted.statusCode).toBe(200)
    await drainSearchDeliveries(16)
    await expectSearch(`saved phrase ${suffix}`, note.record_id, false)

    const restore = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/records/note/${note.record_id}/restore`,
      headers: {authorization: `Bearer ${token}`},
      payload: {expectedRevision: 7},
    })
    expect(restore.statusCode).toBe(200)
    await drainSearchDeliveries(16)
    await expectSearch(`saved phrase ${suffix}`, note.record_id, true)

    const otherRead = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/records/note/${note.record_id}`, headers: {authorization: `Bearer ${otherToken}`}})
    expect(otherRead.statusCode).toBe(404)

    const purgeDenied = await app.inject({
      method: 'DELETE',
      url: `/v1/modules/${moduleId}/records/note/${note.record_id}/permanent`,
      headers: {authorization: `Bearer ${token}`},
      payload: {expectedRevision: 8},
    })
    expect(purgeDenied.statusCode).toBe(400)

    const exportResult = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/export`,
      headers: {authorization: `Bearer ${token}`},
      payload: {format: 'json'},
    })
    expect(exportResult.statusCode).toBe(200)
    expect(exportResult.json().data.manifest).toMatchObject({moduleId, moduleVersion, standardVersion: '1.2.0', dataSchemaVersion: '1.0.0'})

    const health = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/health`, headers: {authorization: `Bearer ${token}`}})
    expect(health.statusCode).toBe(200)
    expect(health.json().data.overall).toBe('healthy')
    expect(JSON.stringify(health.json().data)).not.toContain(`Vault saved phrase ${suffix}`)

    const eventPayloads = await db
      .selectFrom('greenfield_domain_events')
      .select(['event_type', 'payload'])
      .where('event_type', 'like', 'vault-notes.%')
      .where('account_id', '=', accountId)
      .execute()
    expect(eventPayloads.length).toBeGreaterThan(0)
    expect(JSON.stringify(eventPayloads)).not.toContain(`Vault saved phrase ${suffix}`)

    const disable = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/disable`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `disable-${suffix}`},
    })
    expect(disable.statusCode).toBe(202)
    await installations.setWorkerStatus(installationId, 'disabled')
    const blocked = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/actions/modula.vault-notes.actions.note.create`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `blocked-${suffix}`},
      payload: {input: noteData({title: 'blocked', text: 'blocked'})},
    })
    expect(blocked.statusCode).toBe(403)
    const reenable = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/enable`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `reenable-${suffix}`},
    })
    expect(reenable.statusCode).toBe(202)
    await installations.setWorkerStatus(installationId, 'enabled')
  })

  async function importVaultNotesRelease() {
    const manifest = manifestForTest()
    const release = await new GreenfieldModuleReleaseService(db).importPendingReview(manifest)
    const published = await new GreenfieldModuleReleaseService(db).publishRelease(moduleId, moduleVersion)
    await registerRuntimeSurface(published.releaseId, manifest)
    return release
  }

  async function registerRuntimeSurface(releaseId: string, manifest: GreenfieldModuleManifestV1) {
    const collections = collectionDefinitions(manifest)
    for (const collection of collections) {
      await db
        .insertInto('greenfield_module_record_collections')
        .values({
          collection_id: `vault-test-collection:${releaseId}:${collection.collection}`,
          release_id: releaseId,
          module_id: manifest.moduleId,
          collection: collection.collection,
          schema_ref: collection.schemaRef,
          default_visibility: collection.defaultVisibility,
          fields: jsonb(collection.fields),
          searchable_fields: jsonb(collection.searchableFields),
          filterable_fields: jsonb(collection.filterableFields),
          sortable_fields: jsonb(collection.sortableFields),
          folder_field: collection.folderField ?? null,
          reference_fields: jsonb(collection.referenceFields ?? []),
          schema_definition: jsonb(collection.schemaDefinition ?? {}),
          retention_policy: collection.retentionPolicy ?? 'keepOnUninstall',
          registration_status: 'registered',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute()
    }
    const actions = new Map<string, GreenfieldModuleAction>()
    for (const view of viewDeclarations()) {
      await db
        .insertInto('greenfield_module_views')
        .values({
          view_id: `vault-test-view:${releaseId}:${view.viewId}`,
          release_id: releaseId,
          module_id: manifest.moduleId,
          view_key: view.viewId,
          view_kind: view.kind,
          collection: view.collection ?? view.query?.collection ?? null,
          title: view.title,
          declaration: jsonb(view),
          required_capabilities: jsonb(view.requiredCapabilities),
          registration_status: 'registered',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute()
      for (const action of view.toolbar ?? []) actions.set(action.actionId, action)
    }
    for (const action of actions.values()) {
      await db
        .insertInto('greenfield_module_actions')
        .values({
          action_row_id: `vault-test-action:${releaseId}:${action.actionId}`,
          release_id: releaseId,
          module_id: manifest.moduleId,
          action_id: action.actionId,
          action_kind: action.kind,
          capability: action.capability,
          declaration: jsonb(action),
          registration_status: 'registered',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute()
    }
  }

  async function registerAccount(email: string, handle: string) {
    const password = 'secure-pass-word-1'
    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, displayName: 'Vault Notes User', acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(session.statusCode).toBe(200)
    return {accountId: register.json().data.accountId as string, token: session.json().data.accessToken as string}
  }

  async function createRecord(collection: string, data: Record<string, unknown>) {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/records/${collection}`,
      headers: {authorization: `Bearer ${token}`},
      payload: {data},
    })
    expect(response.statusCode).toBe(201)
    return response.json().data
  }

  async function patchRecord(collection: string, recordId: string, payload: Record<string, unknown>) {
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/modules/${moduleId}/records/${collection}/${recordId}`,
      headers: {authorization: `Bearer ${token}`},
      payload,
    })
    expect(response.statusCode).toBe(200)
    return response.json().data
  }

  async function runAction(actionId: string, input: Record<string, unknown>) {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/actions/${actionId}`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `${actionId}-${suffix}-${String(input.expectedRevision ?? Date.now())}`},
      payload: {input},
    })
    expect(response.statusCode).toBe(200)
    return response.json().data
  }

  async function expectSearch(query: string, recordId: string, present: boolean) {
    const result = await search.search({query, entityTypes: ['note']}, {actorId: null, accountId, capabilities: [], requestId: `req-vault-search-${randomUUID()}`, correlationId: `corr-vault-search-${randomUUID()}`})
    expect(result.results.some(item => item.entityId === recordId)).toBe(present)
    const other = await search.search({query, entityTypes: ['note']}, {actorId: null, accountId: otherAccountId, capabilities: [], requestId: `req-vault-search-other-${randomUUID()}`, correlationId: `corr-vault-search-other-${randomUUID()}`})
    expect(other.results.some(item => item.entityId === recordId)).toBe(false)
  }

  async function drainSearchDeliveries(max = 12): Promise<void> {
    for (let i = 0; i < max; i += 1) {
      const worked = await processOneEventDelivery(workerDb, workerConfig())
      if (!worked) return
    }
  }
})

function configureTestEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4027'
  process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4027'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
  process.env.MODULA_INVITE_ONLY = 'true'
  process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
  process.env.MODULA_ATPROTO_ENABLED = 'false'
  process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
  process.env.GREENFIELD_MODULE_REGISTRY_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_INSTALLATION_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED = 'true'
  process.env.GREENFIELD_VAULT_NOTES_REFERENCE_ENABLED = 'true'
}

function workerConfig(): WorkerConfig {
  return {
    nodeEnv: 'test',
    environment: 'development',
    workerId: `vault-notes-worker-${process.pid}`,
    logLevel: 'silent',
    databaseUrl: databaseUrl!,
    pollIntervalMs: 1,
    emptyPollBackoffMs: 1,
    leaseDurationMs: 60_000,
    leaseReapIntervalMs: 60_000,
    outboxDrainIntervalMs: 60_000,
    outboxBatchSize: 10,
    eventSubscriberTimeoutMs: 10_000,
    ingestIntervalMs: 60_000,
    ingestEnabled: false,
    encryptionKeysByVersion: new Map([[1, Buffer.alloc(32, 7)]]),
    encryptionKeyIsEphemeral: true,
    ssrfAllowPrivateNetworks: false,
    moduleRemoteFunctionsEnabled: false,
    moduleCommunityExecutionEnabled: false,
    moduleGithubSyncEnabled: false,
  }
}

function manifestForTest(): GreenfieldModuleManifestV1 {
  const manifest = structuredClone(readJson('module.manifest.json')) as GreenfieldModuleManifestV1
  manifest.source = {...manifest.source, commit: '1'.repeat(40)}
  manifest.integrity = {...manifest.integrity, manifestSha256: '', releaseSha256: '2'.repeat(64)}
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

function collectionDefinitions(manifest: GreenfieldModuleManifestV1): GreenfieldModuleCollectionDefinition[] {
  return (manifest.contributions.schemas ?? []).map(schema => {
    const schemaDefinition = readJson(schema.schemaRef)
    const greenfield = record(schemaDefinition['x-greenfield'])
    const collection: GreenfieldModuleCollectionDefinition = {
      collection: schema.collection,
      schemaRef: schema.schemaRef,
      defaultVisibility: schema.defaultVisibility,
      fields: Array.isArray(greenfield.fields) ? greenfield.fields as GreenfieldModuleFieldDefinition[] : deriveFields(schemaDefinition),
      searchableFields: arrayOfStrings(greenfield.searchableFields),
      filterableFields: arrayOfStrings(greenfield.filterableFields),
      sortableFields: arrayOfStrings(greenfield.sortableFields),
      folderField: typeof greenfield.folderField === 'string' ? greenfield.folderField : undefined,
      referenceFields: arrayOfStrings(greenfield.referenceFields),
      schemaDefinition,
      retentionPolicy: greenfield.retentionPolicy as GreenfieldModuleCollectionDefinition['retentionPolicy'],
    }
    const validation = validateGreenfieldModuleCollection(collection, manifest.moduleId)
    expect(validation.valid).toBe(true)
    return validation.value!
  })
}

function viewDeclarations() {
  return readdirSync(join(vaultNotesRoot, 'src/views'))
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => {
      const validation = validateGreenfieldModuleView(readJson(`src/views/${file}`))
      expect(validation.valid).toBe(true)
      for (const action of validation.value?.toolbar ?? []) expect(validateGreenfieldModuleAction(action, moduleId).valid).toBe(true)
      return validation.value!
    })
}

function deriveFields(schemaDefinition: Record<string, unknown>): GreenfieldModuleFieldDefinition[] {
  const required = new Set(arrayOfStrings(schemaDefinition.required))
  const properties = record(schemaDefinition.properties)
  return Object.entries(properties).map(([name, value]) => {
    const property = record(value)
    return {
      fieldId: name,
      name,
      type: fieldType(property),
      label: titleize(name),
      required: required.has(name),
      options: Array.isArray(property.enum) ? property.enum.map(item => ({value: String(item), label: titleize(String(item))})) : undefined,
    }
  })
}

function fieldType(property: Record<string, unknown>): GreenfieldModuleFieldDefinition['type'] {
  if (property.type === 'boolean') return 'boolean'
  if (property.type === 'array') return 'tags'
  if (property.type === 'number' || property.type === 'integer') return 'number'
  if (property.type === 'object') return 'json'
  if (property.format === 'date-time') return 'dateTime'
  if (property.format === 'uri') return 'url'
  if (Array.isArray(property.enum)) return 'singleSelect'
  return 'text'
}

function noteData(input: {title: string; text: string; folderId?: string; tagIds?: string[]}) {
  return {
    title: input.title,
    document: {schemaVersion: '1.0.0', blocks: [{id: `block-${randomUUID()}`, type: 'paragraph', text: input.text, marks: []}]},
    plainTextProjection: input.text,
    folderId: input.folderId,
    tagIds: input.tagIds ?? [],
    pinned: false,
    favourite: false,
    archived: false,
    source: {sourceType: 'manual', capturedAt: new Date().toISOString(), title: 'Manual source'},
    dataSchemaVersion: '1.0.0',
  }
}

function readJson(path: string) {
  return JSON.parse(readFileSync(join(vaultNotesRoot, path), 'utf8'))
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function titleize(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').replace(/^./, letter => letter.toUpperCase())
}
