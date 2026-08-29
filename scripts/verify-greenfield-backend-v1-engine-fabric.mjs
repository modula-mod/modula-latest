#!/usr/bin/env node
import {randomBytes} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const failures = []
const enginesRoot = resolve(process.env.MODULA_BACKEND_ENGINES_ROOT ?? '/root/modula-platform/modula-backend-engines')
const legacyEngineRevision = 'a5511d3065326e5b29f0ab786a6975921b9db286'
const entitlementEngineRevision = 'bcef62e4b4e9b6b9a29b7bee52278d7a68a21061'

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(52)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}${detail ? `: ${detail}` : ''}`)
}
function source(label, file, required, forbidden = []) {
  const content = existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : ''
  record(label, Boolean(content) && required.every(value => content.includes(value)) && forbidden.every(value => !content.includes(value)), file)
}
function run(label, command, args, cwd = root, env = process.env) {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit', shell: false})
  record(label, result.status === 0, cwd)
  return result.status === 0
}
function output(command, args) {
  const result = spawnSync(command, args, {encoding: 'utf8', shell: false})
  return result.status === 0 ? result.stdout.trim() : ''
}

console.log('MODULA')
console.log('GREENFIELD BACKEND V1')
console.log('ENGINE FABRIC VERIFIER\n')

source('AUTHORITATIVE ENGINE LEDGER', 'services/greenfield-api/migrations/044_greenfield_backend_v1_engine_fabric.sql', [
  'greenfield_engine_registrations', 'greenfield_engine_capability_registrations', 'greenfield_engine_service_registrations',
  'greenfield_engine_job_registrations', 'greenfield_engine_event_consumer_registrations', 'greenfield_engine_usage_metric_registrations',
  'a5511d3065326e5b29f0ab786a6975921b9db286', 'TO modula_api, modula_worker, modula_backup',
])
source('CONTRACT-ONLY SERVICE GUARD', 'services/greenfield-api/migrations/044_greenfield_backend_v1_engine_fabric.sql', [
  'greenfield_engine_service_guard', 'only READY trusted engines may register an active service', "execution_mode IN ('IN_PROCESS','SERVICE_FABRIC','CONTRACT_ONLY')",
  'greenfield_engine_activation_guard', 'only READY trusted engines may activate jobs, event consumers or usage metrics',
])
source('REVERSIBLE ENGINE MIGRATION', 'services/greenfield-api/migrations/044_greenfield_backend_v1_engine_fabric.down.sql', [
  'DROP TRIGGER IF EXISTS greenfield_engine_service_guard', "value='043'",
])
source('ENTITLEMENT ENGINE PROVENANCE UPGRADE', 'services/greenfield-api/migrations/049_greenfield_backend_v1_entitlements_usage.sql', [
  `source_revision='${entitlementEngineRevision}'`, "WHERE engine_id='engine.entitlements'",
])
source('ENGINE TOPOLOGY SERVICE', 'services/greenfield-api/src/domains/engines/service.ts', [
  'GreenfieldEngineRegistryService', 'publicTopology', 'source_repository', 'source_revision',
], ['credentialValue', 'rawSecret'])
source('PUBLIC AND ADMIN ENGINE ROUTES', 'services/greenfield-api/src/app/register-routes.ts', [
  'engines: await engines.publicTopology()', '/v1/admin/ops/engines', "requireCapability(request, reply, 'admin:ops')",
])
source('ENGINE BEHAVIOUR TEST', 'services/greenfield-api/tests/greenfield-backend-v1.engine-fabric.test.ts', [
  'toHaveLength(10)', "runtimeStatus === 'CONTRACT_ONLY'", 'only READY trusted engines', 'modula_backup',
])

record('BACKEND ENGINES REPOSITORY', existsSync(join(enginesRoot, '.git')), enginesRoot)
if (existsSync(join(enginesRoot, '.git'))) {
  run('BACKEND ENGINES VERIFY', 'pnpm', ['verify'], enginesRoot, {...process.env, CI: 'true'})
  run('BACKEND ENGINES MAIN CONVERGENCE', 'sh', ['-ceu', 'test "$(git branch --show-current)" = main; test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"; test -z "$(git status --porcelain)"'], enginesRoot)
}

run('GREENFIELD API AND WORKER WORKSPACE BUILD', 'pnpm', [
  '--filter', '@modula/greenfield-api...', '--filter', '@modula/greenfield-worker...', 'build',
], root, {...process.env, CI: 'true'})
run('GREENFIELD API TYPECHECK', 'pnpm', ['--filter', '@modula/greenfield-api', 'typecheck'], root, {...process.env, CI: 'true'})
run('GREENFIELD WORKER TYPECHECK', 'pnpm', ['--filter', '@modula/greenfield-worker', 'typecheck'], root, {...process.env, CI: 'true'})
await runDatabaseChecks()
verifyProductionState()

console.log('\nRESULT')
if (failures.length) {
  console.log(`GREENFIELD BACKEND V1 ENGINE FABRIC FAIL (${failures.length})`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log('GREENFIELD BACKEND V1 ENGINE FABRIC PASS')

async function runDatabaseChecks() {
  const fixture = databaseFixture()
  record('DISPOSABLE DATABASE AVAILABLE', Boolean(fixture), fixture?.databaseName ?? 'configure MODULA_TEST_DATABASE_URL or run preview Postgres')
  if (!fixture) return
  try {
    const migrateEnv = {...process.env, CI: 'true', MODULA_TEST_DATABASE_URL: fixture.migratorUrl}
    const testEnv = {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl}
    run('FULL MIGRATION CHAIN THROUGH 044', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e', "import {migrateUp} from './src/database/migrate.ts'; void migrateUp(process.env.MODULA_TEST_DATABASE_URL).then(applied => { if (!applied.includes('044_greenfield_backend_v1_engine_fabric')) process.exit(1) })"], join(root, 'services/greenfield-api'), migrateEnv)
    run('ENGINE LEDGER AND ROUTE BEHAVIOUR', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.engine-fabric.test.ts'], root, testEnv)
    run('SEARCH AND MEDIA REFERENCE JOURNEYS', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.search-platform.test.ts', 'tests/phase7c.media-storage.test.ts', 'tests/phase7l.media-headers.test.ts'], root, testEnv)
    run('SEARCH MEDIA NOTIFICATION WORKERS', 'pnpm', ['--filter', '@modula/greenfield-worker', 'exec', 'vitest', 'run', 'tests/phase7e.search-projector.test.ts', 'tests/phase7e.vault-notes-search-projector.test.ts', 'tests/phase7e.notifications.test.ts'], root, testEnv)
    run('MIGRATION 044 DOWN AND REAPPLY', 'pnpm', ['exec', 'tsx', 'scripts/verify-migration-cycle.ts', '044_greenfield_backend_v1_engine_fabric'], join(root, 'services/greenfield-api'), migrateEnv)
  } finally {
    fixture.cleanup()
    record('DISPOSABLE DATABASE REMOVED', true, fixture.databaseName)
  }
}

function databaseFixture() {
  const supplied = process.env.MODULA_TEST_DATABASE_URL
  if (supplied) return {databaseName: new URL(supplied).pathname.slice(1), migratorUrl: supplied, testUrl: supplied, cleanup: () => undefined}
  const container = 'modula-preview-greenfield-postgres-1'
  if (!output('docker', ['container', 'inspect', container])) return null
  const environment = output('docker', ['inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}'])
  const values = Object.fromEntries(environment.split('\n').map(line => line.split(/=(.*)/s).slice(0, 2)).filter(parts => parts.length === 2))
  const databaseName = `modula_gbv1_engines_${process.pid}_${Date.now()}`.toLowerCase()
  const testRole = `gbv1_engines_test_${process.pid}_${Date.now()}`.toLowerCase()
  const testPassword = randomBytes(24).toString('base64url')
  const roleCreated = spawnSync('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', values.POSTGRES_DB ?? 'modula', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE ROLE ${testRole} LOGIN SUPERUSER PASSWORD '${testPassword}'`], {stdio: 'ignore', shell: false})
  if (roleCreated.status !== 0) return null
  const created = spawnSync('docker', ['exec', container, 'createdb', '-U', 'modula_admin', '-O', 'modula_migrator', databaseName], {stdio: 'ignore', shell: false})
  if (created.status !== 0) {
    spawnSync('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', values.POSTGRES_DB ?? 'modula', '-c', `DROP ROLE IF EXISTS ${testRole}`], {stdio: 'ignore', shell: false})
    return null
  }
  return {
    databaseName,
    migratorUrl: databaseUrl('modula_migrator', values.MODULA_MIGRATOR_PASSWORD, databaseName),
    testUrl: databaseUrl(testRole, testPassword, databaseName),
    cleanup: () => {
      spawnSync('docker', ['exec', container, 'dropdb', '-U', 'modula_admin', '--if-exists', databaseName], {stdio: 'ignore', shell: false})
      spawnSync('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', values.POSTGRES_DB ?? 'modula', '-c', `DROP ROLE IF EXISTS ${testRole}`], {stdio: 'ignore', shell: false})
    },
  }
}

function databaseUrl(user, password, databaseName) {
  const url = new URL('postgresql://127.0.0.1:5433')
  url.username = user
  if (password) url.password = password
  url.pathname = `/${databaseName}`
  return url.toString()
}

function verifyProductionState() {
  const container = 'modula-production-greenfield-postgres-1'
  if (!output('docker', ['container', 'inspect', container])) return record('PRODUCTION DATABASE DISCOVERED', true, 'not present outside production host')
  const database = output('docker', ['inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}']).split('\n').find(line => line.startsWith('POSTGRES_DB='))?.slice(12) ?? 'modula'
  const schema = output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', "SELECT value FROM schema_metadata WHERE key='schema_version'"])
  const required = process.env.MODULA_REQUIRE_PRODUCTION_044 === '1'
  const version = Number(schema)
  record('PRODUCTION SCHEMA DISCOVERED', required ? version >= 44 : version >= 43 && version <= 53, schema)
  if (!required || version < 44) return
  const count = output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', 'SELECT count(*) FROM greenfield_engine_registrations'])
  const invalid = output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', "SELECT count(*) FROM greenfield_engine_service_registrations service JOIN greenfield_engine_registrations engine USING(engine_id) WHERE engine.runtime_status <> 'READY'"])
  const revision = output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', `SELECT
    count(*) FILTER (WHERE engine_id='engine.entitlements' AND source_revision='${entitlementEngineRevision}') || chr(58) ||
    count(*) FILTER (WHERE engine_id<>'engine.entitlements' AND source_revision='${legacyEngineRevision}') || chr(58) ||
    count(*) FILTER (WHERE source_revision IS NULL OR NOT (
      (engine_id='engine.entitlements' AND source_revision='${entitlementEngineRevision}') OR
      (engine_id<>'engine.entitlements' AND source_revision='${legacyEngineRevision}')
    ))
    FROM greenfield_engine_registrations`])
  record('PRODUCTION ENGINE COUNT', count === '10', count)
  record('PRODUCTION CONTRACT-ONLY SERVICES', invalid === '0', invalid)
  record('PRODUCTION ENGINE PROVENANCE', revision === '1:9:0', revision)
}
