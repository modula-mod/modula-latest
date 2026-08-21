#!/usr/bin/env node
/**
 * PVP-UI-1 Product Hub presentation invariants.
 * Source semantics only — not a file-existence test.
 */
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = rel => readFileSync(path.join(root, rel), 'utf8')

function section(title) {
  console.log(`\n# ${title}`)
}

section('Search machine')
const machine = read('src/features/modules/state/productHubSearchMachine.ts')
for (const state of [
  'IDLE_LARGE_HEADER',
  'SEARCH_ACTIVE',
  'SEARCH_RESULTS',
  'SEARCH_EMPTY',
  'SEARCH_ERROR',
  'SEARCH_COLLAPSING',
]) {
  assert.match(machine, new RegExp(state), `missing ${state}`)
}
assert.match(machine, /RESULTS_CHANGED/)
console.log('SEARCH STATES                  PASS')

section('Product Hub landing')
const hub = read('src/features/modules/screens/ProductHubMarketplaceScreen.tsx')
assert.match(hub, /testID="product-hub-featured"/)
assert.match(hub, /New for Modula/)
assert.match(hub, /Made by Modula/)
assert.match(hub, /ComingSoonEditorial|Coming Soon/)
assert.match(hub, /Your modules/)
assert.match(hub, /ProductHubSegmentedControl/)
assert.match(hub, /isLegacyVaultNotesModuleId/)
assert.match(hub, /featuredId/)
assert.match(hub, /item\.moduleId !== featuredId/)
assert.match(hub, /install=1/)
assert.match(hub, /useModuleCatalogueQuery/)
assert.doesNotMatch(hub, /\bfetch\s*\(/)
assert.doesNotMatch(hub, /Discover \| Installed/)
assert.doesNotMatch(hub, /Not available/)
assert.doesNotMatch(hub, /firstParty/)
assert.doesNotMatch(hub, /downloads/)
assert.doesNotMatch(hub, /star rating/)
assert.doesNotMatch(hub, /editor pick/i)
console.log('LANDING IA                     PASS')

section('Vault Notes uniqueness')
assert.match(hub, /isLegacyVaultNotesModuleId\(item\.moduleId\)/)
const landingExclusions = hub.match(/item\.moduleId !== featuredId/g) ?? []
assert.ok(landingExclusions.length >= 3, `featured exclusion too weak (${landingExclusions.length})`)
console.log('VAULT NOTES DEDUPE             PASS')

section('Customer vocabulary')
const action = read('src/features/modules/components/presentation/ModuleAction.tsx')
assert.match(action, /Coming Soon/)
assert.match(action, /Unavailable/)
assert.match(action, /Installing…/)
assert.match(action, /Updating…/)
assert.doesNotMatch(action, /ProductHubButton2/)
assert.doesNotMatch(action, /MarketplaceInstallPill/)
assert.doesNotMatch(action, /TealSpecialButton/)
const install = read('src/features/modules/identity/installPresentation.ts')
assert.match(install, /'Soon'/)
assert.doesNotMatch(install, /primaryAction: 'Coming soon'/)
console.log('INSTALL VOCAB                  PASS')

section('Native contracts')
const header = read('src/features/modules/components/ProductHubHeader.tsx')
assert.match(header, /ProductHubSearchChrome/)
assert.match(header, /screenLargeTitle/)
assert.match(header, /screenCompactTitle/)
assert.match(header, /Stack\.SearchBar/)
const search = read('src/features/modules/components/ProductHubSearchChrome.tsx')
assert.match(search, /LiquidGlassChrome/)
assert.match(search, /withTiming/)
assert.match(search, /useReduceMotion/)
assert.match(search, /Escape/)
assert.match(search, /product-hub-search-input/)
assert.doesNotMatch(search, /setInterval/)
const segmented = read('src/features/modules/components/ProductHubSegmentedControl.tsx')
assert.match(segmented, /ModulaSegmentedPicker/)
assert.match(segmented, /Discover/)
assert.match(segmented, /Installed/)
assert.match(segmented, /Updates/)
const hero = read('src/features/modules/components/presentation/ModuleEditorialHero.tsx')
assert.match(hero, /Link\.AppleZoom/)
assert.match(hero, /ProductCover/)
assert.match(hero, /size="editorial"/)
assert.match(hero, /LinearGradient/)
const detail = read('src/features/marketplace/screens/ModuleDetailScreen.tsx')
assert.match(detail, /Link\.AppleZoomTarget/)
console.log('NATIVE CONTRACTS               PASS')

section('Rows and shelves')
const row = read('src/features/modules/components/presentation/ModuleRow.tsx')
assert.match(row, /fontScale >= 1\.2/)
assert.match(row, /publisher/)
assert.match(row, /comingSoon/)
const shelf = read('src/features/modules/components/presentation/ModuleShelf.tsx')
assert.match(shelf, /width >= 1100/)
assert.match(shelf, /ScrollView horizontal/)
const comingSoon = read('src/features/modules/components/presentation/ComingSoonRow.tsx')
assert.match(comingSoon, /muted/)
console.log('ROWS SHELVES                   PASS')

section('Typography aliases')
const type = read('src/theme/contracts/typography.ts')
for (const alias of [
  'screenLargeTitle',
  'screenCompactTitle',
  'editorialEyebrow',
  'editorialTitle',
  'editorialSubtitle',
  'sectionAccessory',
  'productName',
  'productSubtitle',
  'buttonLabel',
]) {
  assert.match(type, new RegExp(alias))
}
console.log('TYPOGRAPHY                     PASS')

section('UI Lab specimens')
const lab = read('src/platform/ui/dev/pvp-ui-1-lab.tsx')
for (const name of [
  'ProductHubHeader',
  'ProductHubSearch',
  'ProductHubSearchActive',
  'EditorialFeature',
  'ModuleRow',
  'ModuleShelf',
  'SectionHeader',
  'ComingSoonRow',
  'InstallButton',
  'ProductHubSegmentedControl',
  'GlassToolbar',
]) {
  assert.match(lab, new RegExp(name), `missing lab ${name}`)
}
const uiLab = read('src/features/settings/screens/ModulaUiLabScreen.tsx')
assert.match(uiLab, /PvpUi1LabBlocks/)
assert.doesNotMatch(uiLab, /create another UI Lab/i)
const experiments = read('src/platform/ui/dev/pvp-native-experiments.tsx')
assert.match(experiments, /ADAPT/)
assert.match(experiments, /DEFER/)
assert.match(experiments, /NativeTabs/)
const route = read('src/app/settings/developer/pvp-native-experiments.tsx')
assert.match(route, /canAccessDeveloperLabs/)
console.log('UI LAB                         PASS')

section('Architecture')
assert.doesNotMatch(hub, /@expo\/ui\/swift-ui/)
assert.doesNotMatch(hub, /@expo\/ui\/jetpack-compose/)
assert.doesNotMatch(hero, /@expo\/ui\/swift-ui/)
assert.doesNotMatch(action, /from '@expo\/ui/)
console.log('NO SECOND UI SYSTEM            PASS')

console.log('\nPVP-UI-1 presentation          PASS')
