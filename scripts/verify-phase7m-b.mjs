#!/usr/bin/env node
/**
 * Phase 7M-B aggregate verifier.
 *
 * Source/structure assertions and the dynamic-route regression gate always run.
 * Database-backed module-platform gates run when a Postgres URL is provided and
 * fail closed (reported, not silently skipped) when the env is absent.
 *
 * Covers:
 *  - Track A visual system: canonical ModulaIcon registry, consolidated field /
 *    menu controls, semantic typography aliases, expanded motion tokens.
 *  - Track B module platform: generic Module Host (no Vault Notes branching),
 *    real install / enable / disable / uninstall(keepData) / reinstall lifecycle,
 *    Vault Notes CRUD + search + Product Hub canonicalisation policy.
 *  - Dynamic route regression gate: direct HTTP load of Expo Router dynamic
 *    routes (notably /module/[moduleId] and /module/[moduleId]/[...path]).
 */
import {existsSync, readFileSync, statSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

const root = process.cwd()
const failures = []

function rel(file) {
  return path.join(root, file)
}

function record(label, ok, detail = '') {
  console.log(`${label.padEnd(34)} ${ok ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
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

function assertExists(file, label) {
  record(label, existsSync(rel(file)), existsSync(rel(file)) ? '' : `missing ${file}`)
}

function assertContains(file, needle, label) {
  const text = read(file)
  const ok = text.includes(needle)
  record(label, ok, ok ? '' : `missing "${needle}"`)
}

function assertAbsent(file, needle, label) {
  const text = read(file)
  const ok = !text.includes(needle)
  record(label, ok, ok ? '' : `unexpected "${needle}"`)
}

function run(label, command, args, env = process.env) {
  const result = spawnSync(command, args, {cwd: root, env, stdio: 'inherit', shell: false})
  const ok = result.status === 0
  record(label, ok, ok ? '' : `exit ${result.status ?? 'null'}`)
  return ok
}

console.log('Phase 7M-B verifier\n')
console.log('# Track A — Modula visual system')

assertExists('src/platform/ui/icons/modula-icon-registry.ts', 'ICON REGISTRY')
assertContains('src/platform/ui/icons/modula-icon-registry.ts', 'MODULA_ICONS', 'ICON REGISTRY EXPORT')
assertExists('src/platform/ui/icons/modula-icon-svg.tsx', 'ICON SVG RENDERER')
assertExists('src/platform/ui/icons/modula-icon.native.tsx', 'ICON NATIVE ADAPTER')
assertContains('src/platform/ui/index.ts', "@/platform/ui/icons", 'ICON BARREL WIRED')

assertExists('src/platform/ui/controls/modula-field-shell.tsx', 'FIELD SHELL')
assertExists('src/platform/ui/controls/modula-otp-field.tsx', 'OTP FIELD')
assertExists('src/platform/ui/controls/modula-search-field.tsx', 'SEARCH FIELD')
assertExists('src/platform/ui/controls/modula-secure-field.tsx', 'SECURE FIELD')
assertExists('src/platform/ui/menus/modula-popover.tsx', 'POPOVER')
assertContains('src/platform/ui/index.ts', 'ModulaFieldShell', 'FIELD SHELL BARREL')
assertContains('src/platform/ui/index.ts', 'ModulaOTPField', 'OTP FIELD BARREL')
assertContains('src/platform/ui/index.ts', 'ModulaSearchField', 'SEARCH FIELD BARREL')
assertContains('src/platform/ui/menus/index.ts', 'ModulaPopover', 'POPOVER BARREL')

assertContains('src/theme/contracts/typography.ts', 'TYPOGRAPHY_SEMANTIC_ALIASES', 'TYPOGRAPHY ALIASES')
assertContains('src/theme/contracts/materials.ts', 'spatial', 'MOTION SPATIAL SPRING')
assertContains('src/theme/data/defaults.ts', 'REDUCED_MOTION_TOKENS', 'REDUCED MOTION TOKENS')

assertExists('docs/research/phase7m-b-ui-dispositions.md', 'DISPOSITION INVENTORY')

console.log('\n# Track B — Real module platform (Vault Notes)')

assertExists('docs/research/phase7m-b-vault-notes-provenance.md', 'VAULT PROVENANCE DOC')
// Generic host: no Vault Notes branching in host runtime.
assertAbsent('src/features/modules/runtime/module-host.tsx', 'vault-notes', 'HOST NOT VAULT-HARDCODED')
assertAbsent(
  'src/features/modules/runtime/module-route-resolver.ts',
  'vault-notes',
  'RESOLVER NOT VAULT-HARDCODED',
)
// Client must not hardcode the canonical module id (Phase 7E invariant).
assertAbsent(
  'src/data/repositories/api/ApiModuleRepository.ts',
  "'digital.modula.vault-notes'",
  'CLIENT NOT HARDCODED ID',
)

console.log('\n# Dynamic route regression gate')

run('WEB DIST ROUTE RESOLVER', 'node', ['scripts/resolve-web-dist-file.mjs'])

const distDir = rel('dist')
const distReady = existsSync(distDir) && existsSync(path.join(distDir, 'index.html'))
if (!distReady) {
  record('WEB DIST PRESENT', false, 'run `pnpm build:web` to exercise real direct-load routes')
} else {
  record('WEB DIST PRESENT', true)
  const resolver = await import(pathToFileURL(rel('scripts/resolve-web-dist-file.mjs')).href)
  const directLoads = [
    ['/module/digital.modula.vault-notes', 'module/[moduleId].html'],
    ['/module/digital.modula.vault-notes/note/abc', 'module/[moduleId]/[...path].html'],
    ['/product', null],
    ['/', 'index.html'],
  ]
  for (const [requestUrl, expected] of directLoads) {
    const resolved = resolver.resolveWebDistFile(distDir, requestUrl)
    const relPath = resolved ? path.relative(distDir, resolved).split(path.sep).join('/') : null
    const ok = expected ? relPath === expected : Boolean(relPath)
    record(`DIRECT LOAD ${requestUrl}`, ok, ok ? relPath ?? '' : `resolved ${relPath}`)
  }
}

console.log('\n# Module platform database gates')

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL ?? process.env.MODULA_DATABASE_URL
const externalRepo = rel('../modula-mod/modula-vault-notes')
const externalReady = existsSync(path.join(externalRepo, 'module.manifest.json'))
record(
  'EXTERNAL VAULT REPO',
  externalReady,
  externalReady ? externalRepo : 'clone modula-mod/modula-vault-notes as sibling',
)

if (!databaseUrl) {
  record('DB TEST ENV', false, 'set MODULA_TEST_DATABASE_URL to run platform gates')
} else if (!externalReady) {
  record('DB TEST ENV', true, 'skipping platform tests: external repo absent')
} else {
  record('DB TEST ENV', true)
  const env = {
    ...process.env,
    CI: 'true',
    MODULA_TEST_DATABASE_URL: databaseUrl,
    MODULA_DATABASE_MIGRATOR_URL: process.env.MODULA_DATABASE_MIGRATOR_URL ?? databaseUrl,
  }
  run(
    'VAULT NOTES PLATFORM',
    'pnpm',
    [
      '--filter',
      '@modula/greenfield-api',
      'exec',
      'vitest',
      'run',
      'tests/phase7e.vault-notes-platform.test.ts',
      'tests/phase7b.module-runtime.test.ts',
      'tests/phase7e.module-runtime-2.test.ts',
      'tests/phase7l.product-hub-policy.test.ts',
    ],
    env,
  )
}

if (failures.length > 0) {
  console.error('\nPhase 7M-B verifier FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nPhase 7M-B source/local gates PASS')
console.log('Remaining manual gates (record explicitly):')
console.log('  IOS BUILD / SIMULATOR      MANUAL — native rebuild + simulator exercise')
console.log('  FLAGSHIP VISUAL APPROVAL   MANUAL — Login / Home / Product Hub / Vault Notes')
process.exit(0)
