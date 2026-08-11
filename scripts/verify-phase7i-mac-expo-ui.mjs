#!/usr/bin/env node
/**
 * Phase 7I-MAC-A — Expo UI adoption inventory + no product mocks on Stories rail.
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

read('docs/research/phase7i-mac-a-expo-ui-inventory.md')

const rail = read('src/features/presence/components/PresenceStoriesRail.tsx')
if (/presenceRailSeed/.test(rail)) {
  errors.push('PresenceStoriesRail must not import presenceRailSeed')
}
if (/demoStories|fixtureStories|FAKE_STORIES/.test(rail)) {
  errors.push('PresenceStoriesRail must not embed demo story fixtures')
}
if (!/No stories yet/.test(rail)) {
  errors.push('PresenceStoriesRail must expose an honest empty state (no silent null)')
}

const home = read('src/features/feed/screens/HomeFeedScreen.tsx')
if (/presenceRailSeed/.test(home)) {
  errors.push('HomeFeedScreen must not import presenceRailSeed')
}

const signIn = read('src/auth/screens/SignInScreen.tsx')
if (!/dataSource === 'local'/.test(signIn)) {
  errors.push('Sign-in demo account CTA must be gated to local dataSource only')
}

if (errors.length) {
  console.error('verify:phase7i-mac-expo-ui failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('verify:phase7i-mac-expo-ui passed')
