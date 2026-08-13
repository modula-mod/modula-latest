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
const headSha = currentHead()
const expectedSha = process.env.MODULA_PHASE7J_B_EXPECTED_SHA?.trim() || recordedIdentitySha() || headSha
let failed = 0

function currentHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8', cwd: root})
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || 'git rev-parse HEAD failed')
    process.exit(result.status ?? 1)
  }
  return result.stdout.trim()
}

function recordedIdentitySha() {
  try {
    const text = readFileSync(path.join(evidence, 'identity-agreement.json'), 'utf8')
    const json = JSON.parse(text)
    return typeof json?.sha === 'string' && json.sha.trim() ? json.sha.trim() : ''
  } catch {
    return ''
  }
}

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

function assertExpectedShaIsSafeForHead() {
  if (expectedSha === headSha) {
    pass(`expected SHA matches HEAD ${headSha}`)
    return
  }

  const exists = spawnSync('git', ['cat-file', '-e', `${expectedSha}^{commit}`], {cwd: root})
  if (exists.status !== 0) {
    fail(`expected SHA ${expectedSha} is not a local commit`)
    return
  }

  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', expectedSha, headSha], {cwd: root})
  if (ancestor.status !== 0) {
    fail(`expected SHA ${expectedSha} is not an ancestor of HEAD ${headSha}`)
    return
  }

  const runtimePaths = [
    'services/greenfield-api/migrations',
    'services/greenfield-api/src',
    'services/greenfield-worker/src',
    'src',
    'packages/api-contracts',
    'packages/atproto-lexicons',
    'packages/dimon-contracts',
    'packages/greenfield-connector-contracts',
    'packages/greenfield-contracts',
    'packages/greenfield-mcp',
    'packages/greenfield-module-engine-contracts',
    'packages/greenfield-module-manifest',
    'packages/greenfield-module-registry-contracts',
    'packages/greenfield-module-sdk',
    'packages/greenfield-module-ui-contracts',
    'packages/greenfield-protocol',
    'packages/greenfield-runtime',
    'packages/greenfield-schema-registry',
    'packages/modula-cli',
    'packages/protocol-contracts',
    'public',
    'ops',
  ]
  const diff = spawnSync('git', ['diff', '--quiet', `${expectedSha}..${headSha}`, '--', ...runtimePaths], {cwd: root})
  if (diff.status === 0) {
    pass(`HEAD ${headSha} is proof-only relative to deployed SHA ${expectedSha}`)
  } else {
    fail(`HEAD ${headSha} has runtime/source delta after deployed SHA ${expectedSha}`)
  }
}

console.log('Phase 7J-B cutover verifier')
console.log(`cwd=${root}`)
console.log(`headSha=${headSha}`)
console.log(`expectedSha=${expectedSha}`)
assertExpectedShaIsSafeForHead()

assertFile('docs/validation/phase7j-b-cutover-status.md', 'Deployed / proven SHA')
assertFile('docs/validation/phase7j-b-cutover-status.md', expectedSha)
assertFile('docs/validation/phase7j-b-cutover-status.md', 'Public identity agreement')
assertFile('docs/validation/evidence/phase7j-b/public-identity-proof.txt', '=== web version.json ===')
assertFile('docs/validation/evidence/phase7j-b/public-identity-proof.txt', '=== api version.json ===')
assertFile('docs/validation/evidence/phase7j-b/public-identity-proof.txt', expectedSha)
assertFile('docs/validation/evidence/phase7j-b/identity-agreement.json', expectedSha)
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
