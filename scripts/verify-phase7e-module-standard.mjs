#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const standardRoot = resolve(root, '../modula-mod/modula-module-standard')
const failures = []

function pass(message) {
  console.log(`PASS ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

function file(path) {
  const absolute = join(root, path)
  if (!existsSync(absolute)) {
    fail(`missing ${path}`)
    return ''
  }
  pass(`found ${path}`)
  return readFileSync(absolute, 'utf8')
}

function standardFile(path) {
  const absolute = join(standardRoot, path)
  if (!existsSync(absolute)) {
    fail(`missing external standard ${path}`)
    return ''
  }
  pass(`found external standard ${path}`)
  return readFileSync(absolute, 'utf8')
}

function run(command, args, label, cwd = root) {
  const result = spawnSync(command, args, {cwd, env: process.env, stdio: 'inherit', shell: false})
  if (result.status === 0) pass(label)
  else fail(`${label} exited ${result.status ?? 'without status'}`)
}

if (!existsSync(join(standardRoot, '.git'))) fail('external repository .git directory missing')
else pass('external repository is initialized')

run('git', ['status', '--short'], 'external repository status inspected', standardRoot)
run('pnpm', ['verify'], 'external module-standard repo verifier passes', standardRoot)

const standardPackage = JSON.parse(standardFile('packages/module-standard/package.json') || '{}')
if (standardPackage.version === '2.1.0') pass('@modula/module-standard version is 2.1.0')
else fail('@modula/module-standard version must be 2.1.0')

for (const packagePath of [
  'packages/module-sdk/package.json',
  'packages/module-validator/package.json',
  'packages/create-module/package.json',
  'packages/module-testing/package.json',
  'packages/module-fixtures/package.json',
  'packages/module-backend-protocol/package.json',
  'packages/module-backend-testing/package.json',
  'packages/module-backend-fixtures/package.json',
]) {
  const pkg = JSON.parse(standardFile(packagePath) || '{}')
  if (pkg.version === '2.1.0') pass(`${pkg.name} version is 2.1.0`)
  else fail(`${packagePath} must be version 2.1.0`)
}

for (const doc of [
  'docs/module-standard.md',
  'docs/module-versioning.md',
  'docs/module-capabilities.md',
  'docs/module-records.md',
  'docs/module-events.md',
  'docs/module-search.md',
  'docs/module-ai.md',
  'docs/module-health.md',
  'docs/module-diagnostics.md',
  'docs/module-validator.md',
  'docs/module-sdk.md',
  'docs/module-backends.md',
]) {
  standardFile(doc)
}

standardFile('schemas/module-manifest-1.0.schema.json')
standardFile('schemas/module-manifest-1.1.schema.json')
standardFile('schemas/module-manifest-2.0.schema.json')
standardFile('schemas/module-manifest-2.1.schema.json')
standardFile('specifications/module-standard-1.0.md')
const standard20Source = standardFile('packages/module-standard/src/standard-2.ts')
for (const marker of [
  'MODULE_STANDARD_20_SECTION_NAMES',
  'ModuleStandard20DependencyGraph',
  'ModuleStandard20PermissionModel',
  'ModuleStandard20CompatibilityMatrix',
  'resolveModuleDependencyGraph',
]) {
  if (standard20Source.includes(marker)) pass(`Standard 2.0 source includes ${marker}`)
  else fail(`Standard 2.0 source missing ${marker}`)
}
for (const standard20Doc of ['docs/module-standard-2.0.md', 'docs/migration-standard-2.0.md']) standardFile(standard20Doc)
standardFile('templates/basic-module/manifest.json')
standardFile('examples/vault-notes/manifest.json')
standardFile('examples/reference-module-backend/server.mjs')

const appPackage = file('package.json')
for (const packageName of ['@modula/module-standard', '@modula/module-validator', '@modula/module-sdk', '@modula/create-module', '@modula/module-testing', '@modula/module-fixtures']) {
  if (appPackage.includes(`"${packageName}": "file:../modula-mod/modula-module-standard/packages/`)) pass(`app consumes ${packageName} from external standard repo`)
  else fail(`app package.json does not consume ${packageName} from external standard repo`)
}

const template = JSON.parse(file('templates/modula-module/modula.module.json') || '{}')
for (const field of ['standardVersion', 'moduleVersion', 'manifestSchemaVersion', 'dataSchemaVersion']) {
  if (template[field] === '1.0.0') pass(`template remains Standard 1.0 compatible for ${field}`)
  else fail(`template must remain Standard 1.0 compatible for ${field}`)
}

const {MODULA_MODULE_STANDARD_VERSION, MODULA_MODULE_BACKEND_PROTOCOL_VERSION, MODULA_MODULE_STANDARD_2_VERSION, createDefaultModuleSectionVersions} = await import('@modula/module-standard')
if (MODULA_MODULE_STANDARD_VERSION === '2.1.0' && MODULA_MODULE_STANDARD_2_VERSION === '2.0.0') pass('main app can import current Standard 2.1 with the compatible Standard 2.0 base')
else fail('main app imported unexpected module standard version')
if (MODULA_MODULE_BACKEND_PROTOCOL_VERSION === '1.0.0') pass('main app can import module backend protocol version')
else fail('main app imported unexpected module backend protocol version')
if (Object.keys(createDefaultModuleSectionVersions()).length >= 40) pass('Standard 2.0 section versions cover major manifest sections')
else fail('Standard 2.0 section versions are incomplete')

const hostManifest = file('packages/greenfield-module-manifest/src/validation.ts')
for (const marker of ['STANDARD_2_REQUIRES_MANIFEST_V2', 'INVALID_MODULE_API_PATH', 'UNKNOWN_PERMISSION_CATEGORY', 'MISSING_SECTION_VERSIONS', 'EXTENSION_PRODUCT_REQUIRES_STANDARD_2_1']) {
  if (hostManifest.includes(marker)) pass(`host manifest validator checks ${marker}`)
  else fail(`host manifest validator missing ${marker}`)
}

if (failures.length > 0) {
  console.error(`Phase 7E module standard verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log('Phase 7E module standard verifier passed')
