#!/usr/bin/env node
/**
 * Phase 7F-B — stories migration, service, repository, and home rail wiring.
 */
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

const root = process.cwd()
const errors = []

function read(rel) {
  const abs = join(root, rel)
  if (!existsSync(abs)) {
    errors.push(`missing ${rel}`)
    return ''
  }
  return readFileSync(abs, 'utf8')
}

function requireFile(rel) {
  if (!existsSync(join(root, rel))) errors.push(`missing ${rel}`)
}

requireFile('services/greenfield-api/migrations/028_phase7f_stories.sql')
requireFile('services/greenfield-api/src/domains/stories/service.ts')
requireFile('src/data/repositories/api/ApiStoriesRepository.ts')

const storyService = read('services/greenfield-api/src/domains/stories/service.ts')
if (!storyService.includes('StoryService') && !storyService.includes('export class StoryService')) {
  errors.push('StoryService export missing from domains/stories/service.ts')
}

const storiesRepo = read('src/data/repositories/api/ApiStoriesRepository.ts')
if (!storiesRepo.includes('ApiStoriesRepository')) {
  errors.push('ApiStoriesRepository class missing')
}

const homeFeed = read('src/features/feed/screens/HomeFeedScreen.tsx')
if (!homeFeed.includes('useStoriesRailQuery')) {
  errors.push('HomeFeedScreen must use useStoriesRailQuery')
}
if (!/\bpeople\s*=/.test(homeFeed)) {
  errors.push('HomeFeedScreen must pass people= to the stories rail')
}
if (/presenceRailSeed/.test(homeFeed)) {
  errors.push('HomeFeedScreen must not import presenceRailSeed')
}

const rail = read('src/features/presence/components/PresenceStoriesRail.tsx')
if (/presenceRailSeed/.test(rail)) {
  errors.push('PresenceStoriesRail must not import presenceRailSeed')
}

if (errors.length) {
  console.error('Phase 7F-B stories verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7F-B stories verification passed.')
