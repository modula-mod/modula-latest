#!/usr/bin/env node
/**
 * Phase 7M-B6 presentation lifecycle tests.
 * Covers search state machine, permission grouping, and install CTA reachability invariants.
 */
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function section(title) {
  console.log(`\n# ${title}`)
}

section('Search state machine')
const machine = read('src/features/modules/state/productHubSearchMachine.ts')
for (const state of [
  'IDLE_LARGE_HEADER',
  'COMPACT_HEADER',
  'SEARCH_TRIGGER',
  'SEARCH_EXPANDING',
  'SEARCH_ACTIVE',
  'SEARCH_RESULTS',
  'SEARCH_COLLAPSING',
]) {
  assert.match(machine, new RegExp(state), `missing ${state}`)
}
assert.match(machine, /TAP_SEARCH/)
assert.match(machine, /GEOMETRY_SETTLED/)
assert.match(machine, /CANCEL/)
console.log('SEARCH MACHINE                 PASS')

section('Permission presentation')
const permissions = read('src/features/modules/identity/permissionPresentation.ts')
assert.match(permissions, /YOUR DATA/)
assert.match(permissions, /MODULA INTEGRATION/)
assert.match(permissions, /technical/)
assert.match(permissions, /complexity/)
assert.match(permissions, /Register |schema|route|function/)
console.log('PERMISSION GROUPS              PASS')

section('Install sheet CTA invariant')
const sheet = read('src/features/modules/components/InstallPreviewSheet.tsx')
assert.match(sheet, /footer=\{footer\}/)
assert.match(sheet, /Install \$\{copy\.name\}/)
assert.match(sheet, /module-install-confirm/)
assert.match(sheet, /Technical permissions/)
assert.doesNotMatch(
  sheet,
  /<ScrollView[\s\S]*Install \$\{copy\.name\}/,
  'Install CTA must not live inside a ScrollView',
)
const layout = read('src/platform/ui/sheets/modula-sheet-layout.tsx')
assert.match(layout, /HEADER/)
assert.match(layout, /FOOTER/)
assert.match(layout, /testID \? `\$\{testID\}-footer`/)
const nativeSheet = read('src/platform/ui/sheets/modula-sheet.native.tsx')
assert.match(nativeSheet, /<Modal/)
assert.match(nativeSheet, /structured/)
const sheetTypes = read('src/platform/ui/sheets/modula-sheet.types.ts')
assert.match(sheetTypes, /nativeSnapPoints/)
assert.match(sheetTypes, /detent === 'full' \|\| detent === 'large'/)
assert.doesNotMatch(sheetTypes, /fraction: 0\.92/)
console.log('INSTALL CTA REACHABLE          PASS')

section('Install press reliability')
const action = read('src/features/modules/components/presentation/ModuleAction.tsx')
assert.match(action, /AppPressable/)
assert.doesNotMatch(action, /from '@\/platform\/ui\/buttons\/modula-button'/)
assert.doesNotMatch(action, /from '@expo\/ui'/)
const row = read('src/features/modules/components/presentation/ModuleRow.tsx')
assert.match(row, /onAction \?\? onPress/)
assert.match(row, /styles.identity/)
const hero = read('src/features/modules/components/presentation/ModuleEditorialHero.tsx')
assert.match(hero, /onAction \?\? onPress/)
assert.match(hero, /variant="scene"/)
const hub = read('src/features/modules/screens/ProductHubMarketplaceScreen.tsx')
assert.match(hub, /install=1/)
assert.doesNotMatch(hub, /contentOffset=\{\{/)
const detail = read('src/features/marketplace/screens/ModuleDetailScreen.tsx')
assert.match(detail, /install === '1'/)
assert.match(detail, /setInstallSheetOpen\(true\)/)
assert.doesNotMatch(detail, /setBusy\('review'\)/)
console.log('INSTALL PRESS RELIABLE         PASS')

section('Hub motion and artwork')
const artwork = read('src/features/modules/components/ModuleArtwork.tsx')
assert.match(artwork, /variant === 'scene'/)
assert.match(artwork, /ArtworkScene/)
const preview = read('src/features/modules/components/presentation/ModulePreview.tsx')
assert.match(preview, /PreviewMock/)
assert.doesNotMatch(preview, /<ModuleArtwork/)
assert.match(hub, /SectionEnter/)
assert.match(machine, /if \(model.compact === event.compact\) return model/)
console.log('HUB VISUAL ENRICHMENT          PASS')

section('Product copy')
const copy = read('src/features/modules/identity/productCopy.ts')
assert.match(copy, /Private notes and knowledge, built into Modula/)
assert.doesNotMatch(copy, /First-party Greenfield module/)
console.log('PRODUCT COPY                   PASS')

section('Install presentation verbs')
const install = read('src/features/modules/identity/installPresentation.ts')
assert.match(install, /'Update'/)
assert.match(install, /'Soon'/)
assert.doesNotMatch(install, /primaryAction: 'Coming soon'/)
console.log('MODULE STATES                  PASS')

section('Generic host')
const host = read('src/features/modules/runtime/module-host.tsx')
assert.doesNotMatch(host, /digital\.modula\.vault-notes/)
assert.doesNotMatch(host, /if \(moduleId === /)
console.log('VAULT SPECIAL CASES            PASS')

section('Profile metrics')
const metrics = read('src/features/profile/model/profile-metrics.ts')
assert.match(metrics, /posts/)
assert.match(metrics, /followers/)
assert.match(metrics, /following/)
assert.match(metrics, /modules/)
assert.doesNotMatch(metrics, /monthly growth/)
assert.doesNotMatch(metrics, /profile reach/)
const picker = read('src/features/profile/components/ProfileMetricPicker.tsx')
assert.match(picker, /accessibilityRole="adjustable"/)
assert.match(picker, /onActivateMetric/)
assert.match(picker, /useReduceMotion/)
assert.match(picker, /NEIGHBOR_OPACITY = 0.34/)
assert.match(picker, /NEIGHBOR_SCALE/)
assert.doesNotMatch(picker, /InvertedSelectedSurface/)
assert.doesNotMatch(picker, /selectedSurface/)
assert.doesNotMatch(picker, /surfaceMuted/)
const customizer = read('src/features/profile/components/ProfileMetricCustomizer.tsx')
assert.match(customizer, /Profile Metrics/)
assert.match(customizer, /Pick up to 5/)
assert.match(customizer, /Move up/)
assert.match(customizer, /Default Metric/)
assert.match(customizer, /handleBar/)
const presentation = read('src/features/profile/storage/validateProfilePresentation.ts')
assert.match(presentation, /hiddenMetricIds/)
assert.match(presentation, /orderedMetricIds/)
assert.match(presentation, /defaultMetricId/)
const geometry = read('src/platform/ui/geometry/inverted-surface-transition.tsx')
assert.match(geometry, /pointerEvents="none"/)
assert.doesNotMatch(geometry, /@expo\/ui\/swift-ui/)
const lip = read('src/platform/ui/geometry/inverted-corner-path.ts')
assert.match(lip, /buildCoverCanvasLipPath/)
assert.match(lip, /buildAvatarCradlePath/)
assert.match(lip, /buildAvatarCradleRisePath/)
assert.match(lip, /A\(r, riseX, cy, 0\)/)
assert.match(lip, /A\(plateau, riseX \+ plateau, plateauY\)/)
assert.doesNotMatch(read('src/features/profile/components/ProfileCover.tsx'), /cornerRadius=\{0\}/)
assert.match(read('src/features/profile/components/ProfileCover.tsx'), /cradleRadius/)
assert.match(read('src/features/profile/components/ProfileCover.tsx'), /avatarCenterY/)
assert.match(read('src/features/profile/components/ProfileCover.tsx'), /raisedSide="trailing"/)
assert.match(read('src/features/profile/components/ProfileCover.tsx'), /marginTop: -insets\.top/)
assert.match(read('src/features/profile/model/profile-layout.ts'), /coverHeadroomCompact: 140/)
assert.match(read('src/features/profile/components/ProfileHero.tsx'), /avatarLeft/)
assert.match(read('src/features/profile/components/ProfileHero.tsx'), /plateauDepth/)
assert.match(read('src/features/profile/model/profile-layout.ts'), /avatarFit: 0\.95/)
assert.match(read('src/features/profile/model/profile-layout.ts'), /avatarDrop: 72/)
assert.match(read('src/features/profile/model/profile-layout.ts'), /identityDrop: 55/)
assert.doesNotMatch(
  read('src/features/profile/model/profile-layout.ts'),
  /identityColumnPad: PROFILE_LAYOUT\.cradleGap \+ plateauRadius \+ 12/,
)
assert.match(read('src/features/profile/components/ProfileHero.tsx'), /metricColumnTop/)
assert.match(read('src/features/profile/components/ProfileMetricPicker.tsx'), /styles.rail/)
const morph = read('src/features/profile/components/ProfileHeaderTitle.tsx')
assert.match(morph, /LiquidGlassChrome/)
assert.match(morph, /@\{profile\.handle\}/)
assert.match(morph, /importantForAccessibility="no-hide-descendants"/)
assert.match(read('src/features/profile/components/ProfileShell.tsx'), /ProfileHeaderTitle/)
assert.match(read('src/features/profile/model/profile-layout.ts'), /profileGeometry/)
assert.match(read('src/features/profile/components/ProfileMetadataGrid.tsx'), /profile-metadata-grid/)
assert.doesNotMatch(read('src/features/profile/components/ProfileIdentity.tsx'), /ProfileVisibilityBadge/)
assert.match(read('src/platform/ui/menus/chrome-glass-control-group.native.tsx'), /LiquidGlassChrome/)
assert.doesNotMatch(read('src/platform/ui/menus/chrome-glass-control-group.native.tsx'), /#F7F7F8/)
assert.match(read('src/features/profile/components/ProfileShell.tsx'), /stickyHeaderIndices=\{\[1\]\}/)
assert.match(read('src/features/profile/components/ProfileShell.tsx'), /insetTop/)
assert.match(read('src/platform/ui/navigation/profile-stack-header.tsx'), /accessibilityLabel: 'Edit Profile'/)
assert.doesNotMatch(read('src/features/profile/components/ProfileActions.tsx'), /Edit Profile/)
console.log('PROFILE METRICS                PASS')

console.log('\nphase7m-b6 presentation tests passed')
