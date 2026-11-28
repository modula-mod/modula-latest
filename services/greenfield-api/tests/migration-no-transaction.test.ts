import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import pg from 'pg'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {NO_TRANSACTION_DIRECTIVE, migrateDown, migrateStatus, migrateUp} from '../src/database/migrate.js'

// Runner support for migrations that must run outside a transaction
// (098_messaging_expiry_index_concurrently uses CREATE INDEX CONCURRENTLY).
const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_ADMIN_DATABASE_URL
const describeIfDb = databaseUrl && adminDatabaseUrl ? describe : describe.skip

describeIfDb.sequential('migration runner: no-transaction migrations', () => {
  const database = `modula_notx_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  let adminPool: pg.Pool
  let url = ''
  let dir = ''

  const write = (name: string, sql: string) => fs.writeFile(path.join(dir, name), sql)
  const query = async (sql: string) => {
    const client = new pg.Client({connectionString: url})
    await client.connect()
    try {
      return (await client.query(sql)).rows
    } finally {
      await client.end()
    }
  }

  beforeAll(async () => {
    adminPool = new pg.Pool({connectionString: adminDatabaseUrl!})
    const owner = decodeURIComponent(new URL(databaseUrl!).username)
    await adminPool.query(`CREATE DATABASE "${database}" OWNER "${owner}"`)
    const target = new URL(databaseUrl!)
    target.pathname = `/${database}`
    url = target.toString()
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'modula-notx-'))
    await write('001_base.sql', 'CREATE TABLE notx_items (id int PRIMARY KEY, expires_at timestamptz);\nINSERT INTO notx_items SELECT g, now() FROM generate_series(1, 50) g;\n')
    await write('001_base.down.sql', 'DROP TABLE notx_items;\n')
    await write('002_index.sql', `${NO_TRANSACTION_DIRECTIVE}
-- built without blocking writers
DROP INDEX CONCURRENTLY IF EXISTS notx_items_expiry_idx;
CREATE INDEX CONCURRENTLY notx_items_expiry_idx
  ON notx_items (expires_at)
  WHERE expires_at IS NOT NULL;
`)
    await write('002_index.down.sql', `${NO_TRANSACTION_DIRECTIVE}\nDROP INDEX CONCURRENTLY IF EXISTS notx_items_expiry_idx;\n`)
  })

  afterAll(async () => {
    if (dir) await fs.rm(dir, {recursive: true, force: true})
    if (adminPool) {
      await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [database])
      await adminPool.query(`DROP DATABASE IF EXISTS "${database}"`)
      await adminPool.end()
    }
  })

  it('applies a CONCURRENTLY index outside the transaction and records it in the ledger', async () => {
    expect(await migrateUp(url, dir)).toEqual(['001_base', '002_index'])
    const [index] = await query(`SELECT indisvalid FROM pg_index WHERE indexrelid = to_regclass('public.notx_items_expiry_idx')`)
    expect(index?.indisvalid).toBe(true)
    expect((await migrateStatus(url, dir)).pending).toEqual([])
    // The session lock is released afterwards: a second run is a no-op, not a hang.
    expect(await migrateUp(url, dir)).toEqual([])
    const locks = await query(`SELECT count(*)::int AS count FROM pg_locks WHERE locktype = 'advisory' AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`)
    expect(locks[0]?.count).toBe(0)
  })

  it('rolls a no-transaction migration back outside a transaction', async () => {
    expect(await migrateDown(url, dir)).toBe('002_index')
    const [index] = await query(`SELECT to_regclass('public.notx_items_expiry_idx') AS name`)
    expect(index?.name).toBeNull()
    expect((await migrateStatus(url, dir)).pending).toEqual(['002_index'])
  })

  it('keeps earlier migrations committed and the ledger row absent when it fails, and a re-run heals', async () => {
    await write('003_after.sql', 'CREATE TABLE notx_after (id int);\n')
    await write('003_after.down.sql', 'DROP TABLE notx_after;\n')
    // Duplicate key makes a UNIQUE CONCURRENTLY build fail and leave an INVALID index.
    await write('002_index.sql', `${NO_TRANSACTION_DIRECTIVE}
DROP INDEX CONCURRENTLY IF EXISTS notx_items_expiry_idx;
CREATE UNIQUE INDEX CONCURRENTLY notx_items_expiry_idx ON notx_items (expires_at) WHERE expires_at IS NOT NULL;
`)
    await query(`UPDATE notx_items SET expires_at = '2026-01-01T00:00:00Z'`)
    await expect(migrateUp(url, dir)).rejects.toThrow()
    const status = await migrateStatus(url, dir)
    expect(status.applied).toEqual(['001_base'])
    expect(status.pending).toEqual(['002_index', '003_after'])
    const [invalid] = await query(`SELECT indisvalid FROM pg_index WHERE indexrelid = to_regclass('public.notx_items_expiry_idx')`)
    expect(invalid?.indisvalid).toBe(false)
    const [after] = await query(`SELECT to_regclass('public.notx_after') AS name`)
    expect(after?.name).toBeNull()

    // Fix the data and re-run: the leading DROP ... IF EXISTS clears the INVALID index.
    await query(`UPDATE notx_items SET expires_at = now() + (id || ' minutes')::interval`)
    expect(await migrateUp(url, dir)).toEqual(['002_index', '003_after'])
    const [valid] = await query(`SELECT indisvalid FROM pg_index WHERE indexrelid = to_regclass('public.notx_items_expiry_idx')`)
    expect(valid?.indisvalid).toBe(true)
    const locks = await query(`SELECT count(*)::int AS count FROM pg_locks WHERE locktype = 'advisory' AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`)
    expect(locks[0]?.count).toBe(0)
  })
})
