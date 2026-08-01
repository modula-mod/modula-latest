#!/usr/bin/env node
import {resolve} from 'node:path'
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

function run(command, args, label, cwd = root) {
  const result = spawnSync(command, args, {cwd, env: process.env, stdio: 'inherit', shell: false})
  if (result.status === 0) pass(label)
  else fail(`${label} exited ${result.status ?? 'without status'}`)
}

run('pnpm', ['build'], 'external module-standard packages build', standardRoot)

const {vaultNotesManifestFixture} = await import('@modula/module-fixtures')
const {createModuleSandbox} = await import('@modula/module-testing')
const {validateModulaModuleManifest} = await import('@modula/module-validator')

const validation = validateModulaModuleManifest(vaultNotesManifestFixture)
if (validation.valid) pass('health fixture manifest validates')
else fail(`health fixture invalid: ${validation.issues.map(issue => issue.code).join(', ')}`)

const requiredDiagnostics = ['startup', 'runtime', 'permissions', 'dependencies', 'search', 'ai', 'connector', 'health']
for (const component of requiredDiagnostics) {
  if (vaultNotesManifestFixture.diagnostics.components.includes(component) && typeof vaultNotesManifestFixture.diagnostics[component] === 'object') {
    pass(`diagnostics include ${component}`)
  } else {
    fail(`diagnostics missing ${component}`)
  }
}

for (const state of ['healthy', 'degraded', 'failed', 'disabled', 'quarantined']) {
  const clone = structuredClone(vaultNotesManifestFixture)
  clone.health.status = state
  if (validateModulaModuleManifest(clone).valid) pass(`health state ${state} is standardized`)
  else fail(`health state ${state} is not accepted`)
}

const sandbox = createModuleSandbox({deniedCapabilities: ['search', 'ai']})
const negotiation = sandbox.negotiate(vaultNotesManifestFixture)
if (negotiation.capabilities.canEnable) pass('health sandbox allows optional degraded AI/search')
else fail('health sandbox blocked optional degraded AI/search')

if (sandbox.previewHealth(vaultNotesManifestFixture).components.length >= 1) pass('component health preview is available')
else fail('component health preview missing components')

if (failures.length > 0) {
  console.error(`Phase 7E module health verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log('Phase 7E module health verifier passed')
