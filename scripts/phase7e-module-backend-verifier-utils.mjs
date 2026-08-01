import {existsSync, readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {spawnSync} from 'node:child_process'

export const root = process.cwd()
export const standardRoot = resolve(root, '../modula-mod/modula-module-standard')
export const failures = []

export function pass(message) {
  console.log(`PASS ${message}`)
}

export function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

export function read(path, base = root) {
  const absolute = join(base, path)
  if (!existsSync(absolute)) {
    fail(`missing ${relativeLabel(path, base)}`)
    return ''
  }
  return readFileSync(absolute, 'utf8')
}

export function exists(path, base = root) {
  const present = existsSync(join(base, path))
  if (present) pass(`found ${relativeLabel(path, base)}`)
  else fail(`missing ${relativeLabel(path, base)}`)
  return present
}

export function includes(path, markers, label, base = root) {
  const text = read(path, base)
  let ok = true
  for (const marker of markers) {
    if (!text.includes(marker)) {
      ok = false
      fail(`${label} missing marker ${marker}`)
    }
  }
  if (ok) pass(label)
  return ok
}

export function expect(condition, label) {
  if (condition) pass(label)
  else fail(label)
}

export function packageVersion(path, expected, base = standardRoot) {
  const text = read(path, base)
  if (!text) return
  const pkg = JSON.parse(text)
  expect(pkg.version === expected, `${relativeLabel(path, base)} version is ${expected}`)
}

export function packageVersionAtRef(ref, path, expected, base = standardRoot) {
  const text = git(['show', `${ref}:${path}`], base)
  if (!text) {
    fail(`${relativeLabel(path, base)} missing at ${ref}`)
    return
  }
  const pkg = JSON.parse(text)
  expect(pkg.version === expected, `${relativeLabel(path, base)} version is ${expected} at ${ref}`)
}

export function git(args, cwd = root) {
  const result = spawnSync('git', args, {cwd, encoding: 'utf8', shell: false})
  if (result.status !== 0) return null
  return result.stdout.trim()
}

export function gitSucceeds(args, cwd = root) {
  return spawnSync('git', args, {cwd, stdio: 'ignore', shell: false}).status === 0
}

export function run(command, args, label, env = process.env, cwd = root) {
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit', shell: false})
  if (result.status === 0) pass(label)
  else fail(`${label} exited ${result.status ?? 'without status'}`)
}

export function finish(label) {
  if (failures.length > 0) {
    console.error(`${label} failed: ${failures.length} issue(s)`)
    process.exit(1)
  }
  console.log(`${label} passed`)
}

export function verifyStandard11Surface() {
  exists('.git', standardRoot)
  const standardHead = git(['rev-parse', 'HEAD'], standardRoot)
  const standard11Commit = git(['rev-list', '-n', '1', 'mms-v1.1.0'], standardRoot)
  expect(Boolean(standardHead && standard11Commit), 'mms-v1.1.0 release tag exists')
  if (standardHead && standard11Commit) {
    expect(
      gitSucceeds(['merge-base', '--is-ancestor', standard11Commit, standardHead], standardRoot),
      'mms-v1.1.0 release commit is contained in current Standard HEAD',
    )
  }
  for (const packagePath of [
    'package.json',
    'packages/module-standard/package.json',
    'packages/module-validator/package.json',
    'packages/module-sdk/package.json',
    'packages/create-module/package.json',
    'packages/module-testing/package.json',
    'packages/module-fixtures/package.json',
    'packages/module-backend-protocol/package.json',
    'packages/module-backend-testing/package.json',
    'packages/module-backend-fixtures/package.json',
  ]) {
    packageVersionAtRef('mms-v1.1.0', packagePath, '1.1.0', standardRoot)
  }
  includes('packages/module-standard/src/index.ts', [
    "MODULA_MODULE_STANDARD_1_1_VERSION = '1.1.0'",
    "MODULA_MANIFEST_SCHEMA_1_1_VERSION = '1.1.0'",
    'MODULA_MODULE_BACKEND_PROTOCOL_VERSION',
    'ModuleBackendDefinition',
    'ResolvedModuleCapability',
    'ModuleSessionClaims',
    'ModuleBackendDiscovery',
    "'greenfield-managed'",
    "'module-managed'",
    "'hybrid'",
    "'frontend-only'",
  ], 'Standard 1.1 backend types exist', standardRoot)
  includes('packages/module-validator/src/index.ts', [
    'SUPPORTED_STANDARD_VERSIONS',
    'MODULA_MODULE_STANDARD_LEGACY_VERSION',
    'MODULA_MODULE_STANDARD_SUPPORTED_VERSIONS',
    '1.1.0',
    'TOKEN_EXCHANGE_REQUIRED',
    'FRONTEND_ONLY_BACKEND_DECLARATION',
    'UNSAFE_BACKEND_HOST',
    'ARBITRARY_BACKEND_URL',
  ], 'Standard validator preserves 1.0 and enforces backend 1.1 guardrails', standardRoot)
}

function relativeLabel(path, base) {
  return base === standardRoot ? `standard:${path}` : path
}
