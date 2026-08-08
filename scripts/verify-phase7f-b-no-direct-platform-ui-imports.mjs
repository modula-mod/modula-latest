#!/usr/bin/env node
/**
 * Phase 7F-B — fail if features/auth/app import Expo UI platform paths directly.
 * Allows src/platform/ui/** only.
 */
import {execFileSync} from 'node:child_process'

const root = process.cwd()

function maybeRg(args) {
  try {
    return execFileSync(args[0], args.slice(1), {cwd: root, encoding: 'utf8'}).trim()
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 1) return ''
    throw error
  }
}

const pattern =
  "@expo/ui/(swift-ui|jetpack-compose)|@expo/ui/.*/modifiers|from ['\"]@expo/ui/swift-ui|from ['\"]@expo/ui/jetpack-compose"

const hits = maybeRg([
  'rg',
  '-n',
  pattern,
  'src/features',
  'src/auth',
  'src/app',
  '--glob',
  '!**/node_modules/**',
])

if (hits) {
  console.error('Phase 7F-B no-direct-platform-ui-imports failed:')
  console.error('Direct @expo/ui platform imports outside src/platform/ui/**:')
  console.error(hits)
  process.exit(1)
}

console.log('Phase 7F-B no-direct-platform-ui-imports verification passed.')
