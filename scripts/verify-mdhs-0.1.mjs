#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const avatarStudioRoot = process.env.MODULA_AVATAR_STUDIO_PATH || '/root/modula-mod/modula-avatar-studio'
let failed = 0

function pass(message) {
  console.log(`PASS: ${message}`)
}

function fail(message) {
  console.error(`FAIL: ${message}`)
  failed += 1
}

function assertFile(rel, needle) {
  const full = path.join(root, rel)
  if (!existsSync(full)) {
    fail(`missing ${rel}`)
    return ''
  }
  const text = readFileSync(full, 'utf8')
  if (needle && !text.includes(needle)) {
    fail(`${rel} missing ${needle}`)
  } else {
    pass(rel + (needle ? ` contains "${needle}"` : ''))
  }
  return text
}

function run(label, command, args) {
  console.log(`\n==> ${label}`)
  const result = spawnSync(command, args, {cwd: root, stdio: 'inherit'})
  if (result.status !== 0) {
    fail(`${label} exit ${result.status ?? 'null'}`)
    return false
  }
  pass(label)
  return true
}

function runIn(label, cwd, command, args) {
  console.log(`\n==> ${label}`)
  const result = spawnSync(command, args, {cwd, stdio: 'inherit'})
  if (result.status !== 0) {
    fail(`${label} exit ${result.status ?? 'null'}`)
    return false
  }
  pass(label)
  return true
}

function assert(condition, message) {
  if (condition) pass(message)
  else fail(message)
}

console.log('MDHS 0.1 verifier')
console.log(`cwd=${root}`)

assertFile('packages/avatar-contracts/package.json', '@modula/avatar-contracts')
assertFile('packages/avatar-contracts/schemas/mdhs-0.1.schema.json', 'modula://schemas/mdhs/0.1.0')
assertFile('docs/architecture/mdhs-overview.md', 'Identity is persistent. Appearance is temporal. Representation is contextual.')
assertFile('docs/specifications/mdhs-0.1.md', 'Render permission does not imply raw data permission.')
assertFile('docs/security/mdhs-biometric-data.md', 'cross-user biometric matching')
assertFile('docs/validation/phase7k-mdhs-contracts.md', 'contracts-first foundation')
assertFile('docs/validation/phase7k-avatar-studio.md', 'modula-mod/modula-avatar-studio')

if (run('@modula/avatar-contracts build', 'pnpm', ['--filter', '@modula/avatar-contracts', 'build'])) {
  const contracts = await import(path.join(root, 'packages/avatar-contracts/dist/index.js'))

  assert(contracts.MDHS_SCHEMA_VERSION === '0.1.0', 'schema version is 0.1.0')
  assert(contracts.MDHS_SCHEMA_URI === 'modula://schemas/mdhs/0.1.0', 'schema URI is canonical')

  const uri = contracts.formatAvatarUri('avatar_123', {kind: 'revision_number', revisionNumber: 4})
  const parsed = contracts.parseAvatarUri(uri)
  assert(uri === 'modula://avatar/avatar_123@revision_4', 'revision URI formats without ambiguity')
  assert(parsed.avatarId === 'avatar_123' && parsed.selector.revisionNumber === 4, 'revision URI parses')
  assert(contracts.parseAvatarUri('modula://avatar/avatar_123@2026-08-12').selector.kind === 'timestamp', 'timestamp URI parses')

  assert(contracts.isRegisteredAvatarAttributePath('physical.face.eyes.left.iris.colour'), 'left eye path registered')
  assert(contracts.isRegisteredAvatarAttributePath('physical.face.eyes.right.iris.colour'), 'right eye path registered')
  assert(!contracts.isRegisteredAvatarAttributePath('physical.random.trash'), 'unbounded attribute path rejected')
  assert(contracts.isValidAvatarConfidence(0) && contracts.isValidAvatarConfidence(1), 'confidence accepts inclusive range')
  assert(!contracts.isValidAvatarConfidence(1.1), 'confidence rejects values above 1')

  const unknown = contracts.createUnknownAvatarAttribute('physical.hair.colour.current', 'TEMPORAL_PHYSICAL')
  assert(unknown.status === 'unknown' && unknown.value === undefined && unknown.confidence === null, 'unknown attribute stays unknown without guessed value')

  const locked = {...unknown, ownerLocked: true}
  const autoChange = {
    id: 'change_1',
    observationId: 'obs_1',
    attributePath: 'physical.hair.colour.current',
    observedValue: 'black',
    confidence: 0.8,
    resolutionStatus: 'auto_accepted',
  }
  assert(!contracts.canObservationChangeMutateAttribute(locked, autoChange), 'owner lock blocks auto-accepted observation')

  assert(contracts.renderCapabilityAllowsRawData('avatar.render.image') === false, 'render.image does not grant raw data')
  assert(contracts.avatarCapabilityAllowsRawData('avatar.read.rawBiometrics') === true, 'raw biometric capability is explicit')
  assert(contracts.isPrivilegedAvatarCapability('avatar.read.identityEmbedding'), 'identity embedding is privileged')

  const projection = contracts.createEmptyMdhsProjection({
    avatarId: 'avatar_123',
    ownerAccountId: 'acct_123',
    revisionId: 'revision_1',
    createdAt: '2026-08-13T00:00:00Z',
  })
  const requiredRoots = [
    '$schema',
    'avatar',
    'modelStatus',
    'timeline',
    'physical',
    'geometry',
    'materials',
    'rig',
    'expressions',
    'motion',
    'voice',
    'appearance',
    'wardrobe',
    'personas',
    'representations',
    'observations',
    'history',
    'generationProfile',
    'permissions',
    'privacy',
    'provenance',
    'integrity',
    'extensions',
  ]
  assert(requiredRoots.every(key => key in projection), 'projection exposes all MDHS roots')

  const a = contracts.createMdhsStateHash({b: 2, a: 1})
  const b = contracts.createMdhsStateHash({a: 1, b: 2})
  const c = contracts.createMdhsStateHash({a: 1, b: 3})
  assert(a === b, 'state hash is stable across object key order')
  assert(a !== c, 'state hash changes when state changes')

  const completeness = contracts.computeAvatarCompleteness([unknown])
  assert(completeness.some(item => item.domain === 'overall'), 'completeness returns overall domain')
}

if (!existsSync(avatarStudioRoot)) {
  fail(`missing Avatar Studio repo at ${avatarStudioRoot}`)
} else {
  const manifestText = readFileSync(path.join(avatarStudioRoot, 'module.manifest.json'), 'utf8')
  assert(manifestText.includes('"moduleId": "modula.avatar-studio"'), 'Avatar Studio module ID recorded')
  assert(manifestText.includes('"moduleStandardVersion": "2.0.0"'), 'Avatar Studio Standard version recorded')
  assert(manifestText.includes('"avatar.read.rawBiometrics"'), 'Avatar Studio raw biometric deny policy recorded')
  runIn('Avatar Studio verify', avatarStudioRoot, 'pnpm', ['verify'])
}

console.log('\n---')
if (failed > 0) {
  console.error(`MDHS 0.1 verifier FAILED (${failed})`)
  process.exit(1)
}
console.log('MDHS 0.1 verifier PASS')
