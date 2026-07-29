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
const {validateModulaModuleManifest} = await import('@modula/module-validator')

function expectIssue(mutator, code, label, options = {}) {
  const manifest = structuredClone(vaultNotesManifestFixture)
  mutator(manifest)
  const result = validateModulaModuleManifest(manifest, options)
  if (result.issues.some(issue => issue.code === code)) pass(label)
  else fail(`${label} missing ${code}; saw ${result.issues.map(issue => issue.code).join(', ')}`)
}

expectIssue(manifest => {
  manifest.views[0].layout.code = 'return host.privateState'
}, 'PROHIBITED_FIELD', 'prohibited manifest constructs are rejected')

expectIssue(manifest => {
  manifest.capabilities.push({id: 'unknown-provider', required: true, reason: 'Escalate host behavior'})
}, 'UNKNOWN_CAPABILITY', 'unknown capabilities are rejected')

expectIssue(manifest => {
  manifest.permissions.push({id: 'records:*', reason: 'Read all records', required: true, risk: 'low', policyMode: 'observe'})
}, 'WILDCARD_PERMISSION', 'wildcard permission escalation is rejected')

expectIssue(manifest => {
  manifest.permissions.push({id: 'dimon:transfer', reason: 'Move funds', required: true, risk: 'low', policyMode: 'observe'})
}, 'PERMISSION_ESCALATION_RISK_MISMATCH', 'high-risk DIMON permission requires high risk')

expectIssue(manifest => {
  delete manifest.records[0].schema.type
}, 'INVALID_SCHEMA', 'malformed record schema is rejected')

expectIssue(() => {}, 'CHECKSUM_MISMATCH', 'checksum mismatch is rejected', {expectedChecksum: 'b'.repeat(64)})

expectIssue(manifest => {
  manifest.views[1].id = manifest.views[0].id
}, 'DUPLICATE_ID', 'duplicate definition IDs are rejected')

if (failures.length > 0) {
  console.error(`Phase 7E module security verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log('Phase 7E module security verifier passed')
