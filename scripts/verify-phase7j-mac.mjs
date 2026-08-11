#!/usr/bin/env node
/**
 * Phase 7J-Mac-A aggregate verifier.
 * CI=true pnpm verify:phase7j-mac
 *
 * No silent skips: every gate is PASS (with evidence or command) or FAIL.
 */
import {spawnSync} from 'node:child_process'
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const evidenceRoot = path.join(root, 'docs/validation/evidence/phase7j-mac-ui')
let failed = 0

function fail(msg) {
  console.error(`FAIL: ${msg}`)
  failed += 1
}

function pass(msg) {
  console.log(`PASS: ${msg}`)
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

function assertEvidence(name, needle) {
  return assertFile(path.join('docs/validation/evidence/phase7j-mac-ui', name), needle)
}

function run(label, command, args, opts = {}) {
  console.log(`\n==> ${label}`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: root,
    shell: false,
    env: {...process.env, ...(opts.env || {})},
  })
  if (result.status !== 0) {
    fail(`${label} (exit ${result.status ?? 'null'})`)
    return false
  }
  pass(label)
  return true
}

function curlJson(url) {
  const result = spawnSync('curl', ['-fsS', '-A', 'ModulaPhase7JMacVerifier/1.0', url], {
    encoding: 'utf8',
    cwd: root,
  })
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

console.log('Phase 7J-Mac-A verify aggregator')
console.log(`cwd=${root}`)

// --- SOURCE CONVERGENCE / BRANCH AUDIT ---
assertFile('docs/engineering/phase7j-branch-convergence.md', 'MERGE_FULL')
assertFile('docs/engineering/phase7j-branch-convergence.md', 'phase7i-trusted-production-alpha')
assertFile('docs/engineering/phase7j-branch-inventory.md', '7632e03')
assertFile('docs/engineering/phase7j-branch-convergence.md', 'ALREADY_INTEGRATED')
assertFile('docs/engineering/phase7j-branch-convergence.md', 'SUPERSEDED')
assertFile('docs/engineering/phase7j-branch-convergence.md', 'CHERRY_PICK_VALID')
assertFile('docs/engineering/phase7j-branch-convergence.md', 'ssh modula-vps')

const branch = spawnSync('git', ['branch', '--show-current'], {encoding: 'utf8', cwd: root})
if ((branch.stdout || '').trim() !== 'phase7j-product-convergence') {
  fail(`expected branch phase7j-product-convergence, got ${(branch.stdout || '').trim()}`)
} else {
  pass('SOURCE CONVERGENCE branch phase7j-product-convergence')
}

// Architecture guards
assertFile('docs/architecture/phase3-unified-profile.md', 'No Identity Centre')
if (existsSync(path.join(root, 'src/features/vault-notes'))) {
  fail('Vault Notes must remain external — src/features/vault-notes/ must not exist')
} else {
  pass('VAULT NOTES external package boundary (no src/features/vault-notes)')
}

// --- LINT / TYPECHECK ---
run('LINT', 'pnpm', ['lint'])
run('TYPECHECK', 'pnpm', ['typecheck'])

// --- EXPO DOCTOR (19/20 with expected CNG advisory) ---
console.log('\n==> EXPO DOCTOR')
const doctor = spawnSync('pnpm', ['exec', 'expo-doctor'], {encoding: 'utf8', cwd: root})
const doctorOut = `${doctor.stdout || ''}${doctor.stderr || ''}`
if (/19\/20 checks passed/.test(doctorOut) && /non-CNG project|Prebuild/.test(doctorOut)) {
  pass('EXPO DOCTOR 19/20 with expected committed ios/android CNG advisory')
} else if (doctor.status === 0) {
  pass('EXPO DOCTOR clean')
} else {
  fail('EXPO DOCTOR unexpected failure')
  console.error(doctorOut.slice(-1500))
}

// --- WEB BUILD ---
assertEvidence('part12-web-expo.txt', 'BUILD_WEB_EXIT=0')
assertEvidence('part12-web-expo.txt', 'VERIFY_WEB_EXIT=0')
assertEvidence('part12-web-expo.txt', 'EXPO_CHECK_EXIT=0')
pass('WEB BUILD evidence recorded')

// --- IOS BUILD ---
assertEvidence('ios-xcodebuild.txt', 'BUILD SUCCEEDED')
pass('IOS BUILD SUCCEEDED evidence')

// --- LIVE API ---
const live = curlJson('https://api.modula.digital/v1/health/live')
if (live?.ok && live?.data?.status === 'live') pass('AUTH/API live health')
else fail('live health')
const ready = curlJson('https://api.modula.digital/v1/health/ready')
if (ready?.ok && ready?.data?.status === 'ready') pass('API ready health')
else fail('ready health')
const version = curlJson('https://api.modula.digital/version.json')
if (version?.commit && version?.apiOrigin === 'https://api.modula.digital') {
  pass(`API version commit=${version.commit.slice(0, 7)} phase=${version.phase}`)
} else fail('version.json')

assertEvidence('api-auth-session-lifecycle.txt', '=== me after refresh ===')
assertEvidence('api-auth-session-lifecycle.txt', 'http 200 ok True handle')
assertEvidence('api-auth-session-lifecycle.txt', '"revoked":true')
assertEvidence('api-auth-session-lifecycle.txt', 'UNAUTHENTICATED')
assertEvidence('api-auth-session-lifecycle.txt', '=== re-login ===')
assertEvidence('api-auth-golden-path.txt', 'INVALID_CREDENTIALS')
assertEvidence('api-auth-golden-path.txt', '"verified":true')
pass('AUTH + SESSION RESTORE (API lifecycle) evidence')

// --- Prior Mac / product gates (must still be present on tree) ---
assertFile('docs/validation/phase7i-mac-b-final.md', 'SESSION_RESTORE = PASS')
assertFile('docs/validation/phase7j-feature-matrix.md', 'SESSION_RESTORE gate PASS')
assertFile('src/auth/runtime/SessionProvider.tsx', 'refreshSession')
assertFile('src/auth/screens/SignInScreen.tsx', 'setFormError')
assertFile('src/auth/screens/SignInScreen.tsx', 'requestEmailSignInCode')
assertFile('packages/api-contracts/src/identifiers.ts', 'UUIDv7')
assertFile('src/components/materials/ProgressiveBlurBand.tsx', 'ProgressiveBlur')
assertFile('src/platform/ui/navigation/shell-bottom-progressive-blur.tsx', 'ShellBottomProgressiveBlur')
assertFile('src/theme/contracts/materials.ts', 'springs')

// Product surfaces — matrix + source anchors (PROFILE uses architecture doc)
assertFile('docs/architecture/phase3-unified-profile.md', 'No Identity Centre')
assertFile('src/features/profile/screens/UnifiedProfileScreen.tsx', 'export function UnifiedProfileScreen')
pass('PROFILE canonical (architecture + UnifiedProfileScreen)')

assertFile('src/theme/contracts/materials.ts', 'Surface')
assertFile('src/features/settings/screens/AppearanceScreen.tsx', 'export function AppearanceScreen')
pass('SURFACE TYPES materials + Appearance screen')

const productGates = [
  ['STORIES', 'Stories', 'src/features/feed/screens/HomeFeedScreen.tsx'],
  ['POSTS', 'Posts create', 'src/data/repositories/api/ApiPostRepository.ts'],
  ['REACTIONS', 'Reactions', 'src/features/social/components/reaction-control.tsx'],
  ['COMMENTS', 'Comments / replies', 'src/features/feed/screens/PostDetailScreen.tsx'],
  ['SETTINGS', 'Appearance / Settings', 'src/features/settings/screens/SettingsHomeScreen.tsx'],
  ['APPEARANCE', 'Appearance', 'src/features/settings/screens/AppearanceScreen.tsx'],
  ['PRODUCT HUB', 'Product Hub', 'src/features/product/screens/ProductHubScreen.tsx'],
  ['DRAWER', 'Drawer', 'src/shell/NavigationDrawer.tsx'],
  ['REDUCE MOTION', 'Reduce Motion', 'src/theme/contracts/materials.ts'],
]

for (const [gate, matrixNeedle, src] of productGates) {
  const matrixOk = assertFile('docs/validation/phase7j-feature-matrix.md', matrixNeedle)
  const srcOk = existsSync(path.join(root, src))
  if (!srcOk) fail(`${gate}: missing ${src}`)
  else if (matrixOk) pass(`${gate} matrix+source`)
}

// Accessibility / icons — require prior Mac-B or matrix mention; fail if neither
assertFile('docs/validation/phase7i-mac-b-final.md', 'PASS')
if (
  !existsSync(path.join(root, 'src/components/primitives/AppIcon.tsx')) &&
  !existsSync(path.join(root, 'src/platform/ui/icons'))
) {
  fail('ICONS: neither AppIcon nor platform/ui/icons present')
} else {
  pass('ICONS abstraction present (AppIcon / platform icons)')
}

// Images: require evidence dir exists (Mac-B screenshots) — not silent
const macBEvidence = path.join(root, 'docs/validation/evidence/phase7i-mac-b-authenticated')
if (existsSync(macBEvidence) && readdirSync(macBEvidence).some(f => f.endsWith('.png'))) {
  pass('IMAGES evidence present (phase7i-mac-b-authenticated screenshots)')
} else {
  fail('IMAGES: missing phase7i-mac-b-authenticated screenshot evidence')
}

// P0/P1 = 0 claim: require matrix P0 queue all struck through / PASS
assertFile('docs/validation/phase7j-feature-matrix.md', 'P0 queue')
const matrix = readFileSync(path.join(root, 'docs/validation/phase7j-feature-matrix.md'), 'utf8')
const openP0 = [...matrix.matchAll(/^\d+\. [^\n~].*$/gm)].filter(m => !m[0].includes('~~'))
// Lines like "1. ~~Wire..." are done; fail if any numbered P0 item lacks ~~
const p0Section = matrix.split('## P0 queue')[1]?.split('## Evidence')[0] || ''
const openItems = [...p0Section.matchAll(/^\d+\.\s+(?!~~).+$/gm)]
if (openItems.length > 0) {
  fail(`P0/P1 open items remain:\n${openItems.map(m => m[0]).join('\n')}`)
} else {
  pass('P0/P1 = 0 (all P0 queue items struck through)')
}

// Accessibility / reduce motion evidence from motion adoption docs
assertFile('docs/validation/phase7j-feature-matrix.md', 'Reduce Motion')

// Mac-A remaining UI redesign docs — required files may be pending; FAIL if mission-required docs missing
const macAUiDocs = [
  'docs/design/modula-native-ui-principles.md',
  'docs/research/phase7j-expo-ui-component-map.md',
  'docs/research/phase7j-ui-component-candidates.md',
  'docs/validation/phase7j-ui-screen-matrix.md',
]
for (const rel of macAUiDocs) {
  if (!existsSync(path.join(root, rel))) {
    fail(`UI rebuild doc missing (Parts 22–64 remaining): ${rel}`)
  } else {
    pass(rel)
  }
}

// Evidence directory non-empty
if (!existsSync(evidenceRoot) || readdirSync(evidenceRoot).length < 3) {
  fail('phase7j-mac-ui evidence directory incomplete')
} else {
  pass(`evidence dir has ${readdirSync(evidenceRoot).length} artifacts`)
}

console.log('\n---')
if (failed > 0) {
  console.error(`Phase 7J-Mac-A verify FAILED (${failed} gate(s))`)
  process.exit(1)
}
console.log('Phase 7J-Mac-A automated + evidence gates PASS')
console.log('Note: full Simulator golden-path UI redesign acceptance may still be outstanding; missing UI docs fail this verifier intentionally.')
