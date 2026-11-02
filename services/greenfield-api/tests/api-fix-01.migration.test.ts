import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import pg from 'pg'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {listMigrationFiles, migrateDown, migrateStatus, migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_ADMIN_DATABASE_URL
const describeIfDb = databaseUrl && adminDatabaseUrl ? describe : describe.skip

describeIfDb.sequential('API-FIX-01, module-platform, distribution, Premium and closeout migrations through 087', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const predecessorDatabase = `modula_api_fix_01_pre_${suffix}`
  const freshDatabase = `modula_api_fix_01_fresh_${suffix}`
  const qaDatabase = `modula_api_fix_01_qa_${suffix}`
  let adminPool: pg.Pool
  let predecessorUrl: string
  let freshUrl: string
  let qaUrl: string
  let predecessorMigrationsDir: string
  let qaMigrationsDir: string

  beforeAll(async () => {
    adminPool = new pg.Pool({connectionString: adminDatabaseUrl!})
    await adminPool.query(`CREATE DATABASE "${predecessorDatabase}" OWNER modula_migrator`)
    await adminPool.query(`CREATE DATABASE "${freshDatabase}" OWNER modula_migrator`)
    await adminPool.query(`CREATE DATABASE "${qaDatabase}" OWNER modula_migrator`)
    const predecessor = new URL(databaseUrl!)
    predecessor.pathname = `/${predecessorDatabase}`
    predecessorUrl = predecessor.toString()
    const fresh = new URL(databaseUrl!)
    fresh.pathname = `/${freshDatabase}`
    freshUrl = fresh.toString()
    const qa = new URL(databaseUrl!)
    qa.pathname = `/${qaDatabase}`
    qaUrl = qa.toString()

    predecessorMigrationsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'modula-migrations-065-'))
    qaMigrationsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'modula-migrations-qa-076-'))
    for (const migration of await listMigrationFiles()) {
      if (Number(migration.id.slice(0, 3)) > 65) continue
      await fs.copyFile(migration.file, path.join(predecessorMigrationsDir, migration.name))
    }
    for (const migration of await listMigrationFiles()) {
      if (Number(migration.id.slice(0, 3)) > 75) continue
      await fs.copyFile(migration.file, path.join(qaMigrationsDir, migration.name))
    }
    const optionalMediaMigration = (await listMigrationFiles()).find(migration => migration.id === '077_optional_package_media')
    if (!optionalMediaMigration) throw new Error('Canonical optional-package migration is missing')
    const canonicalOptionalMedia = await fs.readFile(optionalMediaMigration.file, 'utf8')
    await fs.writeFile(
      path.join(qaMigrationsDir, '076_optional_package_media.sql'),
      canonicalOptionalMedia.replace("VALUES ('schema_version', '077')", "VALUES ('schema_version', '076')"),
    )
  }, 120_000)

  afterAll(async () => {
    if (adminPool) {
      for (const database of [predecessorDatabase, freshDatabase, qaDatabase]) {
        await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [database])
        await adminPool.query(`DROP DATABASE IF EXISTS "${database}"`)
      }
      await adminPool.end()
    }
    if (predecessorMigrationsDir) await fs.rm(predecessorMigrationsDir, {recursive: true, force: true})
    if (qaMigrationsDir) await fs.rm(qaMigrationsDir, {recursive: true, force: true})
  }, 120_000)

  it('migrates a production-like 065 database without granting or deleting relationship history', async () => {
    await migrateUp(predecessorUrl, predecessorMigrationsDir)
    const client = new pg.Client({connectionString: predecessorUrl})
    await client.connect()
    const now = new Date()
    await client.query(
      `INSERT INTO greenfield_accounts (account_id, primary_handle, status, created_at, updated_at)
       VALUES ('migration-account-a', 'migrationa', 'active', $1, $1),
              ('migration-account-b', 'migrationb', 'active', $1, $1)`,
      [now],
    )
    await client.query(
      `INSERT INTO actors (id, account_id, kind, created_at, updated_at, deleted_at, version)
       VALUES ('migration-actor-a', 'migration-account-a', 'person', $1, $1, NULL, 1),
              ('migration-actor-b', 'migration-account-b', 'person', $1, $1, NULL, 1)`,
      [now],
    )
    await client.query(
      `INSERT INTO follows (id, follower_actor_id, followed_actor_id, created_at, updated_at, deleted_at, version)
       VALUES ('migration-follow', 'migration-actor-a', 'migration-actor-b', $1, $1, NULL, 1)`,
      [now],
    )
    await client.query(
      `INSERT INTO notifications (
         id, recipient_actor_id, actor_id, type, category, channels, dedupe_key, aggregate_count,
         aggregate_window_started_at, last_aggregated_at, resource_type, resource_id, body,
         read_at, created_at, updated_at, deleted_at, version
       ) VALUES (
         'migration-notification', 'migration-actor-b', 'migration-actor-a', 'like', 'social', '["in-app"]',
         'social:reaction:post:migration-post', 1, $1, $1, 'post', 'migration-post', 'reacted to your post',
         NULL, $1, $1, NULL, 1
       )`,
      [now],
    )
    await client.end()

    expect(await migrateUp(predecessorUrl)).toEqual([
      '066_trust_privacy_fail_closed', '067_legacy_duplicate_installation_versions',
      '068_module_platform_records', '069_module_platform_media_sharing',
      '070_module_platform_functions_actions', '071_module_record_search_projection',
      '072_module_distribution_protocol', '073_backup_sequence_acl_defaults',
      '074_greenfield_v1_query_indexes', '075_greenfield_messaging',
      '076_greenfield_premium_entitlements', '077_optional_package_media',
      '078_gubic_game_catalogue', '079_story_attachment_pipeline', '080_push_notifications', '081_messaging_v2', '082_gubic_play_platform', '083_moliboo_game_systems',
      '087_greenfield_premium_apple_sandbox',
    ])
    const verified = new pg.Client({connectionString: predecessorUrl})
    await verified.connect()
    const version = await verified.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
    const follows = await verified.query(`SELECT count(*)::int AS count FROM follows WHERE id = 'migration-follow' AND deleted_at IS NULL`)
    const notifications = await verified.query(`SELECT count(*)::int AS count FROM notifications WHERE id = 'migration-notification' AND deleted_at IS NULL`)
    const requests = await verified.query(`SELECT count(*)::int AS count FROM follow_requests`)
    expect(version.rows[0]?.value).toBe('087')
    expect(follows.rows[0]?.count).toBe(1)
    expect(notifications.rows[0]?.count).toBe(1)
    expect(requests.rows[0]?.count).toBe(0)
    await verified.end()
  }, 120_000)

  it('applies the full migration chain to a fresh database', async () => {
    const applied = await migrateUp(freshUrl)
    expect(applied.at(-1)).toBe('087_greenfield_premium_apple_sandbox')
    const client = new pg.Client({connectionString: freshUrl})
    await client.connect()
    const table = await client.query(`SELECT to_regclass('public.follow_requests') AS name`)
    const constraints = await client.query(
      `SELECT count(*)::int AS count FROM pg_constraint
       WHERE conrelid = 'follow_requests'::regclass
         AND contype IN ('p', 'u', 'c', 'f')`,
    )
    expect(table.rows[0]?.name).toBe('follow_requests')
    expect(constraints.rows[0]?.count).toBeGreaterThanOrEqual(5)
    const optionalMedia = await client.query(`
      SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conname = 'greenfield_release_asset_blobs_media_type_check'
    `)
    expect(optionalMedia.rows[0]?.definition).toContain('application/vnd.modula.web-runtime+tgz')
    await client.end()

    expect(await migrateDown(freshUrl)).toBe('087_greenfield_premium_apple_sandbox')

    const rolledBackApplePremium = new pg.Client({connectionString: freshUrl})
    await rolledBackApplePremium.connect()
    const appleTransactions = await rolledBackApplePremium.query(`SELECT to_regclass('public.greenfield_premium_apple_transactions') AS name`)
    const versionAfter087 = await rolledBackApplePremium.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
    expect(appleTransactions.rows[0]?.name).toBeNull()
    expect(versionAfter087.rows[0]?.value).toBe('086')
    await rolledBackApplePremium.end()

    // Migrations 084-086 belong to the separately reviewed PR-01, PR-04 and
    // PR-05 branches. Until those are approved into the shared base, this
    // direct Premium branch proceeds from reserved schema version 086 to the
    // current 083 ledger entry.
    expect(await migrateDown(freshUrl)).toBe('083_moliboo_game_systems')

    const rolledBackMoliboo = new pg.Client({connectionString: freshUrl})

    await rolledBackMoliboo.connect()

    const molibooTable = await rolledBackMoliboo.query(`SELECT to_regclass('public.greenfield_moliboo_inventory') AS name`)

    const versionAfter083 = await rolledBackMoliboo.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)

    expect(molibooTable.rows[0]?.name).toBeNull()

    expect(versionAfter083.rows[0]?.value).toBe('082')

    await rolledBackMoliboo.end()


    expect(await migrateDown(freshUrl)).toBe('082_gubic_play_platform')

    const rolledBackGubicPlay = new pg.Client({connectionString: freshUrl})

    await rolledBackGubicPlay.connect()

    const gubicPlayTable = await rolledBackGubicPlay.query(`SELECT to_regclass('public.greenfield_gubic_lobbies') AS name`)

    const versionAfter082 = await rolledBackGubicPlay.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)

    expect(gubicPlayTable.rows[0]?.name).toBeNull()

    expect(versionAfter082.rows[0]?.value).toBe('081')

    await rolledBackGubicPlay.end()


    expect(await migrateDown(freshUrl)).toBe('081_messaging_v2')

    expect(await migrateDown(freshUrl)).toBe('080_push_notifications')
    expect(await migrateDown(freshUrl)).toBe('079_story_attachment_pipeline')
    const rolledBackStoryAttachments = new pg.Client({connectionString: freshUrl})
    await rolledBackStoryAttachments.connect()
    const attachmentColumn = await rolledBackStoryAttachments.query(`
      SELECT count(*)::int AS count FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'greenfield_story_items' AND column_name = 'attachment_id'
    `)
    const versionAfter079 = await rolledBackStoryAttachments.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
    expect(attachmentColumn.rows[0]?.count).toBe(0)
    expect(versionAfter079.rows[0]?.value).toBe('078')
    await rolledBackStoryAttachments.end()

    expect(await migrateDown(freshUrl)).toBe('078_gubic_game_catalogue')
    const rolledBackGubic = new pg.Client({connectionString: freshUrl})
    await rolledBackGubic.connect()
    const gubicTable = await rolledBackGubic.query(`SELECT to_regclass('public.greenfield_game_catalogue_entries') AS name`)
    const versionAfter078 = await rolledBackGubic.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
    expect(gubicTable.rows[0]?.name).toBeNull()
    expect(versionAfter078.rows[0]?.value).toBe('077')
    await rolledBackGubic.end()

    expect(await migrateDown(freshUrl)).toBe('077_optional_package_media')
    const rolledBackOptionalMedia = new pg.Client({connectionString: freshUrl})
    await rolledBackOptionalMedia.connect()
    const oldMediaConstraint = await rolledBackOptionalMedia.query(`
      SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conname = 'greenfield_release_asset_blobs_media_type_check'
    `)
    const versionAfter077 = await rolledBackOptionalMedia.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
    expect(oldMediaConstraint.rows[0]?.definition).not.toContain('application/vnd.modula.web-runtime+tgz')
    expect(versionAfter077.rows[0]?.value).toBe('076')
    await rolledBackOptionalMedia.end()

    expect(await migrateDown(freshUrl)).toBe('076_greenfield_premium_entitlements')
    const rolledBackPremium = new pg.Client({connectionString: freshUrl})
    await rolledBackPremium.connect()
    const premiumTable = await rolledBackPremium.query(`SELECT to_regclass('public.greenfield_premium_memberships') AS name`)
    const verificationTable = await rolledBackPremium.query(`SELECT to_regclass('public.greenfield_verification_statuses') AS name`)
    const versionAfter076 = await rolledBackPremium.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
    expect(premiumTable.rows[0]?.name).toBeNull()
    expect(verificationTable.rows[0]?.name).toBeNull()
    expect(versionAfter076.rows[0]?.value).toBe('075')
    await rolledBackPremium.end()

    expect(await migrateDown(freshUrl)).toBe('075_greenfield_messaging')
    const rolledBackMessaging = new pg.Client({connectionString: freshUrl})
    await rolledBackMessaging.connect()
    const messagingTable = await rolledBackMessaging.query(`SELECT to_regclass('public.greenfield_conversations') AS name`)
    const versionAfter075 = await rolledBackMessaging.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
    expect(messagingTable.rows[0]?.name).toBeNull()
    expect(versionAfter075.rows[0]?.value).toBe('074')
    await rolledBackMessaging.end()

    expect(await migrateDown(freshUrl)).toBe('074_greenfield_v1_query_indexes')
    const rolledBack = new pg.Client({connectionString: freshUrl})
    await rolledBack.connect()
    const recordIndex = await rolledBack.query(`SELECT to_regclass('public.greenfield_module_records_active_list_idx') AS name`)
    const versionAfter074 = await rolledBack.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
    expect(recordIndex.rows[0]?.name).toBeNull()
    expect(versionAfter074.rows[0]?.value).toBe('073')
    await rolledBack.end()

    expect(await migrateDown(freshUrl)).toBe('073_backup_sequence_acl_defaults')
    const rolledBackBackupAcl = new pg.Client({connectionString: freshUrl})
    await rolledBackBackupAcl.connect()
    const sequencePrivilege = await rolledBackBackupAcl.query(
      `SELECT has_sequence_privilege(
         'modula_backup',
         'greenfield_module_record_changes_change_sequence_seq',
         'SELECT'
       ) AS allowed`,
    )
    const version = await rolledBackBackupAcl.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
    expect(sequencePrivilege.rows[0]?.allowed).toBe(false)
    expect(version.rows[0]?.value).toBe('072')
    await rolledBackBackupAcl.end()

    expect(await migrateUp(freshUrl)).toEqual([
      '073_backup_sequence_acl_defaults', '074_greenfield_v1_query_indexes',
      '075_greenfield_messaging', '076_greenfield_premium_entitlements',
      '077_optional_package_media', '078_gubic_game_catalogue', '079_story_attachment_pipeline', '080_push_notifications', '081_messaging_v2', '082_gubic_play_platform', '083_moliboo_game_systems',
      '087_greenfield_premium_apple_sandbox',
    ])
    const reapplied = new pg.Client({connectionString: freshUrl})
    await reapplied.connect()
    const restoredPrivilege = await reapplied.query(
      `SELECT has_sequence_privilege(
         'modula_backup',
         'greenfield_module_record_changes_change_sequence_seq',
         'SELECT'
       ) AS allowed`,
    )
    expect(restoredPrivilege.rows[0]?.allowed).toBe(true)
    const restoredIndex = await reapplied.query(`SELECT to_regclass('public.greenfield_module_records_active_list_idx') AS name`)
    expect(restoredIndex.rows[0]?.name).toBe('greenfield_module_records_active_list_idx')
    await reapplied.end()
  }, 120_000)

  it('upgrades the legacy QA 076 package ledger without unknown migrations or record loss', async () => {
    await migrateUp(qaUrl, qaMigrationsDir)
    const before = new pg.Client({connectionString: qaUrl})
    await before.connect()
    await before.query(
      `INSERT INTO greenfield_accounts (account_id, primary_handle, status, created_at, updated_at)
       VALUES ('qa-migration-account', 'qamigrationaccount', 'active', NOW(), NOW())`,
    )
    await before.end()

    expect(await migrateUp(qaUrl)).toEqual([
      '076_greenfield_premium_entitlements', '077_optional_package_media', '078_gubic_game_catalogue',
      '079_story_attachment_pipeline', '080_push_notifications', '081_messaging_v2', '082_gubic_play_platform', '083_moliboo_game_systems',
      '087_greenfield_premium_apple_sandbox',
    ])
    const status = await migrateStatus(qaUrl)
    expect(status.pending).toEqual([])
    expect(status.unknown).toEqual([])
    expect(status.applied).toContain('076_optional_package_media')

    const after = new pg.Client({connectionString: qaUrl})
    await after.connect()
    const version = await after.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
    const account = await after.query(`SELECT count(*)::int AS count FROM greenfield_accounts WHERE account_id = 'qa-migration-account'`)
    const optionalMedia = await after.query(`
      SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conname = 'greenfield_release_asset_blobs_media_type_check'
    `)
    expect(version.rows[0]?.value).toBe('087')
    expect(account.rows[0]?.count).toBe(1)
    expect(optionalMedia.rows[0]?.definition).toContain('application/vnd.modula.web-runtime+tgz')
    await after.end()
  }, 120_000)
})
