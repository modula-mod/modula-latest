#!/usr/bin/env node
/**
 * Phase 7M-B8 source gate — founder mockup reconstruction invariants.
 * ENGINEERING PASS only. Does not claim FOUNDER VISUAL APPROVAL.
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function file(name) {
  return path.join(root, name)
}

function read(name) {
  if (!existsSync(file(name))) return ''
  return readFileSync(file(name), 'utf8')
}

function record(label, ok, detail = '') {
  console.log(`${label.padEnd(42)} ${ok ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ''}`)
}

function contains(name, needle, label) {
  const source = read(name)
  record(label, source.includes(needle), source ? '' : `missing ${name}`)
}

function absent(name, needle, label) {
  const source = read(name)
  record(label, Boolean(source) && !source.includes(needle), source ? '' : `missing ${name}`)
}

console.log('Phase 7M-B8 source verifier\n')
console.log('# Gate docs')
for (const [label, name] of [
  ['BASELINE', 'docs/validation/phase7m-b8-source-baseline.md'],
  ['MANIFEST', 'docs/design/phase7m-b8-founder-mockup-manifest.md'],
  ['MATRIX', 'docs/design/phase7m-b8-component-reconstruction-matrix.md'],
  ['OVERLAYS', 'docs/design/phase7m-b8-overlay-map.md'],
]) {
  record(label, existsSync(file(name)), name)
}

const mockDir = 'docs/validation/evidence/phase7m-b8/founder-mockups'
const mockCount = existsSync(file(mockDir))
  ? readdirSync(file(mockDir)).filter(n => n.endsWith('.png')).length
  : 0
record('FOUNDER MOCKUPS', mockCount >= 28, `${mockCount} png`)
contains('docs/design/phase7m-b8-founder-mockup-manifest.md', 'UNKNOWN MOCKUPS: **0**', 'UNKNOWN MOCKUPS ZERO')
contains('docs/design/phase7m-b8-component-reconstruction-matrix.md', 'UNKNOWN | **0**', 'MATRIX NO UNKNOWN')

console.log('\n# App Lock (local-only)')
contains('src/features/security/app-lock/app-lock-storage.ts', 'LOCAL ONLY', 'APPLOCK LOCAL BANNER')
contains('src/features/security/app-lock/app-lock-storage.ts', 'browserStorage', 'APPLOCK WEB STORAGE')
for (const [label, name] of [
  ['APPLOCK PIN', 'src/features/security/app-lock/UnlockPinScreen.tsx'],
  ['APPLOCK PATTERN', 'src/features/security/app-lock/UnlockPatternScreen.tsx'],
  ['APPLOCK PASSWORD', 'src/features/security/app-lock/UnlockPasswordScreen.tsx'],
  ['APPLOCK BIOMETRIC', 'src/features/security/app-lock/UnlockBiometricScreen.tsx'],
  ['APPLOCK GATE', 'src/features/security/app-lock/AppLockGate.tsx'],
  ['APPLOCK SETTINGS', 'src/features/security/app-lock/AppLockSettingsPanel.tsx'],
  ['APPLOCK ROUTE', 'src/app/settings/app-lock.tsx'],
]) {
  record(label, existsSync(file(name)))
}
contains('src/features/settings/screens/SettingsExtraScreens.tsx', 'Local App Lock', 'SECURITY SETTINGS LINK')
contains('src/app/_layout.tsx', 'AppLockProvider', 'APPLOCK PROVIDER')
contains('src/features/security/app-lock/app-lock-context.tsx', 'unavailable in the GreenField web host', 'BIOMETRIC WEB BOUNDARY')

console.log('\n# Module identity + Vault Notes honesty')
contains('src/features/modules/identity/moduleIdentitySubtext.ts', 'moduleIdentitySubtext', 'IDENTITY HELPER')
contains('src/features/marketplace/screens/ModuleDetailScreen.tsx', 'moduleIdentitySubtext(', 'DETAIL IDENTITY')
contains('src/features/modules/components/presentation/ModuleRow.tsx', 'moduleIdentitySubtext(', 'HUB ROW IDENTITY')
contains('src/features/marketplace/screens/ModuleDetailScreen.tsx', 'candidate', 'VAULT CANDIDATE HONESTY')
contains('src/platform/ui/chrome/product-stats-row.tsx', 'never invent ratings', 'STATS HONEST COMMENT')
contains(
  'packages/greenfield-contracts/src/canonical-module-identity.ts',
  'digital.modula.vault-notes',
  'CANONICAL VAULT ID',
)

console.log('\n# Post V2 grammar preserved')
for (const [label, name] of [
  ['POST SHELL', 'src/features/social/posts/components/post-shell.tsx'],
  ['ACTION RAIL', 'src/features/social/posts/components/post-action-rail.tsx'],
  ['REACTION PICKER', 'src/features/social/posts/interactions/reaction-picker.tsx'],
  ['CONTEXT MENU', 'src/features/social/posts/interactions/post-context-menu.tsx'],
  ['COMMENTS', 'src/features/social/posts/interactions/comments-surface.tsx'],
  ['MUSIC', 'src/features/social/posts/renderers/music-post-renderer.tsx'],
  ['VIDEO', 'src/features/social/posts/renderers/video-post-renderer.tsx'],
  ['CAROUSEL', 'src/features/social/posts/renderers/carousel-post-renderer.tsx'],
]) {
  record(label, existsSync(file(name)))
}
const reactionUi = read('src/features/social/posts/state/post-interaction-types.ts')
const reactionContract = read('packages/greenfield-contracts/src/reaction.ts')
for (const reaction of ['like', 'love', 'laugh', 'fire', 'celebrate', 'insightful', 'support', 'curious']) {
  record(
    `REACTION ${reaction.toUpperCase()}`,
    reactionContract.includes(`'${reaction}'`) && reactionUi.includes(`'${reaction}'`),
  )
}

console.log('\n# Auth consumer copy')
absent('src/auth/screens/WelcomeScreen.tsx', 'Greenfield owns accounts', 'NO ARCHI WELCOME JARGON')
contains('src/auth/screens/WelcomeScreen.tsx', 'Get started', 'WELCOME CTA')

console.log('\n# Freeze')
contains('docs/validation/phase7m-b8-source-baseline.md', '7M-C:** NOT AUTHORISED', '7M-C BLOCKED')
contains('docs/validation/phase7m-b8-source-baseline.md', 'FOUNDER VISUAL APPROVAL:** REQUIRED', 'FOUNDER APPROVAL REQUIRED')

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`)
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}
console.log('\nPhase 7M-B8 source verifier: PASS')
console.log('FOUNDER VISUAL APPROVAL = REQUIRED (not granted by this gate)')
