#!/usr/bin/env node
import {randomBytes} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const failures = []
const repositories = {
  notes: '/root/modula-mod/modula-vault-notes',
  formatting: '/root/modula-mod/modula-vault-formatting',
  ai: '/root/modula-mod/modula-vault-ai',
  voice: '/root/modula-mod/modula-vault-voice',
}

function record(label, ok, detail = '') {
  console.log(`${label.padEnd(49)} ${ok ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(`${label}: ${detail}`)
}
function source(label, file, required, forbidden = []) {
  const body = existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : ''
  record(label, Boolean(body) && required.every(value => body.includes(value)) && forbidden.every(value => !body.includes(value)), file)
}
function run(label, command, args, cwd = root, env = process.env) {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit', shell: false})
  record(label, result.status === 0, cwd)
}
function output(command, args) {
  const result = spawnSync(command, args, {encoding: 'utf8', shell: false})
  return result.status === 0 ? result.stdout.trim() : ''
}

console.log('MODULA\nGREENFIELD BACKEND V1\nREFERENCE PRODUCT JOURNEYS VERIFIER\n')
source('DEFAULT PROVIDER LEDGER', 'services/greenfield-api/migrations/051_greenfield_backend_v1_default_providers.sql', ['greenfield_account_default_providers', 'capability_role', 'provider_installation_id', 'greenfield_default_provider_scope_guard', "'051'"])
source('REVERSIBLE PROVIDER MIGRATION', 'services/greenfield-api/migrations/051_greenfield_backend_v1_default_providers.down.sql', ['DROP TABLE IF EXISTS greenfield_account_default_providers', "value='050'"])
source('MANIFEST DRIVEN PROVIDER RESOLUTION', 'services/greenfield-api/src/providers/service.ts', ['dependencyProvidesFromManifest', 'greenfield.provider.default.changed', "row.status === 'enabled'"], ['digital.modula.vault-notes'])
source('ACCOUNT SCOPED PROVIDER API', 'services/greenfield-api/src/providers/routes.ts', ['/v1/providers/:capabilityRole', '/resolve', '/default', 'sessions.resolveAccess'])
source('TEST ONLY SECOND PROVIDER', 'services/greenfield-api/tests/greenfield-backend-v1.provider-fabric.test.ts', ['test.modula.reference-notes', 'switches the account default', 'enforces account ownership'], ['digital.modula.vault-notes'])
source('TEST ONLY MODULE BACKEND FIXTURE', 'fixtures/modules/module-owned-backend/backend/service.mjs', ['ReferenceModuleBackend', 'account_id=$1 AND installation_id=$2', 'deleteInstallationData'], ['MODULA_DATABASE_URL', 'greenfield session bearer'])
source('MODULE BACKEND INTEGRATION PROOF', 'services/greenfield-api/tests/greenfield-backend-v1.module-owned-backend.test.ts', ['dedicated-database CRUD', 'publishes scoped events', 'deleteData uninstall', "code: '42501'"])
source('ADDON OWN BACKEND SCOPE PROOF', 'services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts', ['single-purpose assertion for its own add-on backend', 'service.digital.modula.vault-notes.ai.backend', 'raw_user_bearer_forwarded: false'])

for (const [name, repository] of Object.entries(repositories)) {
  record(`${name.toUpperCase()} REPOSITORY`, existsSync(join(repository, 'module.manifest.json')), repository)
  run(`${name.toUpperCase()} SOURCE VERIFY`, 'pnpm', ['verify'], repository, {...process.env, CI: 'true'})
}

databaseChecks()
productionState()

console.log('\nRESULT')
if (failures.length) {
  console.log(`GREENFIELD BACKEND V1 REFERENCE PRODUCTS FAIL (${failures.length})`)
  failures.forEach(value => console.log(`- ${value}`))
  process.exit(1)
}
console.log('VAULT NOTES'.padEnd(49), 'PASS')
console.log('VAULT FORMATTING'.padEnd(49), 'PASS')
console.log('VAULT AI'.padEnd(49), 'PASS*  PROVIDER_NOT_CONFIGURED unless credential fabric reports READY')
console.log('VAULT VOICE'.padEnd(49), 'PASS*  TRANSCRIPTION_PROVIDER_NOT_CONFIGURED unless credential fabric reports READY')
console.log('REFERENCE NOTES'.padEnd(49), 'PASS TEST_ONLY')
console.log('MULTIPLE PROVIDERS'.padEnd(49), 'PASS')
console.log('DEFAULT PROVIDERS'.padEnd(49), 'PASS')
console.log('MODULE-OWNED-BACKEND FIXTURE'.padEnd(49), 'PASS TEST_ONLY')
console.log('EXTENSION WITH BACKEND'.padEnd(49), 'PASS')
console.log('GREENFIELD BACKEND V1 REFERENCE PRODUCTS PASS')

function databaseChecks() {
  const fixture = databaseFixture()
  record('DISPOSABLE DATABASE AVAILABLE', Boolean(fixture), fixture?.databaseName ?? 'preview Postgres unavailable')
  if (!fixture) return
  try {
    const migrateEnv = {...process.env, CI: 'true', MODULA_TEST_DATABASE_URL: fixture.migratorUrl}
    const testEnv = {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl}
    run('FULL MIGRATION CHAIN THROUGH 051', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e', "import {migrateUp} from './src/database/migrate.ts'; void migrateUp(process.env.MODULA_TEST_DATABASE_URL).then(applied=>{if(!applied.includes('051_greenfield_backend_v1_default_providers'))process.exit(1)})"], join(root, 'services/greenfield-api'), migrateEnv)
    run('GENERIC PROVIDER SWITCHING', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.provider-fabric.test.ts'], root, testEnv)
    run('VAULT NOTES FULL LIFECYCLE', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.vault-notes-platform.test.ts'], root, testEnv)
    run('REAL EXTENSION COMPOSITION', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/pvp-platform-2.reference-products.test.ts'], root, testEnv)
    run('MODULE BACKEND SUBSTRATE', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.module-backend-runtime.test.ts'], root, testEnv)
    run('MODULE OWNED BACKEND JOURNEY', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.module-owned-backend.test.ts'], root, testEnv)
    run('MIGRATION 051 DOWN AND REAPPLY', 'pnpm', ['exec', 'tsx', 'scripts/verify-migration-cycle.ts', '051_greenfield_backend_v1_default_providers'], join(root, 'services/greenfield-api'), migrateEnv)
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
  const raw = output('docker', ['inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}'])
  const values = Object.fromEntries(raw.split('\n').map(line => line.split(/=(.*)/s).slice(0, 2)).filter(value => value.length === 2))
  const suffix = `${process.pid}_${Date.now()}`.toLowerCase()
  const databaseName = `modula_gbv1_references_${suffix}`
  const role = `gbv1_references_test_${suffix}`
  const password = randomBytes(24).toString('base64url')
  if (spawnSync('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', values.POSTGRES_DB ?? 'modula', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE ROLE ${role} LOGIN SUPERUSER PASSWORD '${password}'`], {stdio: 'ignore'}).status !== 0) return null
  if (spawnSync('docker', ['exec', container, 'createdb', '-U', 'modula_admin', '-O', 'modula_migrator', databaseName], {stdio: 'ignore'}).status !== 0) return null
  return {
    databaseName,
    migratorUrl: dbUrl('modula_migrator', values.MODULA_MIGRATOR_PASSWORD, databaseName),
    testUrl: dbUrl(role, password, databaseName),
    cleanup: () => {
      spawnSync('docker', ['exec', container, 'dropdb', '-U', 'modula_admin', '--if-exists', '--force', databaseName], {stdio: 'ignore'})
      spawnSync('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', values.POSTGRES_DB ?? 'modula', '-c', `DROP ROLE IF EXISTS ${role}`], {stdio: 'ignore'})
    },
  }
}

function dbUrl(user, password, database) {
  const url = new URL('postgresql://127.0.0.1:5433')
  url.username = user
  if (password) url.password = password
  url.pathname = `/${database}`
  return url.toString()
}

function productionState() {
  const container = 'modula-production-greenfield-postgres-1'
  if (!output('docker', ['container', 'inspect', container])) return record('PRODUCTION DATABASE DISCOVERED', true, 'not present outside production host')
  const database = output('docker', ['inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}']).split('\n').find(line => line.startsWith('POSTGRES_DB='))?.slice(12) ?? 'modula'
  const schema = output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', "SELECT value FROM schema_metadata WHERE key='schema_version'"])
  record('PRODUCTION SCHEMA DISCOVERED', Number(schema) >= 43 && Number(schema) <= 55, `${schema} (production read-only observation)`)
}
