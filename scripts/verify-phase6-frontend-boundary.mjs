#!/usr/bin/env node
/**
 * Confirms the VPS Phase 6 backend branch did not modify Mac-owned frontend trees
 * relative to the Phase 6 starting main commit.
 */
import {execSync} from 'node:child_process'
import fs from 'node:fs'

const root = process.cwd()
const startCommitPath = '/tmp/modula-phase6-start-commit.txt'
let failures = 0

function ok(msg) {
  console.log(`PASS ${msg}`)
}
function fail(msg) {
  console.error(`FAIL ${msg}`)
  failures += 1
}

function runSupersedingVerifier(script) {
  try {
    execSync(`"${process.execPath}" "${script}"`, {cwd: root, stdio: 'inherit'})
  } catch (error) {
    process.exit(error && typeof error === 'object' && 'status' in error ? error.status : 1)
  }
}

if (fs.existsSync('docs/validation/phase7c-verifier-reconciliation.md')) {
  runSupersedingVerifier('scripts/verify-phase7c-product-shell.mjs')
  console.log('Phase 6 frontend boundary verifier retired for Phase 7C.')
  console.log('Superseded by verify-phase7c-product-shell.mjs.')
  process.exit(0)
}

if (!fs.existsSync(startCommitPath)) {
  fail(`${startCommitPath} missing`)
} else {
  const start = fs.readFileSync(startCommitPath, 'utf8').trim()
  for (const dir of ['src', 'ios', 'android', 'assets']) {
    const diff = execSync(`git -C ${root} diff --name-only ${start} -- ${dir}`, {encoding: 'utf8'}).trim()
    if (diff) fail(`${dir} modified since Phase 6 start:\n${diff}`)
    else ok(`${dir} unchanged since Phase 6 start`)
  }
  const quiet = execSync(`git -C ${root} diff --quiet ${start} -- src ios android assets; echo $?`, {
    encoding: 'utf8',
  }).trim()
  if (quiet.endsWith('0')) ok('git diff --quiet main frontend dirs')
  else fail('git diff --quiet frontend dirs failed')
}

if (failures > 0) {
  console.error(`\nPhase 6 frontend boundary verifier failed with ${failures} issue(s)`)
  process.exit(1)
}
console.log('\nPhase 6 frontend boundary verifier passed')
