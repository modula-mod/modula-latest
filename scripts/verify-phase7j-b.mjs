#!/usr/bin/env node
/**
 * Phase 7J-B cutover verifier.
 * CI=true pnpm verify:phase7j-b
 *
 * No silent skips: every gate is PASS or FAIL.
 */
import {spawnSync} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const evidence = path.join(root, 'docs/validation/evidence/phase7j-b')
const statusDoc = path.join(root, 'docs/validation/phase7j-b-cutover-status.md')
const expectedSha = 'b5252d5f7654547ff8aa75498bd205336692cd99'
let failed = 0

function pass(msg) {
  console.log(`PASS: ${msg}`)
}
function fail(msg) {
  console.error(`FAIL: ${msg}`)
  failed += 1
}

function assertFile(rel, needle) {
  const full = path.join(root, rel)
  if (!existsSync(full)) {
    fail(`missing ${rel}`)
    return false
  }
  if (needle) {
    const text = readFileSync(full, 'utf8')
    if (!text.includes(needle)) {
      fail(`${rel} missing expected content: ${needle}`)
      return false
    }
  }
  pass(rel + (needle ? ` contains "${needle}"` : ''))
  return true
}

function curlJson(url) {
  const result = spawnSync(
    'curl',
    ['-fsS', '-A', 'ModulaPhase7JBVerifier/1.0', url],
    {encoding: 'utf8', cwd: root},
  )
  if (result.status !== 0) {
    fail(`curl ${url} (exit ${result.status})`)
    return null
  }
  try {
    return JSON.parse(result.stdout)
  } catch {
    fail(`curl ${url} returned non-JSON`)
    return null
  }
}

console.log('Phase 7J-B cutover verifier')
console.log(`cwd=${root}`)

assertFile('docs/validation/phase7j-b-cutover-status.md', expectedSha.slice(0, 7))
assertFile('docs/validation/phase7j-b-cutover-status.md', 'Public identity agreement')
assertFile('docs/validation/evidence/phase7j-b/public-identity-proof.txt', expectedSha)
assertFile('docs/validation/evidence/phase7j-b/vps-source-gates.txt', 'TYPECHECK_EXIT=0')
assertFile('docs/validation/evidence/phase7j-b/vps-source-gates.txt', 'VERIFY_PHASE7J_MAC_EXIT=0')
assertFile('docs/validation/evidence/phase7j-b/founder-otp-login.txt', 'handle modula_org')
assertFile('docs/validation/evidence/phase7j-b/ui-logout-otp.txt', 'welcome')
assertFile('docs/validation/evidence/phase7j-b/moderation-report.txt', 'report 201')
assertFile('docs/validation/evidence/phase7j-b/golden-path-api.txt', 'follow 200 True')
assertFile('docs/validation/evidence/phase7j-b/surface-http-smoke.txt', '200 /sign-in')

const web = curlJson('https://modula.digital/version.json')
const api = curlJson('https://api.modula.digital/version.json')
const live = curlJson('https://api.modula.digital/v1/health/live')
const ready = curlJson('https://api.modula.digital/v1/health/ready')

if (web?.commit === expectedSha) pass(`web commit ${web.commit}`)
else fail(`web commit mismatch: ${web?.commit}`)
if (api?.commit === expectedSha) pass(`api commit ${api.commit}`)
else fail(`api commit mismatch: ${api?.commit}`)
if (api?.worker?.expectedCommit === expectedSha) pass(`worker expectedCommit ${api.worker.expectedCommit}`)
else fail(`worker expectedCommit mismatch: ${api?.worker?.expectedCommit}`)
if (live?.ok && live?.data?.status === 'live') pass('health live')
else fail('health live')
if (ready?.ok && ready?.data?.status === 'ready') pass('health ready')
else fail('health ready')

if (!existsSync(statusDoc)) fail('status doc missing')
else {
  const text = readFileSync(statusDoc, 'utf8')
  if (!text.includes('SOURCE_FAILURE=0')) fail('status missing SOURCE_FAILURE=0')
  else pass('SOURCE_FAILURE=0 recorded')
  if (!text.includes('LIVE_DEPLOYMENT_FAILURE=0')) fail('status missing LIVE_DEPLOYMENT_FAILURE=0')
  else pass('LIVE_DEPLOYMENT_FAILURE=0 recorded')
  if (!text.includes('Phase 7K')) fail('status missing Phase 7K note')
  else pass('Phase 7K next-phase note present')
}

if (!existsSync(path.join(evidence, '11-home-after-login.png'))) fail('missing home screenshot evidence')
else pass('home screenshot evidence present')

console.log('---')
if (failed) {
  console.error(`Phase 7J-B verifier FAILED (${failed})`)
  process.exit(1)
}
console.log('Phase 7J-B verifier PASS')
