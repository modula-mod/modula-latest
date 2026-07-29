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
  if (result.status === 0) {
    pass(label)
  } else {
    fail(`${label} exited ${result.status ?? 'without status'}`)
  }
}

includes('packages/greenfield-contracts/src/event.ts', [
  'interface GreenfieldDomainEvent',
  'EventDataClassification',
  "'public' | 'internal' | 'private' | 'sensitive' | 'restricted'",
  'requestId: string',
  'correlationId: string',
  'visibility: EventVisibility',
  'metadata: Record<string, unknown>',
], 'canonical event envelope')

const registry = includes('packages/greenfield-schema-registry/src/events.ts', [
  'owner',
  'jsonSchema',
  'compatibilityPolicy',
  'retentionPolicy',
  'dataClassification',
  'permittedSubscribers',
  'replayPolicy',
], 'event schema registry metadata')

const requiredEvents = [
  'account.created',
  'account.updated',
  'account.deactivated',
  'account.deletion-requested',
  'profile.updated',
  'profile.visibility-changed',
  'session.created',
  'session.revoked',
  'post.created',
  'post.updated',
  'post.deleted',
  'post.visibility-changed',
  'post.saved',
  'post.unsaved',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  'reaction.created',
  'reaction.removed',
  'follow.created',
  'follow.removed',
  'module.discovered',
  'module.install-requested',
  'module.installed',
  'module.enabled',
  'module.disabled',
  'module.update-available',
  'module.update-started',
  'module.updated',
  'module.update-failed',
  'module.quarantined',
  'module.uninstalled',
  'module.health-changed',
  'note.created',
  'note.updated',
  'note.archived',
  'note.deleted',
  'note.restored',
  'note.linked',
  'note.exported',
  'note.ai-processed',
  'ai.requested',
  'ai.started',
  'ai.completed',
  'ai.failed',
  'ai.cancelled',
  'ai.tool-requested',
  'ai.tool-confirmed',
  'ai.tool-completed',
  'ai.memory-created',
  'ai.memory-deleted',
  'connection.created',
  'connection.authorised',
  'connection.degraded',
  'connection.refreshed',
  'connection.revoked',
  'connection.disconnected',
  'connector.sync-started',
  'connector.sync-completed',
  'connector.sync-failed',
  'connector.webhook-received',
  'automation.created',
  'automation.enabled',
  'automation.triggered',
  'automation.execution-started',
  'automation.execution-completed',
  'automation.execution-failed',
  'automation.disabled',
  'dimon.transaction-prepared',
  'dimon.transaction-submitted',
  'dimon.transaction-rejected',
  'dimon.transaction-confirmed',
  'dimon.block-created',
  'dimon.validator-health-changed',
  'dimon.anchor-created',
]

for (const eventType of requiredEvents) {
  if (!registry.includes(`'${eventType}'`)) fail(`event registry missing ${eventType}`)
}
if (requiredEvents.every(eventType => registry.includes(`'${eventType}'`))) pass('event registry covers required Phase 7E event families')

includes('services/greenfield-api/migrations/019_phase7e_event_platform.sql', [
  'greenfield_event_schema_registry',
  'greenfield_event_inbox',
  'greenfield_event_replay_requests',
  "'pending','leased','processing','completed','retrying','dead_lettered','cancelled'",
  'permitted_classifications',
  'subscriber_timeout_ms',
], 'event platform migration')

includes('services/greenfield-api/src/events/domain-events.ts', [
  'toGreenfieldDomainEventEnvelope',
  'getEventSchema',
  'classification',
  'canRouteEvent',
  'onConflict(conflict => conflict.columns([\'event_id\', \'subscriber_id\']).doNothing())',
], 'domain event repository')

includes('services/greenfield-worker/src/events/claim.ts', [
  'FOR UPDATE SKIP LOCKED',
  "status = 'leased'",
  "status = 'retrying'",
  "status: 'dead_lettered'",
  'reapExpiredEventDeliveryLeases',
], 'event worker leasing')

includes('services/greenfield-worker/src/events/runner.ts', [
  'startInboxProcessing',
  'already-completed',
  'withTimeout',
  'computeNextAvailableAt',
  'sanitizeFailureMessage',
  'deadLetterEventDelivery',
], 'event worker delivery')

includes('services/greenfield-api/src/events/replay.ts', [
  'dryRun',
  'retryDeadLetters',
  'inspectSubscriberFailures',
  'cancelReplay',
  'canRouteEvent',
], 'operator replay service')

includes('services/greenfield-api/src/app/register-routes.ts', [
  '/v1/admin/ops/events/subscriber-failures',
  '/v1/admin/ops/events/replay',
  '/v1/admin/ops/events/dead-letters/retry',
  '/v1/admin/ops/events/replay/:replayId/cancel',
  "requireCapability(request, reply, 'admin:ops')",
], 'operator event routes')

includes('services/greenfield-api/tests/phase7e.internal-events.test.ts', [
  'rolls back a business write when the domain event insert fails in the same transaction',
  'records post.created from the real post write path without storing post text in the event',
  'plans and queues replay without bypassing subscriber classification permissions',
], 'API event tests')

includes('services/greenfield-worker/tests/phase7e.event-delivery.test.ts', [
  'effectCount).toBe(1)',
  "'retrying'",
  "'dead_lettered'",
  'reapExpiredEventDeliveryLeases',
  'access_token=secret',
], 'worker event tests')

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) {
  fail('MODULA_TEST_DATABASE_URL or MODULA_DATABASE_URL is required for dynamic event-platform proof')
} else {
  const env = {...process.env, MODULA_TEST_DATABASE_URL: databaseUrl}
  run('pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.internal-events.test.ts'], 'API event platform tests', env)
  run('pnpm', ['--filter', '@modula/greenfield-worker', 'exec', 'vitest', 'run', 'tests/phase7e.event-delivery.test.ts'], 'worker event delivery tests', env)
}

if (failures.length > 0) {
  console.error(`Phase 7E event platform verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log('Phase 7E event platform verifier passed')
