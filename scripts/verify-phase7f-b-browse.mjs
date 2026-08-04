#!/usr/bin/env node
/**
 * Phase 7F-B — browse surfaces: feed/discover/activity/profile + stories routes.
 */
import {existsSync} from 'node:fs'
import {join} from 'node:path'

const root = process.cwd()
const errors = []

function requireFile(rel) {
  if (!existsSync(join(root, rel))) errors.push(`missing ${rel}`)
}

function requireAny(rels, label) {
  if (!rels.some(rel => existsSync(join(root, rel)))) {
    errors.push(`missing ${label} (tried: ${rels.join(', ')})`)
  }
}

// Repositories
requireFile('src/data/repositories/api/ApiFeedRepository.ts')
requireFile('src/data/repositories/api/ApiDiscoverRepository.ts')
requireFile('src/data/repositories/api/ApiActivityRepository.ts')
requireFile('src/data/repositories/api/ApiProfileRepository.ts')

// Screens
requireFile('src/features/feed/screens/HomeFeedScreen.tsx')
requireFile('src/features/discover/screens/DiscoverScreen.tsx')
requireFile('src/features/activity/screens/ActivityScreen.tsx')
requireAny(
  [
    'src/features/profile/screens/UnifiedProfileScreen.tsx',
    'src/features/profile/screens/ProfileOsPreScreen.tsx',
  ],
  'profile screen',
)

// Tab / app routes
requireAny(
  ['src/app/(tabs)/index/index.tsx', 'src/app/(tabs)/index.tsx'],
  'home tab route',
)
requireAny(
  ['src/app/(tabs)/discover/index.tsx', 'src/app/(tabs)/discover.tsx'],
  'discover tab route',
)
requireAny(
  ['src/app/(tabs)/activity/index.tsx', 'src/app/(tabs)/activity.tsx'],
  'activity tab route',
)
requireAny(
  ['src/app/(tabs)/profile/index.tsx', 'src/app/(tabs)/profile.tsx'],
  'profile tab route',
)

// Stories routes
requireFile('src/app/stories/_layout.tsx')
requireAny(
  ['src/app/stories/[groupId].tsx', 'src/app/stories/[id].tsx'],
  'stories viewer route',
)
requireFile('src/app/stories/create.tsx')

if (errors.length) {
  console.error('Phase 7F-B browse verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7F-B browse verification passed.')
