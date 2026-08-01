#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const failures = []

function pass(message) {
  console.log(`PASS ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

function file(path) {
  const absolute = join(root, path)
  if (!existsSync(absolute)) {
    fail(`missing ${path}`)
    return ''
  }
  pass(`found ${path}`)
  return readFileSync(absolute, 'utf8')
}

function includes(path, markers, label = path) {
  const text = file(path)
  const missing = markers.filter(marker => !text.includes(marker))
  if (missing.length > 0) {
    for (const marker of missing) fail(`${label} missing ${marker}`)
  } else {
    pass(`${label} includes required markers`)
  }
  return text
}

function run(command, args, label, env = process.env) {
  const result = spawnSync(command, args, {cwd: root, env, stdio: 'inherit', shell: false})
  if (result.status === 0) pass(label)
  else fail(`${label} exited ${result.status ?? 'without status'}`)
}

includes('services/greenfield-api/migrations/020_phase7e_policy_audit_notifications.sql', [
  'audit_id TEXT',
  "result TEXT NOT NULL DEFAULT 'succeeded'",
  'request_id TEXT',
  'correlation_id TEXT',
  'ip_classification TEXT NOT NULL DEFAULT',
  'user_agent_classification TEXT NOT NULL DEFAULT',
  'metadata_schema_version INTEGER NOT NULL DEFAULT 1',
  'audit_events_audit_id_uidx',
], 'audit platform migration')

includes('services/greenfield-api/src/domains/audit/repository.ts', [
  'AuditRepository',
  'AuditAppendContext',
  'sanitizeAuditMetadata',
  'SECRET_KEY_PATTERN',
  'PRIVATE_CONTENT_KEY_PATTERN',
  '[redacted:secret]',
  '[redacted:private-content]',
  'metadata_schema_version: 1',
], 'append-only audit repository')

includes('services/greenfield-api/src/accounts/service.ts', [
  'new AuditRepository(trx).append',
  'account.registered',
  'email.verified',
  'handle.changed',
], 'account audit integration')

includes('services/greenfield-api/src/records/service.ts', [
  'new AuditRepository(trx).append',
  'greenfield.record.',
  'accountId: input.accountId',
], 'record audit integration')

includes('services/greenfield-api/src/domains/policy/engine.ts', [
  'policy.decision.evaluated',
  "result: decision.allowed ? 'succeeded' : 'denied'",
], 'policy audit integration')

includes('services/greenfield-api/tests/phase7e.policy-audit-notifications.test.ts', [
  'sanitises audit metadata',
  'accessToken',
  'noteContent',
  'ip_classification',
  'user_agent_classification',
], 'audit verifier tests')

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) {
  fail('MODULA_TEST_DATABASE_URL or MODULA_DATABASE_URL is required for dynamic audit-platform proof')
} else {
  run(
    'pnpm',
    ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.policy-audit-notifications.test.ts'],
    'API audit platform tests',
    {...process.env, MODULA_TEST_DATABASE_URL: databaseUrl},
  )
}

if (failures.length > 0) {
  console.error(`\nPhase 7E audit platform verification failed (${failures.length} failure${failures.length === 1 ? '' : 's'}).`)
  process.exit(1)
}

console.log('\nPhase 7E audit platform verification passed.')
