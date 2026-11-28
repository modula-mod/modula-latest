import {createHash, randomUUID} from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {listMigrationFiles, migrateDown, migrateStatus, migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_ADMIN_DATABASE_URL
const describeIfDb = databaseUrl && adminDatabaseUrl ? describe : describe.skip
const protectedTimestamp = '2026-01-01T00:00:00.000Z'

type ForwardOnlyTip = 93 | 94 | 95
type MigrationTip = 91 | ForwardOnlyTip

type Fixture = {
  database: string
  url: string
  migrationsDir: string
  expectedTip: string
  keyId: string
  keyEventId: string
  auditEventId: string
}

async function copyMigrationsThrough(destination: string, tip: MigrationTip): Promise<void> {
  await fs.mkdir(destination, {recursive: true})
  for (const migration of await listMigrationFiles()) {
    if (Number.parseInt(migration.id.slice(0, 3), 10) > tip) continue
    await fs.copyFile(migration.file, path.join(destination, migration.name))
    const downName = migration.name.replace(/\.sql$/, '.down.sql')
    await fs.copyFile(migration.file.replace(/\.sql$/, '.down.sql'), path.join(destination, downName))
  }
}

async function seedProtectedHistory(
  url: string,
  tip: ForwardOnlyTip,
): Promise<Pick<Fixture, 'keyId' | 'keyEventId' | 'auditEventId'>> {
  const client = new pg.Client({connectionString: url})
  const keyId = `forward-only-key-${tip}-${randomUUID()}`
  const keyEventId = `forward-only-event-${tip}-${randomUUID()}`
  const auditEventId = `psae_${randomUUID()}`
  const fingerprint = `sha256:${createHash('sha256').update(keyId).digest('hex')}`
  await client.connect()
  try {
    await client.query(
      `INSERT INTO greenfield_publisher_signing_keys (
         key_id, publisher_id, algorithm, public_key_pem, fingerprint, state,
         valid_from, valid_until, rotated_at, rotated_to_key_id, revoked_at,
         revocation_reason, registered_by_account_id, created_at, updated_at
       ) VALUES (
         $1, 'modula', 'Ed25519',
         '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n-----END PUBLIC KEY-----',
         $2, 'ACTIVE', $3, NULL, NULL, NULL, NULL, NULL, NULL, $3, $3
       )`,
      [keyId, fingerprint, protectedTimestamp],
    )
    await client.query(
      `INSERT INTO greenfield_publisher_signing_key_events (
         event_id, key_id, publisher_id, event_type, related_key_id, reason,
         actor_account_id, created_at
       ) VALUES ($1, $2, 'modula', 'registered', NULL, 'forward-only protected history', NULL, $3)`,
      [keyEventId, keyId, protectedTimestamp],
    )
    await client.query(
      `INSERT INTO greenfield_publisher_signing_audit_events (
         event_id, event_type, publisher_id, receipt, details, created_at
       ) VALUES (
         $1, 'signing_failed', 'modula', '{}'::jsonb,
         jsonb_build_object('fixture', 'forward-only-protection', 'schemaTip', $2::int), $3
       )`,
      [auditEventId, tip, protectedTimestamp],
    )
  } finally {
    await client.end()
  }
  return {keyId, keyEventId, auditEventId}
}

async function captureDatabaseState(fixture: Fixture) {
  const client = new pg.Client({connectionString: fixture.url})
  await client.connect()
  try {
    const ledger = await client.query(`SELECT id, name, applied_at::text FROM schema_migrations ORDER BY id`)
    const metadata = await client.query(`SELECT key, value, updated_at::text FROM schema_metadata ORDER BY key`)
    const schema = await client.query(`
        WITH schema_objects AS (
          SELECT 'relation'::text AS kind,
            pg_catalog.quote_ident(namespace.nspname) || '.' || pg_catalog.quote_ident(class.relname) AS identity,
            class.relkind::text || '|' || pg_catalog.pg_get_userbyid(class.relowner) || '|' || COALESCE(class.relacl::text, '') AS definition
          FROM pg_catalog.pg_class AS class
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
          WHERE namespace.nspname = 'public'
          UNION ALL
          SELECT 'column',
            pg_catalog.quote_ident(namespace.nspname) || '.' || pg_catalog.quote_ident(class.relname) || '.' || pg_catalog.quote_ident(attribute.attname),
            pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
              || '|not-null=' || attribute.attnotnull::text
              || '|default=' || COALESCE(pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid), '')
          FROM pg_catalog.pg_attribute AS attribute
          JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
          LEFT JOIN pg_catalog.pg_attrdef AS default_value
            ON default_value.adrelid = attribute.attrelid AND default_value.adnum = attribute.attnum
          WHERE namespace.nspname = 'public' AND attribute.attnum > 0 AND NOT attribute.attisdropped
          UNION ALL
          SELECT 'constraint',
            pg_catalog.quote_ident(namespace.nspname) || '.' || pg_catalog.quote_ident(class.relname) || '.' || pg_catalog.quote_ident(constraint_row.conname),
            pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
          FROM pg_catalog.pg_constraint AS constraint_row
          JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
          WHERE namespace.nspname = 'public'
          UNION ALL
          SELECT 'index',
            pg_catalog.quote_ident(namespace.nspname) || '.' || pg_catalog.quote_ident(index_class.relname),
            pg_catalog.pg_get_indexdef(index_row.indexrelid)
          FROM pg_catalog.pg_index AS index_row
          JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index_row.indexrelid
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = index_class.relnamespace
          WHERE namespace.nspname = 'public'
          UNION ALL
          SELECT 'trigger',
            pg_catalog.quote_ident(namespace.nspname) || '.' || pg_catalog.quote_ident(class.relname) || '.' || pg_catalog.quote_ident(trigger_row.tgname),
            pg_catalog.pg_get_triggerdef(trigger_row.oid, true)
          FROM pg_catalog.pg_trigger AS trigger_row
          JOIN pg_catalog.pg_class AS class ON class.oid = trigger_row.tgrelid
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
          WHERE namespace.nspname = 'public' AND NOT trigger_row.tgisinternal
          UNION ALL
          SELECT 'function',
            pg_catalog.quote_ident(namespace.nspname) || '.' || pg_catalog.quote_ident(proc.proname)
              || '(' || pg_catalog.pg_get_function_identity_arguments(proc.oid) || ')',
            pg_catalog.pg_get_functiondef(proc.oid) || '|acl=' || COALESCE(proc.proacl::text, '')
          FROM pg_catalog.pg_proc AS proc
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = proc.pronamespace
          WHERE namespace.nspname = 'public' AND proc.prokind IN ('f', 'p')
          UNION ALL
          SELECT 'policy',
            pg_catalog.quote_ident(namespace.nspname) || '.' || pg_catalog.quote_ident(class.relname) || '.' || pg_catalog.quote_ident(policy.polname),
            policy.polcmd::text || '|permissive=' || policy.polpermissive::text
              || '|roles=' || policy.polroles::text
              || '|using=' || COALESCE(pg_catalog.pg_get_expr(policy.polqual, policy.polrelid), '')
              || '|check=' || COALESCE(pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid), '')
          FROM pg_catalog.pg_policy AS policy
          JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
          WHERE namespace.nspname = 'public'
        )
        SELECT kind, identity, definition FROM schema_objects ORDER BY kind, identity, definition
      `)
    const signingKey = await client.query(`SELECT row_to_json(history)::text AS row FROM (
        SELECT * FROM greenfield_publisher_signing_keys WHERE key_id = $1
      ) AS history`, [fixture.keyId])
    const keyEvent = await client.query(`SELECT row_to_json(history)::text AS row FROM (
        SELECT * FROM greenfield_publisher_signing_key_events WHERE event_id = $1
      ) AS history`, [fixture.keyEventId])
    const auditEvent = await client.query(`SELECT row_to_json(history)::text AS row FROM (
        SELECT * FROM greenfield_publisher_signing_audit_events WHERE event_id = $1
      ) AS history`, [fixture.auditEventId])
    expect(signingKey.rowCount).toBe(1)
    expect(keyEvent.rowCount).toBe(1)
    expect(auditEvent.rowCount).toBe(1)
    return {
      ledger: ledger.rows,
      metadata: metadata.rows,
      schemaObjectCount: schema.rowCount,
      schemaSha256: createHash('sha256').update(JSON.stringify(schema.rows)).digest('hex'),
      protectedHistory: {
        signingKey: signingKey.rows[0]?.row,
        keyEvent: keyEvent.rows[0]?.row,
        auditEvent: auditEvent.rows[0]?.row,
      },
    }
  } finally {
    await client.end()
  }
}

describeIfDb.sequential('publisher forward-only migration protections at exact schema tips', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const fixtures = new Map<ForwardOnlyTip, Fixture>()
  const createdDatabases = new Set<string>()
  let adminPool: pg.Pool
  let temporaryRoot: string
  let through091: string

  beforeAll(async () => {
    adminPool = new pg.Pool({connectionString: adminDatabaseUrl!})
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'modula-forward-only-'))
    through091 = path.join(temporaryRoot, 'through-091')
    await copyMigrationsThrough(through091, 91)

    for (const tip of [93, 94, 95] as const) {
      const database = `modula_forward_${tip}_${suffix}`
      const migrationsDir = path.join(temporaryRoot, `through-${tip}`)
      await copyMigrationsThrough(migrationsDir, tip)
      await adminPool.query(`CREATE DATABASE "${database}" OWNER modula_migrator`)
      createdDatabases.add(database)
      const url = new URL(databaseUrl!)
      url.pathname = `/${database}`
      await migrateUp(url.toString(), through091)
      const protectedHistory = await seedProtectedHistory(url.toString(), tip)
      const applied = await migrateUp(url.toString(), migrationsDir)
      const expectedTip = `${String(tip).padStart(3, '0')}_${tip === 93
        ? 'publisher_release_governance_integrity'
        : tip === 94
          ? 'publisher_signing_governance_hardening'
          : 'publisher_signing_integration_completion'}`
      expect(applied.at(-1)).toBe(expectedTip)
      fixtures.set(tip, {database, url: url.toString(), migrationsDir, expectedTip, ...protectedHistory})
    }
  }, 300_000)

  afterAll(async () => {
    if (adminPool) {
      for (const database of createdDatabases) {
        await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [database])
        await adminPool.query(`DROP DATABASE IF EXISTS "${database}"`)
      }
      await adminPool.end()
    }
    if (temporaryRoot) await fs.rm(temporaryRoot, {recursive: true, force: true})
  }, 120_000)

  for (const tip of [93, 94, 95] as const) {
    it(`rejects downgrade ${tip} without changing ledger, schema, or protected history`, async () => {
      const fixture = fixtures.get(tip)
      if (!fixture) throw new Error(`schema-${tip} fixture was not prepared`)
      const statusBefore = await migrateStatus(fixture.url, fixture.migrationsDir)
      expect(statusBefore.applied.at(-1)).toBe(fixture.expectedTip)
      expect(statusBefore.pending).toEqual([])
      expect(statusBefore.unknown).toEqual([])
      const before = await captureDatabaseState(fixture)
      expect(before.metadata).toEqual(expect.arrayContaining([
        expect.objectContaining({key: 'schema_version', value: String(tip).padStart(3, '0')}),
      ]))

      await expect(migrateDown(fixture.url, fixture.migrationsDir))
        .rejects.toThrow(new RegExp(`unsafe automated downgrade of ${String(tip).padStart(3, '0')} is prohibited`, 'i'))

      const statusAfter = await migrateStatus(fixture.url, fixture.migrationsDir)
      const after = await captureDatabaseState(fixture)
      expect(statusAfter).toEqual(statusBefore)
      expect(after).toEqual(before)
    }, 120_000)
  }
})
