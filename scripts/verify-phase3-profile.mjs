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

function requireFile(file, label = file) {
  if (!exists(file)) fail(`Missing ${label}: ${file}`)
}

function requireText(file, pattern, message) {
  if (!exists(file)) {
    fail(`Missing file for check: ${file}`)
    return
  }
  const body = text(file)
  const matched = typeof pattern === 'string' ? body.includes(pattern) : pattern.test(body)
  if (!matched) fail(message)
}

const requiredRoutes = [
  'src/app/(tabs)/profile.tsx',
  'src/app/profile/edit.tsx',
  'src/app/profile/customize.tsx',
  'src/app/profile/preview.tsx',
  'src/app/profile/[handle]/index.tsx',
  'src/app/profile/[handle]/followers.tsx',
  'src/app/profile/[handle]/following.tsx',
]

for (const route of requiredRoutes) requireFile(route, 'Phase 3 profile route')

const requiredFiles = [
  'src/features/profile/contracts/profile.ts',
  'src/features/profile/contracts/profileTabs.ts',
  'src/features/profile/contracts/identity.ts',
  'src/features/profile/contracts/presence.ts',
  'src/features/profile/repository/ProfileRepository.ts',
  'src/features/profile/repository/DemoProfileRepository.ts',
  'src/features/profile/runtime/ProfilePresentationProvider.tsx',
  'src/features/profile/storage/profilePresentationStorage.ts',
  'src/features/profile/storage/validateProfilePresentation.ts',
  'src/features/profile/registry/ProfileTabRegistry.ts',
  'src/features/profile/registry/createCoreProfileTabs.ts',
  'src/features/profile/registry/resolveProfileTabs.ts',
  'src/features/profile/screens/UnifiedProfileScreen.tsx',
  'src/features/profile/screens/EditProfileScreen.tsx',
  'src/features/profile/screens/CustomizeProfileScreen.tsx',
  'src/features/profile/screens/ProfilePreviewScreen.tsx',
  'src/features/profile/screens/FollowersScreen.tsx',
  'src/features/profile/screens/FollowingScreen.tsx',
  'src/features/profile/screens/ProfileConnectionsScreen.tsx',
  'src/features/profile/components/ProfileShell.tsx',
  'src/features/profile/components/ProfileHero.tsx',
  'src/features/profile/components/ProfileCover.tsx',
  'src/features/profile/components/ProfileAvatar.tsx',
  'src/features/profile/components/FocusHalo.tsx',
  'src/features/profile/components/ProfileIdentity.tsx',
  'src/features/profile/components/ProfileStats.tsx',
  'src/features/profile/components/ProfileActions.tsx',
  'src/features/profile/components/ProfileTabBar.tsx',
  'src/features/profile/components/ProfileTabContent.tsx',
  'src/features/profile/components/ProfileModuleCard.tsx',
  'src/features/profile/components/ProfileLinkCard.tsx',
  'src/features/profile/tabs/PostsProfileTab.tsx',
  'src/features/profile/tabs/MediaProfileTab.tsx',
  'src/features/profile/tabs/AboutProfileTab.tsx',
  'src/features/profile/tabs/ModulesProfileTab.tsx',
  'src/features/profile/tabs/LinksProfileTab.tsx',
  'src/features/profile/navigation/openProfile.ts',
  'src/features/profile/services/shareProfile.ts',
  'src/lib/safeExternalUrl.ts',
]

for (const file of requiredFiles) requireFile(file, 'Phase 3 profile file')

requireText(
  'src/app/(tabs)/profile.tsx',
  /UnifiedProfileScreen[\s\S]*mode="owner"/,
  'Owner profile route must render UnifiedProfileScreen mode="owner"',
)
requireText(
  'src/app/profile/[handle]/index.tsx',
  /UnifiedProfileScreen[\s\S]*mode="public"[\s\S]*handle=/,
  'Public profile route must render UnifiedProfileScreen mode="public" with handle',
)

const routeFiles = walk('src/app').filter(file => /\.(ts|tsx)$/.test(file))
for (const file of routeFiles) {
  const body = text(file)
  const lines = body.split('\n').length
  if (lines > 80) fail(`Route file is not thin (${lines} lines): ${file}`)
  if (/StyleSheet\.create|FlatList|ScrollView|TextInput/.test(body)) {
    fail(`Route file contains screen implementation details: ${file}`)
  }
}

requireText(
  'src/features/profile/storage/profilePresentationStorage.ts',
  'modula.profile.presentation.v1',
  'Presentation storage key must be modula.profile.presentation.v1',
)
requireText(
  'src/features/profile/contracts/profile.ts',
  'schemaVersion: 1',
  'Profile presentation schema version 1 is missing',
)
requireText(
  'src/features/profile/runtime/ProfilePresentationProvider.tsx',
  /if \(tabId === 'posts'\) return/,
  'Posts tab must be protected from disabling in ProfilePresentationProvider',
)
requireText(
  'src/features/profile/contracts/identity.ts',
  /'selfDeclared'[\s\S]*'connected'[\s\S]*'verified'/,
  'Identity claim statuses must be explicit',
)
requireText(
  'src/features/profile/contracts/profile.ts',
  'canViewerSeeProfileField',
  'Central visibility helper is missing',
)
requireText(
  'src/lib/safeExternalUrl.ts',
  /ALLOWED_PROTOCOLS[\s\S]*https:[\s\S]*http:[\s\S]*mailto:/,
  'Safe external URL helper must allow only http, https and mailto',
)
requireText(
  'src/lib/safeExternalUrl.ts',
  /!ALLOWED_PROTOCOLS\.has/,
  'Safe external URL helper must reject unsafe schemes',
)

for (const forbiddenRoute of [
  'src/app/identity.tsx',
  'src/app/identity/index.tsx',
  'src/app/settings/identity-centre.tsx',
  'src/app/settings/identity-center.tsx',
]) {
  if (exists(forbiddenRoute)) fail(`Identity Centre route must not exist: ${forbiddenRoute}`)
}

const profileSourceFiles = walk('src/features/profile').filter(file => /\.(ts|tsx)$/.test(file))
for (const file of profileSourceFiles) {
  const body = text(file)
  if (/https?:\/\/[^'"]*\/api\//i.test(body)) {
    fail(`Production API URL appears in profile source: ${file}`)
  }
  if (/:\s*any\b|\bas any\b|<any>/.test(body) && file.includes('/contracts/')) {
    fail(`Profile contract uses any: ${file}`)
  }
}

const screens = walk('src/features/profile/screens').filter(file => /\.(ts|tsx)$/.test(file))
for (const file of screens) {
  if (/^\s*import\s+.*AsyncStorage.*from ['"]@react-native-async-storage\/async-storage['"]/im.test(text(file))) {
    fail(`Profile screen imports AsyncStorage directly: ${file}`)
  }
}

const components = walk('src/features/profile/components').filter(file => /\.(ts|tsx)$/.test(file))
for (const file of components) {
  if (/from ['"]@\/theme\/data\//.test(text(file))) {
    fail(`Profile component imports raw palette data: ${file}`)
  }
}

const pkg = readJson('package.json')
const allDeps = {...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {})}
for (const forbidden of [
  '@react-native-firebase/auth',
  '@supabase/supabase-js',
  'firebase',
  'react-native-appwrite',
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-worklets-core',
  '@react-native/worklets',
]) {
  if (Object.prototype.hasOwnProperty.call(allDeps, forbidden)) {
    fail(`Forbidden Phase 3 dependency present: ${forbidden}`)
  }
}

for (const [file, label] of [
  ['src/components/feed/DemoPostItem.tsx', 'Home'],
  ['src/features/discover/screens/DiscoverScreen.tsx', 'Discover'],
  ['src/features/activity/screens/ActivityScreen.tsx', 'Activity'],
  ['src/features/reels/screens/ReelsScreen.tsx', 'Reels'],
]) {
  requireText(file, 'getProfileRoute', `Public profile navigation is not connected from ${label}`)
}

if (!exists('scripts/verify-phase1-shell.mjs')) fail('Phase 1 verifier is missing')
if (!exists('scripts/verify-phase2-appearance.mjs')) fail('Phase 2 verifier is missing')

if (errors.length) {
  console.error('Phase 3 profile verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 3 profile verification passed.')
