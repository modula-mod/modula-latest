#!/usr/bin/env node
/**
 * Phase 7M-B6 verifier — Product Hub reconstruction, reachable install, sheets.
 * Source/structure gates always run. Does not deploy. Does not start 7M-C.
 */
import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'

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

console.log('Phase 7M-B6 verifier\n')
console.log('# Product Hub structure')

assertExists('src/features/modules/components/presentation/ModuleEditorialHero.tsx', 'EDITORIAL HERO')
assertExists('src/features/modules/components/presentation/ModuleRow.tsx', 'MODULE ROW')
assertExists('src/features/modules/components/presentation/ModuleShelf.tsx', 'MODULE SHELF')
assertExists('src/features/modules/components/presentation/ModuleCollection.tsx', 'COLLECTIONS')
assertExists('src/features/modules/components/presentation/ModuleCategoryTile.tsx', 'CATEGORY TILE')
assertExists('src/features/modules/components/presentation/ModulePreview.tsx', 'MODULE PREVIEW')
assertExists('src/features/modules/components/presentation/ModuleAction.tsx', 'MODULE ACTION')
assertContains('src/features/modules/screens/ProductHubMarketplaceScreen.tsx', 'FEATURED', 'PRODUCT HUB STRUCTURE')
assertContains('src/features/modules/screens/ProductHubMarketplaceScreen.tsx', 'New for Modula', 'EDITORIAL LANDING')
assertContains('src/features/modules/screens/ProductHubMarketplaceScreen.tsx', 'Your modules', 'YOUR MODULES')
assertAbsent('src/features/modules/screens/ProductHubMarketplaceScreen.tsx', 'Installed 0', 'NO REGISTRY STATS')
assertAbsent('src/features/modules/screens/ProductHubMarketplaceScreen.tsx', 'Discover | Installed', 'NO SEGMENT CONTROL')

console.log('\n# Search')
assertExists('src/features/modules/state/productHubSearchMachine.ts', 'SEARCH MACHINE')
assertContains('src/features/modules/state/productHubSearchMachine.ts', 'IDLE_LARGE_HEADER', 'SEARCH TRIGGER')
assertContains('src/features/modules/state/productHubSearchMachine.ts', 'SEARCH_EXPANDING', 'SEARCH MORPH')
assertContains('src/features/modules/state/productHubSearchMachine.ts', 'SEARCH_ACTIVE', 'SEARCH ACTIVE')
assertContains('src/features/modules/state/productHubSearchMachine.ts', 'SEARCH_RESULTS', 'SEARCH RESULTS')
assertContains('src/features/modules/components/ProductHubSearchChrome.tsx', 'product-hub-search-input', 'WEB SEARCH')
assertContains('src/features/modules/screens/ProductHubMarketplaceScreen.tsx', 'install=1', 'HUB INSTALL OPENS SHEET')
assertAbsent('src/features/modules/screens/ProductHubMarketplaceScreen.tsx', 'contentOffset={{', 'NO SCROLL OFFSET BINDING')
assertContains('src/features/modules/components/presentation/ModuleAction.tsx', 'AppPressable', 'RN INSTALL CTA')
assertContains('src/platform/ui/sheets/modula-sheet.native.tsx', '<Modal', 'STRUCTURED SHEET MODAL')
assertContains('src/features/modules/components/ModuleArtwork.tsx', "variant === 'scene'", 'HERO SCENE ART')

console.log('\n# Module detail + sticky install')
assertContains('src/features/marketplace/screens/ModuleDetailScreen.tsx', 'module-sticky-install', 'STICKY INSTALL')
assertContains('src/features/marketplace/screens/ModuleDetailScreen.tsx', 'module-hero-install', 'MODULE DETAIL')
assertContains('src/features/marketplace/screens/ModuleDetailScreen.tsx', 'Trust & Technical Details', 'TRUST SECONDARY')
assertContains('src/features/modules/identity/productCopy.ts', 'Private notes and knowledge, built into Modula.', 'PRODUCT COPY')
assertAbsent('src/features/marketplace/screens/ModuleDetailScreen.tsx', 'First-party Greenfield module', 'NO GREENFIELD PRIMARY COPY')

console.log('\n# Install sheet')
assertContains('src/platform/ui/sheets/modula-sheet-layout.tsx', 'fixed above safe area', 'FIXED ACTION FOOTER')
assertContains('src/features/modules/components/InstallPreviewSheet.tsx', 'footer={footer}', 'INSTALL SHEET')
assertContains('src/features/modules/components/InstallPreviewSheet.tsx', 'module-install-confirm', 'INSTALL CTA REACHABLE')
assertContains('src/features/modules/identity/permissionPresentation.ts', 'complexity', 'LONG PERMISSIONS')
assertContains('src/features/modules/identity/permissionPresentation.ts', 'technical', 'TECHNICAL SPLIT')
assertContains('src/platform/ui/sheets/modula-sheet.native.tsx', 'setShellChromeHoldObscure', 'SHEET OBSCURES NAV')
assertContains('src/platform/ui/sheets/modula-sheet.web.tsx', 'accessibilityViewIsModal', 'SHEET A11Y')

console.log('\n# Drawers / layers')
assertExists('src/theme/tokens/layers.ts', 'ELEVATION LAYERS')
assertContains('src/theme/tokens/layers.ts', 'sheet:', 'LAYER SHEET')
assertExists('src/features/modules/identity/overlayClassification.ts', 'OVERLAY CLASSIFICATION')
assertContains('src/features/modules/identity/overlayClassification.ts', "composerTools: 'SHEET'", 'COMPOSER IS SHEET')
assertContains('src/shell/NavigationDrawer.tsx', 'GestureDetector', 'DRAWER GESTURES')
assertContains('src/components/composer/ComposerToolsDrawer.tsx', 'footer=', 'COMPOSER TOOLS FOOTER')

console.log('\n# Vault Notes candidate + generic host')
assertContains('src/features/modules/identity/moduleArtwork.ts', "'digital.modula.vault-notes'", 'VAULT NOTES 1.1 CANDIDATE')
assertContains('src/platform/ui/dev/modula-primitives-lab.tsx', "latestVersion: '1.1.0'", 'CANDIDATE VERSION')
assertAbsent('src/features/modules/runtime/module-host.tsx', 'vault-notes', 'GENERIC MODULE HOST')
assertExists('src/features/modules/runtime/module-action-bar.tsx', 'MODULE ACTION BAR')
assertContains('src/features/modules/runtime/module-empty-state.tsx', 'primaryAction', 'GENERIC EMPTY STATE')
assertContains('src/features/modules/runtime/module-error-boundary.tsx', 'Couldn’t open this module', 'USER FACING ERRORS')

console.log('\n# Presentation tests')
const test = spawnSync(process.execPath, ['scripts/phase7m-b6-presentation.test.mjs'], {
  cwd: root,
  stdio: 'inherit',
})
record('PRESENTATION LIFECYCLE', test.status === 0, test.status === 0 ? '' : `exit ${test.status}`)

console.log('\n# Docs / evidence')
assertExists('docs/design/phase7m-b6-direction-m.md', 'B6 DIRECTION DOC')
assertExists('docs/research/phase7m-b6-app-store-composition.md', 'APP STORE COMPOSITION')
assertExists('docs/research/phase7m-b6-overlay-classification.md', 'OVERLAY AUDIT')
assertExists('docs/validation/phase7m-b6-cutover-rehearsal.md', 'CUTOVER REHEARSAL')
assertExists('docs/validation/phase7m-b6-evidence.md', 'EVIDENCE INDEX')
assertContains('docs/validation/phase7m-b6-cutover-rehearsal.md', 'PRODUCTION DEPLOYED = NO', 'NO PRODUCTION DEPLOY')
assertContains('docs/validation/phase7m-b6-cutover-rehearsal.md', '7M-C STARTED = NO', '7M-C NOT STARTED')

console.log('\n# Chrome consistency')
assertContains('docs/design/phase7m-b6-direction-m.md', 'One chrome layer', 'CHROME LAYER RULE')
assertContains('src/platform/ui/navigation/home-stack-header.tsx', 'chrome="plain"', 'HEADER PLAIN GLYPHS')
assertContains('src/platform/ui/navigation/profile-stack-header.tsx', 'chrome="plain"', 'PROFILE HEADER PLAIN')
assertAbsent('src/features/profile/components/ProfileHero.tsx', 'identitySheet', 'NO IDENTITY SHEET')
assertAbsent('src/features/profile/screens/CustomizeProfileScreen.tsx', 'MoveButton', 'NO REORDER CIRCLES')
assertAbsent('src/features/profile/components/ProfileModuleCard.tsx', 'ModulaControlGroup', 'NO MODULE CONTROL GROUP')
assertAbsent('src/features/marketplace/screens/ModuleDetailScreen.tsx', 'fullWidth', 'NO BRICK MODULE CTAS')

if (failures.length) {
  console.log(`\nFAILED ${failures.length}`)
  for (const item of failures) console.log(` - ${item}`)
  process.exit(1)
}

console.log('\nPHASE 7M-B6                     PASS')
console.log('PRODUCTION DEPLOYED            NO')
console.log('7M-C                           NOT STARTED')
