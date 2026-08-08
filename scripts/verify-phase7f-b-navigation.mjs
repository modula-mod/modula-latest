#!/usr/bin/env node
/**
 * Phase 7F-B — primary tab routes under src/app/(tabs).
 */
import {existsSync} from 'node:fs'
import {join} from 'node:path'

const root = process.cwd()
const errors = []

function requireAny(rels, label) {
  if (!rels.some(rel => existsSync(join(root, rel)))) {
    errors.push(`missing tab route ${label} (tried: ${rels.join(', ')})`)
  }
}

const tabs = join(root, 'src/app/(tabs)')
if (!existsSync(tabs)) {
  errors.push('missing src/app/(tabs)')
}

requireAny(
  ['src/app/(tabs)/index/index.tsx', 'src/app/(tabs)/index.tsx'],
  'Home',
)
requireAny(
  ['src/app/(tabs)/discover/index.tsx', 'src/app/(tabs)/discover.tsx'],
  'Discover',
)
requireAny(
  ['src/app/(tabs)/create.tsx', 'src/app/(tabs)/create/index.tsx'],
  'Create',
)
requireAny(
  ['src/app/(tabs)/activity/index.tsx', 'src/app/(tabs)/activity.tsx'],
  'Activity',
)
requireAny(
  ['src/app/(tabs)/profile/index.tsx', 'src/app/(tabs)/profile.tsx'],
  'Profile',
)

requireAny(['src/app/(tabs)/_layout.tsx'], 'tabs layout')

if (errors.length) {
  console.error('Phase 7F-B navigation verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7F-B navigation verification passed.')
