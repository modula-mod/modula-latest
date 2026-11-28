import pg from 'pg'
import {migrateStatus} from '../src/database/migrate.js'

const connectionString = process.env.MODULA_TEST_DATABASE_URL
const expectedTip = process.argv[2]

if (!connectionString) throw new Error('MODULA_TEST_DATABASE_URL is required')
if (!expectedTip || !/^\d{3}_[a-z0-9_]+$/.test(expectedTip)) throw new Error('a valid expected migration tip is required')

const status = await migrateStatus(connectionString)
if (status.applied.at(-1) !== expectedTip) {
  throw new Error(`migration tip is ${status.applied.at(-1) ?? 'empty'}, expected ${expectedTip}`)
}
if (status.pending.length) throw new Error(`pending migrations remain: ${status.pending.join(',')}`)
if (status.unknown.length) throw new Error(`unknown migrations remain: ${status.unknown.join(',')}`)

const client = new pg.Client({connectionString})
await client.connect()
try {
  const version = await client.query<{value: string}>(`SELECT value FROM schema_metadata WHERE key = 'schema_version'`)
  const expectedVersion = expectedTip.slice(0, 3)
  if (version.rows[0]?.value !== expectedVersion) {
    throw new Error(`schema version is ${version.rows[0]?.value ?? 'missing'}, expected ${expectedVersion}`)
  }
  console.log(JSON.stringify({tip: expectedTip, schemaVersion: expectedVersion, pending: status.pending, unknown: status.unknown}))
} finally {
  await client.end()
}
