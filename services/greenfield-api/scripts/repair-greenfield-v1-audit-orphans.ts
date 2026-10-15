import {createHash} from 'node:crypto'
import {createReadStream, existsSync} from 'node:fs'
import pg from 'pg'

const connectionString = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL ?? process.env.MODULA_TEST_DATABASE_URL
if (!connectionString) throw new Error('A migrator, production, or test database URL is required')

const apply = process.argv.includes('--apply')
const expectedReleaseOrphans = integerArgument('--expected-release-orphans')
const expectedNamespaceOrphans = integerArgument('--expected-namespace-orphans')
const backupFile = argument('--backup-file')
const expectedBackupSha256 = argument('--backup-sha256')

if (apply) {
  if (expectedReleaseOrphans === null || expectedNamespaceOrphans === null) throw new Error('--apply requires both expected orphan counts')
  if (!backupFile || !expectedBackupSha256 || !/^[a-f0-9]{64}$/.test(expectedBackupSha256)) throw new Error('--apply requires --backup-file and --backup-sha256')
  if (!existsSync(backupFile) || await sha256File(backupFile) !== expectedBackupSha256) throw new Error('verified pre-repair backup does not match')
}

const client = new pg.Client({connectionString, application_name: 'greenfield-v1-bounded-audit-repair'})
await client.connect()
let totalReleaseOrphans = 0
let unexpectedReleaseOrphans = 0
let namespaceOrphans = 0
let deletedReleaseOrphans = 0
let deletedNamespaceOrphans = 0

try {
  await client.query(apply ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  if (apply) await client.query('SELECT pg_advisory_xact_lock($1)', [7_314_202_610_15])
  const tables = await client.query<{table_name: string}>(`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='release_id' AND table_name<>'greenfield_module_releases'
    ORDER BY table_name`)
  for (const {table_name: table} of tables.rows) {
    if (!/^[a-z0-9_]+$/.test(table)) throw new Error(`unsafe catalog table name: ${table}`)
    const count = await client.query<{total: string; unexpected: string}>(`
      SELECT count(*) AS total,
        count(*) FILTER (WHERE child.release_id::text NOT LIKE 'module-release:audit.module.%') AS unexpected
      FROM public.${table} child
      LEFT JOIN greenfield_module_releases parent ON parent.release_id=child.release_id
      WHERE child.release_id IS NOT NULL AND parent.release_id IS NULL`)
    totalReleaseOrphans += Number(count.rows[0]?.total ?? 0)
    unexpectedReleaseOrphans += Number(count.rows[0]?.unexpected ?? 0)
  }
  const namespaces = await client.query<{count: string}>(`
    SELECT count(*) FROM greenfield_publisher_namespaces n
    LEFT JOIN greenfield_publishers p ON p.publisher_id=n.publisher_id
    WHERE p.publisher_id IS NULL`)
  namespaceOrphans = Number(namespaces.rows[0]?.count ?? 0)

  if (apply) {
    if (unexpectedReleaseOrphans !== 0) throw new Error(`refusing unexpected release orphans: ${unexpectedReleaseOrphans}`)
    if (totalReleaseOrphans !== expectedReleaseOrphans) throw new Error(`release orphan count drifted: ${totalReleaseOrphans}`)
    if (namespaceOrphans !== expectedNamespaceOrphans) throw new Error(`namespace orphan count drifted: ${namespaceOrphans}`)
    const exactNamespace = await client.query<{count: string}>(`
      SELECT count(*) FROM greenfield_publisher_namespaces n
      LEFT JOIN greenfield_publishers p ON p.publisher_id=n.publisher_id
      WHERE p.publisher_id IS NULL AND n.publisher_id='audit' AND n.namespace='audit.module'`)
    if (Number(exactNamespace.rows[0]?.count ?? 0) !== namespaceOrphans) throw new Error('refusing non-audit publisher namespace orphan')
    for (const {table_name: table} of tables.rows) {
      const removed = await client.query(`
        DELETE FROM public.${table} child
        WHERE child.release_id::text LIKE 'module-release:audit.module.%'
          AND NOT EXISTS (SELECT 1 FROM greenfield_module_releases parent WHERE parent.release_id=child.release_id)`)
      deletedReleaseOrphans += removed.rowCount ?? 0
    }
    const removedNamespace = await client.query(`
      DELETE FROM greenfield_publisher_namespaces n
      WHERE n.publisher_id='audit' AND n.namespace='audit.module'
        AND NOT EXISTS (SELECT 1 FROM greenfield_publishers p WHERE p.publisher_id=n.publisher_id)`)
    deletedNamespaceOrphans = removedNamespace.rowCount ?? 0
    if (deletedReleaseOrphans !== expectedReleaseOrphans || deletedNamespaceOrphans !== expectedNamespaceOrphans) {
      throw new Error('bounded deletion count did not match the approved plan')
    }
  }
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined)
  throw error
} finally {
  await client.end()
}

process.stdout.write(`${JSON.stringify({
  schemaVersion: '1.0.0', mode: apply ? 'APPLY' : 'DRY_RUN', totalReleaseOrphans,
  unexpectedReleaseOrphans, namespaceOrphans, deletedReleaseOrphans, deletedNamespaceOrphans,
  backup: apply ? {file: backupFile, sha256: expectedBackupSha256} : null,
}, null, 2)}\n`)

function argument(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

function integerArgument(name: string): number | null {
  const value = argument(name)
  if (value === null) return null
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`)
  return parsed
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}
