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

includes('packages/greenfield-contracts/src/policy.ts', [
  'interface PolicyDecision',
  'PolicyEvaluationInput',
  'require-confirmation',
  'redact-fields',
  'exclude-private-content',
  'require-reauthentication',
  'require-admin-role',
  'require-module-enabled',
  'require-connection-healthy',
  'require-AI-consent',
  'RESOURCE_NOT_VISIBLE',
  'MODULE_NOT_ENABLED',
  'MODULE_PERMISSION_MISSING',
  'AI_CONTEXT_NOT_ALLOWED',
  'CONNECTION_NOT_HEALTHY',
  'REAUTHENTICATION_REQUIRED',
  'TRANSACTION_CONFIRMATION_REQUIRED',
], 'policy contract')

includes('services/greenfield-api/migrations/020_phase7e_policy_audit_notifications.sql', [
  'greenfield_policy_decision_audit',
  'actor_id TEXT REFERENCES actors',
  'account_id TEXT REFERENCES greenfield_accounts',
  'obligations JSONB',
  'risk_classification',
  'request_id TEXT',
  'correlation_id TEXT',
], 'policy decision audit migration')

includes('services/greenfield-api/src/domains/policy/engine.ts', [
  'class GreenfieldPolicyEngine',
  'evaluateAndAudit',
  'assertAllowed',
  'evaluateResourceVisibility',
  'evaluateModule',
  'evaluateConnection',
  'evaluateDimon',
  'evaluateAiContext',
  'greenfield_policy_decision_audit',
  'policy.decision.evaluated',
], 'central policy engine')

includes('services/greenfield-api/src/domains/posts/repository.ts', [
  'GreenfieldPolicyEngine',
  "action: 'post.read'",
  'evaluateAndAudit',
], 'post visibility policy integration')

includes('services/greenfield-api/src/domains/comments/service.ts', [
  'GreenfieldPolicyEngine',
  "action: 'comment.list'",
  "action: 'comment.create'",
  "action: 'comment.react'",
], 'comment access policy integration')

includes('services/greenfield-api/src/app/register-routes.ts', [
  '/v1/admin/ops/policy/evaluate',
  "requireCapability(request, reply, 'admin:ops')",
  'classifyUserAgent',
], 'operator policy route')

includes('services/greenfield-api/tests/phase7e.policy-audit-notifications.test.ts', [
  'returns stable policy denial codes',
  'AI_CONTEXT_NOT_ALLOWED',
  'CONNECTION_NOT_HEALTHY',
  'TRANSACTION_CONFIRMATION_REQUIRED',
  'greenfield_policy_decision_audit',
], 'policy verifier tests')

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) {
  fail('MODULA_TEST_DATABASE_URL or MODULA_DATABASE_URL is required for dynamic policy-engine proof')
} else {
  run(
    'pnpm',
    ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.policy-audit-notifications.test.ts'],
    'API policy/audit/notification tests',
    {...process.env, MODULA_TEST_DATABASE_URL: databaseUrl},
  )
}

if (failures.length > 0) {
  console.error(`\nPhase 7E policy engine verification failed (${failures.length} failure${failures.length === 1 ? '' : 's'}).`)
  process.exit(1)
}

console.log('\nPhase 7E policy engine verification passed.')
