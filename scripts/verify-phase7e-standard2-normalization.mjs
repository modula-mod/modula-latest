#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
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

function includes(path, markers, label) {
  const source = file(path)
  for (const marker of markers) {
    if (source.includes(marker)) pass(`${label}: ${marker}`)
    else fail(`${label} missing ${marker}`)
  }
}

function run(command, args, label) {
  const result = spawnSync(command, args, {cwd: root, env: process.env, stdio: 'inherit', shell: false})
  if (result.status === 0) pass(label)
  else fail(`${label} exited ${result.status ?? 'without status'}`)
}

includes('packages/greenfield-module-manifest/src/runtime-support.ts', [
  'MODULE_STANDARD_RUNTIME_SUPPORT_2_0_0',
  'maximumServiceInvocationDepth: 8',
  'services: \'DECLARATIVE_ONLY\'',
  'runtimeSupportDiagnosticsForManifest',
], 'runtime support registry')

includes('services/greenfield-api/src/modules/manifest-normalizer.ts', [
  'NormalizedModuleManifest',
  'normalizeModuleManifest',
  'checksumSource',
  'unsupportedSections',
], 'manifest normalizer')

includes('services/greenfield-api/src/modules/registry-service.ts', [
  'normalizeModuleManifest',
  'runtimeSupportForStandardVersion',
  'runtimeDiagnostics',
  'normalizedManifest',
], 'registry runtime metadata')

includes('src/features/marketplace/screens/ModuleDetailScreen.tsx', [
  'Runtime support',
  'Declared but not fully operational',
  'runtimeDiagnosticSummary',
], 'Product Hub runtime disclosure')

run('pnpm', ['--filter', '@modula/greenfield-module-manifest', 'build'], 'manifest package builds')
run('pnpm', ['--filter', '@modula/greenfield-module-manifest', 'test'], 'manifest package tests pass')
run('pnpm', ['--filter', '@modula/greenfield-api', 'test', '--', 'phase7e.standard2-normalization'], 'normalizer API tests pass')

const {
  MODULE_STANDARD_20_SECTION_NAMES,
  MODULE_STANDARD_RUNTIME_SUPPORT_2_0_0,
  runtimeSupportDiagnosticsForManifest,
} = await import('@modula/greenfield-module-manifest')

const missing = MODULE_STANDARD_20_SECTION_NAMES.filter(section => !MODULE_STANDARD_RUNTIME_SUPPORT_2_0_0.sections[section])
if (missing.length === 0) pass('every Standard 2.0 section has runtime support state')
else fail(`missing runtime support state for ${missing.join(', ')}`)

const diagnostics = runtimeSupportDiagnosticsForManifest({
  manifestVersion: 2,
  standardVersion: '2.0.0',
  dependencyGraph: {version: '2.0.0', requires: [{moduleId: 'digital.modula.records', versionRange: '^1.0.0'}], optional: [], recommended: [], conflicts: [], replaces: [], provides: []},
  serviceRegistry: {version: '2.0.0', items: [{id: 'digital.modula.reference.service.records'}]},
  apiRegistry: {version: '2.0.0', items: [{id: 'digital.modula.reference.api.records'}]},
  hookRegistry: {version: '2.0.0', items: [{id: 'digital.modula.reference.hook.before-install'}]},
})
const nonOperational = diagnostics.filter(diagnostic => diagnostic.declared && !diagnostic.operational).map(diagnostic => diagnostic.section)
for (const section of ['dependencies', 'services', 'apis', 'hooks']) {
  if (nonOperational.includes(section)) pass(`${section} declaration is disclosed as not fully operational`)
  else fail(`${section} declaration was not disclosed as not fully operational`)
}

if (failures.length > 0) {
  console.error(`Phase 7E Standard 2.0 normalization verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log('Phase 7E Standard 2.0 normalization verifier passed')
