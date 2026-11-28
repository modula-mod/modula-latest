import path from 'node:path'
import pg from 'pg'
import {listMigrationFiles, migrateDown, migrateStatus, migrateUp} from '../src/database/migrate.js'

const connectionString = process.env.MODULA_TEST_DATABASE_URL
const [target, ...rawArguments] = process.argv.slice(2)
let migrationsDir: string | undefined
let expectedTip: string | undefined
let applyBaseline = false

for (let index = 0; index < rawArguments.length; index += 1) {
  const argument = rawArguments[index]
  if (argument === '--apply-baseline') {
    applyBaseline = true
    continue
  }
  if (argument === '--migrations-dir') {
    const value = rawArguments[index + 1]
    if (!value) throw new Error('--migrations-dir requires a value')
    migrationsDir = path.resolve(value)
    index += 1
    continue
  }
  if (argument === '--expected-tip') {
    const value = rawArguments[index + 1]
    if (!value) throw new Error('--expected-tip requires a value')
    expectedTip = value
    index += 1
    continue
  }
  throw new Error(`unsupported argument: ${argument}`)
}

if (!connectionString) throw new Error('MODULA_TEST_DATABASE_URL is required')
if (!target || !/^\d{3}_[a-z0-9_]+$/.test(target)) throw new Error('a valid migration target is required')
if (expectedTip && !/^\d{3}_[a-z0-9_]+$/.test(expectedTip)) throw new Error('a valid expected migration tip is required')

const baselineApplied = applyBaseline ? await migrateUp(connectionString, migrationsDir) : []
const expectedMigrations = migrationsDir
  ? (await listMigrationFiles(migrationsDir)).map(migration => migration.id)
  : undefined

async function readSchemaVersion(): Promise<string | undefined> {
  const client = new pg.Client({connectionString})
  await client.connect()
  try {
    const result = await client.query<{value: string}>(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
    return result.rows[0]?.value
  } finally {
    await client.end()
  }
}

const before = await migrateStatus(connectionString, migrationsDir)
if (!before.applied.includes(target)) throw new Error(`migration target is not applied: ${target}`)
if (before.pending.length) throw new Error(`baseline migrations remain pending: ${before.pending.join(',')}`)
if (before.unknown.length) throw new Error(`baseline contains unknown migrations: ${before.unknown.join(',')}`)
if (expectedTip && before.applied.at(-1) !== expectedTip) {
  throw new Error(`migration baseline tip is ${before.applied.at(-1) ?? 'empty'}, expected ${expectedTip}`)
}
const beforeSchemaVersion = expectedTip ? await readSchemaVersion() : undefined
if (expectedTip && beforeSchemaVersion !== expectedTip.slice(0, 3)) {
  throw new Error(`baseline schema version is ${beforeSchemaVersion ?? 'missing'}, expected ${expectedTip.slice(0, 3)}`)
}
if (expectedMigrations && before.applied.join('\n') !== expectedMigrations.join('\n')) {
  throw new Error('migration baseline does not exactly match the isolated migration directory')
}

const removed: string[] = []
while (!removed.includes(target)) {
  const migration = await migrateDown(connectionString, migrationsDir)
  if (!migration) throw new Error(`migration target was not reached: ${target}`)
  removed.push(migration)
}

const reapplied = await migrateUp(connectionString, migrationsDir)
const missing = removed.filter(migration => !reapplied.includes(migration))
if (missing.length) throw new Error(`removed migrations were not reapplied: ${missing.join(',')}`)

const after = await migrateStatus(connectionString, migrationsDir)
if (after.pending.length) throw new Error(`pending migrations remain: ${after.pending.join(',')}`)
if (after.unknown.length) throw new Error(`unknown migrations remain: ${after.unknown.join(',')}`)
if (after.applied.join('\n') !== before.applied.join('\n')) {
  throw new Error('migration ledger was not restored to the exact baseline')
}
const afterSchemaVersion = expectedTip ? await readSchemaVersion() : undefined
if (afterSchemaVersion !== beforeSchemaVersion) throw new Error('schema version was not restored to the exact baseline')

console.log(JSON.stringify({
  target,
  migrationsDir,
  expectedTip,
  baselineApplied,
  removed,
  reapplied,
  applied: after.applied,
  schemaVersion: afterSchemaVersion,
  pending: after.pending,
  unknown: after.unknown,
}))
