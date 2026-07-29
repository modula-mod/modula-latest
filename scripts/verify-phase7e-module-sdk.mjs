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

const sdk = await import('@modula/module-sdk')
const {validateModulaModuleManifest} = await import('@modula/module-validator')

const moduleId = 'com.example.sdk-module'
const publisher = {id: 'example', name: 'Example Publisher', website: 'https://example.com'}
const record = sdk.defineRecord(moduleId, 'item', {type: 'object', required: ['id'], properties: {id: {type: 'string'}}}, {
  searchPolicy: {searchable: true, indexedFields: ['id'], sensitiveFields: [], visibility: 'private'},
})
const fn = sdk.defineFunction(moduleId, 'create-item', {type: 'object'}, {type: 'object'}, {sideEffects: ['record.create']})
const manifest = sdk.defineModule({
  id: moduleId,
  slug: 'sdk-module',
  name: 'SDK Module',
  description: 'SDK generated Standard 1.0 manifest.',
  moduleVersion: '1.0.0',
  publisher,
  compatibility: {host: '^1.0.0', runtime: '^1.0.0', standard: '^1.0.0', platforms: ['web']},
  lifecycle: sdk.defineLifecycle(),
  permissions: [sdk.definePermission('records:item:read', 'Read item records.', {risk: 'low', policyMode: 'observe'})],
  capabilities: [
    sdk.defineCapability('records', 'Store records.'),
    sdk.defineCapability('views', 'Render views.'),
    sdk.defineCapability('functions', 'Expose functions.'),
    sdk.defineCapability('search', 'Index records.', false, 'Module remains browsable without universal search.'),
  ],
  records: [record],
  views: [sdk.defineView(moduleId, 'collection', 'collection', {recordId: record.id, permissions: ['records:item:read']})],
  actions: [sdk.defineAction(moduleId, 'create-item', {functionId: fn.id, sideEffects: ['record.create']})],
  functions: [fn],
  settings: [sdk.defineSettings(moduleId, 'main', {type: 'object'}, {})],
  events: [sdk.defineEvent(moduleId, 'item-created', 'emitted', {type: 'object'})],
  automations: [],
  search: [sdk.defineSearch(moduleId, 'items', record.id, ['id'])],
  ai: [],
  diagnostics: sdk.defineDiagnostics(),
  health: sdk.defineHealth(),
  migrations: {dataSchemaVersion: '1.0.0', steps: [{id: `${moduleId}.migration.1-0-0`, from: '0.0.0', to: '1.0.0', reversible: true, checksum: '1'.repeat(64)}]},
  release: {repository: 'modula-mod/sdk-module', commitSha: '0123456789abcdef0123456789abcdef01234567', checksum: '2'.repeat(64), licenseEvidence: ['LICENSE'], signing: {signed: false}, channel: 'dev', reviewStatus: 'unreviewed', securityAdvisories: []},
  trust: sdk.defineTrust(publisher),
})

const validation = validateModulaModuleManifest(manifest)
if (validation.valid) pass('SDK generated manifest validates')
else fail(`SDK generated manifest failed validation: ${validation.issues.map(issue => issue.code).join(', ')}`)

for (const helper of ['defineRecord', 'defineView', 'defineAction', 'defineFunction', 'defineEvent', 'definePermission', 'defineDiagnostics', 'defineHealth', 'defineSearch', 'defineAutomation', 'defineAIIntegration']) {
  if (typeof sdk[helper] === 'function') pass(`SDK exports ${helper}`)
  else fail(`SDK missing ${helper}`)
}

if (failures.length > 0) {
  console.error(`Phase 7E module SDK verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log('Phase 7E module SDK verifier passed')
