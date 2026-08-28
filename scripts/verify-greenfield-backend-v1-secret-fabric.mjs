#!/usr/bin/env node
import {existsSync, readFileSync, statSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {join, resolve} from 'node:path'
import {createGreenfieldVerifierDatabaseFixture} from './greenfield-backend-v1-database-fixture.mjs'

const root = process.cwd()
const failures = []
const serviceRoot = resolve(process.env.MODULA_SECRETS_SERVICE_ROOT ?? '/root/modula-platform/modula-secrets-service')
const manifestRoot = resolve(process.env.MODULA_SECRET_MANIFESTS_ROOT ?? '/root/modula-secure/modula-secret-manifests')

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(48)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}${detail ? `: ${detail}` : ''}`)
}

function source(label, file, required, forbidden = []) {
  const content = existsSync(file) ? readFileSync(file, 'utf8') : ''
  record(label, Boolean(content) && required.every(value => content.includes(value)) && forbidden.every(value => !content.includes(value)), file)
}

function run(label, command, args, cwd = root, env = process.env) {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit'})
  record(label, result.status === 0, cwd)
}

console.log('MODULA')
console.log('GREENFIELD BACKEND V1')
console.log('SECRET FABRIC VERIFIER\n')

source('GREENFIELD BROKER CONFIG POLICY', join(root, 'services/greenfield-api/src/config/env.ts'), [
  'MODULA_SECRETS_SERVICE_URL',
  'approved private service identity',
  "target.hostname === 'modula-secrets-service'",
])
source('GREENFIELD VALUE-FREE LEASE CLIENT', join(root, 'services/greenfield-api/src/secrets/client.ts'), [
  'x-modula-service-assertion',
  "redirect: 'error'",
  'AbortSignal.timeout',
  '/v1/secrets/lease',
], [
  "'authorization'",
  'Bearer ',
])
source('GREENFIELD SECRET SDK BOUNDARY', join(root, 'services/greenfield-api/src/backend-fabric/routes.ts'), [
  '/v1/backend/products/:productId/secrets/lease',
  "requireAssertionOperation(assertion, 'secrets.use')",
  'secretReference(body.reference)',
  'serviceAssertion: rawAssertion',
])
source('GREENFIELD SECRET BEHAVIOUR TEST', join(root, 'services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts'), [
  'single-use secret lease',
  "not.toHaveProperty('value')",
  "expect(brokerAssertion).toBe(brokerHeaders['x-modula-service-assertion'])",
])

record('SECRETS SERVICE REPOSITORY', existsSync(join(serviceRoot, '.git')), serviceRoot)
if (existsSync(join(serviceRoot, '.git'))) {
  source('BROKER ASSERTION AND RAW-BEARER GUARDS', join(serviceRoot, 'src/http.ts'), [
    'x-modula-service-assertion',
    'Authorization bearer forwarding is not supported',
    'secrets.use.direct',
  ])
  source('BROKER ENCRYPTED SNAPSHOT', join(serviceRoot, 'src/snapshot-crypto.ts'), [
    'aes-256-gcm',
    'setAAD',
    'getAuthTag',
  ])
  source('BROKER ATOMIC RECONCILIATION', join(serviceRoot, 'src/reconcile.ts'), [
    'verify-commit',
    'Manifest checkout does not match the expected commit',
    'Manifest checkout is not clean',
    'store.activate',
  ])
  run('SECRETS SERVICE VERIFY', 'pnpm', ['verify'], serviceRoot, {...process.env, CI: 'true'})
  run('SECRETS SERVICE MAIN CONVERGENCE', 'sh', ['-ceu', 'test "$(git branch --show-current)" = main; test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"; test -z "$(git status --porcelain)"'], serviceRoot)
}

record('ENCRYPTED MANIFEST REPOSITORY', existsSync(join(manifestRoot, '.git')), manifestRoot)
if (existsSync(join(manifestRoot, '.git'))) {
  run('ENCRYPTED-ONLY MANIFEST POLICY', './scripts/verify-encrypted-only.sh', [], manifestRoot)
  run('SIGNED MANIFEST HEAD', 'git', ['verify-commit', 'HEAD'], manifestRoot)
  run('MANIFEST MAIN CONVERGENCE', 'sh', ['-ceu', 'test "$(git branch --show-current)" = main; test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"; test -z "$(git status --porcelain)"'], manifestRoot)
}

for (const keyFile of ['/root/modula-secrets/age/greenfield-secrets.agekey', '/root/modula-secrets/broker/state.key', '/root/modula-secrets/broker/service-assertion.key']) {
  const safe = existsSync(keyFile) && (statSync(keyFile).mode & 0o777) === 0o600 && statSync(keyFile).uid === 0
  record(`ROOT-ONLY KEY ${keyFile.split('/').at(-1)}`, safe, safe ? '0600 root' : keyFile)
}

const runtimeSnapshot = '/var/lib/modula-secrets/active.enc.json'
const snapshot = existsSync(runtimeSnapshot) ? readFileSync(runtimeSnapshot, 'utf8') : ''
record('ENCRYPTED RUNTIME SNAPSHOT', Boolean(snapshot) && snapshot.includes('aes-256-gcm') && !/schemaVersion|secrets:|provider.*value/i.test(snapshot), runtimeSnapshot)

const fixture = createGreenfieldVerifierDatabaseFixture('secret_fabric')
record('DISPOSABLE DATABASE AVAILABLE', Boolean(fixture), fixture?.databaseName ?? 'configure MODULA_TEST_DATABASE_URL or run preview Postgres')
if (fixture) {
  try {
    const testEnvironment = {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl}
    run('GREENFIELD SECRET LEASE BEHAVIOUR', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.service-fabric.test.ts'], root, testEnvironment)
  } finally {
    fixture.cleanup()
    record('DISPOSABLE DATABASE REMOVED', true, fixture.databaseName)
  }
}
run('GREENFIELD TYPECHECK', 'pnpm', ['typecheck'], root, {...process.env, CI: 'true'})
run('GIT DIFF CHECK', 'git', ['diff', '--check'])

console.log('\nRESULT')
if (failures.length) {
  console.log(`GREENFIELD BACKEND V1 SECRET FABRIC FAIL (${failures.length})`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log('GREENFIELD BACKEND V1 SECRET FABRIC PASS')
