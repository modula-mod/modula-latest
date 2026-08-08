import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const errors = []

function rel(file) {
  return path.relative(root, file)
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

function text(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
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

const requiredRoutes = [
  'src/app/_layout.tsx',
  'src/app/+not-found.tsx',
  'src/app/compose.tsx',
  ['src/app/messages.tsx', 'src/app/messages/index.tsx'],
  'src/app/saved.tsx',
  ['src/app/communities.tsx', 'src/app/communities/index.tsx'],
  'src/app/teams.tsx',
  'src/app/modules.tsx',
  ['src/app/marketplace.tsx', 'src/app/marketplace/index.tsx'],
  'src/app/settings/index.tsx',
  ['src/app/reels.tsx', 'src/app/reels/index.tsx'],
  ['src/app/post/[postId].tsx', 'src/app/post/[postId]/index.tsx'],
  'src/app/(tabs)/_layout.tsx',
  'src/app/(tabs)/index/index.tsx',
  'src/app/(tabs)/discover/index.tsx',
  'src/app/(tabs)/board/index.tsx',
  'src/app/(tabs)/create.tsx',
  'src/app/(tabs)/activity/index.tsx',
  'src/app/(tabs)/profile/index.tsx',
]

for (const route of requiredRoutes) {
  if (Array.isArray(route)) {
    if (!route.some(candidate => exists(candidate))) {
      fail(`Missing required route file: ${route.join(' or ')}`)
    }
  } else if (!exists(route)) {
    fail(`Missing required route file: ${route}`)
  }
}

const requiredFiles = [
  'src/platform/ui/navigation/adaptive-account-panel.tsx',
  'src/features/composer/screens/ComposerScreen.tsx',
  'src/components/composer/ComposerToolsDrawer.tsx',
  'src/data/query/QueryRuntimeProvider.tsx',
  'src/runtime/AppServicesProvider.tsx',
  'src/features/feed/screens/HomeFeedScreen.tsx',
  'src/features/discover/screens/DiscoverScreen.tsx',
  'src/features/activity/screens/ActivityScreen.tsx',
  'src/features/profile/screens/UnifiedProfileScreen.tsx',
  'src/features/board/screens/BoardScreen.tsx',
]

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing required Phase 1 file: ${file}`)
}

const pkg = readJson('package.json')
const deps = pkg.dependencies ?? {}
for (const forbidden of ['react-native-worklets-core']) {
  if (Object.prototype.hasOwnProperty.call(deps, forbidden)) {
    fail(`Forbidden direct dependency present: ${forbidden}`)
  }
}

const allowedExternalPreviewHosts = new Set([
  'commondatastorage.googleapis.com',
  'corner-inverter.douiri.org',
  'i.pravatar.cc',
])

const sourceFiles = walk('src').filter(file => /\.(ts|tsx|js|jsx)$/.test(file))
for (const file of sourceFiles) {
  const body = text(file)
  const oldRepositoryPath = ['/home', 'andrei', 'modula'].join('/')
  if (body.includes(oldRepositoryPath)) {
    fail(`Source file references old repository path: ${file}`)
  }
  if (/^\s*import\s+.*(?:bsky|bluesky|@atproto)/im.test(body)) {
    // Phase 6 exception: official Expo AT OAuth client only, under features/atproto/oauth.
    const phase6OfficialOauth =
      file.startsWith('src/features/atproto/oauth/') &&
      /^\s*import\s+.*@atproto\/oauth-client-expo/m.test(body) &&
      !/bsky|bluesky|@atproto\/(?!oauth-client-expo)/i.test(body)
    if (!phase6OfficialOauth) {
      fail(`Source file contains forbidden Bluesky/AT import: ${file}`)
    }
  }
  const urls = body.match(/https?:\/\/[A-Za-z0-9][A-Za-z0-9.-]*/gi) ?? []
  for (const url of urls) {
    const host = url.replace(/^https?:\/\//i, '')
    const allowed =
      ['localhost', '127.0.0.1', '0.0.0.0', 'github.com'].includes(host) ||
      host === 'modula.digital' ||
      host.endsWith('.modula.digital') ||
      allowedExternalPreviewHosts.has(host)
    if (!allowed) {
      fail(`Possible hardcoded production API URL in source file: ${file}`)
    }
  }
}

const config = text('app.config.ts')
if (!/updates:\s*{\s*enabled:\s*false\s*,?\s*}/s.test(config)) {
  fail('app.config.ts must keep updates.enabled set to false')
}
if (!/['"]expo-dev-client['"]/.test(config)) {
  fail('app.config.ts must configure expo-dev-client plugin')
}
if (!/Modula uses your photo library when you choose media for a post\./.test(config)) {
  fail('expo-image-picker photos permission text is missing')
}
if (!/Modula uses your camera when you choose to capture media for a post\./.test(config)) {
  fail('expo-image-picker camera permission text is missing')
}

if (!Object.prototype.hasOwnProperty.call(deps, 'expo-dev-client')) {
  fail('expo-dev-client dependency is missing')
}

const routeFiles = walk('src/app')
  .filter(file => /\.(ts|tsx)$/.test(file))
  .filter(file => !/(^|\/)_layout\.[tj]sx?$/.test(file))
  .filter(file => !/(^|\/)[^/]*\+[^/]*\.[tj]sx?$/.test(file))
for (const file of routeFiles) {
  const lines = text(file).split('\n').length
  if (lines > 70) {
    fail(`Route file is oversized (${lines} lines): ${file}`)
  }
  const body = text(file)
  if (/StyleSheet\.create|FlatList|ScrollView|TextInput/.test(body)) {
    fail(`Route file appears to contain screen implementation details: ${file}`)
  }
}

if (errors.length) {
  console.error('Phase 1 shell verification failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log('Phase 1 shell verification passed.')
