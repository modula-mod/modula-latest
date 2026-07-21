#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {execSync} from 'node:child_process'

const root = process.cwd()
let failures = 0
function ok(msg) { console.log(`PASS ${msg}`) }
function fail(msg) { console.error(`FAIL ${msg}`); failures += 1 }
function exists(rel) { return fs.existsSync(path.join(root, rel)) }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8') }

if (!exists('services/greenfield-api/migrations/002_phase6_social_atproto.sql')) fail('migration 002 missing')
else {
  const mig = read('services/greenfield-api/migrations/002_phase6_social_atproto.sql')
  for (const table of [
    'sessions', 'session_capabilities', 'notifications', 'blocks', 'mutes', 'reports',
    'background_jobs', 'job_failures', 'atproto_connections', 'atproto_oauth_states',
    'atproto_oauth_sessions', 'atproto_publications', 'atproto_records', 'atproto_sync_checkpoints',
    'atproto_dead_letters',
  ]) {
    if (!mig.includes(`CREATE TABLE ${table}`) && !mig.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
      fail(`table ${table} missing from migration`)
    }
  }
  if (!mig.includes('lease_owner') || !mig.includes('lease_expires_at')) fail('job lease fields missing')
  else ok('migration 002 tables and lease fields present')
}

if (!exists('services/greenfield-api/migrations/003_phase6_api_rls_writes.sql')) fail('migration 003 missing')
else {
  const mig3 = read('services/greenfield-api/migrations/003_phase6_api_rls_writes.sql')
  if (!mig3.includes('posts_api_all') || !mig3.includes('TO modula_api')) {
    fail('migration 003 must add API write policies for FORCE RLS tables')
  } else ok('migration 003 API RLS write policies present')
}

if (!exists('services/greenfield-worker') || !exists('services/greenfield-worker/package.json')) fail('services/greenfield-worker package missing')
else if (!exists('services/greenfield-worker/src/main.ts')) fail('worker service entrypoint missing')
else ok('worker service exists')

if (!exists('packages/atproto-lexicons') || !exists('packages/atproto-lexicons/package.json')) fail('packages/atproto-lexicons package missing')
else ok('atproto-lexicons package exists')

for (const lex of [
  'packages/atproto-lexicons/lexicons/digital/modula/temp/profileExtension.json',
  'packages/atproto-lexicons/lexicons/digital/modula/temp/moduleManifest.json',
  'packages/atproto-lexicons/lexicons/digital/modula/temp/publication.json',
]) {
  if (!exists(lex)) fail(`lexicon missing ${lex}`)
}
ok('experimental lexicons exist')

const apiPkg = read('services/greenfield-api/package.json')
if (!apiPkg.includes('@atproto/oauth-client-node')) fail('official OAuth client missing')
else ok('official @atproto/oauth-client-node present')
if (apiPkg.includes('app-password') || apiPkg.toLowerCase().includes('apppassword')) fail('app-password dependency present')
else ok('no app-password auth dependency')

// No hand-rolled OAuth implementation: the API must delegate PKCE/DPoP/token exchange to
// @atproto/oauth-client-node rather than reinventing it.
const oauthSourceFiles = exists('services/greenfield-api/src/atproto')
  ? execSync("grep -rl . --include='*.ts' services/greenfield-api/src/atproto || true", {encoding: 'utf8', cwd: root}).split('\n').filter(Boolean)
  : []
const customOauthMarkers = ['generateCodeVerifier', 'createDpopProof', 'signJwt(', 'jose.SignJWT']
let customOauthFound = false
for (const file of oauthSourceFiles) {
  const contents = read(file)
  for (const marker of customOauthMarkers) {
    if (contents.includes(marker)) {
      fail(`custom OAuth implementation marker "${marker}" found in ${file}`)
      customOauthFound = true
    }
  }
}
if (!customOauthFound) ok('no custom OAuth (PKCE/DPoP/JWT signing) implementation markers')

const routes = read('services/greenfield-api/src/app/register-routes.ts')
for (const needle of [
  "app.post('/v1/posts'",
  "app.patch('/v1/posts/:postId'",
  "app.delete('/v1/posts/:postId'",
  '/v1/atproto/oauth/start',
  '/v1/atproto/feed',
  '/v1/notifications',
  '/v1/search',
  '/v1/reports',
]) {
  if (!routes.includes(needle)) fail(`route missing ${needle}`)
}
ok('authenticated social and AT routes registered')

if (!exists('services/greenfield-api/src/security/ssrf.ts')) fail('API SSRF protections missing'); else ok('API SSRF protections exist')
if (
  !exists('services/greenfield-worker/src/bridges/atproto/ssrf-guard.ts') &&
  !exists('services/greenfield-worker/src/atproto/ssrf-guard.ts')
) {
  fail('worker SSRF protections missing')
} else ok('worker SSRF protections exist')
const crypto = read('services/greenfield-api/src/security/crypto.ts')
if (!crypto.includes('createCipheriv') || !crypto.includes('aes-256-gcm')) fail('AES-GCM encryption missing')
else ok('AES-256-GCM encryption used')
if (exists('services/greenfield-api/src/security/crypto-custom.ts')) fail('custom crypto implementation present')
else ok('no proprietary crypto module')

const workerMain = read('services/greenfield-worker/src/main.ts')
if (workerMain.includes('fastify') || workerMain.includes('listen(')) fail('worker appears to serve HTTP')
else ok('worker is separate from API HTTP process')

if (!exists('scripts/verify-phase6-frontend-boundary.mjs')) fail('frontend boundary verifier missing')
else ok('frontend boundary verifier present')

for (const script of [
  'scripts/verify-phase1-shell.mjs',
  'scripts/verify-phase2-appearance.mjs',
  'scripts/verify-phase3-profile.mjs',
  'scripts/verify-phase4-data-auth.mjs',
  'scripts/verify-phase5-backend.mjs',
]) {
  if (!exists(script)) fail(`previous verifier missing ${script}`)
}
ok('previous verifiers remain')

if (exists('ops/atproto/tap/README.md')) ok('Tap prep present')
else fail('Tap prep missing')
if (exists('ops/atproto/pds/README.md')) ok('PDS prep present')
else fail('PDS prep missing')
if (exists('docs/audits/phase6-pds-gonogo.md')) {
  const gonogo = read('docs/audits/phase6-pds-gonogo.md')
  if (!gonogo.includes('DEFERRED') && !gonogo.includes('GO')) fail('PDS go/no-go verdict missing')
  else ok('PDS go/no-go documented')
} else fail('PDS go/no-go audit missing')

// After PR #5 merge, Phase 6 frontend trees are expected on this branch.
// Keep the pre-merge boundary via verify-phase6-frontend-boundary.mjs + start commit.
const phase6FrontendPresent =
  exists('src/features/atproto') && exists('scripts/verify-phase6-atproto-frontend.mjs')
if (phase6FrontendPresent) {
  ok('Phase 6 frontend tree present — integrated branch allows src/ios/android/assets vs main')
} else {
  const forbiddenFrontend = execSync('git diff --name-only main -- src ios android assets', {
    encoding: 'utf8',
  }).trim()
  if (forbiddenFrontend) fail(`frontend trees modified:\n${forbiddenFrontend}`)
  else ok('no VPS frontend tree modifications vs main')
}

if (failures > 0) {
  console.error(`\nPhase 6 backend verifier failed with ${failures} issue(s)`)
  process.exit(1)
}
console.log('\nPhase 6 backend verifier passed')
