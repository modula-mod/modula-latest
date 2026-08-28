import {migrateDown, migrateStatus, migrateUp} from '../src/database/migrate.js'

const connectionString = process.env.MODULA_TEST_DATABASE_URL
const target = process.argv[2]

if (!connectionString) throw new Error('MODULA_TEST_DATABASE_URL is required')
if (!target || !/^\d{3}_[a-z0-9_]+$/.test(target)) throw new Error('a valid migration target is required')

const before = await migrateStatus(connectionString)
if (!before.applied.includes(target)) throw new Error(`migration target is not applied: ${target}`)

const removed: string[] = []
while (!removed.includes(target)) {
  const migration = await migrateDown(connectionString)
  if (!migration) throw new Error(`migration target was not reached: ${target}`)
  removed.push(migration)
}

const reapplied = await migrateUp(connectionString)
const missing = removed.filter(migration => !reapplied.includes(migration))
if (missing.length) throw new Error(`removed migrations were not reapplied: ${missing.join(',')}`)

const after = await migrateStatus(connectionString)
if (after.pending.length) throw new Error(`pending migrations remain: ${after.pending.join(',')}`)

console.log(JSON.stringify({target, removed, reapplied, pending: after.pending}))
