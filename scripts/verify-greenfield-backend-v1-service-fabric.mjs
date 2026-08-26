#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {join, resolve} from 'node:path'

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

function run(label, command, args, cwd = root, env = process.env) {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit'})
  record(label, result.status === 0, cwd)
}

console.log('MODULA')
console.log('GREENFIELD BACKEND V1')
console.log('SERVICE FABRIC VERIFIER\n')

source('CANONICAL ASSERTION CLAIMS', 'services/greenfield-api/src/modules/backend/token-service.ts', [
  'consumer:',
  'target:',
  'targetProductId:',
  'targetInstallationId:',
  'scope:',
  'jti:',
  'traceId:',
  'resolveServiceAssertion',
  'timingSafeEqual',
])
source('HASHED ASSERTION STORAGE', 'services/greenfield-api/src/modules/backend/token-service.ts', [
  'token_hash: sha256(token)',
  'raw_user_bearer_forwarded: false',
  "where('token_hash', '=', tokenHash)",
])
source('SERVER-OWNED SERVICE IDENTITY', 'services/greenfield-api/src/modules/backend/gateway-service.ts', [
  'backendServiceIdentity',
  'serviceInvocation',
], [
  'serviceId: input.extensionInvocation.serviceId',
])
source('REGISTERED TARGET POLICY', 'services/greenfield-api/src/modules/backend/network-policy.ts', [
  'assertSafeHttpsUrl',
  'allowedOrigins',
  'allowedHosts',
  'allowedPorts',
  'maxRedirects: 0',
  'Resolved module backend origin is not registered by the manifest',
])
source('ASSERTION-ONLY BACKEND API', 'services/greenfield-api/src/backend-fabric/routes.ts', [
  'x-modula-service-assertion',
  'Raw user bearer forwarding is forbidden',
  'resolveServiceAssertion',
  'Service assertion cannot access another account',
  'Service assertion cannot access another installation',
])
source('SCOPED SDK ROUTES', 'services/greenfield-api/src/backend-fabric/routes.ts', [
  '/identity/context',
  '/accounts/:accountId',
  '/installations/:installationId/capabilities',
  '/records/:collection',
  '/installations/:installationId/resources',
  '/resources/:resourceId/schemas',
  '/resources/:resourceId/migrations',
  '/secrets/lease',
])
source('MUTATION IDEMPOTENCY', 'services/greenfield-api/src/backend-fabric/routes.ts', [
  'executeIdempotent',
  "insertInto('idempotency_keys')",
  'Idempotency key was already used for another request',
  'Idempotent request is already in progress',
])
source('NETWORK POLICY BEHAVIOUR TEST', 'services/greenfield-api/tests/greenfield-backend-v1.network-policy.test.ts', [
  'rejects a caller-selected origin',
  'explicitly allowed custom port',
  'does not let registry strategies substitute another origin',
])
source('SERVICE ISOLATION DB TEST', 'services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts', [
  'rejects raw bearer forwarding',
  'crossAccount',
  'idempotency conflict detection',
  'zero raw user bearer forwarding',
  'single-use secret lease',
])

const sdkRoot = resolve(process.env.MODULA_BACKEND_SDK_ROOT ?? '/root/modula-platform/modula-backend-sdk')
const sdkPresent = existsSync(join(sdkRoot, '.git')) && existsSync(join(sdkRoot, 'packages/backend-sdk/src/index.ts'))
record('BACKEND SDK REPOSITORY', sdkPresent, sdkRoot)
if (sdkPresent) {
  const sdk = readFileSync(join(sdkRoot, 'packages/backend-sdk/src/index.ts'), 'utf8')
  record('SDK ASSERTION HEADER', sdk.includes('x-modula-service-assertion') && sdk.includes('raw user bearer forwarding is not supported'))
  record('SDK GREENFIELD ROUTE CONTRACT', sdk.includes('/v1/backend/products/') && sdk.includes('/identity/context') && sdk.includes('/records/'))
  run('BACKEND SDK VERIFY', 'pnpm', ['verify'], sdkRoot, {...process.env, CI: 'true'})
}

run('GREENFIELD PREREQUISITES', 'pnpm', ['--filter', '@modula/greenfield-api...', 'build'], root, {...process.env, CI: 'true'})
run('NETWORK TARGET POLICY', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.network-policy.test.ts'], root, {...process.env, CI: 'true'})

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
record('DISPOSABLE DATABASE URL PROVIDED', Boolean(databaseUrl), databaseUrl ? 'configured' : 'MODULA_TEST_DATABASE_URL is required; no silent skip')
if (databaseUrl) {
  run('SERVICE FABRIC DB BEHAVIOUR', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.service-fabric.test.ts'], root, {...process.env, CI: 'true'})
  run('EXTENSION FABRIC REGRESSION', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/pvp-platform-2.extension-fabric.test.ts'], root, {...process.env, CI: 'true'})
}
run('GIT DIFF CHECK', 'git', ['diff', '--check'])

console.log('\nRESULT')
if (failures.length) {
  console.log(`GREENFIELD BACKEND V1 SERVICE FABRIC FAIL (${failures.length})`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log('GREENFIELD BACKEND V1 SERVICE FABRIC PASS')
