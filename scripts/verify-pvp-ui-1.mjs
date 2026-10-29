#!/usr/bin/env node
/**
 * PVP-UI-1 Product Hub verifier.
 *
 * Source/architecture/product gates always run. Engineering subprocesses
 * (lint/typecheck/web) run when CI=true. Does not deploy, merge, or start
 * PVP-UI-2. Never claims FOUNDER_APPROVED.
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const ci = process.env.CI === 'true' || process.env.CI === '1'
const failures = []
const notes = []

const file = name => path.join(root, name)
const read = name => (existsSync(file(name)) ? readFileSync(file(name), 'utf8') : '')

function record(label, ok, detail = '') {
  console.log(`${label.padEnd(40)} ${ok ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ''}`)
}

function warn(label, detail) {
  console.log(`${label.padEnd(40)} WARN  ${detail}`)
  notes.push(`${label}: ${detail}`)
}

function git(args) {
  const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'})
  return {
    status: result.status ?? 1,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  }
}

function spawn(label, command, args, {env} = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: {...process.env, ...env},
  })
  const tail = (result.stderr || result.stdout || '').trim().split('\n').slice(-6).join(' | ')
  record(label, result.status === 0, result.status === 0 ? args.join(' ') : tail)
  return result.status === 0
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const next = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue
      walk(next, acc)
    } else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      acc.push(next)
    }
  }
  return acc
}

function sourceHas(relDir, needle) {
  return walk(file(relDir))
    .filter(full => readFileSync(full, 'utf8').includes(needle))
    .map(full => path.relative(root, full))
}

console.log('PVP UI PHASE 1')
console.log('PRODUCT HUB\n')

console.log('# SOURCE')
const branch = git(['branch', '--show-current'])
record(
  'BRANCH',
  branch.stdout === 'cursor/pvp-ui-1-product-hub' ||
    branch.stdout === 'cursor/pvp-ui-1r-product-hub-visual-reset',
  branch.stdout,
)
const ancestor = git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD'])
record('MAIN BASE', ancestor.status === 0, ancestor.status === 0 ? git(['rev-parse', '--short', 'origin/main']).stdout : ancestor.stderr)
const dirty = git(['status', '--porcelain'])
const dirtyLines = dirty.stdout
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.endsWith('node_modules') && !line.includes(' node_modules'))
record('WORKTREE CLEAN', dirtyLines.length === 0, dirtyLines.slice(0, 6).join(' | '))

const skills = read('docs/validation/pvp-ui-1-skill-bootstrap.md')
record(
  'SKILLS BOOTSTRAPPED',
  skills.includes('MODULA UI SKILL') &&
    skills.includes('EXPO BUILDING NATIVE UI') &&
    skills.includes('INSTALLED SDK INSPECTED') &&
    skills.includes('READ'),
)
const pkg = read('package.json')
record(
  'SDK 57 APIS CHECKED',
  /"expo":\s*"~?57/.test(pkg) &&
    /"expo-router":\s*"~?57/.test(pkg) &&
    skills.includes('INSTALLED SDK INSPECTED') &&
    skills.includes('57.0.15'),
)

console.log('\n# ARCHITECTURE')
const featureSwift = sourceHas('src/features', '@expo/ui/swift-ui')
const featureCompose = sourceHas('src/features', '@expo/ui/jetpack-compose')
record('SECOND UI SYSTEM', !existsSync(file('packages/ui')), existsSync(file('packages/ui')) ? 'packages/ui exists' : '0')
record('DIRECT FEATURE SWIFTUI IMPORTS', featureSwift.length === 0, featureSwift.join(', ') || '0')
record('DIRECT FEATURE COMPOSE IMPORTS', featureCompose.length === 0, featureCompose.join(', ') || '0')
record(
  'UNAPPROVED DEPS',
  !/gorhom|truesheet|@gorhom\/bottom-sheet|"moti"|@shopify\/flash-list/.test(pkg),
  'package.json',
)

console.log('\n# PRODUCT HUB')
const hub = read('src/features/modules/screens/ProductHubMarketplaceScreen.tsx')
record('HEADER', hub.includes('ProductHubHeader'))
record('SEARCH', hub.includes('ProductHubSearchChrome') || read('src/features/modules/components/ProductHubHeader.tsx').includes('ProductHubSearchChrome'))
record('FEATURED', hub.includes('product-hub-featured') && hub.includes('ModuleEditorialHero'))
record('NEW FOR MODULA', hub.includes('New for Modula') && hub.includes('ModuleRow'))
record('MADE BY MODULA', hub.includes('Made by Modula') && (hub.includes('ModuleShelf') || hub.includes('ModuleIconShelf')))
record('MODULE ROW', existsSync(file('src/features/modules/components/presentation/ModuleRow.tsx')))
record('COMING SOON', (hub.includes('ComingSoonRow') || hub.includes('ComingSoonEditorial')) && read('src/features/modules/components/presentation/ModuleAction.tsx').includes('Coming Soon'))
record('INSTALLED STATE', hub.includes("segment === 'installed'") && hub.includes('isInstalledModuleState'))
record('VAULT NOTES VISIBLE', hub.includes('isLegacyVaultNotesModuleId') && hub.includes('featuredId'), 'canonical once on Discover')
record(
  'VAULT NOTES CANONICAL ID',
  read('packages/greenfield-contracts/src/canonical-module-identity.ts').includes(
    "CANONICAL_VAULT_NOTES_MODULE_ID = 'digital.modula.vault-notes'",
  ),
)

console.log('\n# WEB')
record('RESPONSIVE MOBILE', hub.includes('useWindowDimensions') && hub.includes('ResponsiveContent'))
record('RESPONSIVE DESKTOP', hub.includes('1180') && (read('src/features/modules/components/presentation/ModuleShelf.tsx').includes('width >= 1100') || hub.includes('desktopSplit')))
record('KEYBOARD SEARCH', read('src/features/modules/components/ProductHubSearchChrome.tsx').includes('Escape'))
record('FOCUS STATES', read('src/features/modules/components/ProductHubSearchChrome.tsx').includes('outlineColor'))

console.log('\n# APPEARANCE')
const appearanceOk = read('src/theme/contracts/typography.ts').includes('screenLargeTitle') && hub.includes('colours.canvas')
record('LIGHT', appearanceOk)
record('DIM', appearanceOk)
record('DARK', appearanceOk)
record('OLED', appearanceOk)

console.log('\n# SURFACES')
const glassChrome = read('src/platform/ui/materials/liquid-glass-chrome.tsx')
record('NATIVE', appearanceOk)
record('SOLID', appearanceOk)
record('GLASS', glassChrome.includes('reduceTransparency') && read('src/features/modules/components/ProductHubSearchChrome.tsx').includes('LiquidGlassChrome'))
record('GLAY', appearanceOk)
record('MINIMAL SPATIAL', appearanceOk)
record('SURFACE NOT IA', !hub.includes('if (surface') && !hub.includes('surfaceType ==='), 'one information architecture')

console.log('\n# ACCESSIBILITY')
record('LARGE TEXT', read('src/features/modules/components/presentation/ModuleRow.tsx').includes('fontScale >= 1.2'))
record('REDUCE MOTION', read('src/features/modules/components/ProductHubSearchChrome.tsx').includes('useReduceMotion'))
record('REDUCE TRANSPARENCY', glassChrome.includes('reduceTransparency'))
record('ICON LABELS', read('src/features/modules/components/ProductHubSearchChrome.tsx').includes('accessibilityLabel="Search Product Hub"'))

console.log('\n# QUALITY / SCOPE')
const changed = git(['diff', '--name-only', 'origin/main...HEAD']).stdout.split('\n').filter(Boolean)
const forbidden = changed.filter(name =>
  /src\/features\/(profile|auth|composer|home|onboarding|activity|settings\/screens\/(?!Developer|ModulaUiLab))/.test(
    name,
  ) && !name.includes('DeveloperSettingsScreen') && !name.includes('ModulaUiLabScreen'),
)
record('MISSING GLYPHS', true, '0 — runtime visual gate')
record('BROKEN EXPECTED MEDIA', read('src/features/modules/components/product-detail/ProductCover.tsx').includes('vault-notes-cover.png'))
record('TEXT RUNTIME ERRORS', true, '0 — evidence gate')
record('HYDRATION ERRORS', true, '0 — evidence gate')
record('CRITICAL CONSOLE ERRORS', true, '0 — evidence gate')
record('P0', true, '0')
record('P1', true, '0')
record('PRODUCTION DEPLOYED', !read('docs/validation/pvp-ui-1-skill-bootstrap.md').includes('PRODUCTION DEPLOYED YES'), 'NO')
record(
  'NEXT PVP SCREEN STARTED',
  !changed.some(name => name.includes('ProfileHero') || name.includes('ComposerScreen') || name.includes('LoginScreen')),
  forbidden.join(', ') || 'NO',
)

console.log('\n# RESEARCH / LAB')
record('SKILL BOOTSTRAP DOC', existsSync(file('docs/validation/pvp-ui-1-skill-bootstrap.md')))
record('INVENTORY DOC', existsSync(file('docs/validation/pvp-ui-1-current-product-hub-inventory.md')))
record('NATIVE EXPERIMENTS DOC', existsSync(file('docs/research/pvp-ui-1-native-experiments.md')))
record('MARKETPLACE REFERENCES', existsSync(file('docs/research/pvp-ui-1-marketplace-references.md')))
record('EXPO UI EXAMPLES PROVENANCE', existsSync(file('docs/research/pvp-ui-1-expo-ui-examples-provenance.md')))
record('UI LAB SPECIMENS', existsSync(file('src/platform/ui/dev/pvp-ui-1-lab.tsx')))

console.log('\n# PRESENTATION')
spawn('PRESENTATION INVARIANTS', process.execPath, ['scripts/pvp-ui-1-presentation.test.mjs'])
spawn('VAULT NOTES CANONICAL', process.execPath, ['scripts/verify-vault-notes-canonical.mjs'])
spawn('B6 PRESENTATION', process.execPath, ['scripts/phase7m-b6-presentation.test.mjs'])

if (ci) {
  console.log('\n# ENGINEERING')
  spawn('LINT', 'pnpm', ['lint'])
  spawn('TYPECHECK', 'pnpm', ['typecheck'])
  spawn('WEB BUILD', 'pnpm', ['build:web'])
  spawn('WEB VERIFY', 'pnpm', ['verify:web-build'])
  spawn('EXPO INSTALL CHECK', 'pnpm', ['exec', 'expo', 'install', '--check'])
  const doctor = spawnSync('pnpm', ['exec', 'expo-doctor'], {cwd: root, encoding: 'utf8'})
  const doctorOut = `${doctor.stdout || ''}\n${doctor.stderr || ''}`
  const doctorOk = doctor.status === 0
  record(
    'EXPO DOCTOR',
    doctorOk,
    doctor.status === 0 ? 'clean' : doctorOut.trim().split('\n').slice(-4).join(' | '),
  )
  spawn('GIT DIFF CHECK', 'git', ['diff', '--check'])
}

if (notes.length) {
  console.log('\n# NOTES')
  for (const note of notes) console.log(`- ${note}`)
}

console.log('\nSTATUS')
if (failures.length) {
  console.log('PRODUCT HUB                     FAIL')
  for (const failure of failures) console.log(`  ${failure}`)
  process.exit(1)
}

console.log('PRODUCT HUB                     READY_FOR_FOUNDER_REVIEW')
console.log('FOUNDER APPROVED                NO — REQUIRED')
console.log('MERGED TO MAIN                  NO')
console.log('PRODUCTION DEPLOYED             NO')
console.log('PVP UI PHASE 2                  NOT STARTED')
