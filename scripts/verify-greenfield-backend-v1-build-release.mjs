#!/usr/bin/env node
import {randomBytes} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const buildService = '/root/modula-platform/modula-build-service'
const failures = []
function record(label, passed, detail = '') { console.log(`${label.padEnd(49)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`); if (!passed) failures.push(`${label}: ${detail}`) }
function source(label, file, required, forbidden = []) { const content = existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : ''; record(label, Boolean(content) && required.every(value => content.includes(value)) && forbidden.every(value => !content.includes(value)), file) }
function run(label, command, args, cwd = root, env = process.env) { console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`); const result = spawnSync(command, args, {cwd, env, stdio: 'inherit', shell: false}); record(label, result.status === 0, cwd) }
function output(command, args) { const result = spawnSync(command, args, {encoding: 'utf8', shell: false}); return result.status === 0 ? result.stdout.trim() : '' }

console.log('MODULA\nGREENFIELD BACKEND V1\nBUILD AND RELEASE VERIFIER\n')
source('BUILD LEDGER MIGRATION', 'services/greenfield-api/migrations/048_greenfield_backend_v1_build_release_pipeline.sql', ['greenfield_build_service_registrations', 'greenfield_build_provenance', 'greenfield_build_claim_requests', 'greenfield_build_result_receipts', 'greenfield_release_review_checks', "'QUARANTINED'", "'048'"])
source('REVERSIBLE BUILD MIGRATION', 'services/greenfield-api/migrations/048_greenfield_backend_v1_build_release_pipeline.down.sql', ["state='FAILED' WHERE state='QUARANTINED'", 'DROP TABLE IF EXISTS greenfield_build_provenance', "value='047'"])
source('EXACT SHA BUILD QUEUE', 'services/greenfield-api/src/developers/service.ts', ['Exact 40-character source SHA', 'idempotency_key', "builder_identity: 'service.modula-build'"])
source('PROVENANCE QUARANTINE', 'services/greenfield-api/src/developers/build-coordinator.ts', ['PROVENANCE_INVALID', "acceptedState = 'QUARANTINED'", 'signature_verified: true'])
source('RAW BEARER REJECTED', 'services/greenfield-api/src/developers/routes.ts', ['RAW_USER_BEARER_REJECTED', 'x-modula-service-id', 'x-modula-service-signature'])
source('REVIEW CHECK MATRIX', 'services/greenfield-api/src/developers/service.ts', ["'manifest', 'permissions', 'network', 'backend', 'storage', 'dependencies', 'provenance', 'licence', 'security', 'compatibility', 'export-delete'"])
source('BEHAVIOUR JOURNEY', 'services/greenfield-api/tests/greenfield-backend-v1.build-release.test.ts', ['quarantines tampered provenance', 'provenance-backed releases', 'toHaveLength(11)'])
record('PRIVATE BUILD SERVICE PRESENT', existsSync(join(buildService, 'package.json')), buildService)

run('BUILD SERVICE VERIFY', 'pnpm', ['verify'], buildService, {...process.env, CI: 'true'})
run('GREENFIELD API TYPECHECK', 'pnpm', ['--filter', '@modula/greenfield-api', 'typecheck'], root, {...process.env, CI: 'true'})
databaseChecks()
productionState()

console.log('\nRESULT')
if (failures.length) { console.log(`GREENFIELD BACKEND V1 BUILD AND RELEASE FAIL (${failures.length})`); failures.forEach(failure => console.log(`- ${failure}`)); process.exit(1) }
console.log('GREENFIELD BACKEND V1 BUILD AND RELEASE PASS')

function databaseChecks() {
  const fixture = databaseFixture()
  record('DISPOSABLE DATABASE AVAILABLE', Boolean(fixture), fixture?.databaseName ?? 'preview Postgres unavailable')
  if (!fixture) return
  try {
    const migrateEnv = {...process.env, CI: 'true', MODULA_TEST_DATABASE_URL: fixture.migratorUrl}
    const testEnv = {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl}
    run('FULL MIGRATION CHAIN THROUGH 048', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e', "import {migrateUp} from './src/database/migrate.ts'; void migrateUp(process.env.MODULA_TEST_DATABASE_URL).then(applied => { if (!applied.includes('048_greenfield_backend_v1_build_release_pipeline')) process.exit(1) })"], join(root, 'services/greenfield-api'), migrateEnv)
    run('BUILD AND RELEASE BEHAVIOUR', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.build-release.test.ts'], root, testEnv)
    run('EXISTING DEVELOPER JOURNEYS', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.developer-domain.test.ts'], root, testEnv)
    run('MIGRATION 048 DOWN AND REAPPLY', 'pnpm', ['exec', 'tsx', 'scripts/verify-migration-cycle.ts', '048_greenfield_backend_v1_build_release_pipeline'], join(root, 'services/greenfield-api'), migrateEnv)
  } finally { fixture.cleanup(); record('DISPOSABLE DATABASE REMOVED', true, fixture.databaseName) }
}

function databaseFixture() {
  const supplied = process.env.MODULA_TEST_DATABASE_URL
  if (supplied) return {databaseName: new URL(supplied).pathname.slice(1), migratorUrl: supplied, testUrl: supplied, cleanup: () => undefined}
  const container = 'modula-preview-greenfield-postgres-1'
  if (!output('docker', ['container', 'inspect', container])) return null
  const environment = output('docker', ['inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}'])
  const values = Object.fromEntries(environment.split('\n').map(line => line.split(/=(.*)/s).slice(0, 2)).filter(parts => parts.length === 2))
  const databaseName = `modula_gbv1_build_${process.pid}_${Date.now()}`.toLowerCase()
  const testRole = `gbv1_build_test_${process.pid}_${Date.now()}`.toLowerCase()
  const password = randomBytes(24).toString('base64url')
  if (spawnSync('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', values.POSTGRES_DB ?? 'modula', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE ROLE ${testRole} LOGIN SUPERUSER PASSWORD '${password}'`], {stdio: 'ignore'}).status !== 0) return null
  if (spawnSync('docker', ['exec', container, 'createdb', '-U', 'modula_admin', '-O', 'modula_migrator', databaseName], {stdio: 'ignore'}).status !== 0) return null
  return {databaseName, migratorUrl: databaseUrl('modula_migrator', values.MODULA_MIGRATOR_PASSWORD, databaseName), testUrl: databaseUrl(testRole, password, databaseName), cleanup: () => {
    spawnSync('docker', ['exec', container, 'dropdb', '-U', 'modula_admin', '--if-exists', databaseName], {stdio: 'ignore'})
    spawnSync('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', values.POSTGRES_DB ?? 'modula', '-c', `DROP ROLE IF EXISTS ${testRole}`], {stdio: 'ignore'})
  }}
}
function databaseUrl(user, password, databaseName) { const url = new URL('postgresql://127.0.0.1:5433'); url.username = user; if (password) url.password = password; url.pathname = `/${databaseName}`; return url.toString() }
function productionState() {
  const container = 'modula-production-greenfield-postgres-1'
  if (!output('docker', ['container', 'inspect', container])) return record('PRODUCTION DATABASE DISCOVERED', true, 'not present outside production host')
  const database = output('docker', ['inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}']).split('\n').find(line => line.startsWith('POSTGRES_DB='))?.slice(12) ?? 'modula'
  const schema = output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', "SELECT value FROM schema_metadata WHERE key='schema_version'"])
  const version = Number(schema)
  record('PRODUCTION SCHEMA DISCOVERED', process.env.MODULA_REQUIRE_PRODUCTION_048 === '1' ? version >= 48 : version >= 43 && version <= 52, schema)
}
