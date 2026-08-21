#!/usr/bin/env node
/**
 * Phase 7M-B9 source gate — Product Hub exact reconstruction invariants.
 *
 * This validates source and architecture only. Simulator/web evidence and
 * founder visual approval remain separate, exact-SHA gates.
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const failures = []

const file = name => path.join(root, name)
const read = name => existsSync(file(name)) ? readFileSync(file(name), 'utf8') : ''

function record(label, ok, detail = '') {
  console.log(`${label.padEnd(38)} ${ok ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ''}`)
}

function contains(name, needle, label) {
  const source = read(name)
  record(label, Boolean(source) && source.includes(needle), source ? name : `missing ${name}`)
}

function absent(name, pattern, label) {
  const source = read(name)
  const found = typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source)
  record(label, Boolean(source) && !found, source ? name : `missing ${name}`)
}

function walk(directory, acc = []) {
  if (!existsSync(directory)) return acc
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const next = path.join(directory, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') walk(next, acc)
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) acc.push(next)
  }
  return acc
}

console.log('PHASE 7M-B9 — Product Hub source verifier\n')

console.log('# Founder reference lock')
const breakdown = 'docs/design/product-hub/founder-reference-breakdown.md'
record('REFERENCE BREAKDOWN', existsSync(file(breakdown)), breakdown)
contains(breakdown, 'FM-PH-VN-001', 'REFERENCE 001 LOCKED')
contains(breakdown, 'FM-PH-VN-002', 'REFERENCE 002 LOCKED')
for (const zone of [
  '01 Safe Area', '02 Cover', '03 Floating Navigation Controls', '04 Module Artwork',
  '05 Privacy Badge', '06 Product Title', '07 Subtitle', '08 Publisher', '09 Primary CTA',
  '10 Secondary Actions', '11 Metadata Strip', '12 Section Tabs', '13 Capability Strip',
  "14 What's New", '15 Version History Link', '16 Preview Section', '17 Preview Cards',
  '18 Page Indicator', '19 Platform Strip', '20 Product Description',
  '21 Product Information Strip', '22 Information Disclosure',
]) contains(breakdown, zone, `ZONE ${zone.slice(0, 2)}`)
for (const name of ['FM-PH-VN-001.jpg', 'FM-PH-VN-002.jpg']) {
  record(`REFERENCE ${name.slice(-7, -4)}`, existsSync(file(`docs/validation/evidence/phase7m-b9/founder-references/${name}`)), name)
}

console.log('\n# Canonical Vault Notes')
const canonical = spawnSync(process.execPath, ['scripts/verify-vault-notes-canonical.mjs'], {cwd: root, encoding: 'utf8'})
record('CANONICAL VERIFIER', canonical.status === 0, canonical.status === 0 ? 'one product family' : canonical.stderr.trim())
const identity = read('packages/greenfield-contracts/src/canonical-module-identity.ts')
record('CANONICAL MODULE ID', identity.includes("CANONICAL_VAULT_NOTES_MODULE_ID = 'digital.modula.vault-notes'"))
record('CANONICAL SOURCE REPO', identity.includes("CANONICAL_VAULT_NOTES_REPOSITORY = 'modula-mod/modula-vault-notes'"))
record('CANDIDATE RELEASE 1.1.0', identity.includes("CANONICAL_VAULT_NOTES_CURRENT_VERSION = '1.1.0'"))
contains('src/features/modules/screens/ProductHubMarketplaceScreen.tsx', '!isLegacyVaultNotesModuleId(item.moduleId)', 'LEGACY PRODUCT FILTERED')

console.log('\n# Product-detail components')
const productDir = 'src/features/modules/components/product-detail'
for (const component of [
  'ProductCover', 'ProductTopChrome', 'ProductBadge', 'ProductIdentity',
  'ProductActionGroup', 'ProductMetadataStrip', 'ProductTabs',
  'ProductCapabilityStrip', 'ProductWhatsNew', 'ProductPreviewCarousel',
  'ProductPlatformRow', 'ProductDescription', 'ProductInformationStrip',
  'ProductInformationDisclosure', 'ProductStickyHeader',
]) record(component.toUpperCase(), existsSync(file(`${productDir}/${component}.tsx`)))

const detailName = 'src/features/marketplace/screens/ModuleDetailScreen.tsx'
const detail = read(detailName)
const composition = [
  '<ProductCover', '<ProductIdentity', '<ProductActionGroup', '<ProductMetadataStrip',
  '<ProductTabs', '<ProductCapabilityStrip', '<ProductWhatsNew',
  '<ProductPreviewCarousel', '<ProductPlatformRow', '<ProductDescription',
  '<ProductInformationStrip',
]
let previous = -1
let ordered = true
for (const marker of composition) {
  const index = detail.indexOf(marker, previous + 1)
  if (index < 0 || index <= previous) ordered = false
  previous = index
}
record('DETAIL COMPOSITION ORDER', ordered)
absent(detailName, /4\.8|1\.2K|No\. ?7|18\.6\s*MB/i, 'NO FAKE MARKET VALUES')
record(
  'UNAVAILABLE METRICS ARE EXPLICIT',
  detail.includes("value: average === null ? '—'") &&
    detail.includes("value: age ?? '—'") &&
    detail.includes("value: chartRank === null ? '—'") &&
    detail.includes("value: module.latestVersion ?? '—'"),
)
contains(detailName, 'module.latestVersion', 'VISIBLE VERSION IS REGISTRY DATA')

console.log('\n# Actions and install review')
contains('src/features/modules/components/presentation/ModuleAction.tsx', "shown === 'Install'", 'INSTALLABLE CTA')
contains(detailName, 'const stickyVisible = scrollOffset > heroActionBottom', 'STICKY VISIBILITY GATE')
contains(detailName, 'visible={stickyVisible}', 'STICKY USES HERO GATE')
record('ONE HERO CTA', (detail.match(/testID="module-hero-install"/g) ?? []).length === 1)
record('ONE STICKY HEADER', (detail.match(/<ProductStickyHeader/g) ?? []).length === 1)
const installSheet = read('src/features/modules/components/InstallPreviewSheet.tsx')
const sheetLayout = read('src/platform/ui/sheets/modula-sheet-layout.tsx')
record('INSTALL CTA COMPONENT', installSheet.includes('testID="module-install-confirm"') && installSheet.includes('footer={footer}'))
record('INSTALL FOOTER AFTER BODY', sheetLayout.indexOf('{footer ?') > sheetLayout.indexOf('<ScrollView'))
record('INSTALL FOOTER STABLE', sheetLayout.includes('flexShrink: 0') && sheetLayout.includes('sheetKeyboardBottomInset'))
contains('src/features/modules/identity/permissionPresentation.ts', 'Notes & folders', 'CONSUMER PERMISSION GROUPS')
record('TECHNICAL PERMISSIONS DISCLOSURE', installSheet.includes('Technical permissions'))

console.log('\n# Marketplace and search')
const landingName = 'src/features/modules/screens/ProductHubMarketplaceScreen.tsx'
for (const marker of ['ModuleEditorialHero', 'ModuleRow', 'ModuleShelf', 'New for Modula', 'Made by Modula']) {
  contains(landingName, marker, `LANDING ${marker.toUpperCase()}`)
}
absent(landingName, 'ModuleCatalogueCard', 'OLD REGISTRY CARD GRID REMOVED')
absent(landingName, 'CATALOGUE', 'REGISTRY LANGUAGE REMOVED')
const searchMachine = read('src/features/modules/state/productHubSearchMachine.ts')
for (const state of ['SEARCH_ACTIVE', 'SEARCH_RESULTS', 'SEARCH_EMPTY', 'SEARCH_ERROR', 'SEARCH_COLLAPSING']) {
  record(`SEARCH ${state.replace('SEARCH_', '')}`, searchMachine.includes(`'${state}'`))
}
const searchChrome = read('src/features/modules/components/ProductHubSearchChrome.tsx')
for (const marker of ["event.nativeEvent.key === 'Escape'", 'Clear search', 'Cancel search', "accessibilityRole=\"search\""]) {
  record(`SEARCH ${marker.replace(/[^A-Za-z]+/g, ' ').trim().toUpperCase()}`, searchChrome.includes(marker))
}

console.log('\n# Artwork, icons, routes, boundaries')
contains('src/features/modules/identity/moduleArtwork.ts', "'digital.modula.vault-notes'", 'VAULT ARTWORK RESOLVES')
contains('src/features/modules/identity/moduleArtwork.ts', "kind: 'vault-notes'", 'NO GENERIC VAULT CUBE')
record('OWNED COVER MEDIA', existsSync(file('assets/images/product-hub/vault-notes-cover.png')))
contains('assets/images/product-hub/README.md', 'ownership: Modula first-party generated asset', 'COVER PROVENANCE')
const iconRegistry = read('src/platform/ui/icons/modula-icon-registry.ts')
for (const icon of ['back', 'share', 'more', 'search', 'module', 'verified', 'privacy', 'note', 'profile', 'marketplace']) {
  record(`WEB ICON ${icon.toUpperCase()}`, new RegExp(`\\n\\s{2}${icon}:`).test(iconRegistry))
}
contains('src/app/marketplace/[moduleId].tsx', '<ModuleDetailScreen />', 'DYNAMIC DETAIL ROUTE')
const hostFiles = [
  'src/features/modules/runtime/module-host.tsx',
  'src/features/modules/runtime/module-route-resolver.ts',
  'src/features/modules/runtime/module-view-renderer.tsx',
]
const hostSpecialCases = hostFiles.filter(name => /vault-notes/i.test(read(name)))
record('VAULT HOST SPECIAL CASES', hostSpecialCases.length === 0, hostSpecialCases.join(', '))
const featureFiles = [
  ...walk(file('src/features/marketplace')),
  ...walk(file('src/features/modules/screens')),
  ...walk(file('src/features/modules/components/product-detail')),
  ...walk(file('src/features/modules/components/presentation')),
]
const directExpoUi = featureFiles.filter(name => /@expo\/ui(?:\/swift-ui|\/jetpack-compose)?/.test(readFileSync(name, 'utf8')))
record('DIRECT FEATURE EXPO UI', directExpoUi.length === 0, directExpoUi.map(name => path.relative(root, name)).join(', '))

console.log('\n# UI Lab')
const lab = read('src/platform/ui/dev/modula-primitives-lab.tsx')
for (const primitive of [
  'ProductCover', 'ProductTopChrome', 'ModuleArtwork', 'ProductIdentity', 'ProductActions',
  'ProductMetadataStrip', 'ProductTabs', 'ProductCapabilityStrip', 'ProductPreviewCarousel',
  'ProductStickyHeader', 'InstallReview', 'ModuleRow', 'EditorialHero', 'ProductHubSearch',
]) record(`UI LAB ${primitive.toUpperCase()}`, lab.includes(`title="${primitive}"`))

const diff = spawnSync('git', ['diff', '--check'], {cwd: root, encoding: 'utf8'})
record('GIT DIFF CHECK', diff.status === 0, diff.stderr.trim())

if (failures.length) {
  console.error(`\nverify:phase7m-b9 FAIL (${failures.length})`)
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('\nverify:phase7m-b9 PASS')
console.log('VISUAL IMPLEMENTATION = READY FOR INTERNAL ITERATION')
console.log('FOUNDER VISUAL APPROVAL = REQUIRED (not granted by this gate)')
console.log('PRODUCTION DEPLOYED = NO')
console.log('7M-C = NOT STARTED')
