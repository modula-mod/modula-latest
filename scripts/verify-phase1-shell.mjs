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
  'src/app/board.tsx',
  'src/app/messages.tsx',
  'src/app/saved.tsx',
  'src/app/communities.tsx',
  'src/app/teams.tsx',
  'src/app/modules.tsx',
  'src/app/marketplace.tsx',
  'src/app/settings.tsx',
  'src/app/reels.tsx',
  'src/app/post/[postId].tsx',
  'src/app/(tabs)/_layout.tsx',
  'src/app/(tabs)/index.tsx',
  'src/app/(tabs)/discover.tsx',
  'src/app/(tabs)/create.tsx',
  'src/app/(tabs)/activity.tsx',
  'src/app/(tabs)/profile.tsx',
]

for (const route of requiredRoutes) {
  if (!exists(route)) fail(`Missing required route file: ${route}`)
}

const requiredFiles = [
  'src/shell/NavigationDrawer.tsx',
  'src/features/composer/screens/ComposerScreen.tsx',
  'src/components/composer/ComposerToolsDrawer.tsx',
  'src/demo/DemoSocialContext.tsx',
  'src/features/feed/screens/HomeFeedScreen.tsx',
  'src/features/discover/screens/DiscoverScreen.tsx',
  'src/features/activity/screens/ActivityScreen.tsx',
  'src/features/profile/screens/ProfileScreen.tsx',
  'src/features/board/screens/BoardScreen.tsx',
]

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing required Phase 1 file: ${file}`)
}

const pkg = readJson('package.json')
const deps = pkg.dependencies ?? {}
for (const forbidden of [
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-worklets-core',
]) {
  if (Object.prototype.hasOwnProperty.call(deps, forbidden)) {
    fail(`Forbidden direct dependency present: ${forbidden}`)
  }
}

const sourceFiles = walk('src').filter(file => /\.(ts|tsx|js|jsx)$/.test(file))
for (const file of sourceFiles) {
  const body = text(file)
  if (body.includes('/home/andrei/modula')) {
    fail(`Source file references old repository path: ${file}`)
  }
  if (/^\s*import\s+.*(?:bsky|bluesky|@atproto)/im.test(body)) {
    fail(`Source file contains forbidden Bluesky/AT import: ${file}`)
  }
  if (/https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(body)) {
    fail(`Possible hardcoded production API URL in source file: ${file}`)
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

const routeFiles = walk('src/app').filter(file => /\.(ts|tsx)$/.test(file))
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
