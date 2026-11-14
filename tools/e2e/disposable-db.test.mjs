// Run: node --test tools/e2e/disposable-db.test.mjs
// With MODULA_E2E_ADMIN_DATABASE_URL set (loopback only), the live collision
// test also runs against the disposable Postgres; otherwise it is skipped.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import path from 'node:path'
import {randomBytes} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {assertDisposableName, createOwnedDatabase, dropOwnedDatabase} from './disposable-db.mjs'
import {assertLoopbackDatabaseUrls} from './loopback-guard.mjs'

function recorder({failCreate} = {}) {
  const statements = []
  const query = async sql => {
    statements.push(sql)
    if (failCreate && sql.startsWith('CREATE DATABASE')) throw new Error(failCreate)
  }
  return {statements, query}
}

test('drops a database only after this run created it, exactly once', async () => {
  const {statements, query} = recorder()
  const handle = await createOwnedDatabase(query, 'gf_msg_01_abc123')
  assert.equal(handle.created, true)
  assert.equal(await dropOwnedDatabase(query, handle), true)
  assert.equal(await dropOwnedDatabase(query, handle), false, 'second cleanup is a no-op')
  assert.deepEqual(statements, ['CREATE DATABASE "gf_msg_01_abc123"', 'DROP DATABASE IF EXISTS "gf_msg_01_abc123" WITH (FORCE)'])
})

test('never drops on a name collision or any other create failure', async () => {
  const {statements, query} = recorder({failCreate: 'database "gf_msg_01_abc123" already exists'})
  const error = await createOwnedDatabase(query, 'gf_msg_01_abc123').catch(e => e)
  assert.match(error.message, /already exists/)
  assert.equal(error.handle.created, false)
  assert.equal(await dropOwnedDatabase(query, error.handle), false)
  assert.equal(await dropOwnedDatabase(query, null), false)
  assert.equal(await dropOwnedDatabase(query, undefined), false)
  assert.deepEqual(statements, ['CREATE DATABASE "gf_msg_01_abc123"'], 'no DROP was issued')
})

test('refuses names outside the disposable namespace', async () => {
  for (const name of ['postgres', 'modula_test', 'gf_msg_01_', 'gf_msg_01_ABC123', 'gf_msg_01_a"b;drop', 'x gf_msg_01_abc123']) {
    assert.throws(() => assertDisposableName(name), /refusing database name/, name)
  }
  const {statements, query} = recorder()
  await assert.rejects(createOwnedDatabase(query, 'postgres'))
  assert.equal(await dropOwnedDatabase(query, {name: 'postgres', created: true}).catch(() => 'refused'), 'refused')
  assert.deepEqual(statements, [])
})

const adminUrl = process.env.MODULA_E2E_ADMIN_DATABASE_URL
test('live: a pre-existing database survives a collision', {skip: adminUrl ? false : 'MODULA_E2E_ADMIN_DATABASE_URL not set'}, async () => {
  assertLoopbackDatabaseUrls({MODULA_E2E_ADMIN_DATABASE_URL: adminUrl})
  const apiPackageJson = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'services', 'greenfield-api', 'package.json')
  const {Client} = createRequire(apiPackageJson)('pg')
  const name = `gf_msg_01_coll${randomBytes(4).toString('hex')}`
  const target = new URL(adminUrl)
  target.pathname = `/${name}`
  const admin = new Client({connectionString: adminUrl})
  await admin.connect()
  const query = sql => admin.query(sql)
  try {
    await query(`CREATE DATABASE "${name}"`) // pre-existing, NOT owned by the code under test
    const marker = new Client({connectionString: target.toString()})
    await marker.connect()
    await marker.query('CREATE TABLE collision_marker (note text)')
    await marker.query("INSERT INTO collision_marker VALUES ('must survive')")
    await marker.end()

    const error = await createOwnedDatabase(query, name).catch(e => e)
    assert.match(String(error?.message), /already exists/)
    assert.equal(await dropOwnedDatabase(query, error.handle), false)

    const exists = await query(`SELECT 1 FROM pg_database WHERE datname = '${name}'`)
    assert.equal(exists.rowCount, 1, 'pre-existing database still exists')
    const check = new Client({connectionString: target.toString()})
    await check.connect()
    const rows = (await check.query('SELECT note FROM collision_marker')).rows
    await check.end()
    assert.deepEqual(rows, [{note: 'must survive'}])
  } finally {
    await query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`) // the test's own fixture
    await admin.end()
  }
})
