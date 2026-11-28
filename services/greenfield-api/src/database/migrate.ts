import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATION_ADVISORY_LOCK_KEY = 7_314_202_610_14

// Historical QA builds applied the optional-package migration before Premium
// claimed 076. Keep that immutable ledger row recognised while the canonical
// migration remains 077. The canonical 077 still runs so schema_metadata and
// every fresh/production upgrade converge on the same forward-only sequence.
const KNOWN_LEGACY_MIGRATIONS = new Set(['076_optional_package_media'])

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

/**
 * A migration whose first line is exactly this directive runs outside the
 * runner's transaction (needed for CREATE INDEX CONCURRENTLY and friends).
 * Its statements run one at a time in autocommit mode, so each must stand
 * alone: statements end with `;` at end of line and dollar quoting is refused.
 * The advisory lock is still held (session-scoped) for the whole run.
 */
export const NO_TRANSACTION_DIRECTIVE = '-- modula:migrate no-transaction'

export function isNoTransactionMigration(sql: string): boolean {
  return sql.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0]?.trim() === NO_TRANSACTION_DIRECTIVE
}

/** Splits a no-transaction migration into standalone statements (comment lines dropped). */
export function splitNoTransactionStatements(sql: string): string[] {
  if (sql.includes('$$')) throw new Error('no-transaction migrations may not use dollar quoting')
  const body = sql
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
  const statements = body
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map(statement => statement.trim())
    .filter(statement => statement.length > 0)
  if (statements.length === 0) throw new Error('no-transaction migration has no statements')
  for (const statement of statements) {
    if (/^(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\b/i.test(statement)) {
      throw new Error('no-transaction migrations may not manage transactions')
    }
  }
  return statements
}

async function runNoTransaction(client: pg.PoolClient, sql: string): Promise<void> {
  for (const statement of splitNoTransactionStatements(sql)) await client.query(statement)
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
  let inTransaction = false
  let sessionLocked = false
  try {
    // The session-scoped lock spans no-transaction migrations, which commit the
    // surrounding transaction; it conflicts with the transaction-scoped lock
    // other runners (and migrateDown) take on the same key.
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY])
    sessionLocked = true
    await client.query('BEGIN')
    inTransaction = true
    // A transaction-scoped advisory lock serializes every migration runner,
    // including operators using different checkouts of the same database.
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY])
    await ensureMigrationsTable(client)
    const {rows} = await client.query<MigrationRecord>('SELECT id, name, applied_at FROM schema_migrations ORDER BY id')
    const done = new Set(rows.map(r => r.id))
    for (const migration of await listMigrationFiles(migrationsDir)) {
      if (done.has(migration.id)) continue
      const sql = await fs.readFile(migration.file, 'utf8')
      if (isNoTransactionMigration(sql)) {
        // Commit everything before it, then run it in autocommit mode. If it
        // fails, earlier migrations stay applied and its ledger row is absent.
        await client.query('COMMIT')
        inTransaction = false
        await runNoTransaction(client, sql)
        await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [migration.id, migration.name])
        applied.push(migration.id)
        await client.query('BEGIN')
        inTransaction = true
        await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY])
        continue
      }
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [migration.id, migration.name])
      applied.push(migration.id)
    }
    await client.query('COMMIT')
    inTransaction = false
    return applied
  } catch (error) {
    if (inTransaction) await client.query('ROLLBACK')
    throw error
  } finally {
    if (sessionLocked) await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_KEY]).catch(() => undefined)
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
    const source = new Set([...files.map(migration => migration.id), ...KNOWN_LEGACY_MIGRATIONS])
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
  let inTransaction = false
  let sessionLocked = false
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY])
    sessionLocked = true
    await client.query('BEGIN')
    inTransaction = true
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY])
    await ensureMigrationsTable(client)
    const {rows} = await client.query<MigrationRecord>('SELECT id, name FROM schema_migrations ORDER BY id DESC LIMIT 1')
    if (rows.length === 0) {
      await client.query('COMMIT')
      inTransaction = false
      return null
    }
    const latest = rows[0]!
    if (KNOWN_LEGACY_MIGRATIONS.has(latest.id)) {
      // A canonical replacement migration has already performed the matching
      // down operation. Removing this compatibility ledger row is therefore a
      // metadata-only step during an explicit QA rollback.
      await client.query('DELETE FROM schema_migrations WHERE id = $1', [latest.id])
      await client.query('COMMIT')
      inTransaction = false
      return latest.id
    }
    const dir = migrationsDir ?? path.resolve(__dirname, '../../migrations')
    const downFile = path.join(dir, `${latest.id}.down.sql`)
    const sql = await fs.readFile(downFile, 'utf8')
    if (isNoTransactionMigration(sql)) {
      await client.query('COMMIT')
      inTransaction = false
      await runNoTransaction(client, sql)
      await client.query('DELETE FROM schema_migrations WHERE id = $1', [latest.id])
      return latest.id
    }
    await client.query(sql)
    await client.query('DELETE FROM schema_migrations WHERE id = $1', [latest.id])
    await client.query('COMMIT')
    inTransaction = false
    return latest.id
  } catch (error) {
    if (inTransaction) await client.query('ROLLBACK')
    throw error
  } finally {
    if (sessionLocked) await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_KEY]).catch(() => undefined)
    client.release()
    await pool.end()
  }
}
