import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'docs/validation/phase7l-a-release-identity.md',
  'docs/validation/phase7l-a-auth-journey.md',
  'docs/validation/phase7l-a-auth-ui.md',
  'docs/validation/phase7l-a-icon-rendering.md',
  'docs/validation/phase7l-a-media-rendering.md',
  'docs/validation/phase7l-a-static-assets.md',
  'docs/validation/phase7l-a-browser-runtime.md',
  'docs/validation/phase7l-a-product-hub-vault-notes.md',
  'docs/validation/phase7l-a-module-runtime-health.md',
  'docs/validation/phase7l-a-native-audit.md',
  'docs/validation/phase7l-a-ui-defect-inventory.md',
  'docs/validation/phase7l-a-feature-matrix.md',
  'docs/roadmap/phase7l-b-beta-remediation.md',
  'docs/product/modula-beta-feature-manifest.md',
  'docs/validation/evidence/phase7l-a/api-production-audit-v2.jsonl',
  'docs/validation/evidence/phase7l-a/api-production-audit-v3-targeted.jsonl',
  'docs/validation/evidence/phase7l-a/api-production-audit-v4-password-vault.jsonl',
  'docs/validation/evidence/phase7l-a/browser-public/runtime-events.json',
  'docs/validation/evidence/phase7l-a/browser-public/network-resources.json',
]

const allowedStatuses = new Set([
  'WORKING',
  'WORKING_WITH_DEFECTS',
  'BROKEN',
  'NOT_RENDERING',
  'INCOMPLETE',
  'COMING_SOON',
  'INTERNAL_ONLY',
  'DUPLICATED',
  'STALE',
  'MISLEADING',
  'SECURITY_BLOCKED',
])

const allowedManifestStates = new Set(['BETA_SUPPORTED', 'COMING_SOON', 'INTERNAL_ONLY'])

const failures = []

function rel(file) {
  return path.join(root, file)
}

function readRequired(file) {
  const full = rel(file)
  if (!existsSync(full)) {
    failures.push(`Missing required artifact: ${file}`)
    return ''
  }
  const stat = statSync(full)
  if (!stat.isFile() || stat.size === 0) {
    failures.push(`Empty required artifact: ${file}`)
    return ''
  }
  return readFileSync(full, 'utf8')
}

function printCheck(label, ok) {
  console.log(`${label.padEnd(24)} ${ok ? 'PASS' : 'FAIL'}`)
}

for (const file of requiredFiles) readRequired(file)

const screenshotDir = rel('docs/validation/evidence/phase7l-a/browser-public')
const screenshotCount = existsSync(screenshotDir)
  ? readdirSync(screenshotDir).filter(file => file.endsWith('.png')).length
  : 0
if (screenshotCount < 10) {
  failures.push(`Expected at least 10 browser screenshots, found ${screenshotCount}`)
}

const featureMatrix = readRequired('docs/validation/phase7l-a-feature-matrix.md')
const featureRows = []
for (const line of featureMatrix.split('\n')) {
  if (!line.startsWith('| ') || line.includes('---')) continue
  const columns = line
    .split('|')
    .slice(1, -1)
    .map(column => column.trim())
  if (columns[0] === 'Feature') continue
  if (columns.length >= 11) featureRows.push(columns)
}

if (featureRows.length === 0) failures.push('Feature matrix contains no parsed feature rows')

let p0Count = 0
let p1Count = 0
let unknownCount = 0
const invalidStatuses = []

for (const row of featureRows) {
  const status = row[9]
  const priority = row[10]
  if (status === 'UNKNOWN') unknownCount += 1
  if (!allowedStatuses.has(status)) invalidStatuses.push(`${row[0]} => ${status}`)
  if (priority === 'P0') p0Count += 1
  if (priority === 'P1') p1Count += 1
}

if (invalidStatuses.length > 0) {
  failures.push(`Invalid feature statuses:\n${invalidStatuses.join('\n')}`)
}
if (unknownCount > 0) failures.push(`Unknown feature classifications remain: ${unknownCount}`)

const manifest = readRequired('docs/product/modula-beta-feature-manifest.md')
const invalidManifestStates = []
for (const line of manifest.split('\n')) {
  if (!line.startsWith('| ') || line.includes('---')) continue
  const columns = line
    .split('|')
    .slice(1, -1)
    .map(column => column.trim())
  if (columns[0] === 'Feature') continue
  const state = columns[2]
  if (state && !allowedManifestStates.has(state)) {
    invalidManifestStates.push(`${columns[0]} => ${state}`)
  }
}
if (invalidManifestStates.length > 0) {
  failures.push(`Invalid beta manifest states:\n${invalidManifestStates.join('\n')}`)
}

const release = readRequired('docs/validation/phase7l-a-release-identity.md')
const sourceBaselineOk =
  release.includes('fb4b58c07bf475d99ab6792d367058331257ea97') &&
  release.includes('2ef3755082b46e49fe62424e93d4a4de9c6f1e17')
const productionIdentityOk =
  release.includes('https://modula.digital/version.json') &&
  release.includes('https://api.modula.digital/version.json')

const authOk = readRequired('docs/validation/phase7l-a-auth-journey.md').includes(
  'Successful login',
)
const iconsOk = readRequired('docs/validation/phase7l-a-icon-rendering.md').includes(
  'Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf',
)
const mediaOk = readRequired('docs/validation/phase7l-a-media-rendering.md').includes(
  'ERR_BLOCKED_BY_RESPONSE.NotSameOrigin',
)
const browserOk = readRequired('docs/validation/phase7l-a-browser-runtime.md').includes(
  'React hydration/runtime error',
)
const productHub = readRequired('docs/validation/phase7l-a-product-hub-vault-notes.md')
const productHubOk =
  productHub.includes('digital.modula.vault-notes') &&
  productHub.includes('modula.module.vaultNotes') &&
  productHub.includes('DUPLICATE')
const vaultNotesOk =
  productHub.includes('Vault Notes API lifecycle') &&
  productHub.includes('Create note after enable') &&
  productHub.includes('VALIDATION_FAILED')
const nativeOk = readRequired('docs/validation/phase7l-a-native-audit.md').includes(
  'xcodebuild',
)
const moduleRuntime = readRequired('docs/validation/phase7l-a-module-runtime-health.md')
const moduleRuntimeOk =
  moduleRuntime.includes('TEST_ENV_FAILURE') &&
  moduleRuntime.includes('LIVE_DEPLOYMENT_FAILURE') &&
  moduleRuntime.includes('Phase 7I canonical source verification passed')
const roadmapOk = readRequired('docs/roadmap/phase7l-b-beta-remediation.md').includes(
  'P0',
)
const manifestOk = manifest.includes('BETA_SUPPORTED') && manifest.includes('INTERNAL_ONLY')

if (!sourceBaselineOk) failures.push('Release identity does not contain expected source/beta SHAs')
if (!productionIdentityOk) failures.push('Production identity endpoints are not recorded')
if (!authOk) failures.push('Auth journey audit is missing required successful-login conclusion')
if (!iconsOk) failures.push('Icon audit is missing font evidence')
if (!mediaOk) failures.push('Media audit is missing blocked media evidence')
if (!browserOk) failures.push('Browser runtime audit is missing hydration/runtime classification')
if (!productHubOk) failures.push('Product Hub audit is missing canonical/duplicate Vault Notes evidence')
if (!vaultNotesOk) failures.push('Vault Notes audit is missing lifecycle/create-note classification')
if (!moduleRuntimeOk) failures.push('Module runtime health audit is missing failure classification')
if (!nativeOk) failures.push('Native audit is missing Mac xcodebuild command classification')
if (!roadmapOk) failures.push('Remediation roadmap is missing severity ordering')
if (!manifestOk) failures.push('Beta feature manifest is missing beta state classifications')

printCheck('SOURCE BASELINE', sourceBaselineOk)
printCheck('PRODUCTION IDENTITY', productionIdentityOk)
printCheck('AUTH AUDITED', authOk)
printCheck('ICONS AUDITED', iconsOk)
printCheck('MEDIA AUDITED', mediaOk)
printCheck('BROWSER RUNTIME', browserOk)
printCheck('SOCIAL AUDITED', featureMatrix.includes('Reactions Like/Love/Laugh/Fire'))
printCheck('STORIES AUDITED', featureMatrix.includes('Stories rail/create/view/delete'))
printCheck('PRODUCT HUB AUDITED', productHubOk)
printCheck('VAULT NOTES AUDITED', vaultNotesOk)
printCheck('MODULE RUNTIME', moduleRuntimeOk)
printCheck('SETTINGS AUDITED', featureMatrix.includes('| Settings home |'))
printCheck('APPEARANCE AUDITED', featureMatrix.includes('| Appearance modes |'))
printCheck('NATIVE AUDITED', nativeOk)
printCheck('FEATURE MATRIX', featureRows.length > 0 && invalidStatuses.length === 0)
printCheck('BETA MANIFEST', invalidManifestStates.length === 0 && manifestOk)
printCheck('REPAIR ROADMAP', roadmapOk)
console.log(`P0 COUNT                ${p0Count}`)
console.log(`P1 COUNT                ${p1Count}`)
console.log(`UNKNOWN FEATURES        ${unknownCount}`)
console.log(`BROWSER SCREENSHOTS     ${screenshotCount}`)

if (failures.length > 0) {
  console.error('\nPhase 7L-A audit verifier failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
