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

includes('packages/api-contracts/src/notifications.ts', [
  'NotificationCategory',
  'NotificationChannel',
  'NotificationFrequency',
  'QuietHoursPreferences',
  'category?: NotificationCategory',
  'channels?: NotificationChannel[]',
  'dedupeKey?: string',
  'aggregateCount?: number',
], 'notification API contract')

includes('services/greenfield-api/migrations/020_phase7e_policy_audit_notifications.sql', [
  "category TEXT NOT NULL DEFAULT 'social'",
  'channels JSONB NOT NULL DEFAULT',
  'dedupe_key TEXT',
  'aggregate_count INTEGER NOT NULL DEFAULT 1',
  'notifications_recipient_dedupe_uidx',
  'quiet_hours JSONB',
  'channel_preferences JSONB',
  'category_preferences JSONB',
  'module_preferences JSONB',
  'connector_failure_enabled BOOLEAN',
  'ai_completion_enabled BOOLEAN',
  'automation_failure_enabled BOOLEAN',
  'dimon_transaction_confirmation_enabled BOOLEAN',
], 'notification migration')

includes('services/greenfield-api/src/domains/notifications/preferences.ts', [
  'normalizeQuietHours',
  'normalizeBooleanRecord',
  'normalizeModulePreferences',
  'channelPreferences',
  'categoryPreferences',
  'modulePreferences',
  'aiCompletionEnabled',
  'automationFailureEnabled',
  'dimonTransactionConfirmationEnabled',
], 'notification preferences service')

includes('services/greenfield-api/src/domains/notifications/repository.ts', [
  'category: row.category',
  'channels(row.channels)',
  'dedupeKey',
  'aggregateCount',
], 'notification repository projection')

includes('services/greenfield-worker/src/notifications/create.ts', [
  'NotificationCategory',
  'NotificationChannel',
  'dedupeKey',
  'aggregateBody',
  'enabledChannels',
  'categoryDisabled',
  'moduleDisabled',
  'aggregate_count',
], 'category-aware notification worker')

includes('services/greenfield-worker/src/notifications/social.ts', [
  'categoryDisabled',
  'aggregate_count',
  'dedupe_key',
  'social:reaction',
  'people reacted to your post',
], 'social notification aggregation')

includes('services/greenfield-api/tests/phase7e.policy-audit-notifications.test.ts', [
  'stores expanded notification channel',
  'quietHours',
  'categoryPreferences',
  'modulePreferences',
], 'notification API tests')

includes('services/greenfield-worker/tests/phase7e.notifications.test.ts', [
  'deduplicates and aggregates category-aware notification creates',
  'honours category-specific preferences',
  'uses the shared aggregate columns',
], 'notification worker tests')

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) {
  fail('MODULA_TEST_DATABASE_URL or MODULA_DATABASE_URL is required for dynamic notification-platform proof')
} else {
  const env = {...process.env, MODULA_TEST_DATABASE_URL: databaseUrl}
  run(
    'pnpm',
    ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.policy-audit-notifications.test.ts'],
    'API notification preference tests',
    env,
  )
  run(
    'pnpm',
    ['--filter', '@modula/greenfield-worker', 'exec', 'vitest', 'run', 'tests/phase7e.notifications.test.ts'],
    'worker notification delivery tests',
    env,
  )
}

if (failures.length > 0) {
  console.error(`\nPhase 7E notification verification failed (${failures.length} failure${failures.length === 1 ? '' : 's'}).`)
  process.exit(1)
}

console.log('\nPhase 7E notification verification passed.')
