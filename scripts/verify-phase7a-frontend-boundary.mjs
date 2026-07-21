#!/usr/bin/env node
import {execFileSync} from 'node:child_process'

const baseline = 'c127d0cbf16072cc96db6850d8fab9d06c92d18d'
const protectedPaths = ['src', 'ios', 'android', 'assets', 'app.config.ts', 'app.json', 'ios/Podfile.lock']

function git(args) {
  return execFileSync('git', args, {encoding: 'utf8'}).trim()
}

const changed = git(['diff', '--name-only', `${baseline}...HEAD`, '--', ...protectedPaths])
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean)

if (changed.length > 0) {
  console.error('Phase 7A frontend/native boundary failed.')
  console.error(`Baseline: ${baseline}`)
  console.error('Protected path changes:')
  for (const file of changed) console.error(`- ${file}`)
  process.exit(1)
}

console.log('MODULA PHASE 7A FRONTEND BOUNDARY PASSED')
console.log(`baseline=${baseline}`)
console.log(`protectedPaths=${protectedPaths.join(',')}`)
