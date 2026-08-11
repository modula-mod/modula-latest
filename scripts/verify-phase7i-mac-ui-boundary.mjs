#!/usr/bin/env node
/**
 * Phase 7I-MAC-A — UI boundary: no feature-level Expo UI imports; adapters present.
 */
import {execFileSync} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

const root = process.cwd()
const errors = []

function sh(args) {
  return execFileSync(args[0], args.slice(1), {cwd: root, encoding: 'utf8'}).trim()
}

function maybeRg(args) {
  try {
    return sh(args)
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 1) return ''
    throw error
  }
}

function read(rel) {
  const abs = join(root, rel)
  if (!existsSync(abs)) {
    errors.push(`missing ${rel}`)
    return ''
  }
  return readFileSync(abs, 'utf8')
}

const direct = maybeRg([
  'rg',
  '-n',
  "@expo/ui/(swift-ui|jetpack-compose)|from ['\"]@expo/ui['\"]",
  'src/features',
  'src/app',
  'src/auth',
  'src/components',
  'src/shell',
  '--glob',
  '*.{ts,tsx}',
])
if (direct) errors.push(`forbidden direct Expo UI import outside platform adapters:\n${direct}`)

for (const rel of [
  'src/platform/ui/controls/modula-segmented-picker.tsx',
  'src/platform/ui/controls/modula-segmented-picker.native.tsx',
  'src/platform/ui/controls/modula-segmented-picker.shared.tsx',
  'src/platform/ui/buttons/modula-button.tsx',
  'src/platform/ui/buttons/modula-button.native.tsx',
  'src/platform/ui/menus/modula-context-menu.tsx',
  'src/platform/ui/menus/modula-context-menu.native.tsx',
]) {
  read(rel)
}

const nativeSeg = read('src/platform/ui/controls/modula-segmented-picker.native.tsx')
if (!nativeSeg.includes('@expo/ui/community/segmented-control')) {
  errors.push('native segmented adapter must use @expo/ui/community/segmented-control')
}

if (errors.length) {
  console.error('verify:phase7i-mac-ui-boundary failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('verify:phase7i-mac-ui-boundary passed')
