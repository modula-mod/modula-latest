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

function readJson(file) {
  return JSON.parse(text(file))
}

function walk(dir) {
  const absolute = path.join(root, dir)
  if (!fs.existsSync(absolute)) return []
  return fs.readdirSync(absolute, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(absolute, entry.name)
    const relative = path.relative(root, full)
    if (entry.isDirectory()) return walk(relative)
    return [relative]
  })
}

const requiredFiles = [
  'src/theme/runtime/AppearanceProvider.tsx',
  'src/theme/runtime/resolveAppearance.ts',
  'src/theme/runtime/useAppearance.ts',
  'src/theme/runtime/useAppearanceActions.ts',
  'src/theme/runtime/useThemeTokens.ts',
  'src/theme/system/useSystemUISync.ts',
  'src/theme/storage/appearanceStorage.ts',
  'src/theme/accessibility/useSystemAccessibility.ts',
  'src/components/materials/MaterialSurface.tsx',
  'src/components/materials/BlurMaterialSurface.tsx',
  'src/components/materials/NativeMaterialSurface.tsx',
  'src/app/settings/index.tsx',
  'src/app/settings/appearance.tsx',
  'src/app/settings/accessibility.tsx',
  'src/app/settings/appearance-lab.tsx',
  'src/features/settings/screens/AppearanceScreen.tsx',
  'src/features/settings/screens/AccessibilityScreen.tsx',
  'src/features/settings/screens/AppearanceLabScreen.tsx',
]

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing required Phase 2 file: ${file}`)
}

if (exists('src/app/settings.tsx')) {
  fail('Settings route migration incomplete: src/app/settings.tsx still exists')
}

const contracts = text('src/theme/contracts/appearance.ts')
for (const mode of ['system', 'light', 'dim', 'dark', 'oled']) {
  if (!contracts.includes(`'${mode}'`)) fail(`Missing appearance mode: ${mode}`)
}
for (const family of ['standard', 'forest', 'ocean', 'plum', 'espresso', 'spaceGray']) {
  if (!contracts.includes(`'${family}'`)) fail(`Missing theme family: ${family}`)
}
for (const surface of [
  'native',
  'solid',
  'glass',
  'glay',
  'minimalSpatial',
  'skeuomorphic',
  'neomorphic',
]) {
  if (!contracts.includes(`'${surface}'`)) fail(`Missing Surface Type: ${surface}`)
}

const accents = readJson('src/theme/data/accents.json')
for (const accent of [
  'modulaTeal',
  'electricCyan',
  'vividViolet',
  'neonMint',
  'sunsetOrange',
  'crimsonFlash',
  'lemonSpark',
  'rosePetal',
]) {
  if (!accents[accent]) fail(`Missing accent preset: ${accent}`)
}

const storage = text('src/theme/storage/appearanceStorage.ts')
if (!storage.includes('modula.appearance.preferences.v1')) {
  fail('Appearance storage key is missing or not namespaced')
}
if (!contracts.includes('schemaVersion: 2')) {
  fail('Appearance schema version 2 is missing')
}
if (!contracts.includes('SystemAdaptivePreference')) {
  fail('SystemAdaptivePreference is missing from appearance contracts')
}

const config = text('app.config.ts')
if (!/updates:\s*{\s*enabled:\s*false\s*,?\s*}/s.test(config)) {
  fail('updates.enabled must remain false')
}

const pkg = readJson('package.json')
const deps = {...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {})}
for (const forbidden of ['react-native-worklets-core', '@react-native/worklets']) {
  if (Object.prototype.hasOwnProperty.call(deps, forbidden)) {
    fail(`Forbidden animation dependency present: ${forbidden}`)
  }
}

const materialSystemPrefixes = [
  'src/components/materials/',
  'src/platform/ui/materials/',
  'src/platform/ui/motion/',
  'src/platform/ui/navigation/',
  'src/platform/ui/sheets/',
  'src/theme/materials/',
]

const asyncStorageBoundaryFiles = new Set([
  'src/theme/storage/appearanceStorage.ts',
  'src/features/onboarding/data/onboardingStorage.ts',
  'src/features/product/storage/localProductStorage.ts',
  'src/features/product/storage/productPreferencesStorage.ts',
  'src/features/profile/storage/profilePresentationStorage.ts',
])

const acceptedPreviewColourFiles = new Set([
  'src/components/system/AppErrorBoundary.tsx',
  'src/features/discover/components/LivePresenceRail.tsx',
  'src/features/discover/data/inspireSeed.ts',
  'src/features/discover/screens/DiscoverLiveScreen.tsx',
  'src/features/feed/components/HomeSearchModal.tsx',
  'src/features/feed/components/HomeStickyFeedModes.tsx',
  'src/features/onboarding/components/OnboardingAtmosphere.tsx',
  'src/features/presence/components/PresenceStoriesRail.tsx',
  'src/features/presence/data/presenceRailSeed.ts',
  'src/features/product/components/ProductPreScreen.tsx',
  'src/features/product/data/featureAtlas.ts',
  'src/features/product/screens/CommandsLayerScreen.tsx',
  'src/features/product/screens/CustomizationSurfacesScreens.tsx',
  'src/features/product/screens/DesignLabScreen.tsx',
  'src/features/product/screens/DeveloperToolsScreen.tsx',
  'src/features/product/screens/ForgeStudioScreen.tsx',
  'src/features/product/screens/IntelligenceHubScreen.tsx',
  'src/features/product/screens/IntelligenceLayerScreen.tsx',
  'src/features/product/screens/ModuleStandardsScreen.tsx',
  'src/features/product/screens/PermissionsMatrixScreen.tsx',
  'src/features/product/screens/ProductHubScreen.tsx',
  'src/features/profile/components/ProfileCover.tsx',
  'src/features/profile/editor/profile-cover-editor.tsx',
  'src/features/profile/screens/ProfileOsPreScreen.tsx',
  'src/features/reels/components/ReelsModeSwitcher.tsx',
  'src/features/reels/screens/ReelsScreen.tsx',
  'src/features/settings/components/AdvancedCameraMaskedBlurPreview.tsx',
  'src/features/social/components/media-post-card.tsx',
])

const acceptedPreviewShadowFiles = new Set([
  'src/features/feed/components/HomeStickyFeedModes.tsx',
  'src/features/presence/components/PresenceStoriesRail.tsx',
  'src/features/social/components/media-post-card.tsx',
])

const sourceFiles = walk('src').filter(file => /\.(ts|tsx|js|jsx)$/.test(file))
for (const file of sourceFiles) {
  const body = text(file)
  const isMaterialSystem = materialSystemPrefixes.some(prefix =>
    file.startsWith(prefix),
  )
  const isTheme = file.startsWith('src/theme/')
  const isDemo = file.startsWith('src/demo/')
  const isScript = file.startsWith('scripts/')

  if (/^\s*import\s+.*(?:BlurView).*from ['"]expo-blur['"]/im.test(body) && !isMaterialSystem) {
    fail(`BlurView imported outside material system: ${file}`)
  }
  if (/^\s*import\s+.*(?:GlassView|GlassContainer).*from ['"]expo-glass-effect['"]/im.test(body) && !isMaterialSystem) {
    fail(`GlassView imported outside material system: ${file}`)
  }
  if (
    /^\s*import\s+.*AsyncStorage.*from ['"]@react-native-async-storage\/async-storage['"]/im.test(body) &&
    !asyncStorageBoundaryFiles.has(file)
  ) {
    fail(`AsyncStorage imported outside appearance storage: ${file}`)
  }
  if (/from ['"]@\/theme\/data\//.test(body) && !isTheme) {
    fail(`Raw theme data imported outside theme runtime: ${file}`)
  }
  if (/^\s*import\s+.*(?:bsky|bluesky|@atproto)/im.test(body)) {
    // Phase 6: official Expo AT OAuth client only under features/atproto/oauth.
    const phase6OfficialOauth =
      file.startsWith('src/features/atproto/oauth/') &&
      /^\s*import\s+.*@atproto\/oauth-client-expo/m.test(body) &&
      !/bsky|bluesky|@atproto\/(?!oauth-client-expo)/i.test(body)
    if (!phase6OfficialOauth) {
      fail(`Forbidden Bluesky/AT import: ${file}`)
    }
  }

  const restrictedProductFile =
    (file.startsWith('src/features/') ||
      file.startsWith('src/shell/') ||
      file.startsWith('src/components/')) &&
    !isMaterialSystem &&
    !isTheme &&
    !isDemo &&
    !isScript

  if (restrictedProductFile) {
    if (
      /#[0-9A-Fa-f]{3,8}|rgba?\(/.test(body) &&
      !acceptedPreviewColourFiles.has(file)
    ) {
      fail(`Hardcoded colour literal in product source: ${file}`)
    }
    if (
      /(shadowColor|shadowOpacity|shadowRadius|shadowOffset|elevation)\s*:/.test(body) &&
      !acceptedPreviewShadowFiles.has(file)
    ) {
      fail(`Screen-level shadow/elevation style in product source: ${file}`)
    }
    if (/blurIntensity\s*:/.test(body)) {
      fail(`Screen-level blurIntensity style in product source: ${file}`)
    }
  }
}

if (errors.length) {
  console.error('Phase 2 appearance verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 2 appearance verification passed.')
