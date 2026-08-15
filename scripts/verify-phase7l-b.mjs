#!/usr/bin/env node
/**
 * Phase 7L-B aggregate verifier.
 * Source assertions always run. Database-backed gates fail closed when URLs are missing.
 */
import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const failures = []
const results = []

function rel(file) {
  return path.join(root, file)
}

function record(label, ok, detail = '') {
  results.push({label, ok, detail})
  console.log(`${label.padEnd(28)} ${ok ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(detail ? `${label}: ${detail}` : label)
}

function read(file) {
  const full = rel(file)
  if (!existsSync(full)) {
    record(file, false, 'missing')
    return ''
  }
  return readFileSync(full, 'utf8')
}

function assertContains(file, needle, label) {
  const text = read(file)
  record(label, text.includes(needle), text.includes(needle) ? '' : `missing ${needle}`)
}

function run(label, command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: false,
  })
  const ok = result.status === 0
  record(label, ok, ok ? '' : `exit ${result.status ?? 'null'}`)
  return ok
}

console.log('Phase 7L-B verifier\n')

assertContains(
  'src/auth/storage/WebPersistentSessionStorage.ts',
  'session',
  'SESSION SOURCE',
)
assertContains(
  'src/features/profile/screens/EditProfileScreen.tsx',
  'canonicalProfileMediaUri',
  'PROFILE EDIT SOURCE',
)
assertContains(
  'services/greenfield-api/src/domains/profiles/writes.ts',
  'normalizeMediaUri',
  'PROFILE WRITE SOURCE',
)
assertContains(
  'src/features/composer/screens/ComposerScreen.tsx',
  'GIF — Coming Soon',
  'COMPOSER GIF GATE',
)
assertContains(
  'src/features/composer/screens/ComposerScreen.tsx',
  'Poll — Coming Soon',
  'COMPOSER POLL GATE',
)
assertContains(
  'src/features/settings/screens/SettingsExtraScreens.tsx',
  'comingSoon: true',
  'SECURITY COMING SOON',
)
assertContains(
  'src/features/settings/screens/ModulaMailSettingsScreen.tsx',
  'mail provisioner is disabled',
  'MAIL COPY',
)
assertContains(
  'services/greenfield-api/src/sessions/service.ts',
  'sessionId: row.session_id',
  'SESSION LIST SERIALIZE',
)
assertContains(
  'docs/product/modula-beta-feature-manifest.md',
  'COMING_SOON',
  'BETA MANIFEST',
)

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) {
  record('DB TEST ENV', false, 'MODULA_TEST_DATABASE_URL is required')
} else {
  record('DB TEST ENV', true)
  run('AUTH REGRESSION', 'pnpm', ['verify:phase7l-b:auth'])
  run(
    'PROFILE UPDATE API',
    'pnpm',
    ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7l.profile-update.test.ts'],
    {
      ...process.env,
      CI: 'true',
      MODULA_TEST_DATABASE_URL: databaseUrl,
      MODULA_DATABASE_MIGRATOR_URL: process.env.MODULA_DATABASE_MIGRATOR_URL ?? databaseUrl,
    },
  )
}

if (existsSync(rel('docs/validation/phase7l-b-hydration-runtime.md'))) {
  record('HYDRATION NOTES', true)
}
if (existsSync(rel('docs/validation/phase7l-b-media-corp.md'))) {
  record('MEDIA NOTES', true)
}
if (existsSync(rel('docs/validation/phase7l-b-product-hub-canonicalization.md'))) {
  record('PRODUCT HUB NOTES', true)
}

const register = read('docs/validation/phase7l-b-defect-register.md')
if (register) {
  const openP0 = (register.match(/### P7LB-P0-[\d]+[\s\S]*?- Status: OPEN/g) ?? []).length
  const openP1 = (register.match(/### P7LB-P1-[\d]+[\s\S]*?- Status: OPEN/g) ?? []).length
  record('P0 OPEN COUNT', true, String(openP0))
  record('P1 OPEN COUNT', true, String(openP1))
}

console.log('\nRemaining live/manual gates must be recorded explicitly:')
console.log('IOS BUILD                 MANUAL')
console.log('SIMULATOR                 MANUAL')
console.log('PRODUCTION IDENTITY       OPEN until exact SHA deploy')

if (failures.length > 0) {
  console.error('\nPhase 7L-B verifier FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nPhase 7L-B source/local gates PASS')
process.exit(0)
