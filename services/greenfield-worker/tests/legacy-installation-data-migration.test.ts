import {randomUUID} from 'node:crypto'
import pg from 'pg'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {migrateUp} from '../../greenfield-api/src/database/migrate.js'
import {createDb, type ModulaWorkerDb} from '../src/database.js'
import {migrateHistoricalInstallationData} from '../src/modules/legacy-installation-data-migration.js'
import {handleModuleUpdate} from '../src/modules/update-handler.js'
import type {WorkerConfig} from '../src/config.js'

const testUrl = process.env.MODULA_TEST_DATABASE_URL
const adminUrl = process.env.MODULA_TEST_ADMIN_DATABASE_URL
const describeIfDb = testUrl && adminUrl ? describe : describe.skip

describeIfDb.sequential('API-FIX-01C legacy Vault data migration on disposable PostgreSQL', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const databaseName = `modula_fix01c_legacy_${suffix}`
  const accountId = `legacy-account-${suffix}`
  const installationId = `legacy-install-${suffix}`
  const moduleId = 'digital.modula.vault-notes'
  const targetReleaseId = `legacy-target-${suffix}`
  let admin: pg.Pool
  let db: ModulaWorkerDb

  beforeAll(async () => {
    admin = new pg.Pool({connectionString: adminUrl!})
    const url = new URL(testUrl!)
    const migratorUser = url.username
    if (!/^[a-z_][a-z0-9_]*$/.test(migratorUser)) throw new Error('Unsafe test migrator role')
    await admin.query(`CREATE DATABASE "${databaseName}" OWNER "${migratorUser}"`)
    url.pathname = `/${databaseName}`
    await migrateUp(url.toString())
    db = createDb(url.toString())
    const now = new Date('2024-01-02T03:04:05.000Z')
    await db.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: `legacy${suffix}`, status: 'active', created_at: now, updated_at: now}).execute()
    await db.insertInto('greenfield_publishers').values({publisher_id: `publisher-${suffix}`, display_name: 'Test', website: null,
      status: 'verified', trust_level: 'firstParty', created_at: now, updated_at: now,
      verified_at: now, suspended_at: null, revoked_at: null}).execute()
    const extensionId = `extension-${suffix}`
    const sourceVersionId = `source-version-${suffix}`
    const targetVersionId = `target-version-${suffix}`
    await db.insertInto('greenfield_extensions').values({extension_id: extensionId, slug: `legacy-${suffix}`, publisher_account_id: null,
      status: 'published', created_at: now, updated_at: now}).execute()
    for (const [versionId, version] of [[sourceVersionId, '0.2.0'], [targetVersionId, '1.8.0']]) {
      await db.insertInto('greenfield_extension_versions').values({extension_version_id: versionId, extension_id: extensionId,
        version, manifest: {}, status: 'published', created_at: now}).execute()
      await db.insertInto('greenfield_module_versions').values({module_version_id: `module-${versionId}`, extension_version_id: versionId,
        module_id: moduleId, version, publisher_id: `publisher-${suffix}`, manifest: {}, status: 'published', created_at: now, updated_at: now}).execute()
      await db.insertInto('greenfield_module_releases').values({release_id: version === '1.8.0' ? targetReleaseId : `legacy-source-${suffix}`,
        module_version_id: `module-${versionId}`, extension_id: extensionId, extension_version_id: versionId,
        module_id: moduleId, version, publisher_id: `publisher-${suffix}`, release_state: version === '1.8.0' ? 'published' : 'superseded',
        source_repository: 'modula-mod/modula-vault-notes', source_commit: 'a'.repeat(40), manifest_path: 'module.manifest.json',
        manifest_sha256: 'b'.repeat(64), release_sha256: 'c'.repeat(64), signature_key_id: null, signature: null,
        compatibility: {}, license_status: 'firstParty', trust_level: 'firstParty', published_at: now,
        quarantined_at: null, revoked_at: null, superseded_at: null, created_at: now, updated_at: now}).execute()
    }
    await db.insertInto('greenfield_extension_installations').values({installation_id: installationId,
      extension_version_id: sourceVersionId, account_id: accountId, status: 'enabled', config: {}, created_at: now, updated_at: now}).execute()
    for (const collection of ['note', 'folder', 'tag']) await db.insertInto('greenfield_module_record_collections').values({
      collection_id: `collection-${collection}-${suffix}`, release_id: targetReleaseId, module_id: moduleId, collection,
      schema_ref: `schemas/${collection}.schema.json`, default_visibility: 'private', fields: [], searchable_fields: [],
      filterable_fields: [], sortable_fields: [], folder_field: null, reference_fields: [], schema_definition: {},
      retention_policy: 'keepOnUninstall', registration_status: 'registered', created_at: now, updated_at: now,
    }).execute()
    await db.insertInto('greenfield_module_records').values({record_id: `folder-${suffix}`, account_id: accountId,
      module_id: moduleId, installation_id: installationId, collection: 'folder', schema_ref: 'schemas/vault-folder.v1.schema.json',
      visibility: 'private', data: {folderId: 'folder-raw', name: 'Projects'}, search_text: 'Projects', folder_ref: null,
      source_uri: null, retained_after_uninstall: true, revision: 1, created_at: now, updated_at: now, deleted_at: null}).execute()
    await db.insertInto('greenfield_module_records').values({record_id: `note-${suffix}`, account_id: accountId,
      module_id: moduleId, installation_id: installationId, collection: 'note', schema_ref: 'schemas/vault-note.v1.schema.json',
      visibility: 'private', data: {title: 'Example', body: 'Exact old body', tags: ['Travel', 'Ideas'], folderId: 'folder-raw',
        sourceUri: 'https://example.test/post/1'}, search_text: 'Example Exact old body', folder_ref: 'folder-raw',
      source_uri: 'https://example.test/post/1', retained_after_uninstall: true, revision: 2,
      created_at: now, updated_at: now, deleted_at: null}).execute()
    await db.insertInto('greenfield_module_installation_settings').values({settings_id: `settings-${suffix}`, installation_id: installationId,
      module_id: moduleId, scope: 'installation', schema_version: 1, values: {defaultNoteSort: 'title', defaultFolderId: 'folder-raw',
        autoCreateTitle: true, saveSourceLink: true, confirmBeforeSavingPost: false, showRecentNotesOnBoard: true},
      secret_refs: {}, version: 2, updated_by: null, updated_at: now}).execute()
  }, 120_000)

  afterAll(async () => {
    await db?.destroy()
    if (admin) {
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [databaseName])
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`)
      await admin.end()
    }
  }, 120_000)

  const input = () => ({installationId, accountId, moduleId, fromVersion: '0.2.0', toVersion: '1.8.0', targetReleaseId})

  it('preflights without changing data and rolls back an unsupported record', async () => {
    expect(await migrateHistoricalInstallationData(db, {...input(), dryRun: true})).toEqual({records: 2, tags: 2, settings: 1})
    const before = await db.selectFrom('greenfield_module_records').select('revision').where('record_id', '=', `note-${suffix}`).executeTakeFirstOrThrow()
    expect(before.revision).toBe(2)
    const badId = `bad-${suffix}`
    await db.insertInto('greenfield_module_records').values({record_id: badId, account_id: accountId, module_id: moduleId,
      installation_id: installationId, collection: 'note', schema_ref: 'schemas/vault-note.v1.schema.json', visibility: 'private',
      data: {title: 'Unsupported', body: 'Body', tags: [], impossible: true}, search_text: '', folder_ref: null,
      source_uri: null, retained_after_uninstall: true, revision: 1, created_at: new Date(), updated_at: new Date(), deleted_at: null}).execute()
    await expect(db.transaction().execute(trx => migrateHistoricalInstallationData(trx, input()))).rejects.toThrow(/unsupported field/)
    const still = await db.selectFrom('greenfield_module_records').select('revision').where('record_id', '=', `note-${suffix}`).executeTakeFirstOrThrow()
    expect(still.revision).toBe(2)
    await db.deleteFrom('greenfield_module_records').where('record_id', '=', badId).execute()
  })

  it('archives old values and preserves installation and record identities', async () => {
    expect(await db.transaction().execute(trx => migrateHistoricalInstallationData(trx, input())))
      .toEqual({records: 2, tags: 2, settings: 1})
    const note = await db.selectFrom('greenfield_module_records').selectAll().where('record_id', '=', `note-${suffix}`).executeTakeFirstOrThrow()
    expect(note.revision).toBe(3)
    expect(note.schema_ref).toBe('schemas/note.schema.json')
    expect(note.folder_ref).toBe(`folder-${suffix}`)
    expect(note.data).toMatchObject({id: `note-${suffix}`, plainTextProjection: 'Exact old body', folderId: `folder-${suffix}`,
      document: {blocks: [{text: 'Exact old body'}]}})
    const oldVersion = await db.selectFrom('greenfield_module_record_versions').select('data_snapshot')
      .where('record_id', '=', `note-${suffix}`).where('revision', '=', 2).executeTakeFirstOrThrow()
    expect(oldVersion.data_snapshot).toMatchObject({body: 'Exact old body', tags: ['Travel', 'Ideas']})
    const settings = await db.selectFrom('greenfield_module_installation_settings').selectAll()
      .where('installation_id', '=', installationId).executeTakeFirstOrThrow()
    expect(settings.version).toBe(3)
    expect(settings.values).toEqual({defaultSort: 'title'})
    const archivedSettings = await db.selectFrom('greenfield_module_settings_versions').select('values')
      .where('settings_id', '=', settings.settings_id).where('version', '=', 2).executeTakeFirstOrThrow()
    expect(archivedSettings.values).toMatchObject({defaultFolderId: 'folder-raw', confirmBeforeSavingPost: false})
    const installation = await db.selectFrom('greenfield_extension_installations').select('status')
      .where('installation_id', '=', installationId).executeTakeFirstOrThrow()
    expect(installation.status).toBe('enabled')
    const tags = await db.selectFrom('greenfield_module_records').select('record_id')
      .where('installation_id', '=', installationId).where('collection', '=', 'tag').execute()
    expect(tags).toHaveLength(2)
  })

  it('keeps an installed-but-disabled historical installation disabled through the normal worker update', async () => {
    const disabledAccount = `disabled-account-${suffix}`
    const disabledInstall = `disabled-install-${suffix}`
    const now = new Date()
    await db.insertInto('greenfield_accounts').values({account_id: disabledAccount, primary_handle: `disabled${suffix}`,
      status: 'active', created_at: now, updated_at: now}).execute()
    await db.insertInto('greenfield_extension_installations').values({installation_id: disabledInstall,
      extension_version_id: `source-version-${suffix}`, account_id: disabledAccount, status: 'installedDisabled',
      config: {}, created_at: now, updated_at: now}).execute()
    await db.insertInto('greenfield_module_permission_reviews').values({review_id: `review-${suffix}`,
      installation_id: disabledInstall, release_id: targetReleaseId, account_id: disabledAccount,
      granted_permissions: [], denied_permissions: [], high_risk_increase: false,
      idempotency_key: `legacy-review-${suffix}`, reviewed_at: now}).execute()
    const config = {environment: 'development', moduleAllowUntrustedDevelopmentReleases: true} as WorkerConfig
    await handleModuleUpdate(db, config, {installationId: disabledInstall, targetReleaseId,
      previousStatus: 'installedDisabled', accountId: disabledAccount, moduleId, legacyTrustMigration: true})
    const updated = await db.selectFrom('greenfield_extension_installations').select(['extension_version_id', 'status'])
      .where('installation_id', '=', disabledInstall).executeTakeFirstOrThrow()
    expect(updated).toMatchObject({extension_version_id: `target-version-${suffix}`, status: 'installedDisabled'})
  })

  it('preserves a second historical identity at the trusted target without weakening ordinary install uniqueness', async () => {
    const duplicateAccount = `duplicate-account-${suffix}`
    const firstInstallation = `duplicate-first-${suffix}`
    const secondInstallation = `duplicate-second-${suffix}`
    const now = new Date()
    await db.insertInto('greenfield_accounts').values({account_id: duplicateAccount, primary_handle: `duplicate${suffix}`,
      status: 'active', created_at: now, updated_at: now}).execute()
    for (const [installationId, status, versionId] of [
      [firstInstallation, 'installedDisabled', `target-version-${suffix}`],
      [secondInstallation, 'enabled', `source-version-${suffix}`],
    ]) {
      await db.insertInto('greenfield_extension_installations').values({installation_id: installationId,
        extension_version_id: versionId, account_id: duplicateAccount, status, config: {}, created_at: now, updated_at: now}).execute()
    }
    await db.insertInto('greenfield_module_permission_reviews').values({review_id: `duplicate-review-${suffix}`,
      installation_id: secondInstallation, release_id: targetReleaseId, account_id: duplicateAccount,
      granted_permissions: [], denied_permissions: [], high_risk_increase: false,
      idempotency_key: `duplicate-review-${suffix}`, reviewed_at: now}).execute()
    const config = {environment: 'development', moduleAllowUntrustedDevelopmentReleases: true} as WorkerConfig
    await handleModuleUpdate(db, config, {installationId: secondInstallation, targetReleaseId,
      previousStatus: 'enabled', accountId: duplicateAccount, moduleId, legacyTrustMigration: true})
    const rows = await db.selectFrom('greenfield_extension_installations')
      .select(['installation_id', 'extension_version_id', 'status', 'legacy_duplicate_allowed'])
      .where('account_id', '=', duplicateAccount).orderBy('installation_id').execute()
    expect(rows).toEqual([
      {installation_id: firstInstallation, extension_version_id: `target-version-${suffix}`,
        status: 'installedDisabled', legacy_duplicate_allowed: false},
      {installation_id: secondInstallation, extension_version_id: `target-version-${suffix}`,
        status: 'enabled', legacy_duplicate_allowed: true},
    ])
    await expect(db.insertInto('greenfield_extension_installations').values({installation_id: `duplicate-ordinary-${suffix}`,
      extension_version_id: `target-version-${suffix}`, account_id: duplicateAccount, status: 'enabled', config: {},
      created_at: now, updated_at: now}).execute()).rejects.toMatchObject({code: '23505'})
  })
})
