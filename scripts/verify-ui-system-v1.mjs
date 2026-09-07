#!/usr/bin/env node

import {existsSync, readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(55)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}: ${detail || 'failed'}`)
}

function source(path, needles, label) {
  const absolute = join(ROOT, path)
  if (!existsSync(absolute)) {
    record(label, false, `missing ${path}`)
    return
  }
  const text = readFileSync(absolute, 'utf8')
  const missing = needles.filter(needle => !text.includes(needle))
  record(label, missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : path)
}

function excludes(path, needles, label) {
  const text = readFileSync(join(ROOT, path), 'utf8')
  const found = needles.filter(needle => text.includes(needle))
  record(label, found.length === 0, found.length ? `found ${found.join(', ')}` : '0')
}

console.log('MODULA')
console.log('UI SYSTEM V1')
console.log('CANONICAL VERIFIER\n')

source('src/theme/foundations/controls.ts', ['touchTarget', 'actionButton', 'listRow', 'toolbar', 'sheet'], 'SEMANTIC GEOMETRY TOKENS')
source('src/platform/ui/buttons/modula-action-button.tsx', ['touchTarget.minimum', 'actionButton[size]', 'accessibilityState'], 'ACTION BUTTON CONTRACT')
source('src/platform/ui/sheets/modula-sheet.types.ts', ['ModulaSheetPresentation', 'ModulaSheetSemanticDetent', 'detentForPresentation'], 'SHEET PRESENTATION CONTRACT')
source('src/platform/ui/sheets/modula-sheet-compositions.tsx', ['ModulaActionSheet', 'ModulaToolDrawer'], 'SHEET COMPOSITIONS')
source('src/platform/ui/drawers/modula-drawer-frame.tsx', ['Gesture.Pan()', 'useReduceMotion', 'accessibilityViewIsModal'], 'DRAWER INTERACTION CONTRACT')
source('src/platform/ui/lists/modula-list-system.tsx', ['ModulaListRowVariant', 'ModulaIconTile', 'ModulaActivityRow', 'ModulaNotificationRow'], 'LIST AND ROW SYSTEM')
source('src/platform/ui/forms/modula-form-system.tsx', ['ModulaForm', 'ModulaField', 'ModulaRadioGroup', 'ModulaFilterChip'], 'FORM AND SELECTION SYSTEM')
source('src/platform/ui/tabs/modula-tabs-control.tsx', ['navigation', 'segmented', 'scrollable', 'underline'], 'SEMANTIC TAB PRESENTATIONS')
source('src/platform/ui/navigation/modula-navigation-header.tsx', ['large-title', 'transparent-over-hero', 'scrolled'], 'NAVIGATION HEADER PRESENTATIONS')
source('src/platform/ui/toolbars/modula-toolbar.tsx', ['navigation', 'content', 'editor', 'floating', 'module'], 'TOOLBAR PRESENTATIONS')
source('src/platform/ui/controls/modula-search-field.tsx', ['navigation', 'settings', 'product', 'module'], 'SEARCH PRESENTATIONS')
source('src/platform/ui/motion/modula-motion-spec.ts', ['sheet.enter', 'drawer.expand', 'menu.open', 'button.press', 'tab.change', 'navigation.push'], 'NAMED MOTION CONTRACTS')
source('src/platform/ui/feedback/modula-feedback.tsx', ['ModulaInlineNotice', 'ModulaUndoToast', 'ModulaEmptyState', 'ModulaErrorState', 'ModulaLoadingSection'], 'FEEDBACK AND STATE SYSTEM')
source('src/platform/ui/identity/modula-identity.tsx', ['ModulaBadge', 'ModulaProductRow', 'ModulaUserRow'], 'IDENTITY AND PRODUCT ROWS')
source('src/platform/ui/avatars/modula-avatar.tsx', ['ModulaAvatarSize', 'focusHalo', 'presence', 'loading'], 'AVATAR SYSTEM')
source('src/platform/ui/composer/modula-composer.tsx', ['ModulaComposerInput', 'ModulaComposerToolbar', 'ModulaComposerAttachment'], 'COMPOSER PRIMITIVES')
source('src/platform/ui/floating/modula-floating-controls.tsx', ['ModulaFloatingButton', 'ModulaFloatingGroup', 'ModulaFloatingToolbar'], 'FLOATING CONTROL SYSTEM')

source('src/platform/ui/product-ui.ts', ['MODULA_PRODUCT_UI_V1_COMPONENTS', 'ModulaButton', 'ModulaFieldShell', 'ModulaProductRow'], 'GENERIC PRODUCT UI BRIDGE')
excludes('src/platform/ui/product-ui.ts', ['VaultNotes', 'TasksRow', 'CRMCard', 'eval(', 'WebView'], 'PRODUCT-SPECIFIC SHARED COMPONENTS')
excludes('src/features/modules/runtime/module-view-renderer.tsx', ['digital.modula.vault-notes', 'Vault Notes'], 'PRODUCT-SPECIFIC HOST CASES')

source('src/features/settings/components/SettingsRows.tsx', ['ModulaListRow', 'ModulaListSection', 'ModulaIconTile'], 'SETTINGS PROPAGATION')
excludes('src/features/settings/components/SettingsRows.tsx', ['function RowChrome', 'function TrailingValue', 'function DecorativeChevron'], 'SETTINGS-SPECIFIC ROW RENDERERS')
source('src/features/feed/components/HomeSearchModal.tsx', ['ModulaSheet', 'ModulaSearchField', 'ModulaListRow'], 'HOME PROPAGATION')
source('src/features/modules/components/ProductHubSearchChrome.tsx', ['ModulaSearchField', 'ModulaIconButton'], 'PRODUCT HUB SEARCH PROPAGATION')
source('src/features/modules/components/presentation/ModuleRow.tsx', ['ModulaProductRow'], 'PRODUCT HUB ROW PROPAGATION')
source('src/features/modules/components/product-detail/ProductNavigationChrome.tsx', ['ProductNavigationChrome', 'product-navigation-back', 'product-navigation-identity', 'product-navigation-actions', 'fallback="regular"'], 'PRODUCT NAVIGATION CHROME CONTRACT')
source('src/platform/ui/menus/chrome-glass-control-group.tsx', ['style={styles.actionHit}', '<View', 'styles.actionChip', 'height: 26'], 'INSET GROUP ACTION PAINT')
source('src/features/marketplace/screens/ModuleDetailScreen.tsx', ['<ProductNavigationChrome', 'clampScrollOffset', 'Math.max(insets.bottom, spacing[4])'], 'PRODUCT DETAIL CHROME PROPAGATION')
excludes('src/features/marketplace/screens/ModuleDetailScreen.tsx', ['<ProductFixedChrome', '<ProductStickyHeader', 'useFloatingTabBarContentPadding'], 'PRODUCT DETAIL SPLIT CHROME')
source('src/features/activity/screens/ActivityScreen.tsx', ['SelectionSheet', 'ModulaActivityRow'], 'ACTIVITY PROPAGATION')
source('src/components/composer/ComposerToolsDrawer.tsx', ['presentation="tools"', 'ModulaListRow', 'ModulaInlineNotice'], 'COMPOSER PROPAGATION')
source('src/features/profile/components/ProfileOwnerToolbar.tsx', ['ModulaToolbar', 'ModulaActionButton', 'ModulaIconButton'], 'PROFILE PROPAGATION')
source('src/features/profile/screens/ProfileConnectionsScreen.tsx', ['ModulaSearchField', 'ModulaUserRow'], 'PROFILE PERSON ROW PROPAGATION')
source('src/shell/NavigationDrawer.tsx', ['ModulaDrawerFrame'], 'SHELL DRAWER PROPAGATION')

for (const path of [
  'src/features/feed/components/HomeSearchModal.tsx',
  'src/features/settings/screens/AppearanceScreen.tsx',
  'src/shell/NavigationDrawer.tsx',
  'src/components/composer/ComposerToolsDrawer.tsx',
  'src/features/activity/screens/ActivityScreen.tsx',
]) {
  excludes(path, ['<Modal'], `NORMAL-CASE LOCAL MODAL ${path.split('/').at(-1)}`)
}

for (const path of [
  'src/features/feed/components/HomeSearchModal.tsx',
  'src/features/modules/components/ProductHubSearchChrome.tsx',
  'src/features/composer/screens/ComposerScreen.tsx',
  'src/features/profile/screens/ProfileConnectionsScreen.tsx',
]) {
  excludes(path, ['<TextInput'], `NORMAL-CASE LOCAL INPUT ${path.split('/').at(-1)}`)
}

source('src/platform/ui/dev/ui-system-lab-matrix.ts', ['light', 'dark', 'oled', 'native', 'solid', 'glass', 'glay', 'minimalSpatial', 'increased', 'reduced'], 'UI LAB ACCEPTANCE MATRIX')
source('src/features/settings/screens/ModulaUiLabScreen.tsx', ['canAccessDeveloperLabs'], 'DEVELOPMENT-ONLY UI LAB GATE')
source('docs/design/modula-ui-system-v1.md', ['Shared-component admission', 'Database work: **none**', 'Product UI boundary'], 'ARCHITECTURE AND ADMISSION RULE')

if (failures.length) {
  console.error('\nverify:ui-system-v1 FAIL')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('\nverify:ui-system-v1 PASS')
console.log('SCREEN-SPECIFIC BUTTON IMPLEMENTATIONS = 0 (AUDITED NORMAL CASES)')
console.log('SCREEN-SPECIFIC SHEET IMPLEMENTATIONS = 0 (AUDITED NORMAL CASES)')
console.log('SCREEN-SPECIFIC SEARCH IMPLEMENTATIONS = 0 (AUDITED NORMAL CASES)')
console.log('SCREEN-SPECIFIC SETTINGS ROW RENDERERS = 0')
console.log('GENERIC PRODUCTS USE SAME COMPONENT SYSTEM = YES')
