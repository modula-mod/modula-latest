// Run: node --test tools/e2e/loopback-guard.test.mjs
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {assertLoopbackUrls, isLoopbackUrl} from './loopback-guard.mjs'

test('accepts literal loopback API, socket and database URLs', () => {
  for (const url of [
    'http://127.0.0.1:4100',
    'ws://127.0.0.1:4100/v1/messaging/socket',
    'http://[::1]:4100/v1/health/live',
    'postgresql://postgres:postgres@127.0.0.1:55533/postgres',
  ]) assert.equal(isLoopbackUrl(url), true, url)
})

test('refuses modula.digital hosts, including test.modula.*', () => {
  for (const url of [
    'https://modula.digital',
    'https://api.modula.digital/v1',
    'https://test.modula.digital',
    'wss://test.modula.digital/v1/messaging/socket',
    'postgresql://u:p@db.modula.digital:5432/modula',
  ]) assert.equal(isLoopbackUrl(url), false, url)
})

test('refuses names that only resolve to loopback and lookalike hosts', () => {
  for (const url of [
    'http://localhost:4100',
    'http://127.0.0.1.nip.io:4100',
    'http://127.0.0.2:4100',
    'http://0.0.0.0:4100',
    'http://user:pass@127.0.0.1:4100',
    'not a url',
    '',
  ]) assert.equal(isLoopbackUrl(url), false, url)
})

test('assertLoopbackUrls names the offending setting and hides credentials', () => {
  assert.throws(
    () => assertLoopbackUrls({MODULA_E2E_ADMIN_DATABASE_URL: 'postgresql://admin:hunter2@db.modula.digital/postgres'}),
    error => error.message.includes('MODULA_E2E_ADMIN_DATABASE_URL') && error.message.includes('db.modula.digital') && !error.message.includes('hunter2'),
  )
  assert.throws(() => assertLoopbackUrls({X: undefined}), /X is required/)
  assert.doesNotThrow(() => assertLoopbackUrls({A: 'http://127.0.0.1:1', B: 'postgresql://p:p@127.0.0.1:2/d'}))
})
