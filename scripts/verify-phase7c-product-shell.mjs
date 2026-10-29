#!/usr/bin/env node
import {
  check,
  finish,
  includes,
  maybeSh,
  read,
} from './phase7c-verifier-utils.mjs'

const tabs = read('src/platform/ui/navigation/modula-tabs.ts')
for (const id of ['home', 'discover', 'create', 'activity', 'profile']) {
  check(`canonical tab missing ${id}`, tabs.includes(`id: '${id}'`))
}
check('Board must not be a canonical root tab', !tabs.includes("id: 'board'"))
check('Create tab route missing', tabs.includes("routeName: 'create'"))

includes('src/features/product/data/layoutBlocks.ts', [
  "id: 'create'",
  "required: true",
  'DEFAULT_TAB_BAR_IDS',
], 'layout tab catalogue')

includes('src/features/product/storage/productPreferencesStorage.ts', [
  'LAYOUT_SCHEMA_VERSION = 3',
  'Home/Discover/Create/Activity/Profile',
], 'product preference migration')

includes('src/features/product/data/resolveTabBar.ts', [
  'REQUIRED_ROOT_TAB_IDS',
  "'create'",
  'REQUIRED_ROOT_TAB_IDS.includes(tabId)',
], 'tab resolver')

includes('src/platform/ui/navigation/platform-tabs.web.tsx', [
  "create: 'create'",
  "label: 'Board'",
  'MORE',
], 'web tab rail')

includes('src/shell/NavigationDrawer.tsx', [
  "label: 'Board'",
  "label: 'Product Hub'",
  "label: 'Saved'",
  "label: 'Profile preview'",
  "label: 'Appearance'",
  "label: 'Settings'",
  'Sign out',
], 'drawer contents')

includes('docs/architecture/adr/ADR-014-modula-root-navigation.md', [
  'Home',
  'Discover',
  'Create',
  'Activity',
  'Profile',
  'Candidate B',
], 'ADR-014')

const directPlatformImports = maybeSh([
  'rg',
  '-n',
  '@expo/ui/(swift-ui|jetpack-compose)',
  'src',
  '--glob',
  '!src/platform/**',
])
check(`feature-level direct Expo UI import:\n${directPlatformImports}`, !directPlatformImports)

finish('Phase 7C product shell verification')
