#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {join} from 'node:path'

const root = process.cwd()
const failures = []
const file = path => join(root, path)
const read = path => existsSync(file(path)) ? readFileSync(file(path), 'utf8') : ''

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(48)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}${detail ? `: ${detail}` : ''}`)
}

function source(label, path, required, forbidden = []) {
  const content = read(path)
  record(label, Boolean(content) && required.every(value => content.includes(value)) && forbidden.every(value => !content.includes(value)), path)
}

function run(label, command, args, env = process.env) {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd: root, env, stdio: 'inherit'})
  record(label, result.status === 0)
}

console.log('MODULA')
console.log('GREENFIELD BACKEND V1')
console.log('DATA LEDGER VERIFIER\n')

source('AUTHORITATIVE RESOURCE TABLES', 'services/greenfield-api/migrations/041_greenfield_backend_v1_data_ledger.sql', [
  'greenfield_data_resources',
  'greenfield_data_resource_owners',
  'greenfield_data_storage_bindings',
  'greenfield_data_schema_versions',
  'greenfield_data_migration_history',
  'greenfield_data_retention_policies',
  'greenfield_data_backup_policies',
])
source('ACCOUNT INSTALL RELEASE SCOPE GUARD', 'services/greenfield-api/migrations/041_greenfield_backend_v1_data_ledger.sql', [
  'greenfield_validate_data_resource_scope',
  'installation.account_id = NEW.owner_account_id',
  'release.release_id = NEW.release_id',
  'release.module_id = NEW.product_id',
])
source('STORAGE MODES', 'services/greenfield-api/migrations/041_greenfield_backend_v1_data_ledger.sql', [
  "'greenfield-records'",
  "'dedicated-postgres'",
  "'object-storage'",
  "'external-service'",
])
source('RUNTIME AND BACKUP ROLE GRANTS', 'services/greenfield-api/migrations/041_greenfield_backend_v1_data_ledger.sql', [
  'TO modula_api, modula_worker',
  'TO modula_backup',
])
source('REVERSIBLE MIGRATION', 'services/greenfield-api/migrations/041_greenfield_backend_v1_data_ledger.down.sql', [
  'DROP TABLE IF EXISTS greenfield_data_resources',
  "VALUES ('schema_version', '040')",
])
source('LEDGER SERVICE SECURITY', 'services/greenfield-api/src/data-ledger/service.ts', [
  'Storage locator must be an opaque approved binding reference',
  'Storage credential must use a secret handle',
  'Plaintext secret material is forbidden in the data ledger',
  "where('owner_account_id', '=', accountId)",
])
source('UNINSTALL TRUTH STATES', 'services/greenfield-worker/src/modules/uninstall-handler.ts', [
  "'EXPORT_PENDING'",
  "'DELETE_PENDING'",
  "'DELETED'",
  'legal_hold',
])
source('STANDARD 2 LEDGER PROJECTION', 'services/greenfield-worker/src/modules/standard2-runtime-registration.ts', [
  'reconcileDataLedgerStorage',
  'greenfield_data_resources',
  'standard-2-storage-allocation',
])
source('ACCOUNT ROUTES', 'services/greenfield-api/src/modules/routes/index.ts', [
  '/v1/modules/:moduleId/data-resources',
  '/v1/modules/:moduleId/data-resources/:resourceId/schemas',
  '/v1/modules/:moduleId/data-resources/:resourceId/migrations',
])
source('BEHAVIOURAL DB TEST', 'services/greenfield-api/tests/greenfield-backend-v1.data-ledger.test.ts', [
  'rejects scope forgery',
  'has_table_privilege',
  'DELETE_PENDING',
  'unsafe-secret',
])

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
record('DISPOSABLE DATABASE URL PROVIDED', Boolean(databaseUrl), databaseUrl ? 'configured' : 'MODULA_TEST_DATABASE_URL is required; no silent skip')
if (databaseUrl) {
  run('GREENFIELD PREREQUISITES', 'pnpm', ['--filter', '@modula/greenfield-api...', 'build'], {...process.env, CI: 'true'})
  run('DATA LEDGER DB BEHAVIOUR', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.data-ledger.test.ts'], {...process.env, CI: 'true'})
}
run('GIT DIFF CHECK', 'git', ['diff', '--check'])

console.log('\nRESULT')
if (failures.length) {
  console.log(`GREENFIELD BACKEND V1 DATA LEDGER FAIL (${failures.length})`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log('GREENFIELD BACKEND V1 DATA LEDGER PASS')
