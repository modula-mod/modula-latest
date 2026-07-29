#!/usr/bin/env node
import {readFileSync} from 'node:fs'
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
const {validateModulaModuleManifest, negotiateCapabilities, negotiateCompatibility} = await import('@modula/module-validator')
const template = JSON.parse(readFileSync('templates/modula-module/modula.module.json', 'utf8'))

function expect(condition, message) {
  if (condition) pass(message)
  else fail(message)
}

expect(validateModulaModuleManifest(vaultNotesManifestFixture).valid, 'fixture manifest validates')
expect(validateModulaModuleManifest(template).valid, 'app template manifest validates')

const host = {hostVersion: '1.0.0', runtimeVersion: '1.0.0', standardVersion: '1.0.0', platform: 'web'}
expect(negotiateCompatibility(vaultNotesManifestFixture, host).compatible, 'compatible host is accepted')
expect(!negotiateCompatibility(vaultNotesManifestFixture, {...host, hostVersion: '2.0.0'}).compatible, 'incompatible host is rejected')

const optionalMissing = negotiateCapabilities(vaultNotesManifestFixture, ['records', 'views', 'functions', 'events'])
expect(optionalMissing.canEnable, 'optional capabilities degrade safely')
expect(optionalMissing.unavailableOptional.includes('search'), 'missing optional search capability is reported')

const requiredMissing = validateModulaModuleManifest(vaultNotesManifestFixture, {hostCapabilities: ['views', 'functions', 'events']})
expect(!requiredMissing.valid, 'missing required capability blocks activation')
expect(requiredMissing.issues.some(issue => issue.code === 'REQUIRED_CAPABILITY_UNAVAILABLE'), 'required capability failure code is reported')

for (const marker of ['records', 'views', 'actions', 'functions', 'settings', 'events', 'automations', 'search', 'ai', 'diagnostics', 'health', 'release', 'trust']) {
  expect(Array.isArray(vaultNotesManifestFixture[marker]) || typeof vaultNotesManifestFixture[marker] === 'object', `validator fixture includes ${marker}`)
}

if (failures.length > 0) {
  console.error(`Phase 7E module validator verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log('Phase 7E module validator verifier passed')
