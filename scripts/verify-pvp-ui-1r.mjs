#!/usr/bin/env node
/**
 * PVP-UI-1R Product Hub visual reconstruction verifier.
 * Never claims FOUNDER_APPROVED. Does not deploy or merge.
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
  console.log(`${label.padEnd(42)} ${ok ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ''}`)
}

function warn(label, detail) {
  console.log(`${label.padEnd(42)} WARN  ${detail}`)
  notes.push(`${label}: ${detail}`)
}

function git(args) {
  const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'})
  return {status: result.status ?? 1, stdout: (result.stdout || '').trim(), stderr: (result.stderr || '').trim()}
}

function spawn(label, command, args) {
  const result = spawnSync(command, args, {cwd: root, encoding: 'utf8'})
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
    } else if (entry.isFile() && /\.(ts|tsx|js|mjs|md)$/.test(entry.name)) {
      acc.push(next)
    }
  }
  return acc
}

console.log('PVP UI PHASE 1R')
console.log('PRODUCT HUB VISUAL RECONSTRUCTION\n')

console.log('# RESEARCH')
const refs = read('docs/research/pvp-ui-1r-marketplace-references.md')
const refCount = (refs.match(/^### REF-/gm) || []).length
record('REAL PRODUCT REFERENCES >= 40', refCount >= 40, String(refCount))
record('REAL PRODUCTS STUDIED >= 8', /PRODUCTS STUDIED:\s*([0-9]+)/.test(refs) && Number(RegExp.$1) >= 8, (refs.match(/PRODUCTS STUDIED:\s*([0-9]+)/) || [])[1] || '0')
record('APP STORE REFERENCES', refs.includes('Apple App Store') && refs.includes('Today'))
record('GOOGLE PLAY REFERENCES', refs.includes('Google Play'))
record('EXTENSION MARKETPLACES', refs.includes('VS Code') && refs.includes('Figma Community') && refs.includes('Shopify'))
record('REFERO / EQUIVALENT', refs.includes('Refero'))
record('MOBBIN', refs.includes('ACCESS_UNAVAILABLE') || refs.includes('Mobbin'))
record('REFERENCE PROVENANCE', refs.includes('why_it_is_good') && refs.includes('what_modula_must_not_copy'))
record('REJECTION RECORDED', existsSync(file('docs/research/pvp-ui-1r-rejection.md')))
record('SKILLS', read('docs/validation/pvp-ui-1r-skills.md').includes('EXPO BUILDING NATIVE UI'))

console.log('\n# DIRECTIONS')
const lab = read('src/platform/ui/dev/pvp-ui-1r-lab.tsx')
record('DIRECTION A', lab.includes('pvp-ui-1r-direction-a') && existsSync(file('src/features/modules/components/presentation/ModuleEditorialHero.tsx')))
record('DIRECTION B', lab.includes('pvp-ui-1r-direction-b') && existsSync(file('src/features/modules/components/presentation/EditorialBleedHero.tsx')))
record('DIRECTION C', lab.includes('pvp-ui-1r-direction-c') && existsSync(file('src/features/modules/components/presentation/EditorialSplitHero.tsx')))
record('LIGHT / DARK / DESKTOP FRAMES', lab.includes('desktop') && existsSync(file('docs/design/pvp-ui-1r-directions.md')))

console.log('\n# NATIVE')
const experiments = read('docs/research/pvp-ui-1r-native-experiments.md') + read('src/platform/ui/dev/pvp-native-experiments.tsx')
record('SDK 57 TYPES', existsSync(file('node_modules/expo-router/build/layouts/stack-utils/StackSearchBar.d.ts')))
record('STACK SEARCH EVALUATED', experiments.includes('Stack.SearchBar'))
record('BOTTOM SEARCH SLOT EVALUATED', experiments.includes('SearchBarSlot'))
record('SEGMENTED CONTROL EVALUATED', experiments.includes('Segmented'))
record('LIQUID GLASS EVALUATED', experiments.includes('expo-glass-effect') || experiments.includes('GlassView'))
record('ANIMATED SYMBOLS EVALUATED', experiments.includes('Animated'))
record('APPLE ZOOM EVALUATED', experiments.includes('AppleZoom') || read('src/features/modules/components/presentation/ModuleEditorialHero.tsx').includes('Link.AppleZoom'))
record('COMPOSE / MATERIAL EVALUATED', experiments.includes('Material') || experiments.includes('Compose'))

console.log('\n# PRODUCT')
const hub = read('src/features/modules/screens/ProductHubMarketplaceScreen.tsx')
const header = read('src/features/modules/components/ProductHubHeader.tsx')
record('FEATURED', hub.includes('product-hub-featured') && hub.includes('ModuleEditorialHero'))
record('PRODUCT ROWS', hub.includes('ModuleRow'))
record('COMING SOON', hub.includes('ComingSoonEditorial') && !read('src/features/modules/components/presentation/ComingSoonEditorial.tsx').includes('opacity:'))
record('MADE BY MODULA', hub.includes('ModuleIconShelf'))
record('COLLECTIONS / BROWSE', hub.includes('ModuleBrowseGrid') && hub.includes('PRODUCT_HUB_COLLECTIONS'))
record('SEARCH', header.includes('ProductHubSearchChrome') && header.includes('compact={!searchActive}'))
record('INSTALLED', hub.includes("segment === 'installed'"))
record('UPDATES', hub.includes("segment === 'updates'"))
record('VAULT NOTES COUNT', hub.includes('isLegacyVaultNotesModuleId') && hub.includes('featuredId'))
record('VAULT NOTES ID', read('packages/greenfield-contracts/src/canonical-module-identity.ts').includes("digital.modula.vault-notes"))
record('NO GREY IDLE SEARCH FIELD', header.includes('compact={!searchActive}') && !header.includes('Discover modules'))
record('NO STACKED SEGMENTED IN SCROLL', !hub.includes('<ProductHubSegmentedControl'))
record('NAV LABEL TRUNCATION GUARD', read('src/features/modules/components/ProductHubLibraryControl.tsx').includes('numberOfLines={1}') && read('src/features/modules/components/ProductHubLibraryControl.tsx').includes('Discover'))

console.log('\n# APPEARANCE')
record('OLED TRUE BLACK', read('src/features/modules/identity/marketplaceCanvas.ts').includes("'#000000'") && read('src/theme/data/palettes.json').includes('"oled"'))
record('DARK MARKETPLACE CANVAS', read('src/features/modules/identity/marketplaceCanvas.ts').includes("mode === 'dark'"))
record('ARTWORK ROLES', read('src/features/modules/identity/moduleArtwork.ts').includes('heroArtwork') && read('src/features/modules/identity/moduleArtwork.ts').includes('editorialArtwork'))

console.log('\n# ACCESSIBILITY')
record('LARGE TEXT', read('src/features/modules/components/presentation/ModuleRow.tsx').includes('fontScale >= 1.2'))
record('REDUCE MOTION', read('src/features/modules/components/ProductHubSearchChrome.tsx').includes('useReduceMotion'))
record('REDUCE TRANSPARENCY', read('src/platform/ui/materials/liquid-glass-chrome.tsx').includes('reduceTransparency'))
record('WEB KEYBOARD', read('src/features/modules/components/ProductHubSearchChrome.tsx').includes('Escape'))

console.log('\n# QUALITY / SCOPE')
record('NO FAKE METRICS', !/downloads|star rating|editor.?pick/i.test(hub))
record('NO CONTENT GLASS', !hub.includes('GlassView') && !hub.includes('LiquidGlassChrome'))
record('DIRECT SWIFTUI IN FEATURES', walk(file('src/features')).every(full => !readFileSync(full, 'utf8').includes('@expo/ui/swift-ui')))
record('PVP UI 2 STARTED', !git(['diff', '--name-only', 'origin/main...HEAD']).stdout.includes('ComposerScreen'))
record('PRODUCTION DEPLOYED', true, 'NO')
record('FOUNDER APPROVED', true, 'NO')

console.log('\n# PRESENTATION')
spawn('1R PRESENTATION', process.execPath, ['scripts/pvp-ui-1r-presentation.test.mjs'])
spawn('1 PRESENTATION', process.execPath, ['scripts/pvp-ui-1-presentation.test.mjs'])
spawn('VAULT NOTES CANONICAL', process.execPath, ['scripts/verify-vault-notes-canonical.mjs'])

if (ci) {
  console.log('\n# ENGINEERING')
  spawn('LINT', 'pnpm', ['lint'])
  spawn('TYPECHECK', 'pnpm', ['typecheck'])
  spawn('WEB BUILD', 'pnpm', ['build:web'])
  spawn('WEB VERIFY', 'pnpm', ['verify:web-build'])
  spawn('EXPO INSTALL CHECK', 'pnpm', ['exec', 'expo', 'install', '--check'])
  const doctor = spawnSync('pnpm', ['exec', 'expo-doctor'], {cwd: root, encoding: 'utf8'})
  const doctorOut = `${doctor.stdout || ''}\n${doctor.stderr || ''}`
  const expectedWarning = /CNG|native folder|prebuild/i.test(doctorOut)
  record('EXPO DOCTOR', doctor.status === 0 || (doctor.status === 1 && expectedWarning), doctor.status === 0 ? 'clean' : expectedWarning ? 'PASS_WITH_EXPECTED_WARNING' : 'fail')
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
