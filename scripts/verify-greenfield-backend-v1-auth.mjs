#!/usr/bin/env node
import {randomBytes} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const failures = []

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(49)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
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
console.log('AUTH COMPLETION VERIFIER\n')

source('APPLE CHALLENGE MIGRATION', 'services/greenfield-api/migrations/045_greenfield_backend_v1_apple_auth.sql', [
  'apple_authentication', 'apple_linking', "delivery_channel IN ('email', 'authenticator', 'webauthn', 'recovery', 'internal', 'external')", "'045'",
])
source('REVERSIBLE APPLE MIGRATION', 'services/greenfield-api/migrations/045_greenfield_backend_v1_apple_auth.down.sql', [
  "purpose IN ('apple_authentication', 'apple_linking')", "value='044'",
])
source('FIXED APPLE VERIFICATION AUTHORITY', 'services/greenfield-api/src/auth/apple/service.ts', [
  "const APPLE_ISSUER = 'https://appleid.apple.com'", "const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys')",
  'createRemoteJWKSet', 'jwtVerify', "algorithms: ['RS256']", 'payload.nonce !== expectedNonce',
], ['MODULA_APPLE_JWKS_URL', 'clientSecret'])
source('ONE-TIME NONCE AND IDENTITY ISOLATION', 'services/greenfield-api/src/auth/apple/service.ts', [
  "purpose: 'apple_authentication'", "purpose: 'apple_linking'", 'consumeOpaque',
  "provider_subject', '=', identity.subject", 'subjectIdentity.account_id !== input.accountId', "strength: 'strong'",
])
source('DISABLED PROVIDER TRUTH', 'services/greenfield-api/src/config/env.ts', [
  'MODULA_APPLE_AUTH_ENABLED', 'MODULA_APPLE_CLIENT_IDS is required when MODULA_APPLE_AUTH_ENABLED=true',
])
source('APPLE PUBLIC ROUTES', 'services/greenfield-api/src/app/register-routes.ts', [
  '/v1/auth/apple/status', '/v1/auth/apple/link/options', '/v1/auth/apple/link', '/v1/sessions/apple/options', '/v1/sessions/apple',
])
source('APPLE BEHAVIOUR TEST', 'services/greenfield-api/tests/greenfield-backend-v1.apple-auth.test.ts', [
  'AUTH_METHOD_UNAVAILABLE', 'CHALLENGE_REPLAYED', 'cross-account linking', "event_type)).toEqual(['external_identity.linked', 'sign_in.succeeded'])",
], ['sk-proj-', 'OPENAI_API_KEY='])

run('GREENFIELD API TYPECHECK', 'pnpm', ['--filter', '@modula/greenfield-api', 'typecheck'], root, {...process.env, CI: 'true'})
await runDatabaseChecks()
verifyProductionState()

console.log('\nRESULT')
if (failures.length) {
  console.log(`GREENFIELD BACKEND V1 AUTH FAIL (${failures.length})`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log('GREENFIELD BACKEND V1 AUTH PASS')

async function runDatabaseChecks() {
  const fixture = databaseFixture()
  record('DISPOSABLE DATABASE AVAILABLE', Boolean(fixture), fixture?.databaseName ?? 'configure MODULA_TEST_DATABASE_URL or run preview Postgres')
  if (!fixture) return
  try {
    const migrateEnv = {...process.env, CI: 'true', MODULA_TEST_DATABASE_URL: fixture.migratorUrl}
    const testEnv = {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl}
    run('FULL MIGRATION CHAIN THROUGH 045', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e', "import {migrateUp} from './src/database/migrate.ts'; void migrateUp(process.env.MODULA_TEST_DATABASE_URL).then(applied => { if (!applied.includes('045_greenfield_backend_v1_apple_auth')) process.exit(1) })"], join(root, 'services/greenfield-api'), migrateEnv)
    run('APPLE AUTH BEHAVIOUR', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.apple-auth.test.ts'], root, testEnv)
    run('EXISTING AUTH JOURNEYS', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield.accounts.test.ts'], root, testEnv)
    run('MIGRATION 045 DOWN AND REAPPLY', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e', "import {migrateDown,migrateUp} from './src/database/migrate.ts'; void (async()=>{const down=await migrateDown(process.env.MODULA_TEST_DATABASE_URL);if(down!=='045_greenfield_backend_v1_apple_auth')process.exit(1);const applied=await migrateUp(process.env.MODULA_TEST_DATABASE_URL);if(!applied.includes('045_greenfield_backend_v1_apple_auth'))process.exit(1)})()"], join(root, 'services/greenfield-api'), migrateEnv)
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
  const databaseName = `modula_gbv1_auth_${process.pid}_${Date.now()}`.toLowerCase()
  const testRole = `gbv1_auth_test_${process.pid}_${Date.now()}`.toLowerCase()
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
  const required = process.env.MODULA_REQUIRE_PRODUCTION_045 === '1'
  record('PRODUCTION SCHEMA DISCOVERED', required ? schema === '045' : ['043', '044', '045'].includes(schema), schema)
  if (!required || schema !== '045') return
  const appleChallenges = output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', "SELECT count(*) FROM pg_constraint WHERE conname='greenfield_auth_challenges_purpose_check' AND pg_get_constraintdef(oid) LIKE '%apple_authentication%'"])
  record('PRODUCTION APPLE CHALLENGE CONTRACT', appleChallenges === '1', appleChallenges)
}
