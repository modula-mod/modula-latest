import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import pg from 'pg'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {listMigrationFiles, migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_ADMIN_DATABASE_URL
const describeIfDb = databaseUrl && adminDatabaseUrl ? describe : describe.skip

describeIfDb.sequential('API-FIX-01, module-platform and distribution migrations through 072', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const predecessorDatabase = `modula_api_fix_01_pre_${suffix}`
  const freshDatabase = `modula_api_fix_01_fresh_${suffix}`
  let adminPool: pg.Pool
  let predecessorUrl: string
  let freshUrl: string
  let predecessorMigrationsDir: string

  beforeAll(async () => {
    adminPool = new pg.Pool({connectionString: adminDatabaseUrl!})
    await adminPool.query(`CREATE DATABASE "${predecessorDatabase}" OWNER modula_migrator`)
    await adminPool.query(`CREATE DATABASE "${freshDatabase}" OWNER modula_migrator`)
    const predecessor = new URL(databaseUrl!)
    predecessor.pathname = `/${predecessorDatabase}`
    predecessorUrl = predecessor.toString()
    const fresh = new URL(databaseUrl!)
    fresh.pathname = `/${freshDatabase}`
    freshUrl = fresh.toString()

    predecessorMigrationsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'modula-migrations-065-'))
    for (const migration of await listMigrationFiles()) {
      if (Number(migration.id.slice(0, 3)) > 65) continue
      await fs.copyFile(migration.file, path.join(predecessorMigrationsDir, migration.name))
    }
  }, 120_000)

  afterAll(async () => {
    if (adminPool) {
      for (const database of [predecessorDatabase, freshDatabase]) {
        await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [database])
        await adminPool.query(`DROP DATABASE IF EXISTS "${database}"`)
      }
      await adminPool.end()
    }
    if (predecessorMigrationsDir) await fs.rm(predecessorMigrationsDir, {recursive: true, force: true})
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
      '072_module_distribution_protocol',
    ])
    const verified = new pg.Client({connectionString: predecessorUrl})
    await verified.connect()
    const version = await verified.query(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
    const follows = await verified.query(`SELECT count(*)::int AS count FROM follows WHERE id = 'migration-follow' AND deleted_at IS NULL`)
    const notifications = await verified.query(`SELECT count(*)::int AS count FROM notifications WHERE id = 'migration-notification' AND deleted_at IS NULL`)
    const requests = await verified.query(`SELECT count(*)::int AS count FROM follow_requests`)
    expect(version.rows[0]?.value).toBe('072')
    expect(follows.rows[0]?.count).toBe(1)
    expect(notifications.rows[0]?.count).toBe(1)
    expect(requests.rows[0]?.count).toBe(0)
    await verified.end()
  }, 120_000)

  it('applies the full migration chain to a fresh database', async () => {
    const applied = await migrateUp(freshUrl)
    expect(applied.at(-1)).toBe('072_module_distribution_protocol')
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
    await client.end()
  }, 120_000)
})
