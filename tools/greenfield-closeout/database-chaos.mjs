#!/usr/bin/env node
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'

const require = createRequire(new URL('../../services/greenfield-api/package.json', import.meta.url))
const pg = require('pg')

const connectionString = process.env.MODULA_TEST_DATABASE_URL
if (!connectionString) fail('MODULA_TEST_DATABASE_URL is required')
const parsed = new URL(connectionString)
const databaseName = parsed.pathname.slice(1)
if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) || !/(closeout|test|disposable)/i.test(databaseName)) {
  fail('database chaos is restricted to a local disposable database whose name contains closeout, test, or disposable')
}

const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
const table = `greenfield_closeout_lock_${suffix}`
const role = `greenfield_closeout_saturation_${suffix}`
const password = `synthetic-${suffix}-only`
const migrationAdvisoryLockKey = 7_314_202_610_14
const admin = new pg.Client({connectionString, application_name: 'greenfield-closeout-chaos-admin'})
const report = {
  format: 'modula.greenfield.database-chaos.v1',
  database: databaseName,
  startedAt: new Date().toISOString(),
  lockContention: null,
  deadlock: null,
  migrationLock: null,
  connectionSaturation: null,
}

await admin.connect()
try {
  await admin.query(`CREATE TABLE ${table} (id integer PRIMARY KEY, value integer NOT NULL)`)
  await admin.query(`INSERT INTO ${table} (id,value) VALUES (1,0),(2,0)`)
  report.lockContention = await lockContentionProbe()
  report.deadlock = await deadlockProbe()
  report.migrationLock = await migrationLockProbe()
  report.connectionSaturation = await connectionSaturationProbe()
  report.completedAt = new Date().toISOString()
  report.result = 'PASS'
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} finally {
  await admin.query(`DROP TABLE IF EXISTS ${table}`).catch(() => undefined)
  await admin.query(`DROP ROLE IF EXISTS ${role}`).catch(() => undefined)
  await admin.end()
}

async function lockContentionProbe() {
  const holder = client('lock-holder')
  const waiter = client('lock-waiter')
  await Promise.all([holder.connect(), waiter.connect()])
  const started = performance.now()
  try {
    await holder.query('BEGIN')
    await holder.query(`UPDATE ${table} SET value=value+1 WHERE id=1`)
    await waiter.query('BEGIN')
    await waiter.query("SET LOCAL lock_timeout='250ms'")
    const result = await waiter.query(`UPDATE ${table} SET value=value+1 WHERE id=1`).then(
      () => ({code: null}),
      error => ({code: errorCode(error)}),
    )
    if (result.code !== '55P03') fail(`expected bounded lock timeout 55P03, received ${result.code ?? 'success'}`)
    return {result: 'PASS', failureCode: result.code, boundedMs: Math.round(performance.now() - started)}
  } finally {
    await Promise.allSettled([holder.query('ROLLBACK'), waiter.query('ROLLBACK')])
    await Promise.all([holder.end(), waiter.end()])
  }
}

async function deadlockProbe() {
  const left = client('deadlock-left')
  const right = client('deadlock-right')
  await Promise.all([left.connect(), right.connect()])
  const started = performance.now()
  try {
    await Promise.all([left.query('BEGIN'), right.query('BEGIN')])
    await Promise.all([
      left.query("SET LOCAL deadlock_timeout='100ms'"),
      right.query("SET LOCAL deadlock_timeout='100ms'"),
    ])
    await left.query(`UPDATE ${table} SET value=value+1 WHERE id=1`)
    await right.query(`UPDATE ${table} SET value=value+1 WHERE id=2`)
    const leftWait = left.query(`UPDATE ${table} SET value=value+1 WHERE id=2`)
    await delay(25)
    const results = await Promise.allSettled([leftWait, right.query(`UPDATE ${table} SET value=value+1 WHERE id=1`)])
    const codes = results.map(result => result.status === 'rejected' ? errorCode(result.reason) : null)
    if (codes.filter(code => code === '40P01').length !== 1) fail(`expected one PostgreSQL deadlock victim, received ${codes.join(',')}`)
    return {result: 'PASS', failureCode: '40P01', boundedMs: Math.round(performance.now() - started), transactionRollbackRequired: true}
  } finally {
    await Promise.allSettled([left.query('ROLLBACK'), right.query('ROLLBACK')])
    await Promise.all([left.end(), right.end()])
  }
}

async function connectionSaturationProbe() {
  await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' CONNECTION LIMIT 3`)
  await admin.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(databaseName)} TO ${role}`)
  const roleUrl = new URL(connectionString)
  roleUrl.username = role
  roleUrl.password = password
  const poolErrors = []
  const pool = new pg.Pool({connectionString: roleUrl.toString(), max: 10, connectionTimeoutMillis: 1_000, application_name: 'greenfield-closeout-saturation'})
  pool.on('error', error => poolErrors.push(errorCode(error)))
  const started = performance.now()
  try {
    const results = await Promise.allSettled(Array.from({length: 10}, () => pool.query('SELECT pg_sleep(0.2)')))
    const rejectedCodes = results.filter(result => result.status === 'rejected').map(result => errorCode(result.reason))
    const fulfilled = results.length - rejectedCodes.length
    if (fulfilled < 1 || rejectedCodes.length < 1 || rejectedCodes.some(code => code !== '53300')) {
      fail(`connection saturation was not bounded as expected: fulfilled=${fulfilled}, rejected=${rejectedCodes.join(',')}`)
    }
    const recovered = await pool.query('SELECT 1 AS healthy')
    if (recovered.rows[0]?.healthy !== 1) fail('pool did not recover after bounded connection saturation')
    return {
      result: 'PASS',
      roleConnectionLimit: 3,
      attempted: results.length,
      fulfilled,
      rejected: rejectedCodes.length,
      failureCodes: [...new Set(rejectedCodes)],
      poolErrors,
      boundedMs: Math.round(performance.now() - started),
      recovered: true,
    }
  } finally {
    await pool.end()
  }
}

async function migrationLockProbe() {
  const holder = client('migration-lock-holder')
  const runner = client('migration-lock-runner')
  await Promise.all([holder.connect(), runner.connect()])
  let settled = false
  const started = performance.now()
  try {
    await holder.query('SELECT pg_advisory_lock($1)', [migrationAdvisoryLockKey])
    await runner.query('BEGIN')
    const waiting = runner.query('SELECT pg_advisory_xact_lock($1)', [migrationAdvisoryLockKey]).then(() => { settled = true })
    await delay(200)
    if (settled) fail('migration advisory lock did not serialize a second runner')
    await holder.query('SELECT pg_advisory_unlock($1)', [migrationAdvisoryLockKey])
    await Promise.race([waiting, delay(2_000).then(() => fail('migration advisory lock did not release boundedly'))])
    return {result: 'PASS', key: migrationAdvisoryLockKey, observedBlockedMs: Math.round(performance.now() - started)}
  } finally {
    await Promise.allSettled([holder.query('SELECT pg_advisory_unlock($1)', [migrationAdvisoryLockKey]), runner.query('ROLLBACK')])
    await Promise.all([holder.end(), runner.end()])
  }
}

function client(applicationName) {
  return new pg.Client({connectionString, application_name: `greenfield-closeout-${applicationName}`})
}

function errorCode(error) {
  return typeof error?.code === 'string' ? error.code : 'UNKNOWN'
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function fail(message) {
  throw new Error(message)
}
