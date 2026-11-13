// Run: node --test tools/e2e/loopback-guard.test.mjs
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {
  assertLoopbackDatabaseUrls, assertLoopbackHttpUrls, databaseUrlProblem, isLoopbackDatabaseUrl, isLoopbackHttpUrl, pgConnectionStringParse,
} from './loopback-guard.mjs'

const PG = 'postgresql://postgres:postgres@127.0.0.1:55533/postgres'

test('accepts literal loopback API, socket and database URLs', () => {
  for (const url of ['http://127.0.0.1:4100', 'ws://127.0.0.1:4100/v1/messaging/socket', 'http://[::1]:4100/v1/health/live']) {
    assert.equal(isLoopbackHttpUrl(url), true, url)
  }
  for (const url of [PG, 'postgres://postgres:postgres@127.0.0.1:55533/gf_msg_01_abc123', 'postgresql://postgres:postgres@[::1]:55533/postgres']) {
    assert.equal(isLoopbackDatabaseUrl(url), true, url)
  }
})

test('refuses modula.digital hosts, including test.modula.*', () => {
  for (const url of ['https://modula.digital', 'http://api.modula.digital/v1', 'http://test.modula.digital', 'ws://test.modula.digital/v1/messaging/socket']) {
    assert.equal(isLoopbackHttpUrl(url), false, url)
  }
  for (const url of ['postgresql://u:p@db.modula.digital:5432/modula', 'postgresql://u:p@test.modula.digital:5432/modula']) {
    assert.equal(isLoopbackDatabaseUrl(url), false, url)
  }
})

test('refuses names that only resolve to loopback and lookalike hosts', () => {
  for (const url of ['http://localhost:4100', 'http://127.0.0.1.nip.io:4100', 'http://127.0.0.2:4100', 'http://0.0.0.0:4100', 'not a url', '']) {
    assert.equal(isLoopbackHttpUrl(url), false, url)
  }
  for (const url of ['postgresql://u:p@localhost:55533/postgres', 'postgresql://u:p@127.0.0.2:55533/postgres', 'postgresql://u:p@0.0.0.0:55533/postgres', 'postgresql://u:p@[::]:55533/postgres']) {
    assert.equal(isLoopbackDatabaseUrl(url), false, url)
  }
})

// SENTINEL #176 F1: pg lets the query string and percent-encoding override the authority.
test('F1: pg itself would redirect these, so the guard refuses them', () => {
  const parse = pgConnectionStringParse()
  assert.equal(parse(`${PG}?host=10.0.0.5`).host, '10.0.0.5', 'premise: pg honours ?host=')
  assert.equal(parse('postgresql://u:p@%2Fvar%2Frun%2Fpostgresql:55533/postgres').host, '/var/run/postgresql', 'premise: pg decodes the host')
  const cases = {
    'query host to a remote IP': `${PG}?host=10.0.0.5`,
    'query host to a DNS name': `${PG}?host=db.modula.digital`,
    'query host to a unix socket': `${PG}?host=/var/run/postgresql`,
    'query host percent-encoded socket': `${PG}?host=%2Fvar%2Frun%2Fpostgresql`,
    'query hostaddr': `${PG}?hostaddr=10.0.0.5`,
    'query port override': `${PG}?port=5432`,
    'query sslmode / cert files': `${PG}?sslmode=require&sslrootcert=/etc/passwd`,
    'query options': `${PG}?options=-c%20search_path%3Devil`,
    'empty query': `${PG}?`,
    'fragment': `${PG}#x`,
    'multi-host list': 'postgresql://u:p@127.0.0.1:55533,10.0.0.5:5432/postgres',
    'multi-host list (both loopback)': 'postgresql://u:p@127.0.0.1:55533,[::1]:55533/postgres',
    'percent-encoded loopback host': 'postgresql://u:p@%31%32%37.0.0.1:55533/postgres',
    'percent-encoded unix socket host': 'postgresql://u:p@%2Fvar%2Frun%2Fpostgresql:55533/postgres',
    'empty host with query host': 'postgresql:///postgres?host=127.0.0.1',
    'non-postgres scheme (http)': 'http://u:p@127.0.0.1:55533/postgres',
    'non-postgres scheme (socket:)': 'socket:/var/run/postgresql?db=postgres',
    'non-postgres scheme (file:)': 'file:///var/run/postgresql',
    'userinfo trick: @ in user part': 'postgresql://u:p@127.0.0.1@evil.com:55533/postgres',
    'userinfo trick: host as password': 'postgresql://u:127.0.0.1@evil.com:55533/postgres',
    'userinfo trick: [::1]@': 'postgresql://[::1]@evil.com:55533/postgres',
    'missing port': 'postgresql://u:p@127.0.0.1/postgres',
    'quote in database name': 'postgresql://u:p@127.0.0.1:55533/a%22b',
  }
  for (const [label, url] of Object.entries(cases)) {
    assert.equal(isLoopbackDatabaseUrl(url), false, `${label}: ${url}`)
    assert.ok(databaseUrlProblem(url), label)
  }
})

test('F1: API URLs refuse query strings, credentials and other schemes', () => {
  for (const url of [
    'http://127.0.0.1:4100/?host=10.0.0.5', 'http://127.0.0.1:4100/#x', 'http://u:p@127.0.0.1:4100', 'http://127.0.0.1@evil.com/',
    'http://[::1]@evil.com/', 'https://127.0.0.1:4100', 'wss://127.0.0.1:4100', 'file:///etc/passwd', 'postgresql://u:p@127.0.0.1:1/db',
  ]) assert.equal(isLoopbackHttpUrl(url), false, url)
})

test('assert helpers name the offending setting and hide credentials', () => {
  assert.throws(
    () => assertLoopbackDatabaseUrls({MODULA_E2E_ADMIN_DATABASE_URL: 'postgresql://admin:hunter2@db.modula.digital:5432/postgres'}),
    error => error.message.includes('MODULA_E2E_ADMIN_DATABASE_URL') && error.message.includes('db.modula.digital') && !error.message.includes('hunter2'),
  )
  assert.throws(
    () => assertLoopbackDatabaseUrls({MODULA_E2E_ADMIN_DATABASE_URL: 'postgresql://admin:hunter2@127.0.0.1:55533/postgres?host=10.0.0.5'}),
    error => /query string not allowed/.test(error.message) && !error.message.includes('hunter2'),
  )
  assert.throws(() => assertLoopbackDatabaseUrls({X: undefined}), /X is required/)
  assert.throws(() => assertLoopbackHttpUrls({Y: ''}), /Y is required/)
  assert.doesNotThrow(() => assertLoopbackHttpUrls({A: 'http://127.0.0.1:1'}))
  assert.doesNotThrow(() => assertLoopbackDatabaseUrls({B: 'postgresql://p:p@127.0.0.1:2/d'}))
})
