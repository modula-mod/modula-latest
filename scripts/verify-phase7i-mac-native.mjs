#!/usr/bin/env node
/**
 * Phase 7I-MAC-A — native Mac acceptance docs + geometry contracts.
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

for (const rel of [
  'docs/validation/phase7i-mac-a-expo-doctor.md',
  'docs/validation/phase7i-mac-a-screen-map.md',
  'docs/validation/phase7i-mac-a-ui-defects.md',
  'docs/validation/phase7i-mac-a-final.md',
  'docs/research/phase7i-mac-a-expo-ui-inventory.md',
  'docs/research/phase7i-mac-a-ui-component-candidates.md',
  'docs/validation/evidence/phase7i-mac-a-before/03-home-top.png',
  'docs/validation/evidence/phase7i-mac-a-before/01-login.png',
  'docs/validation/evidence/phase7i-mac-a-before/10-drawer.png',
]) {
  read(rel)
}

const tabBar = read('src/platform/ui/navigation/modula-liquid-glass-tab-bar.tsx')
if (!/bottom:\s*0/.test(tabBar)) {
  errors.push('tab bar must pin physical bottom: 0')
}
if (!/paddingBottom:\s*bottomPad/.test(tabBar) && !/paddingBottom:\s*Math\.max\(insets\.bottom/.test(tabBar)) {
  // Accept either the named bottomPad pattern or inline max(insets.bottom)
  if (!/insets\.bottom/.test(tabBar)) {
    errors.push('tab bar must apply safe-area as internal padding')
  }
}

const sticky = read('src/features/feed/components/HomeStickyFeedModes.tsx')
if (/from ['"]@expo\/ui/.test(sticky) || /<Host\b/.test(sticky)) {
  errors.push('HomeStickyFeedModes must not own Expo UI Host directly')
}

if (errors.length) {
  console.error('verify:phase7i-mac-native failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('verify:phase7i-mac-native passed')
