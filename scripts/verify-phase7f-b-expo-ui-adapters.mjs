#!/usr/bin/env node
/**
 * Phase 7F-B — static audit: @expo/ui adapters under platform/ui/controls.
 * No network required.
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

function existsAny(rels) {
  return rels.some(rel => existsSync(join(root, rel)))
}

const pkg = JSON.parse(read('package.json') || '{}')
const declared = pkg.dependencies?.['@expo/ui'] ?? pkg.devDependencies?.['@expo/ui']
if (!declared) {
  errors.push('@expo/ui is not declared in package.json dependencies')
} else {
  console.log(`@expo/ui package.json pin: ${declared}`)
}

let installed = null
try {
  installed = JSON.parse(readFileSync(join(root, 'node_modules/@expo/ui/package.json'), 'utf8')).version
  console.log(`@expo/ui installed version: ${installed}`)
} catch {
  console.log('@expo/ui installed version: (not installed in node_modules)')
}

const adapters = [
  'modula-switch',
  'modula-checkbox',
  'modula-text-input',
  'modula-secure-input',
  'modula-list',
  'modula-progress',
  'modula-segmented-picker',
]
for (const name of adapters) {
  const candidates = [
    `src/platform/ui/controls/${name}.tsx`,
    `src/platform/ui/controls/${name}.native.tsx`,
  ]
  if (!existsAny(candidates)) {
    errors.push(`adapter missing under src/platform/ui/controls/: ${name}`)
  }
}

const systemSwitch = read('src/components/system/SystemSwitch.tsx')
if (!systemSwitch.includes("from '@/platform/ui/controls/modula-switch'") && !systemSwitch.includes('ModulaSwitch')) {
  errors.push('SystemSwitch must import ModulaSwitch')
} else if (!systemSwitch.includes('ModulaSwitch')) {
  errors.push('SystemSwitch must use ModulaSwitch')
}

const homeFeed = read('src/features/feed/screens/HomeFeedScreen.tsx')
if (!homeFeed.includes('ModulaSegmentedPicker')) {
  errors.push('HomeFeedScreen must use ModulaSegmentedPicker')
}
if (!/appearance\s*=\s*["']segmented["']/.test(homeFeed)) {
  errors.push('HomeFeedScreen must use appearance="segmented" for ModulaSegmentedPicker')
}

const nativePicker = read('src/platform/ui/controls/modula-segmented-picker.native.tsx')
if (!nativePicker.includes('@expo/ui/community/segmented-control')) {
  errors.push('modula-segmented-picker.native.tsx must import @expo/ui/community/segmented-control')
}

if (errors.length) {
  console.error('Phase 7F-B Expo UI adapters verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7F-B Expo UI adapters verification passed.')
