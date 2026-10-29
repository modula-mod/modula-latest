#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'

const baseline = 'c127d0cbf16072cc96db6850d8fab9d06c92d18d'
const protectedPaths = ['src', 'assets', 'app.config.ts', 'app.json']

function git(args) {
  return execFileSync('git', args, {encoding: 'utf8'}).trim()
}

function sh(args) {
  return execFileSync(args[0], args.slice(1), {encoding: 'utf8', stdio: 'inherit'})
}

if (existsSync('docs/validation/phase7c-verifier-reconciliation.md')) {
  sh([process.execPath, 'scripts/verify-phase7b-module-host.mjs'])
  sh([process.execPath, 'scripts/verify-phase7c-product-shell.mjs'])
  console.log('Phase 7A frontend boundary verifier retired for Phase 7C.')
  console.log('Superseded by Phase 7B module-host and Phase 7C product gates.')
  process.exit(0)
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
