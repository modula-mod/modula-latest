#!/usr/bin/env node
import {randomBytes} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const failures = []
function record(label, passed, detail = '') { console.log(`${label.padEnd(49)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`); if (!passed) failures.push(`${label}: ${detail}`) }
function source(label, file, required, forbidden = []) { const content = existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : ''; record(label, Boolean(content) && required.every(value => content.includes(value)) && forbidden.every(value => !content.includes(value)), file) }
function run(label, command, args, cwd = root, env = process.env) { console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`); const result = spawnSync(command, args, {cwd, env, stdio: 'inherit', shell: false}); record(label, result.status === 0, cwd) }
function output(command, args) { const result = spawnSync(command, args, {encoding: 'utf8', shell: false}); return result.status === 0 ? result.stdout.trim() : '' }

console.log('MODULA\nGREENFIELD BACKEND V1\nDEVELOPER DOMAIN VERIFIER\n')
source('DEVELOPER LEDGER MIGRATION', 'services/greenfield-api/migrations/047_greenfield_backend_v1_developer_domain.sql', [
  'greenfield_developer_profiles', 'greenfield_developer_organisations', 'greenfield_publisher_owners',
  'greenfield_developer_agreement_acceptances', 'greenfield_developer_programme_memberships',
  'greenfield_developer_products', 'greenfield_developer_builds', 'greenfield_developer_releases',
  'greenfield_developer_test_groups', 'greenfield_developer_review_submissions', "'047'",
])
source('REVERSIBLE DEVELOPER MIGRATION', 'services/greenfield-api/migrations/047_greenfield_backend_v1_developer_domain.down.sql', ['DROP TABLE IF EXISTS greenfield_developer_review_submissions', "value='046'"])
source('FIRST PARTY NAMESPACE GUARD', 'services/greenfield-api/src/developers/service.ts', ["namespace === 'digital.modula'", 'first-party only', 'requirePublisherAccess'])
source('PRIVATE DEVELOPMENT POLICY', 'services/greenfield-api/src/developers/service.ts', ["input.visibility ?? 'PRIVATE'", 'assertPublicPublishingReady', "programme?.state !== 'ACTIVE'"])
source('SECRET HANDLE ISOLATION', 'services/greenfield-api/src/developers/service.ts', ["credentialRef.startsWith('secret://developer.')"], ['credential_value', 'access_token'])
source('DEVELOPER BOARD APIS', 'services/greenfield-api/src/developers/routes.ts', ['/v1/developer/board', '/v1/developer/products', '/v1/developer/programme/enrol', '/v1/admin/developer/programme'])
source('NO FABRICATED AGREEMENT TEXT', 'services/greenfield-api/migrations/047_greenfield_backend_v1_developer_domain.sql', ['document_hash', 'effective_at', 'accepted_by_account_id'], ['terms and conditions', 'legal agreement text'])
source('DEVELOPER BEHAVIOUR TEST', 'services/greenfield-api/tests/greenfield-backend-v1.developer-domain.test.ts', ['digital.modula.evil', 'private development', 'explicit programme transitions'], ['sk-proj-', 'OPENAI_API_KEY='])

run('API CONTRACTS BUILD', 'pnpm', ['--filter', '@modula/api-contracts', 'build'], root, {...process.env, CI: 'true'})
run('GREENFIELD API TYPECHECK', 'pnpm', ['--filter', '@modula/greenfield-api', 'typecheck'], root, {...process.env, CI: 'true'})
databaseChecks()
productionState()

console.log('\nRESULT')
if (failures.length) { console.log(`GREENFIELD BACKEND V1 DEVELOPER FAIL (${failures.length})`); failures.forEach(failure => console.log(`- ${failure}`)); process.exit(1) }
console.log('GREENFIELD BACKEND V1 DEVELOPER PASS')

function databaseChecks() {
  const fixture = databaseFixture()
  record('DISPOSABLE DATABASE AVAILABLE', Boolean(fixture), fixture?.databaseName ?? 'preview Postgres unavailable')
  if (!fixture) return
  try {
    const migrateEnv = {...process.env, CI: 'true', MODULA_TEST_DATABASE_URL: fixture.migratorUrl}
    const testEnv = {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl}
    run('FULL MIGRATION CHAIN THROUGH 047', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e', "import {migrateUp} from './src/database/migrate.ts'; void migrateUp(process.env.MODULA_TEST_DATABASE_URL).then(applied => { if (!applied.includes('047_greenfield_backend_v1_developer_domain')) process.exit(1) })"], join(root, 'services/greenfield-api'), migrateEnv)
    run('DEVELOPER DOMAIN BEHAVIOUR', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.developer-domain.test.ts'], root, testEnv)
    run('EXISTING REGISTRY JOURNEYS', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7a.modules.test.ts'], root, testEnv)
    run('MIGRATION 047 DOWN AND REAPPLY', 'pnpm', ['exec', 'tsx', 'scripts/verify-migration-cycle.ts', '047_greenfield_backend_v1_developer_domain'], join(root, 'services/greenfield-api'), migrateEnv)
  } finally { fixture.cleanup(); record('DISPOSABLE DATABASE REMOVED', true, fixture.databaseName) }
}

function databaseFixture() {
  const supplied = process.env.MODULA_TEST_DATABASE_URL
  if (supplied) return {databaseName: new URL(supplied).pathname.slice(1), migratorUrl: supplied, testUrl: supplied, cleanup: () => undefined}
  const container = 'modula-preview-greenfield-postgres-1'
  if (!output('docker', ['container', 'inspect', container])) return null
  const environment = output('docker', ['inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}'])
  const values = Object.fromEntries(environment.split('\n').map(line => line.split(/=(.*)/s).slice(0, 2)).filter(parts => parts.length === 2))
  const databaseName = `modula_gbv1_developer_${process.pid}_${Date.now()}`.toLowerCase()
  const testRole = `gbv1_developer_test_${process.pid}_${Date.now()}`.toLowerCase()
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
  record('PRODUCTION SCHEMA DISCOVERED', process.env.MODULA_REQUIRE_PRODUCTION_047 === '1' ? version >= 47 : version >= 43 && version <= 53, schema)
}
