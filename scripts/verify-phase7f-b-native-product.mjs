#!/usr/bin/env node
/**
 * Phase 7F-B orchestrator — runs all static native-product verifiers.
 */
import {spawnSync} from 'node:child_process'
import {join} from 'node:path'

const root = process.cwd()

const scripts = [
  'scripts/verify-phase7f-b-expo-ui-adapters.mjs',
  'scripts/verify-phase7f-b-no-direct-platform-ui-imports.mjs',
  'scripts/verify-phase7f-b-segmented-controls.mjs',
  'scripts/verify-phase7f-b-authentication.mjs',
  'scripts/verify-phase7f-b-stories.mjs',
  'scripts/verify-phase7f-b-browse.mjs',
  'scripts/verify-phase7f-b-navigation.mjs',
  'scripts/verify-phase7f-b-no-native-product-mocks.mjs',
]

const results = []

for (const script of scripts) {
  const result = spawnSync(process.execPath, [join(root, script)], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  })
  const ok = result.status === 0
  results.push({script, ok, status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr})
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
}

console.log('')
console.log('Phase 7F-B native product summary:')
let failed = 0
for (const item of results) {
  const label = item.ok ? 'PASS' : 'FAIL'
  console.log(`${label} ${item.script}`)
  if (!item.ok) failed += 1
}

if (failed > 0) {
  console.error(`Phase 7F-B native product verification failed: ${failed}/${results.length}`)
  process.exit(1)
}

console.log(`Phase 7F-B native product verification passed: ${results.length}/${results.length}`)
