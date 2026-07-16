#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {execSync} from 'node:child_process'

const root = process.cwd()
const startCommitPath = '/tmp/modula-phase5-start-commit.txt'
let failures = 0
function ok(msg) { console.log(`PASS ${msg}`) }
function fail(msg) { console.error(`FAIL ${msg}`); failures += 1 }
function exists(rel) { return fs.existsSync(path.join(root, rel)) }

if (!exists('pnpm-workspace.yaml')) fail('workspace missing')
else {
  const ws = fs.readFileSync('pnpm-workspace.yaml', 'utf8')
  if (!ws.includes('services/*') || !ws.includes('packages/*')) fail('workspace packages incomplete')
  else ok('workspace exists')
}
if (!exists('services/api')) fail('API service missing'); else ok('API service exists')
if (!exists('packages/api-contracts/src/envelopes.ts')) fail('api-contracts missing'); else ok('shared contracts exist')
if (!exists('packages/protocol-contracts/src/version.ts')) fail('protocol-contracts missing'); else ok('protocol contracts exist')

const apiPkg = fs.readFileSync('services/api/package.json', 'utf8')
if (!apiPkg.includes('fastify')) fail('Fastify missing'); else ok('Fastify used')
if (!apiPkg.includes('"pg"') && !apiPkg.includes('"pg":')) fail('PostgreSQL driver missing'); else ok('PostgreSQL used')
if (!exists('services/api/migrations/001_init_schema.sql')) fail('migrations missing'); else ok('migrations exist')

const compose = fs.readFileSync('ops/docker/compose.preview.yml', 'utf8')
if (compose.includes('0.0.0.0:5432') || compose.includes('"5432:5432"') || compose.includes('- 5432:')) fail('database port public')
else ok('database port not public')
if (!compose.includes('127.0.0.1:4020')) fail('API host bind not loopback'); else ok('API binds loopback')

const routes = fs.readFileSync('services/api/src/app/register-routes.ts', 'utf8')
for (const needle of ['/v1/health/live', '/v1/health/ready', '/v1/meta', '/v1/feed/home', '/v1/profiles/:handle', '/v1/discover']) {
  if (!routes.includes(needle)) fail(`route missing ${needle}`)
}
ok('health/meta/feed/profile/discover routes exist')

const plugins = fs.readFileSync('services/api/src/app/register-plugins.ts', 'utf8')
if (!plugins.includes('@fastify/cors') || !plugins.includes('allowedOrigins')) fail('CORS not explicit'); else ok('CORS explicit')
if (!plugins.includes('@fastify/helmet')) fail('Helmet missing'); else ok('Helmet exists')
if (!plugins.includes('@fastify/rate-limit')) fail('rate limits missing'); else ok('rate limits exist')

const logger = fs.readFileSync('services/api/src/observability/logger.ts', 'utf8')
if (!logger.includes('redact')) fail('log redaction missing'); else ok('logging redaction exists')

const migration = fs.readFileSync('services/api/migrations/001_init_schema.sql', 'utf8')
if (!migration.includes('audit_events')) fail('audit table missing'); else ok('audit table exists')
if (!migration.includes('outbox_events')) fail('outbox table missing'); else ok('outbox table exists')
if (!migration.includes('ENABLE ROW LEVEL SECURITY')) fail('RLS missing'); else ok('RLS exists')
if (!migration.includes('modula_api')) fail('runtime role grants missing'); else ok('runtime role present in migration')

const forbidden = ['jsonwebtoken', 'jose', 'bcrypt', 'argon2', 'ethers', 'web3', '@atproto']
for (const name of forbidden) {
  if (apiPkg.includes(name)) fail(`forbidden dependency ${name}`)
}
ok('no production auth/password/blockchain/atproto deps')

if (exists('services/api/src/security/crypto-custom.ts')) fail('custom crypto implementation present')
else ok('no custom encryption implementation')

if (fs.existsSync(startCommitPath)) {
  const start = fs.readFileSync(startCommitPath, 'utf8').trim()
  for (const dir of ['src', 'ios', 'android']) {
    const diff = execSync(`git diff --name-only ${start} -- ${dir}`, {encoding: 'utf8'}).trim()
    if (diff) fail(`${dir} modified since Phase 5 start:\n${diff}`)
    else ok(`${dir} unchanged since Phase 5 start`)
  }
} else {
  fail('Phase 5 start commit file missing; cannot verify frontend dirs')
}

for (const script of [
  'scripts/verify-phase1-shell.mjs',
  'scripts/verify-phase2-appearance.mjs',
  'scripts/verify-phase3-profile.mjs',
  'scripts/verify-phase4-data-auth.mjs',
]) {
  if (!exists(script)) fail(`previous verifier missing ${script}`)
}
ok('previous verifiers remain present')

if (!exists('packages/api-contracts/src/envelopes.ts') || !routes.includes('@modula/api-contracts')) {
  fail('response envelopes not shared')
} else ok('response envelopes shared')

if (!exists('services/api/src/transport/envelope.ts')) fail('request ids helper missing'); else ok('request IDs exist')

if (failures > 0) {
  console.error(`\nPhase 5 verifier failed with ${failures} issue(s)`)
  process.exit(1)
}
console.log('\nPhase 5 verifier passed')
