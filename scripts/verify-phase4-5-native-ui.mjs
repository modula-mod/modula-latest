import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const errors = []

function rel(file) {
  return path.relative(root, file)
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

function text(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
}

function fail(message) {
  errors.push(message)
}

function walk(dir) {
  const absolute = path.join(root, dir)
  if (!fs.existsSync(absolute)) return []
  return fs.readdirSync(absolute, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(absolute, entry.name)
    const relative = rel(full)
    if (entry.isDirectory()) return walk(relative)
    return [relative]
  })
}

const pkg = readJson('package.json')
const deps = {...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {})}

// 1
if (!deps['@expo/ui']) fail('1. @expo/ui is not installed')

// 2
const tabsNative = 'src/platform/ui/navigation/platform-tabs.native.tsx'
if (!exists(tabsNative) || !text(tabsNative).includes('NativeTabs')) {
  fail('2. NativeTabs is not used on native')
}

// 3
const tabsDef = 'src/platform/ui/navigation/modula-tabs.ts'
if (!exists(tabsDef) || !text(tabsDef).includes('ModulaTabDefinition')) {
  fail('3. Native tab definitions are not centralised')
}

const tabBody = exists(tabsDef) ? text(tabsDef) : ''
for (const [n, id] of [
  [4, 'home'],
  [5, 'discover'],
  [6, 'board'],
  [7, 'activity'],
  [8, 'profile'],
]) {
  if (!tabBody.includes(`'${id}'`) && !tabBody.includes(`"${id}"`)) {
    fail(`${n}. ${id} tab definition missing`)
  }
}

// 9 Create is not a tab
if (/id:\s*'create'|routeName:\s*'create'/.test(tabBody)) {
  fail('9. Create must not be a Modula tab definition')
}
if (exists(tabsNative) && !text(tabsNative).includes("name=\"create\" hidden")) {
  // hidden create trigger is OK; visible create is not
  if (/Trigger[^\n]*create(?![^\n]*hidden)/.test(text(tabsNative))) {
    fail('9. Create appears as a visible native tab')
  }
}

// 10 Compose available as action
const homeLayout = 'src/app/(tabs)/index/_layout.tsx'
const homeHeader = 'src/platform/ui/navigation/home-stack-header.tsx'
if (
  !(exists(homeLayout) && text(homeLayout).includes('HomeHeaderRight')) &&
  !(exists(homeHeader) && text(homeHeader).includes('/compose'))
) {
  fail('10. Compose toolbar action missing on Home')
}
if (!exists(homeHeader) || !text(homeHeader).includes('/compose')) {
  fail('10. Compose toolbar action missing on Home')
}

// 11 custom native bottom bar removed from tabs layout
const tabsLayout = text('src/app/(tabs)/_layout.tsx')
if (tabsLayout.includes('MainTabBar')) {
  fail('11. custom native bottom bar (MainTabBar) still wired in tabs layout')
}

// 12 web navigation remains
if (!exists('src/platform/ui/navigation/platform-tabs.web.tsx')) {
  fail('12. web navigation adapter missing')
}

// 13 floating developer gear removed from product routes
const productFiles = walk('src/features')
  .concat(walk('src/app'), walk('src/shell'))
  .filter(file => /\.(tsx|ts)$/.test(file))
for (const file of productFiles) {
  const body = text(file)
  if (
    /FloatingDeveloper|DeveloperGear|floating.*gear/i.test(body) ||
    (body.includes('MaterialFloatingControl') && !file.includes('materials/'))
  ) {
    fail(`13. floating developer gear remnant in ${file}`)
  }
}

// 14–18 account panel
if (!exists('src/platform/ui/navigation/adaptive-account-panel.tsx')) {
  fail('14. account panel adapter missing')
}
const panel = exists('src/platform/ui/navigation/adaptive-account-panel.tsx')
  ? text('src/platform/ui/navigation/adaptive-account-panel.tsx')
  : ''
if (!panel.includes('ModulaSheet')) {
  fail('15. iPhone account panel does not use ModulaSheet')
}
const panelCtx = exists('src/platform/ui/navigation/AccountPanelContext.tsx')
  ? text('src/platform/ui/navigation/AccountPanelContext.tsx')
  : ''
if (!panelCtx.includes('openAccountPanel') || !panelCtx.includes('closeAccountPanel')) {
  fail('16. panel actions must expose open/close')
}
if (/toggleAccountPanel/.test(panelCtx)) {
  fail('16. panel must not expose toggleAccountPanel')
}
if (!exists('src/platform/ui/navigation/account-panel-state.ts')) {
  fail('17. panel reducer missing')
}
if (!exists('scripts/test-account-panel-state.mjs')) {
  fail('18. panel transition tests missing')
} else {
  const result = spawnSync(process.execPath, ['scripts/test-account-panel-state.mjs'], {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    fail(`18. panel transition tests failed: ${result.stderr || result.stdout}`)
  }
}

// 19–21 headers
if (!exists(homeLayout) || !text(homeLayout).includes('nativeScreenHeaderOptions')) {
  fail('19. Home native header missing')
}
if (
  !exists('src/app/(tabs)/discover/_layout.tsx') ||
  !text('src/app/(tabs)/discover/_layout.tsx').includes('headerSearchBarOptions')
) {
  fail('20. Discover native search missing')
}
const profileHeader = 'src/platform/ui/navigation/profile-stack-header.tsx'
if (
  !exists('src/app/(tabs)/profile/_layout.tsx') ||
  !exists(profileHeader) ||
  !text(profileHeader).includes('Share profile')
) {
  fail('21. Profile native toolbar actions missing')
}

// 22–23 composer
if (!exists('src/features/composer/screens/ComposerScreen.tsx')) {
  fail('22. shared Composer editor missing')
}
const tools = text('src/components/composer/ComposerToolsDrawer.tsx')
if (!tools.includes('ModulaSheet')) {
  fail('23. Composer Tools must use ModulaSheet')
}

// 24–26 reels
const reels = text('src/features/reels/screens/ReelsScreen.tsx')
if (!reels.includes('mediaOverlay')) {
  fail('24. Reels must use media overlay tokens')
}
if (/colour:\s*['"]#000000['"]|color:\s*['"]#000000['"]/.test(reels) && reels.includes('rail')) {
  // allow screen bg black; reject black action rail icons hardcoded without tokens
}
if (/AppIcon[^\n]*colour=\{['"]#000/.test(reels)) {
  fail('25. black hardcoded action rail icon colour found')
}
if (/backgroundColor:\s*reel\.colour/.test(reels)) {
  fail('26. flat accent-only Reel fill still present')
}

// 27–30 profile
if (!exists('src/features/profile/editor/profile-cover-editor.tsx')) {
  fail('27. profile cover editor missing')
}
if (!exists('src/features/profile/editor/profile-avatar-editor.tsx')) {
  fail('28. avatar editor missing')
}
const identity = text('src/features/profile/components/ProfileIdentity.tsx')
if (identity.includes('visibleClaims') || identity.includes('IdentityIndicator')) {
  fail('29. identity claims still rendered in hero identity')
}
const tabBar = text('src/features/profile/components/ProfileTabBar.tsx')
if (tabBar.includes('radius.round') && tabBar.includes('backgroundColor: selected')) {
  fail('30. profile selected tab still uses giant pill styling')
}
if (!tabBar.includes('underline')) {
  fail('30. profile selected tab underline missing')
}

// 31 touch target
if (!exists('src/platform/ui/touch/touch-target.ts')) {
  fail('31. minimum touch-target contract missing')
}

// 32 automatic content insets
if (!text('src/features/feed/screens/HomeFeedScreen.tsx').includes('contentInsetAdjustmentBehavior')) {
  fail('32. automatic content insets not used on Home feed')
}

// 33–35 forbidden packages
for (const name of [
  'react-native-drawer-layout',
  '@react-navigation/drawer',
  'react-native-gesture-handler-drawer',
]) {
  if (deps[name]) fail(`33. third-party drawer package added: ${name}`)
}
for (const name of ['@gorhom/bottom-sheet', 'react-native-raw-bottom-sheet']) {
  if (deps[name]) fail(`34. third-party sheet package added: ${name}`)
}
for (const name of ['react-native-reanimated', 'react-native-worklets', 'react-native-worklets-core']) {
  if (Object.prototype.hasOwnProperty.call(pkg.dependencies ?? {}, name)) {
    fail(`35. new Reanimated/Worklets dependency exists: ${name}`)
  }
}

// 36 prior verifiers remain
for (const script of [
  'scripts/verify-phase1-shell.mjs',
  'scripts/verify-phase2-appearance.mjs',
  'scripts/verify-theme-contrast.mjs',
  'scripts/verify-phase3-profile.mjs',
  'scripts/verify-phase4-data-auth.mjs',
]) {
  if (!exists(script)) fail(`36. missing prior verifier: ${script}`)
}

// 37 no Phase 5
const phase5Hints = walk('docs')
  .concat(walk('src'), walk('scripts'))
  .filter(file => /phase5|phase-5/i.test(file))
if (phase5Hints.length) {
  fail(`37. Phase 5 files were introduced: ${phase5Hints.join(', ')}`)
}

if (errors.length) {
  console.error('Phase 4.5 native UI verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 4.5 native UI verification passed (37 checks).')
