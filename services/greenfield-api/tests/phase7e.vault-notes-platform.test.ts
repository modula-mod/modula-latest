import {randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname, join, resolve} from 'node:path'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {
  CANONICAL_VAULT_NOTES_MODULE_ID,
  CANONICAL_VAULT_NOTES_ARTIFACT_SHA256,
  CANONICAL_VAULT_NOTES_CURRENT_COMMIT,
  CANONICAL_VAULT_NOTES_CURRENT_VERSION,
  rewriteLegacyVaultNotesValue,
} from '@modula/greenfield-contracts'
import {manifestChecksum, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
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
import {canonicalizeVaultNotesManifest} from '../src/modules/canonical-manifest.js'
import {GreenfieldModuleInstallationService} from '../src/modules/installation-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {createDb as createWorkerDb, type ModulaWorkerDb} from '../../greenfield-worker/src/database.js'
import {processOneEventDelivery} from '../../greenfield-worker/src/events/runner.js'
import {handleModuleUninstall} from '../../greenfield-worker/src/modules/uninstall-handler.js'
import {handleModuleUpdate} from '../../greenfield-worker/src/modules/update-handler.js'
import type {WorkerConfig} from '../../greenfield-worker/src/config.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const vaultNotesRoot = resolveVaultNotesRoot(workspaceRoot)
const moduleId = CANONICAL_VAULT_NOTES_MODULE_ID
const moduleVersion = CANONICAL_VAULT_NOTES_CURRENT_VERSION
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

describe('Phase 7E Vault Notes external module declarations', () => {
  it('keeps Vault Notes outside hardcoded app feature paths', () => {
    expect(readJson('modula.module.json').standardVersion).toBe('2.1.0')
    expect(readJson('modula.module.json').id).toBe(CANONICAL_VAULT_NOTES_MODULE_ID)
    expect(() => readFileSync(join(workspaceRoot, 'src/features/vault-notes/index.ts'), 'utf8')).toThrow()
    expect(() => readFileSync(join(workspaceRoot, 'app/vault-notes.tsx'), 'utf8')).toThrow()
    const moduleRepository = readFileSync(join(workspaceRoot, 'src/data/repositories/api/ApiModuleRepository.ts'), 'utf8')
    expect(moduleRepository).not.toContain("'digital.modula.vault-notes'")
    expect(moduleRepository).not.toContain('local-vault-note')
    expect(moduleRepository).not.toContain("includes('vault-notes')")
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
  let installations: GreenfieldModuleInstallationService
  let search: GreenfieldSearchService
  const suffix = randomUUID().slice(0, 8)

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    workerDb = createWorkerDb(databaseUrl!)
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    search = new GreenfieldSearchService(db, loadConfig())
    await app.ready()
    await importVaultNotesRelease()
    installations = new GreenfieldModuleInstallationService(db, loadConfig())
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

  it('projects publisher declarations and real account ratings without seeded Marketplace numbers', async () => {
    const initial = await app.inject({
      method: 'GET',
      url: `/v1/registry/modules/${moduleId}`,
      headers: {authorization: `Bearer ${token}`},
    })
    expect(initial.statusCode).toBe(200)
    expect(initial.json().data.marketplace).toMatchObject({
      category: {state: 'declared', value: 'Productivity'},
      ageRating: {state: 'declared', value: '4+'},
      offlineSupport: {state: 'declared', value: false},
      syncSupport: {state: 'declared', value: true},
      inAppPurchases: {state: 'declared', value: false},
      previews: [],
      rating: {average: null, count: 0},
      installations: {count: 0},
    })
    // Registry facts win over the manifest's self-declared marketplace.release block.
    const registryRelease = await db.selectFrom('greenfield_module_releases').select('published_at').where('module_id', '=', moduleId).where('release_state', '=', 'published').orderBy('published_at', 'desc').executeTakeFirstOrThrow()
    expect(initial.json().data.marketplace.release.publishedAt).toBe(new Date(registryRelease.published_at as any).toISOString())
    expect(initial.json().data.publishedAt).toBe(initial.json().data.marketplace.release.publishedAt)

    const primaryRating = await app.inject({
      method: 'PUT',
      url: `/v1/registry/modules/${moduleId}/rating`,
      headers: {authorization: `Bearer ${token}`},
      payload: {rating: 5},
    })
    expect(primaryRating.statusCode).toBe(200)
    expect(primaryRating.json().data).toMatchObject({userRating: 5, average: 5, count: 1})

    const otherRating = await app.inject({
      method: 'PUT',
      url: `/v1/registry/modules/${moduleId}/rating`,
      headers: {authorization: `Bearer ${otherToken}`},
      payload: {rating: 3},
    })
    expect(otherRating.statusCode).toBe(200)
    expect(otherRating.json().data).toMatchObject({userRating: 3, average: 4, count: 2})

    const detail = await app.inject({method: 'GET', url: `/v1/registry/modules/${moduleId}`})
    expect(detail.statusCode).toBe(200)
    expect(detail.json().data.marketplace.rating).toMatchObject({average: 4, count: 2})
  })

  it('installs, enables, edits, exports, disables and re-enables through generic module host APIs', async () => {
    const discover = await app.inject({
      method: 'GET',
      url: '/v1/registry/modules?q=vault',
      headers: {authorization: `Bearer ${token}`},
    })
    expect(discover.statusCode).toBe(200)
    expect(discover.json().data.items.map((item: any) => item.moduleId)).toContain(moduleId)

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/registry/modules/${moduleId}`,
      headers: {authorization: `Bearer ${token}`},
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().data).toMatchObject({
      moduleId,
      latestVersion: moduleVersion,
      source: expect.objectContaining({commit: expect.any(String)}),
    })

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
    expect(install.json().data.status).toBe('installing')
    await installations.setWorkerStatus(installationId, 'installedDisabled')
    const installing = await app.inject({method: 'GET', url: `/v1/modules/installed/${moduleId}`, headers: {authorization: `Bearer ${token}`}})
    expect(installing.statusCode).toBe(200)
    expect(installing.json().data.status).toBe('installedDisabled')
    const enable = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/enable`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `enable-${suffix}`},
    })
    expect(enable.statusCode).toBe(202)
    await installations.setWorkerStatus(installationId, 'enabled')

    const views = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/views`, headers: {authorization: `Bearer ${token}`}})
    expect(views.statusCode).toBe(200)
    expect(views.json().data.views.map((view: any) => view.viewId)).toEqual(expect.arrayContaining([
      'digital.modula.vault-notes.views.home',
      'digital.modula.vault-notes.views.editor',
      'digital.modula.vault-notes.views.settings',
    ]))

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
      url: `/v1/modules/${moduleId}/actions/digital.modula.vault-notes.actions.note.duplicate`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `duplicate-${suffix}`},
      payload: {input: noteData({title: `Vault Copy ${suffix}`, text: `Vault copy phrase ${suffix}`, folderId: folder.record_id, tagIds: [tag.record_id]})},
    })
    expect(duplicate.statusCode).toBe(200)
    expect(duplicate.json().data.result.revision).toBe(1)

    const moved = await runAction('digital.modula.vault-notes.actions.note.move', {recordId: note.record_id, expectedRevision: 2, folderId: folder.record_id})
    expect(moved.result.data.folderId).toBe(folder.record_id)
    const pinned = await runAction('digital.modula.vault-notes.actions.note.pin', {recordId: note.record_id, expectedRevision: 3, pinned: true})
    expect(pinned.result.data.pinned).toBe(true)
    const favourited = await runAction('digital.modula.vault-notes.actions.note.favourite', {recordId: note.record_id, expectedRevision: 4, favourite: true})
    expect(favourited.result.data.favourite).toBe(true)
    const archived = await runAction('digital.modula.vault-notes.actions.note.archive', {recordId: note.record_id, expectedRevision: 5, archived: true})
    expect(archived.result.data.archived).toBe(true)
    const filteredRecords = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/records/note?filter.archived=true`, headers: {authorization: `Bearer ${token}`}})
    expect(filteredRecords.statusCode).toBe(200)
    expect(filteredRecords.json().data.items.some((item: any) => item.record_id === note.record_id)).toBe(true)
    const invalidState = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/records/note?recordState=all`, headers: {authorization: `Bearer ${token}`}})
    expect(invalidState.statusCode).toBe(400)

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/modules/${moduleId}/records/note/${note.record_id}`,
      headers: {authorization: `Bearer ${token}`},
      payload: {expectedRevision: 6},
    })
    expect(deleted.statusCode).toBe(200)
    await drainSearchDeliveries(16)
    await expectSearch(`saved phrase ${suffix}`, note.record_id, false)
    const activeRecords = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/records/note`, headers: {authorization: `Bearer ${token}`}})
    expect(activeRecords.statusCode).toBe(200)
    expect(activeRecords.json().data.items.some((item: any) => item.record_id === note.record_id)).toBe(false)
    const deletedRecords = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/records/note?recordState=deleted`, headers: {authorization: `Bearer ${token}`}})
    expect(deletedRecords.statusCode).toBe(200)
    expect(deletedRecords.json().data.items.some((item: any) => item.record_id === note.record_id)).toBe(true)

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
    expect(exportResult.json().data.manifest).toMatchObject({moduleId, moduleVersion, standardVersion: '2.1.0', dataSchemaVersion: '1.0.0'})

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
      url: `/v1/modules/${moduleId}/actions/digital.modula.vault-notes.actions.note.create`,
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

  it('resolves the legacy module ID onto the one canonical product', async () => {
    const legacy = await app.inject({
      method: 'GET',
      url: '/v1/registry/modules/modula.vault-notes',
      headers: {authorization: `Bearer ${token}`},
    })
    expect(legacy.statusCode).toBe(200)
    expect(legacy.json().data.moduleId).toBe(moduleId)
    expect(legacy.json().data.latestVersion).toBe(moduleVersion)
    const catalogue = await app.inject({
      method: 'GET',
      url: '/v1/registry/modules?q=Vault%20Notes',
      headers: {authorization: `Bearer ${token}`},
    })
    const vaultCards = catalogue.json().data.items.filter((item: {name?: string; moduleId?: string}) =>
      item.name === 'Vault Notes' || item.moduleId === moduleId || item.moduleId === 'modula.vault-notes',
    )
    expect(vaultCards).toHaveLength(1)
    expect(vaultCards[0].moduleId).toBe(moduleId)
  })

  it('refuses a second Vault Notes installation for the same account', async () => {
    const second = await app.inject({
      method: 'POST',
      url: '/v1/modules/modula.vault-notes/install',
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `dup-${suffix}`},
      payload: {version: moduleVersion},
    })
    expect(second.statusCode).toBe(202)
    expect(second.json().data.installationId).toBe(installationId)
    const listed = await app.inject({
      method: 'GET',
      url: '/v1/modules/installed',
      headers: {authorization: `Bearer ${token}`},
    })
    const vaultInstalls = listed.json().data.filter((item: {moduleId: string}) =>
      item.moduleId === moduleId || item.moduleId === 'modula.vault-notes',
    )
    expect(vaultInstalls).toHaveLength(1)
  })

  it('migrates legacy-owned notes onto the canonical namespace without duplication', async () => {
    await db
      .updateTable('greenfield_module_records')
      .set({module_id: 'modula.vault-notes'})
      .where('account_id', '=', accountId)
      .where('module_id', '=', moduleId)
      .execute()
    const before = await db
      .selectFrom('greenfield_module_records')
      .select(['record_id', 'collection'])
      .where('account_id', '=', accountId)
      .where('module_id', 'in', [moduleId, 'modula.vault-notes'])
      .execute()
    expect(before.length).toBeGreaterThan(0)
    const listed = await app.inject({
      method: 'GET',
      url: '/v1/modules/installed',
      headers: {authorization: `Bearer ${token}`},
    })
    expect(listed.statusCode).toBe(200)
    const after = await db
      .selectFrom('greenfield_module_records')
      .select(['record_id', 'module_id', 'collection'])
      .where('account_id', '=', accountId)
      .where('module_id', 'in', [moduleId, 'modula.vault-notes'])
      .execute()
    expect(after.every(row => row.module_id === moduleId)).toBe(true)
    expect(after.map(row => `${row.collection}:${row.record_id}`).sort()).toEqual(
      before.map(row => `${row.collection}:${row.record_id}`).sort(),
    )
  })

  it('keeps notes across uninstall keep-data and reinstall', async () => {
    const noteA = await createRecord('note', noteData({title: `Keep A ${suffix}`, text: `keep-a ${suffix}`}))
    const noteB = await createRecord('note', noteData({title: `Keep B ${suffix}`, text: `keep-b ${suffix}`}))
    const uninstall = await app.inject({
      method: 'DELETE',
      url: `/v1/modules/${moduleId}/install`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `keep-${suffix}`},
      payload: {choice: 'keepData'},
    })
    expect(uninstall.statusCode).toBe(202)
    await installations.setWorkerStatus(installationId, 'removed')
    const reinstall = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/install`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `reinstall-${suffix}`},
      payload: {version: moduleVersion},
    })
    expect(reinstall.statusCode).toBe(202)
    installationId = reinstall.json().data.installationId
    await finishInstall(token, installationId)
    const restoredA = await app.inject({
      method: 'GET',
      url: `/v1/modules/${moduleId}/records/note/${noteA.record_id}`,
      headers: {authorization: `Bearer ${token}`},
    })
    const restoredB = await app.inject({
      method: 'GET',
      url: `/v1/modules/${moduleId}/records/note/${noteB.record_id}`,
      headers: {authorization: `Bearer ${token}`},
    })
    expect(restoredA.statusCode).toBe(200)
    expect(restoredB.statusCode).toBe(200)
  })

  it('isolates installation and notes across two accounts', async () => {
    const otherInstalled = await app.inject({
      method: 'GET',
      url: `/v1/modules/installed/${moduleId}`,
      headers: {authorization: `Bearer ${otherToken}`},
    })
    expect([404, 200]).toContain(otherInstalled.statusCode)
    if (otherInstalled.statusCode === 200) {
      expect(otherInstalled.json().data.status === 'removed' || !otherInstalled.json().data.installationId).toBeTruthy()
    }
    const installB = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/install`,
      headers: {authorization: `Bearer ${otherToken}`, 'idempotency-key': `b-install-${suffix}`},
      payload: {version: moduleVersion},
    })
    expect(installB.statusCode).toBe(202)
    const otherInstallationId = installB.json().data.installationId
    await finishInstall(otherToken, otherInstallationId)
    const noteB = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/records/note`,
      headers: {authorization: `Bearer ${otherToken}`},
      payload: {data: noteData({title: `Account B ${suffix}`, text: `secret-b ${suffix}`})},
    })
    expect(noteB.statusCode).toBe(201)
    const aReadsB = await app.inject({
      method: 'GET',
      url: `/v1/modules/${moduleId}/records/note/${noteB.json().data.record_id}`,
      headers: {authorization: `Bearer ${token}`},
    })
    expect(aReadsB.statusCode).toBe(404)
  })

  it('records canonical source provenance and a release checksum', async () => {
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/registry/modules/${moduleId}`,
      headers: {authorization: `Bearer ${token}`},
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().data.moduleId).toBe(moduleId)
    expect(detail.json().data.source.repository).toBe('modula-mod/modula-vault-notes')
    expect(detail.json().data.source.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(detail.json().data.releaseSha256 || detail.json().data.manifestSha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('deletes notes only on a disposable account with delete-data uninstall', async () => {
    const disposable = await registerAccount(`vault-del-${suffix}@example.com`, `vaultd${suffix}`.slice(0, 20))
    const install = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/install`,
      headers: {authorization: `Bearer ${disposable.token}`, 'idempotency-key': `del-install-${suffix}`},
      payload: {version: moduleVersion},
    })
    expect(install.statusCode).toBe(202)
    const disposableInstallationId = install.json().data.installationId
    await finishInstall(disposable.token, disposableInstallationId)
    const created = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/records/note`,
      headers: {authorization: `Bearer ${disposable.token}`},
      payload: {data: noteData({title: `Disposable ${suffix}`, text: `delete-me ${suffix}`})},
    })
    expect(created.statusCode).toBe(201)
    const recordId = created.json().data.record_id
    const uninstall = await app.inject({
      method: 'DELETE',
      url: `/v1/modules/${moduleId}/install`,
      headers: {authorization: `Bearer ${disposable.token}`, 'idempotency-key': `del-${suffix}`},
      payload: {choice: 'deleteData', confirmDelete: true, recentAuth: true},
    })
    expect(uninstall.statusCode).toBe(202)
    await handleModuleUninstall(workerDb, {
      installationId: disposableInstallationId,
      moduleId,
      dataRetentionChoice: 'deleteData',
    })
    const gone = await db
      .selectFrom('greenfield_module_records')
      .select(['deleted_at'])
      .where('account_id', '=', disposable.accountId)
      .where('record_id', '=', recordId)
      .executeTakeFirst()
    expect(gone?.deleted_at).toBeTruthy()
    const founderStill = await db
      .selectFrom('greenfield_module_records')
      .select(({fn}) => fn.countAll<number>().as('count'))
      .where('account_id', '=', accountId)
      .where('module_id', '=', moduleId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    expect(Number(founderStill?.count ?? 0)).toBeGreaterThan(0)
  })

  it('updates a historical 0.2.0 install onto 1.2.0 without losing notes', async () => {
    const historical = await importHistoricalRelease()
    const disposable = await registerAccount(`vault-upd-${suffix}@example.com`, `vaultu${suffix}`.slice(0, 20))
    const install = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/install`,
      headers: {authorization: `Bearer ${disposable.token}`, 'idempotency-key': `upd-install-${suffix}`},
      payload: {version: historical.version},
    })
    expect(install.statusCode).toBe(202)
    const disposableInstallationId = install.json().data.installationId
    await finishInstall(disposable.token, disposableInstallationId)
    const created = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/records/note`,
      headers: {authorization: `Bearer ${disposable.token}`},
      payload: {data: noteData({title: `Upgrade ${suffix}`, text: `keep-on-update ${suffix}`})},
    })
    expect(created.statusCode).toBe(201)
    const recordId = created.json().data.record_id
    const update = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/update`,
      headers: {authorization: `Bearer ${disposable.token}`, 'idempotency-key': `upd-${suffix}`},
      payload: {version: moduleVersion},
    })
    expect(update.statusCode).toBe(202)
    const current = await new GreenfieldModuleReleaseService(db).getRelease(moduleId, moduleVersion)
    await handleModuleUpdate(workerDb, {
      installationId: disposableInstallationId,
      targetReleaseId: current!.releaseId,
      previousStatus: 'enabled',
      moduleId,
      accountId: disposable.accountId,
    })
    const restored = await app.inject({
      method: 'GET',
      url: `/v1/modules/${moduleId}/records/note/${recordId}`,
      headers: {authorization: `Bearer ${disposable.token}`},
    })
    expect(restored.statusCode).toBe(200)
    const versionRow = await db
      .selectFrom('greenfield_extension_installations')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
      .select(['greenfield_module_releases.version', 'greenfield_module_releases.source_commit'])
      .where('greenfield_extension_installations.installation_id', '=', disposableInstallationId)
      .executeTakeFirst()
    expect(versionRow?.version).toBe(moduleVersion)
    expect(versionRow?.source_commit).toMatch(/^[0-9a-f]{40}$/)
  })


  async function importVaultNotesRelease() {
    const manifest = manifestForTest()
    const releases = new GreenfieldModuleReleaseService(db)
    const existing = await releases.getRelease(moduleId, moduleVersion)
    if (existing) {
      await registerRuntimeSurface(existing.releaseId, manifest)
      return existing
    }
    const release = await releases.importPendingReview(manifest, immutableReleaseEvidence(manifest))
    const published = await releases.publishRelease(moduleId, moduleVersion)
    await registerRuntimeSurface(published.releaseId, manifest)
    return release
  }

  async function importHistoricalRelease() {
    const manifest = structuredClone(manifestForTest())
    manifest.version = '0.2.0'
    if (manifest.extensionProduct) manifest.extensionProduct.version = '0.2.0'
    manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
    const releases = new GreenfieldModuleReleaseService(db)
    const existing = await releases.getRelease(moduleId, '0.2.0')
    if (existing) {
      await registerRuntimeSurface(existing.releaseId, manifest)
      return existing
    }
    const release = await releases.importPendingReview(manifest, syntheticHistoricalEvidence(manifest))
    const published = await releases.publishRelease(moduleId, '0.2.0')
    await registerRuntimeSurface(published.releaseId, manifest)
    return published
  }

  async function finishInstall(authToken: string, nextInstallationId: string) {
    await installations.setWorkerStatus(nextInstallationId, 'installedDisabled')
    const enable = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/enable`,
      headers: {authorization: `Bearer ${authToken}`, 'idempotency-key': `enable-${nextInstallationId}`},
    })
    expect(enable.statusCode).toBe(202)
    await installations.setWorkerStatus(nextInstallationId, 'enabled')
  }

  async function registerRuntimeSurface(releaseId: string, manifest: GreenfieldModuleManifest) {
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
        .onConflict(oc => oc.column('collection_id').doNothing())
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
        .onConflict(oc => oc.column('view_id').doNothing())
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
        .onConflict(oc => oc.column('action_row_id').doNothing())
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
    const attempts = Math.max(max, 100)
    for (let i = 0; i < attempts; i += 1) {
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
    mailTransport: 'disabled',
    mailProvisionerMode: 'dry-run',
    mailDomain: 'modula.digital',
    mailHestiaUser: undefined,
    mailProvisionerCommandTimeoutMs: 10_000,
    mailDefaultQuotaBytes: 1_073_741_824,
    mailRequired: false,
    mailFrom: 'Modula <no-reply@modula.digital>',
    smtpPort: 587,
    smtpSecure: false,
    smtpRequireTls: true,
    smtpTlsRejectUnauthorized: true,
    encryptionKeysByVersion: new Map([[1, Buffer.alloc(32, 7)]]),
    encryptionKeyIsEphemeral: true,
    ssrfAllowPrivateNetworks: false,
    moduleRemoteFunctionsEnabled: false,
    moduleCommunityExecutionEnabled: false,
    moduleGithubSyncEnabled: false,
  }
}

function manifestForTest(): GreenfieldModuleManifest {
  const manifest = readTaggedVaultJson('vault-notes-v1.2.0', 'module.manifest.json') as GreenfieldModuleManifest
  const canonical = canonicalizeVaultNotesManifest(manifest)
  canonical.integrity.manifestSha256 = manifestChecksum({...canonical, integrity: {...canonical.integrity, manifestSha256: ''}})
  return canonical
}

function immutableReleaseEvidence(manifest: GreenfieldModuleManifest) {
  const provenance = readJson('release/vault-notes-v1.2.0.provenance.json')
  expect(provenance.releaseCommit).toBe(CANONICAL_VAULT_NOTES_CURRENT_COMMIT)
  expect(provenance.packageChecksum).toBe(CANONICAL_VAULT_NOTES_ARTIFACT_SHA256)
  return {
    repository: provenance.repository as string,
    releaseTag: provenance.releaseTag as string,
    releaseCommit: provenance.releaseCommit as string,
    artifactSha256: provenance.packageChecksum as string,
    manifestSha256: manifest.integrity.manifestSha256,
  }
}

function readTaggedVaultJson(ref: string, path: string): unknown {
  return JSON.parse(execFileSync('git', ['show', `${ref}:${path}`], {cwd: vaultNotesRoot, encoding: 'utf8'}))
}

function syntheticHistoricalEvidence(manifest: GreenfieldModuleManifest) {
  return {
    repository: manifest.source.repository,
    releaseTag: manifest.source.releaseTag!,
    releaseCommit: '0'.repeat(39) + '2',
    artifactSha256: '2'.repeat(64),
    manifestSha256: manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}}),
  }
}

function collectionDefinitions(manifest: GreenfieldModuleManifest): GreenfieldModuleCollectionDefinition[] {
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
      const validation = validateGreenfieldModuleView(rewriteLegacyVaultNotesValue(readJson(`src/views/${file}`)))
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

function resolveVaultNotesRoot(workspaceRoot: string): string {
  const candidates = [
    process.env.MODULA_VAULT_NOTES_ROOT,
    '/Users/msjoy/Developer/modula-vault-notes',
    resolve(workspaceRoot, '../modula-vault-notes'),
    resolve(workspaceRoot, '../modula-mod/modula-vault-notes'),
    '/tmp/modula-mod/modula-vault-notes',
  ].filter((value): value is string => Boolean(value))
  for (const dir of candidates) {
    if (existsSync(join(dir, 'module.manifest.json'))) return dir
  }
  return candidates[1] ?? candidates[0]!
}
