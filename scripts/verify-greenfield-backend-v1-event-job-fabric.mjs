#!/usr/bin/env node
import {randomBytes} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const failures = []
const sdkRoot = resolve(process.env.MODULA_BACKEND_SDK_ROOT ?? '/root/modula-platform/modula-backend-sdk')

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(48)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
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

function output(command, args, cwd = root) {
  const result = spawnSync(command, args, {cwd, encoding: 'utf8', shell: false})
  return result.status === 0 ? result.stdout.trim() : ''
}

console.log('MODULA')
console.log('GREENFIELD BACKEND V1')
console.log('EVENT + JOB FABRIC VERIFIER\n')

source('CANONICAL EVENT PROVENANCE MIGRATION', 'services/greenfield-api/migrations/043_greenfield_backend_v1_event_job_fabric.sql', [
  'producer_kind',
  'producer_id',
  'product_id',
  'installation_id',
  'release_id',
  'trace_id',
  'greenfield_event_scope_guard',
])
source('CANONICAL JOB LIFECYCLE MIGRATION', 'services/greenfield-api/migrations/043_greenfield_backend_v1_event_job_fabric.sql', [
  "'QUEUED','LEASED','RUNNING','RETRYING','SUCCEEDED','FAILED','CANCELLED','DEAD_LETTER'",
  "'GREENFIELD_WORKER','SERVICE_PULL'",
  'background_jobs_service_idempotency_idx',
  'greenfield_job_scope_guard',
  'TO modula_backup',
])
source('FAILURE PAYLOAD REDACTION', 'services/greenfield-api/migrations/043_greenfield_backend_v1_event_job_fabric.sql', [
  "payload = '{}'::jsonb",
  'job_failures_payload_redacted_check',
  'payload_fingerprint',
  'Legacy job failure detail redacted',
])
source('REVERSIBLE EVENT JOB MIGRATION', 'services/greenfield-api/migrations/043_greenfield_backend_v1_event_job_fabric.down.sql', [
  'DROP TRIGGER IF EXISTS background_jobs_scope_guard',
  'DROP TRIGGER IF EXISTS greenfield_domain_events_scope_guard',
  'FROM modula_backup',
  "value='042'",
])
source('SCOPED BACKEND EVENT ROUTE', 'services/greenfield-api/src/backend-fabric/routes.ts', [
  '/v1/backend/products/:productId/events',
  "requireAssertionOperation(assertion, 'events.publish')",
  'Event idempotency key must equal eventId',
])
source('SCOPED BACKEND JOB ROUTES', 'services/greenfield-api/src/backend-fabric/routes.ts', [
  '/v1/backend/products/:productId/jobs/claim',
  '/v1/backend/products/:productId/jobs/:jobId/start',
  '/v1/backend/products/:productId/jobs/:jobId/succeed',
  '/v1/backend/products/:productId/jobs/:jobId/fail',
  '/v1/backend/products/:productId/jobs/:jobId/result',
  '/v1/backend/products/:productId/jobs/:jobId/cancel',
])
source('DECLARED JOB AND SECRET GUARDS', 'services/greenfield-api/src/backend-fabric/event-job-service.ts', [
  'greenfield_module_job_registrations',
  'Job action is not declared by the installed release',
  'containsRawSecret',
  'secret:// handle',
  "dispatch_mode: 'SERVICE_PULL'",
])
source('SERVICE JOB ACCOUNT ISOLATION', 'services/greenfield-api/src/backend-fabric/event-job-service.ts', [
  ".where('owner_account_id', '=', assertion.accountId)",
  ".where('product_id', '=', runtime.moduleId)",
  ".where('installation_id', '=', runtime.installationId)",
  ".where('service_id', '=', assertion.targetServiceId)",
])
source('WORKER CANONICAL STATE MACHINE', 'services/greenfield-worker/src/jobs/claim.ts', [
  "dispatch_mode = 'GREENFIELD_WORKER'",
  "status IN ('QUEUED', 'RETRYING')",
  "status: 'RUNNING'",
  "status: 'SUCCEEDED'",
  "permanent ? 'FAILED' : 'DEAD_LETTER'",
  'payload_fingerprint',
])
source('WORKER JOB TIMEOUT', 'services/greenfield-worker/src/jobs/runner.ts', [
  'markJobRunning',
  'withTimeout',
  'job.timeout_ms',
  'JOB_TIMEOUT',
])
source('SINGLE USE SERVICE ASSERTION', 'services/greenfield-api/src/modules/backend/token-service.ts', [
  'assertion.consumed_at',
  ".where('consumed_at', 'is', null)",
  ".returning('assertion_id')",
  'if (!consumed) return null',
])
source('RUNTIME JOB SUPPORT TRUTH', 'packages/greenfield-module-manifest/src/runtime-support.ts', [
  "jobs: 'SUPPORTED'",
  'canonical worker or scoped service-pull lifecycle',
])

run('GREENFIELD CONTRACTS BUILD', 'pnpm', ['--filter', '@modula/greenfield-contracts', 'build'], root, {...process.env, CI: 'true'})
run('GREENFIELD API TYPECHECK', 'pnpm', ['--filter', '@modula/greenfield-api', 'typecheck'], root, {...process.env, CI: 'true'})
run('GREENFIELD WORKER TYPECHECK', 'pnpm', ['--filter', '@modula/greenfield-worker', 'typecheck'], root, {...process.env, CI: 'true'})

record('BACKEND SDK REPOSITORY', existsSync(join(sdkRoot, '.git')), sdkRoot)
if (existsSync(join(sdkRoot, '.git'))) {
  run('BACKEND SDK VERIFY', 'pnpm', ['verify'], sdkRoot, {...process.env, CI: 'true'})
  run('BACKEND SDK MAIN CONVERGENCE', 'sh', ['-ceu', 'test "$(git branch --show-current)" = main; test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"; test -z "$(git status --porcelain)"'], sdkRoot)
}

await runIsolatedDatabaseChecks()
verifyProductionState()

console.log('\nRESULT')
if (failures.length) {
  console.log(`GREENFIELD BACKEND V1 EVENT + JOB FABRIC FAIL (${failures.length})`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log('GREENFIELD BACKEND V1 EVENT + JOB FABRIC PASS')

async function runIsolatedDatabaseChecks() {
  const fixture = databaseFixture()
  record('DISPOSABLE DATABASE AVAILABLE', Boolean(fixture), fixture?.databaseName ?? 'configure MODULA_TEST_DATABASE_URL or run preview Postgres')
  if (!fixture) return
  try {
    const migrateEnv = {...process.env, CI: 'true', MODULA_TEST_DATABASE_URL: fixture.migratorUrl}
    const testEnv = {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl}
    run('FULL MIGRATION CHAIN THROUGH 043', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e', "import {migrateUp} from './src/database/migrate.ts'; void migrateUp(process.env.MODULA_TEST_DATABASE_URL).then(applied => { if (!applied.includes('043_greenfield_backend_v1_event_job_fabric')) process.exit(1) })"], join(root, 'services/greenfield-api'), migrateEnv)
    run('EVENT JOB API BEHAVIOUR', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.service-fabric.test.ts', 'tests/phase7e.internal-events.test.ts'], root, testEnv)
    run('EVENT JOB WORKER BEHAVIOUR', 'pnpm', ['--filter', '@modula/greenfield-worker', 'exec', 'vitest', 'run', 'tests/lease.test.ts', 'tests/phase7e.event-delivery.test.ts', 'tests/phase7e.search-projector.test.ts', 'tests/phase7e.vault-notes-search-projector.test.ts'], root, testEnv)
    run('MIGRATION 043 DOWN AND REAPPLY', 'pnpm', ['exec', 'tsx', 'scripts/verify-migration-cycle.ts', '043_greenfield_backend_v1_event_job_fabric'], join(root, 'services/greenfield-api'), migrateEnv)
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
  const databaseName = `modula_gbv1_event_job_${process.pid}_${Date.now()}`.toLowerCase()
  const testRole = `gbv1_event_job_test_${process.pid}_${Date.now()}`.toLowerCase()
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
  if (!output('docker', ['container', 'inspect', container])) {
    record('PRODUCTION DATABASE DISCOVERED', true, 'not present outside production host')
    return
  }
  const database = output('docker', ['inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}'])
    .split('\n').find(line => line.startsWith('POSTGRES_DB='))?.slice('POSTGRES_DB='.length) ?? 'modula'
  const schema = output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', "SELECT value FROM schema_metadata WHERE key='schema_version'"])
  const require043 = process.env.MODULA_REQUIRE_PRODUCTION_043 === '1'
  const version = Number(schema)
  record('PRODUCTION SCHEMA DISCOVERED', require043 ? version >= 43 : version >= 42 && version <= 53, schema)
  if (!require043 || version < 43) return
  const unsafeFailures = output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', "SELECT count(*) FROM job_failures WHERE payload <> '{}'::jsonb"])
  const activeJobs = output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', "SELECT count(*) FROM background_jobs WHERE status IN ('QUEUED','LEASED','RUNNING','RETRYING')"])
  record('PRODUCTION FAILURE PAYLOADS REDACTED', unsafeFailures === '0', unsafeFailures)
  record('PRODUCTION ACTIVE JOBS DRAINED', activeJobs === '0', activeJobs)
}
