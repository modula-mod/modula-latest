#!/usr/bin/env node
/**
 * Phase 7F-B — Home feed segmented control + native community adapter.
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

const homeFeed = read('src/features/feed/screens/HomeFeedScreen.tsx')

// Extract the first ModulaSegmentedPicker JSX block roughly.
const pickerMatch = homeFeed.match(/<ModulaSegmentedPicker[\s\S]*?\/>/)
if (!pickerMatch) {
  errors.push('HomeFeedScreen missing ModulaSegmentedPicker usage')
} else {
  const block = pickerMatch[0]
  if (!/appearance\s*=\s*["']segmented["']/.test(block)) {
    errors.push('HomeFeedScreen ModulaSegmentedPicker must use appearance="segmented"')
  }
  if (/\bscrollable\b/.test(block)) {
    errors.push('HomeFeedScreen ModulaSegmentedPicker must NOT use scrollable')
  }
}

const nativePicker = read('src/platform/ui/controls/modula-segmented-picker.native.tsx')
if (!nativePicker.includes('@expo/ui/community/segmented-control')) {
  errors.push('native adapter must import @expo/ui/community/segmented-control')
}
if (!/from ['"]@expo\/ui\/community\/segmented-control['"]/.test(nativePicker)) {
  errors.push('native adapter missing community segmented-control import statement')
}

if (errors.length) {
  console.error('Phase 7F-B segmented controls verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7F-B segmented controls verification passed.')
