#!/usr/bin/env node
// GF-OPS-01 tests for scripts/verify-compose-release-pins.mjs (node:test, no dependencies).
import assert from 'node:assert/strict'
import {readFileSync, readdirSync} from 'node:fs'
import test from 'node:test'
import {PRODUCTION_COMPOSE, checkComposeReleasePins, expansions, interpolate} from './verify-compose-release-pins.mjs'

const real = path => readFileSync(path, 'utf8')
const list = dir => readdirSync(dir)
function variant(mutations) {
  return {list, read: path => (mutations[path] ?? (value => value))(real(path))}
}
const STALE = '${SOURCE_EXPECTED_MIGRATION:-076_greenfield_premium_entitlements}'

test('interpolation emulator follows compose-spec operators', () => {
  assert.equal(interpolate('${A:-x}|${A-x}|${B:-x}|${B-x}|$${A}', {B: ''}), 'x|x|x||${A}')
  assert.equal(interpolate('${A:-${B}}', {B: 'b'}), 'b')
  assert.equal(interpolate('${A:+set}', {A: '1'}), 'set')
  assert.throws(() => interpolate('${A:?need A}', {A: ''}), /required variable A is missing a value: need A/)
  assert.throws(() => interpolate('${A?need A}', {}), /need A/)
  assert.equal(interpolate('${A?need A}', {A: ''}), '')
  assert.deepEqual(expansions('${X:-${Y:?m}}').map(item => [item.name, item.operator, item.nested]), [['X', ':-', false], ['Y', ':?', true]])
})

test('current repository passes', () => {
  const result = checkComposeReleasePins()
  assert.deepEqual(result.failures, [])
})

test('the pre-GF-OPS-01 stale 076 default fails', () => {
  const result = checkComposeReleasePins(variant({
    [PRODUCTION_COMPOSE]: text => text.replace(/\$\{SOURCE_EXPECTED_MIGRATION:\?[^}]*\}/g, STALE),
  }))
  assert.equal(result.ok, false)
  assert.ok(result.failures.some(f => f.includes(`hard-codes migration id default in ${STALE}`)), result.failures.join('\n'))
  assert.ok(result.failures.some(f => f.includes('must require SOURCE_EXPECTED_MIGRATION')), result.failures.join('\n'))
  assert.ok(result.failures.includes('production compose does not fail fast when SOURCE_EXPECTED_MIGRATION is unset'), result.failures.join('\n'))
})

test('an optional (unguarded) release SHA fails', () => {
  const result = checkComposeReleasePins(variant({
    [PRODUCTION_COMPOSE]: text => text.replace(/\$\{SOURCE_RELEASE_SHA:\?[^}]*\}/, '${SOURCE_RELEASE_SHA}'),
  }))
  assert.ok(result.failures.some(f => f.includes('must require SOURCE_RELEASE_SHA')), result.failures.join('\n'))
})

test('a migration id default in any ops/docker compose file fails', () => {
  const result = checkComposeReleasePins(variant({
    'ops/docker/compose.preview.yml': text => `${text}\nx-pin: \${MODULA_EXPECTED_MIGRATION:-090_calls_v1}\n`,
  }))
  assert.deepEqual(result.failures, ['ops/docker/compose.preview.yml hard-codes migration id default in ${MODULA_EXPECTED_MIGRATION:-090_calls_v1}'])
})

test('missing worker healthcheck or a published worker port fails', () => {
  const noHealth = checkComposeReleasePins(variant({
    [PRODUCTION_COMPOSE]: text => text.replace(/\n {4}healthcheck:\n {6}test: \['CMD', 'node', '\/opt\/modula\/healthcheck\/worker-heartbeat\.cjs'\]/, '\n    x-removed: true'),
  }))
  assert.ok(noHealth.failures.includes('greenfield-worker lacks the heartbeat healthcheck'), noHealth.failures.join('\n'))
  const ported = checkComposeReleasePins(variant({
    [PRODUCTION_COMPOSE]: text => text.replace("    extra_hosts:\n      - 'host.docker.internal:host-gateway'", "    ports:\n      - '127.0.0.1:4030:4030'\n    extra_hosts:\n      - 'host.docker.internal:host-gateway'"),
  }))
  assert.ok(ported.failures.includes('greenfield-worker must not publish ports'), ported.failures.join('\n'))
})

test('a literal schema pin in the canonical backend verifier fails', () => {
  const result = checkComposeReleasePins(variant({
    'scripts/verify-greenfield-backend-v1.mjs': text => text.replace(/schema === expectedSchema/, "schema === '055'"),
  }))
  assert.deepEqual(result.failures, ['scripts/verify-greenfield-backend-v1.mjs pins a literal schema version'])
})

// Forge review of #174 (b): without a fixed MODULA_WORKER_ID the worker uses worker-<pid>
// (services/greenfield-worker/src/config.ts:8) and the healthcheck cannot match its own row.
const HEALTHCHECK = 'ops/docker/greenfield-worker-heartbeat-healthcheck.cjs'
const WORKER_ID = /\n {6}MODULA_WORKER_ID: [^\n]*/

test('production worker id is fixed, release-scoped and required', () => {
  const rendered = interpolate(real(PRODUCTION_COMPOSE), {SOURCE_RELEASE_SHA: 'a'.repeat(40), SOURCE_BUILT_AT: 'x', SOURCE_EXPECTED_MIGRATION: '999_fixture_tip'})
  assert.match(rendered, new RegExp(`\\n {6}MODULA_WORKER_ID: greenfield-worker-${'a'.repeat(40)}\\n`))
})

test('a missing MODULA_WORKER_ID fails', () => {
  const result = checkComposeReleasePins(variant({[PRODUCTION_COMPOSE]: text => text.replace(WORKER_ID, '')}))
  assert.deepEqual(result.failures, ['greenfield-worker does not set a fixed MODULA_WORKER_ID (worker falls back to worker-<pid>)'])
})

test('an optional or defaulted MODULA_WORKER_ID fails', () => {
  for (const value of ['${MODULA_WORKER_ID:-greenfield-worker}', '${WORKER_NAME}', 'greenfield-worker-${SOURCE_RELEASE_SHA:-dev}', '${MODULA_WORKER_ID:?set it}']) {
    const result = checkComposeReleasePins(variant({[PRODUCTION_COMPOSE]: text => text.replace(WORKER_ID, `\n      MODULA_WORKER_ID: ${value}`)}))
    assert.equal(result.ok, false, value)
    assert.ok(result.failures.some(f => f.startsWith('greenfield-worker MODULA_WORKER_ID ')), `${value}\n${result.failures.join('\n')}`)
  }
})

test('a fixed literal MODULA_WORKER_ID is accepted; a pid-shaped or empty one is not', () => {
  const literal = checkComposeReleasePins(variant({[PRODUCTION_COMPOSE]: text => text.replace(WORKER_ID, '\n      MODULA_WORKER_ID: greenfield-worker-primary')}))
  assert.deepEqual(literal.failures, [])
  const pid = checkComposeReleasePins(variant({[PRODUCTION_COMPOSE]: text => text.replace(WORKER_ID, '\n      MODULA_WORKER_ID: worker-pid')}))
  assert.ok(pid.failures.includes('greenfield-worker MODULA_WORKER_ID must not depend on a process id or hostname'), pid.failures.join('\n'))
  const empty = checkComposeReleasePins(variant({[PRODUCTION_COMPOSE]: text => text.replace(WORKER_ID, "\n      MODULA_WORKER_ID: ''")}))
  assert.ok(empty.failures.some(f => f.startsWith('greenfield-worker MODULA_WORKER_ID renders to an unusable id')), empty.failures.join('\n'))
})

test('scaling the worker while its id is fixed fails', () => {
  const result = checkComposeReleasePins(variant({[PRODUCTION_COMPOSE]: text => text.replace(/(\n {4}image: modula-greenfield-worker:[^\n]*)/, '$1\n    scale: 2')}))
  assert.ok(result.failures.includes('greenfield-worker must stay single-instance while it uses a fixed MODULA_WORKER_ID'), result.failures.join('\n'))
})

test('a healthcheck that accepts any worker id or release fails', () => {
  const anyWorker = checkComposeReleasePins(variant({[HEALTHCHECK]: text => text.replace('AND worker_id = $2', 'AND ($2::text IS NULL OR worker_id = $2)')}))
  assert.deepEqual(anyWorker.failures, ['worker healthcheck must require an exact worker_id match'])
  const anyRelease = checkComposeReleasePins(variant({[HEALTHCHECK]: text => text.replace('WHERE release_sha = $1', 'WHERE ($1::text IS NULL OR release_sha = $1)')}))
  assert.deepEqual(anyRelease.failures, ['worker healthcheck must require an exact release_sha match'])
  const noRefusal = checkComposeReleasePins(variant({[HEALTHCHECK]: text => text.replace(/\n {2}if \(!workerId\) return done\(false,[^\n]*/, '')}))
  assert.deepEqual(noRefusal.failures, ['worker healthcheck must refuse when MODULA_WORKER_ID is unset'])
})
