import {cp, mkdtemp, readdir, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import pg from 'pg'
import {migrateDown, migrateStatus, migrateUp} from '../src/database/migrate.js'

const connectionString = process.env.MODULA_TEST_DATABASE_URL
if (!connectionString) throw new Error('MODULA_TEST_DATABASE_URL is required')

const migrations = resolve(import.meta.dirname, '../migrations')
const through052 = await mkdtemp(join(tmpdir(), 'modula-gbv1-through-052-'))
const through053 = await mkdtemp(join(tmpdir(), 'modula-gbv1-through-053-'))
const pool = new pg.Pool({connectionString})

try {
  for (const file of await readdir(migrations)) {
    if (!file.endsWith('.sql')) continue
    const number = Number(file.slice(0, 3))
    if (number <= 52) await cp(join(migrations, file), join(through052, file))
    if (number <= 53) await cp(join(migrations, file), join(through053, file))
  }

  const baseline = await migrateUp(connectionString, through052)
  if (!baseline.includes('052_greenfield_backend_v1_migration_ledger_security')) {
    throw new Error('migration chain did not reach 052')
  }

  await pool.query('REVOKE SELECT ON greenfield_extension_installations FROM modula_backup')
  if (await canBackupInstallations()) throw new Error('historical backup ACL gap was not reproduced')

  const reconciled = await migrateUp(connectionString, through053)
  if (!reconciled.includes('053_greenfield_backend_v1_backup_acl_reconciliation')) {
    throw new Error('migration 053 was not applied')
  }
  if (!await canBackupInstallations()) throw new Error('migration 053 did not reconcile backup SELECT')

  const audit = await pool.query<{count: string}>(`
    SELECT count(*)::text AS count
    FROM greenfield_backup_acl_reconciliation
    WHERE object_identity = 'public.greenfield_extension_installations'
  `)
  if (audit.rows[0]?.count !== '1') throw new Error('reconciled ACL was not audited')

  const removed = await migrateDown(connectionString, through053)
  if (removed !== '053_greenfield_backend_v1_backup_acl_reconciliation') {
    throw new Error(`unexpected migration removed: ${String(removed)}`)
  }
  if (await canBackupInstallations()) throw new Error('migration 053 down did not restore the prior ACL')

  const reapplied = await migrateUp(connectionString, through053)
  if (!reapplied.includes('053_greenfield_backend_v1_backup_acl_reconciliation')) {
    throw new Error('migration 053 was not reapplied')
  }
  if (!await canBackupInstallations()) throw new Error('reapplied migration did not restore backup SELECT')

  await migrateUp(connectionString)

  const status = await migrateStatus(connectionString)
  if (status.pending.length) throw new Error(`pending migrations remain: ${status.pending.join(',')}`)
  console.log(JSON.stringify({baseline: '052', reconciled: '053', down: '052', reapplied: '053', pending: status.pending}))
} finally {
  await pool.end()
  await rm(through052, {recursive: true, force: true})
  await rm(through053, {recursive: true, force: true})
}

async function canBackupInstallations(): Promise<boolean> {
  const result = await pool.query<{allowed: boolean}>(`
    SELECT has_table_privilege(
      'modula_backup',
      'public.greenfield_extension_installations',
      'SELECT'
    ) AS allowed
  `)
  return result.rows[0]?.allowed === true
}
