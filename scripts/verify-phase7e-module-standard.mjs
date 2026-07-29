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
if (standardPackage.version === '1.0.0') pass('@modula/module-standard version is 1.0.0')
else fail('@modula/module-standard version must be 1.0.0')

for (const packagePath of [
  'packages/module-sdk/package.json',
  'packages/module-validator/package.json',
  'packages/create-module/package.json',
  'packages/module-testing/package.json',
  'packages/module-fixtures/package.json',
]) {
  const pkg = JSON.parse(standardFile(packagePath) || '{}')
  if (pkg.version === '1.0.0') pass(`${pkg.name} version is 1.0.0`)
  else fail(`${packagePath} must be version 1.0.0`)
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
]) {
  standardFile(doc)
}

standardFile('schemas/module-manifest-1.0.schema.json')
standardFile('specifications/module-standard-1.0.md')
standardFile('templates/basic-module/manifest.json')
standardFile('examples/vault-notes/manifest.json')

const appPackage = file('package.json')
for (const packageName of ['@modula/module-standard', '@modula/module-validator', '@modula/module-sdk', '@modula/create-module', '@modula/module-testing', '@modula/module-fixtures']) {
  if (appPackage.includes(`"${packageName}": "file:../modula-mod/modula-module-standard/packages/`)) pass(`app consumes ${packageName} from external standard repo`)
  else fail(`app package.json does not consume ${packageName} from external standard repo`)
}

const template = JSON.parse(file('templates/modula-module/modula.module.json') || '{}')
for (const field of ['standardVersion', 'moduleVersion', 'manifestSchemaVersion', 'dataSchemaVersion']) {
  if (template[field] === '1.0.0') pass(`template exposes ${field}`)
  else fail(`template missing ${field}=1.0.0`)
}

const {MODULA_MODULE_STANDARD_VERSION} = await import('@modula/module-standard')
if (MODULA_MODULE_STANDARD_VERSION === '1.0.0') pass('main app can import @modula/module-standard')
else fail('main app imported unexpected module standard version')

if (failures.length > 0) {
  console.error(`Phase 7E module standard verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log('Phase 7E module standard verifier passed')
