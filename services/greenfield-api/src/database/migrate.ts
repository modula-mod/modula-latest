import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATION_ADVISORY_LOCK_KEY = 7_314_202_610_14

export type MigrationRecord = {
  id: string
  name: string
  applied_at: Date
}

async function ensureMigrationsTable(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

export async function listMigrationFiles(migrationsDir?: string): Promise<Array<{id: string; name: string; file: string}>> {
  const dir = migrationsDir ?? path.resolve(__dirname, '../../migrations')
  const entries = await fs.readdir(dir)
  return entries
    .filter(name => name.endsWith('.sql') && !name.includes('.down.'))
    .sort()
    .map(file => {
      const id = file.replace(/\.sql$/, '')
      return {id, name: file, file: path.join(dir, file)}
    })
}

export async function migrateUp(connectionString: string, migrationsDir?: string): Promise<string[]> {
  const pool = new pg.Pool({connectionString})
  const client = await pool.connect()
  const applied: string[] = []
  try {
    await client.query('BEGIN')
    // A transaction-scoped advisory lock serializes every migration runner,
    // including operators using different checkouts of the same database.
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY])
    await ensureMigrationsTable(client)
    const {rows} = await client.query<MigrationRecord>('SELECT id, name, applied_at FROM schema_migrations ORDER BY id')
    const done = new Set(rows.map(r => r.id))
    for (const migration of await listMigrationFiles(migrationsDir)) {
      if (done.has(migration.id)) continue
      const sql = await fs.readFile(migration.file, 'utf8')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [migration.id, migration.name])
      applied.push(migration.id)
    }
    await client.query('COMMIT')
    return applied
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

export async function migrateStatus(connectionString: string, migrationsDir?: string): Promise<{applied: string[]; pending: string[]; unknown: string[]}> {
  const pool = new pg.Pool({connectionString})
  const client = await pool.connect()
  try {
    const files = await listMigrationFiles(migrationsDir)
    const exists = await client.query<{name: string | null}>("SELECT to_regclass('public.schema_migrations')::text AS name")
    const applied = exists.rows[0]?.name
      ? (await client.query<MigrationRecord>('SELECT id FROM schema_migrations ORDER BY id')).rows.map(r => r.id)
      : []
    const done = new Set(applied)
    const source = new Set(files.map(migration => migration.id))
    const pending = files.map(migration => migration.id).filter(id => !done.has(id))
    const unknown = applied.filter(id => !source.has(id))
    return {applied, pending, unknown}
  } finally {
    client.release()
    await pool.end()
  }
}

export async function migrateDown(connectionString: string, migrationsDir?: string): Promise<string | null> {
  const pool = new pg.Pool({connectionString})
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY])
    await ensureMigrationsTable(client)
    const {rows} = await client.query<MigrationRecord>('SELECT id, name FROM schema_migrations ORDER BY id DESC LIMIT 1')
    if (rows.length === 0) {
      await client.query('COMMIT')
      return null
    }
    const latest = rows[0]!
    const dir = migrationsDir ?? path.resolve(__dirname, '../../migrations')
    const downFile = path.join(dir, `${latest.id}.down.sql`)
    const sql = await fs.readFile(downFile, 'utf8')
    await client.query(sql)
    await client.query('DELETE FROM schema_migrations WHERE id = $1', [latest.id])
    await client.query('COMMIT')
    return latest.id
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}
