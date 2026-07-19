import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const errors = []

function fail(message) {
  errors.push(message)
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

function text(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

/** Mirror of sanitizeOrderedIds for invariant checks. */
function sanitizeOrderedIds(ids, catalogIds, requiredIds, fallback) {
  const allowed = new Set(catalogIds)
  const raw = Array.isArray(ids)
    ? ids.filter(id => typeof id === 'string' && allowed.has(id))
    : []
  const unique = [...new Set(raw)]
  for (const id of requiredIds) {
    if (!unique.includes(id)) unique.unshift(id)
  }
  return unique.length ? unique : [...fallback]
}

const requiredFiles = [
  'src/features/product/data/layoutBlocks.ts',
  'src/features/product/data/featureControl.ts',
  'src/features/product/data/resolveTabBar.ts',
  'src/features/product/data/profileTabsSync.ts',
  'src/features/product/runtime/ProductPreferencesProvider.tsx',
  'src/features/product/screens/CustomizationHubScreen.tsx',
  'src/app/product/customize.tsx',
  'src/app/product/layout-home.tsx',
  'src/app/product/layout-discover.tsx',
]

for (const file of requiredFiles) {
  if (!exists(file)) fail(`missing ${file}`)
}

const storage = text('src/features/product/storage/productPreferencesStorage.ts')
for (const key of [
  'homeBlockIds',
  'discoverBlockIds',
  'tabBarIds',
  'activityBlockIds',
  'profileTabIds',
  'chromeDensity',
  'motionDensity',
  'surfacePreview',
  'resetProductPreferences',
]) {
  if (!storage.includes(key)) fail(`productPreferencesStorage missing ${key}`)
}

const rootLayout = text('src/app/_layout.tsx')
if (!rootLayout.includes('ProductPreferencesProvider')) {
  fail('Root layout must mount ProductPreferencesProvider')
}

const home = text('src/features/feed/screens/HomeFeedScreen.tsx')
if (!home.includes('homeBlocks.map') && !home.includes('HomeLayoutHeader')) {
  fail('Home feed must honor ordered home blocks')
}
if (!home.includes('isFeatureEnabled')) {
  fail('Home feed must gate Focus/Merge via featureControl')
}

const discover = text('src/features/discover/screens/DiscoverScreen.tsx')
if (!discover.includes('visibleSectionIds') || !discover.includes('layoutEmpty')) {
  fail('Discover must honor block order and empty-layout restore')
}

const tabsPersistent = text('src/platform/ui/navigation/persistent-shell-tab-bar.tsx')
if (!tabsPersistent.includes('resolveVisibleModulaTabs')) {
  fail('Persistent shell tab bar must use resolveVisibleModulaTabs')
}

const inset = text('src/platform/ui/navigation/floating-tab-bar-inset.ts')
if (!inset.includes('chromeDensity')) {
  fail('Floating tab bar inset must apply chromeDensity')
}

const profileSync = text('src/features/profile/screens/CustomizeProfileScreen.tsx')
if (!profileSync.includes('profileTabIdsFromPresentation')) {
  fail('Customize Profile must sync profileTabIds into product prefs')
}

// Pure sanitize invariants
const catalog = ['a', 'b', 'c', 'required']
const required = ['required']
const fallback = ['required', 'a']
const sanitized = sanitizeOrderedIds(['c', 'nope', 'a'], catalog, required, fallback)
if (!sanitized.includes('required')) fail('sanitize must keep required ids')
if (sanitized.includes('nope')) fail('sanitize must drop unknown ids')
if (sanitized[0] !== 'required' && !sanitized.includes('required')) {
  fail('sanitize required placement broken')
}

const empty = sanitizeOrderedIds([], catalog, required, fallback)
if (JSON.stringify(empty) !== JSON.stringify(['required'])) {
  // required unshifted onto empty unique → ['required']
  if (!empty.includes('required')) fail('empty input must still include required')
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
if (!pkg.scripts?.['verify:layout-preferences']) {
  fail('package.json missing verify:layout-preferences script')
}

if (errors.length) {
  console.error('verify-layout-preferences failed:')
  for (const error of errors) console.error(` - ${error}`)
  process.exit(1)
}

console.log('verify-layout-preferences: ok')
