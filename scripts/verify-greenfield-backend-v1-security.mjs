#!/usr/bin/env node
import {randomBytes} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const buildService = '/root/modula-platform/modula-build-service'
const backendSdk = '/root/modula-platform/modula-backend-sdk'
const secretsService = '/root/modula-platform/modula-secrets-service'
const templates = '/root/modula-platform/modula-product-templates'
const failures = []

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(52)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}: ${detail}`)
}
function source(label, file, required, forbidden = []) {
  const body = existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : ''
  record(label, Boolean(body) && required.every(value => body.includes(value)) && forbidden.every(value => !body.includes(value)), file)
}
function externalSource(label, file, required) {
  const body = existsSync(file) ? readFileSync(file, 'utf8') : ''
  record(label, Boolean(body) && required.every(value => body.includes(value)), file)
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

console.log('MODULA\nGREENFIELD BACKEND V1\nSECURITY HARDENING VERIFIER\n')

source('CROSS ACCOUNT AND CAPABILITY TESTS', 'services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts', ['denies undeclared capability escalation and cross-account resource access', 'cross-account-event'])
source('SQL PRIVILEGE BEHAVIOUR TESTS', 'services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts', ['has_table_privilege', 'modula_backup SELECT'])
source('SERVICE IDENTITY AND RAW BEARER TESTS', 'services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts', ['verified service assertion', 'rejects raw bearer forwarding', 'crossProduct'])
source('EVENT SPOOF AND JOB REPLAY TESTS', 'services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts', ['producer: \'service.attacker\'', 'idempotency conflict detection', 'single-use secret lease'])
source('SQL INJECTION BEHAVIOUR TEST', 'services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts', ['rejects SQL injection collection input', "entry' OR '1'='1"])
source('SSRF AND OPEN REDIRECT GUARD', 'services/greenfield-api/src/modules/backend/network-policy.ts', ['decoded.startsWith(\'//\')', 'resolved.origin !== origin', 'maxRedirects: 0'])
source('SSRF AND OPEN REDIRECT TEST', 'services/greenfield-api/tests/greenfield-backend-v1.network-policy.test.ts', ['exact registered origin', '//attacker.example', '/%2e%2e/admin'])
source('DEPENDENCY CYCLE TEST', 'services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts', ['A to B to C to A dependency cycles', 'DEPENDENCY_CYCLE'])
source('MANIFEST TAMPER QUARANTINE TEST', 'services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts', ['manifest changes after checksum capture', "release_state).toBe('quarantined')"])
source('ARTIFACT TAMPER QUARANTINE TEST', 'services/greenfield-api/tests/greenfield-backend-v1.build-release.test.ts', ['quarantines tampered provenance', "state: 'QUARANTINED'", 'provenanceVerified: false'])
source('ENTITLEMENT BYPASS TEST', 'services/greenfield-api/tests/greenfield-backend-v1.entitlements-usage.test.ts', ['atomically rejects quota bypass', 'APPLE_PROVIDER_NOT_CONFIGURED_OR_RECEIPT_UNVERIFIED'])
source('PUBLISHER IMPERSONATION TEST', 'services/greenfield-api/tests/greenfield-backend-v1.developer-domain.test.ts', ['digital.modula.evil', 'dev-attacker'])
source('TEST PRODUCT PUBLICATION GUARD', 'services/greenfield-api/src/modules/beta-catalogue-policy.ts', ["/^test\\.modula\\./i", "classification: 'TEST_ONLY'", 'visibleInBeta: false'])
source('REMOTE ARBITRARY JS REJECTION', 'packages/greenfield-module-manifest/tests/manifest.test.ts', ['rejects executable escape hatches', 'remoteEntry', 'UNDECLARED_EXTENSION_FIELD'])
source('DATA URL AND SECRET METADATA GUARDS', 'services/greenfield-api/tests/greenfield-backend-v1.data-ledger.test.ts', ['arbitrary storage URLs and plaintext-secret metadata', 'secret://product/'])
source('MIGRATION LEDGER RUNTIME WRITE GUARD', 'services/greenfield-api/migrations/052_greenfield_backend_v1_migration_ledger_security.sql', ['REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER', 'schema_metadata', 'schema_migrations'])
source('BACKUP ROLE ACL RECONCILIATION', 'services/greenfield-api/migrations/053_greenfield_backend_v1_backup_acl_reconciliation.sql', ['greenfield_backup_acl_reconciliation', 'GRANT SELECT ON ALL TABLES', 'GRANT SELECT ON ALL SEQUENCES'])
externalSource('BUILD OUTPUT PATH AND ARCHIVE POLICY', join(buildService, 'src/artifact-policy.ts'), ['isSafeArchivePath', 'contains a link or special file', 'Artifact checksum mismatch'])
externalSource('BUILD REQUEST TRAVERSAL POLICY', join(buildService, 'src/pipeline.ts'), ['Invalid build ID', 'approved HTTPS Git origin'])
externalSource('DEDICATED DATABASE ROLE POLICY', join(backendSdk, 'packages/backend-testkit/src/index.ts'), ['NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION', 'REVOKE ALL ON DATABASE', 'REVOKE CREATE ON SCHEMA public FROM PUBLIC'])

const preview = previewPostgres()
record('PREVIEW POSTGRES AVAILABLE', Boolean(preview), preview?.container ?? 'required for isolation tests')
if (preview) {
  runSdkDatabaseIsolation(preview)
}
run('BUILD SANDBOX AND ARCHIVE SECURITY', 'pnpm', ['verify'], buildService, {...process.env, CI: 'true'})
run('SECRET SERVICE AND TRACKED FILE SCAN', 'pnpm', ['verify'], secretsService, {...process.env, CI: 'true'})
run('PRODUCT TEMPLATE SECURITY AND GOLDENS', 'pnpm', ['verify'], templates, {...process.env, CI: 'true'})
run('MODULE MANIFEST SECURITY', 'pnpm', ['--filter', '@modula/greenfield-module-manifest', 'test'], root, {...process.env, CI: 'true'})
run('GREENFIELD API AND WORKER TYPECHECK', 'pnpm', ['--filter', '@modula/greenfield-api...', 'typecheck'], root, {...process.env, CI: 'true'})
runDatabaseChecks(preview)
productionState()
run('GIT DIFF CHECK', 'git', ['diff', '--check'])

console.log('\nRESULT')
if (failures.length) {
  console.log(`GREENFIELD BACKEND V1 SECURITY FAIL (${failures.length})`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
for (const label of [
  'CROSS ACCOUNT LEAKS', 'CROSS MODULE DB LEAKS', 'RAW BEARER FORWARDING', 'ARBITRARY SERVICE URLS',
  'UNVERIFIED ARTIFACT INSTALLS', 'DEPENDENCY CYCLES ACCEPTED', 'SECRET LEAKS', 'ENTITLEMENT BYPASSES',
  'TEST PRODUCTS PUBLIC', 'REMOTE ARBITRARY JS',
]) console.log(`${label.padEnd(52)} 0`)
console.log('GREENFIELD BACKEND V1 SECURITY PASS')

function runDatabaseChecks(preview) {
  const fixture = databaseFixture(preview)
  record('DISPOSABLE GREENFIELD DATABASE', Boolean(fixture), fixture?.databaseName ?? 'unavailable')
  if (!fixture) return
  try {
    const migrateEnv = {...process.env, CI: 'true', MODULA_TEST_DATABASE_URL: fixture.migratorUrl}
    const testEnv = {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl}
    run('FULL MIGRATION CHAIN AND 053 ACL REHEARSAL', 'pnpm', ['exec', 'tsx', 'scripts/verify-backup-acl-reconciliation.ts'], join(root, 'services/greenfield-api'), migrateEnv)
    run('GREENFIELD SECURITY BEHAVIOUR MATRIX', 'pnpm', [
      '--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', '--maxWorkers=1', '--fileParallelism=false',
      'tests/phase6.security.test.ts',
      'tests/greenfield-backend-v1.network-policy.test.ts',
      'tests/greenfield-backend-v1.service-fabric.test.ts',
      'tests/pvp-platform-2.extension-fabric.test.ts',
      'tests/greenfield-backend-v1.data-ledger.test.ts',
      'tests/greenfield-backend-v1.build-release.test.ts',
      'tests/greenfield-backend-v1.entitlements-usage.test.ts',
      'tests/greenfield-backend-v1.developer-domain.test.ts',
      'tests/greenfield-backend-v1.migration-ledger-security.test.ts',
      'tests/phase7l.product-hub-policy.test.ts',
    ], root, testEnv)
  } finally {
    fixture.cleanup()
    record('DISPOSABLE GREENFIELD DATABASE REMOVED', true, fixture.databaseName)
  }
}

function previewPostgres() {
  const container = 'modula-preview-greenfield-postgres-1'
  if (!output('docker', ['container', 'inspect', container])) return null
  const environment = output('docker', ['inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}'])
  const values = Object.fromEntries(environment.split('\n').map(line => line.split(/=(.*)/s).slice(0, 2)).filter(parts => parts.length === 2))
  const database = values.POSTGRES_DB ?? 'modula'
  return {container, database, values}
}

function runSdkDatabaseIsolation(preview) {
  const suffix = `${process.pid}_${Date.now()}`.toLowerCase()
  const role = `gbv1_sdk_admin_${suffix}`
  const password = randomBytes(24).toString('base64url')
  const created = spawnSync('docker', ['exec', preview.container, 'psql', '-U', 'modula_admin', '-d', preview.database, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE ROLE ${role} LOGIN SUPERUSER PASSWORD '${password}'`], {stdio: 'ignore'}).status === 0
  if (!created) return record('BACKEND SDK AND CROSS PRODUCT DB ISOLATION', false, 'temporary admin role unavailable')
  try {
    run('BACKEND SDK AND CROSS PRODUCT DB ISOLATION', 'pnpm', ['verify'], backendSdk, {...process.env, CI: 'true', MODULA_TEST_POSTGRES_ADMIN_URL: databaseUrl(role, password, preview.database)})
  } finally {
    spawnSync('docker', ['exec', preview.container, 'psql', '-U', 'modula_admin', '-d', preview.database, '-c', `DROP ROLE IF EXISTS ${role}`], {stdio: 'ignore'})
  }
}

function databaseFixture(preview) {
  if (!preview) return null
  const supplied = process.env.MODULA_TEST_DATABASE_URL
  if (supplied) return {databaseName: new URL(supplied).pathname.slice(1), migratorUrl: supplied, testUrl: supplied, cleanup: () => undefined}
  const suffix = `${process.pid}_${Date.now()}`.toLowerCase()
  const databaseName = `modula_gbv1_security_${suffix}`
  const role = `gbv1_security_test_${suffix}`
  const password = randomBytes(24).toString('base64url')
  if (spawnSync('docker', ['exec', preview.container, 'psql', '-U', 'modula_admin', '-d', preview.database, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE ROLE ${role} LOGIN SUPERUSER PASSWORD '${password}'`], {stdio: 'ignore'}).status !== 0) return null
  if (spawnSync('docker', ['exec', preview.container, 'createdb', '-U', 'modula_admin', '-O', 'modula_migrator', databaseName], {stdio: 'ignore'}).status !== 0) return null
  return {
    databaseName,
    migratorUrl: databaseUrl('modula_migrator', preview.values.MODULA_MIGRATOR_PASSWORD, databaseName),
    testUrl: databaseUrl(role, password, databaseName),
    cleanup: () => {
      spawnSync('docker', ['exec', preview.container, 'dropdb', '-U', 'modula_admin', '--if-exists', '--force', databaseName], {stdio: 'ignore'})
      spawnSync('docker', ['exec', preview.container, 'psql', '-U', 'modula_admin', '-d', preview.database, '-c', `DROP ROLE IF EXISTS ${role}`], {stdio: 'ignore'})
    },
  }
}

function databaseUrl(user, password, database) {
  const url = new URL('postgresql://127.0.0.1:5433')
  url.username = user
  if (password) url.password = password
  url.pathname = `/${database}`
  return url.toString()
}

function productionState() {
  const container = 'modula-production-greenfield-postgres-1'
  if (!output('docker', ['container', 'inspect', container])) return record('PRODUCTION DATABASE DISCOVERED', true, 'not present on this host')
  const database = output('docker', ['inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}']).split('\n').find(line => line.startsWith('POSTGRES_DB='))?.slice(12) ?? 'modula'
  const schema = output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', "SELECT value FROM schema_metadata WHERE key='schema_version'"])
  record('PRODUCTION SCHEMA DISCOVERED', Number(schema) >= 43 && Number(schema) <= 53, `${schema} (production read-only observation)`)
}
