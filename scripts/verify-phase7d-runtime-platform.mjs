#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

const root = process.cwd()
let failures = 0

function fail(message) {
  failures += 1
  console.error(`FAIL ${message}`)
}

function pass(message) {
  console.log(`PASS ${message}`)
}

function requireFile(path) {
  const absolute = join(root, path)
  if (!existsSync(absolute)) {
    fail(`missing ${path}`)
    return ''
  }
  pass(`found ${path}`)
  return readFileSync(absolute, 'utf8')
}

function requireIncludes(path, required, label = path) {
  const text = requireFile(path)
  for (const item of required) {
    if (!text.includes(item)) fail(`${label} missing ${item}`)
  }
  if (required.every(item => text.includes(item))) pass(`${label} includes required markers`)
  return text
}

const enginePackage = JSON.parse(requireFile('packages/greenfield-module-engine-contracts/package.json'))
if (enginePackage.name !== '@modula/greenfield-module-engine-contracts') {
  fail('engine contracts package has wrong name')
} else {
  pass('engine contracts package name')
}

const runtimePackage = JSON.parse(requireFile('packages/greenfield-runtime/package.json'))
if (runtimePackage.name !== '@modula/greenfield-runtime') {
  fail('runtime package has wrong name')
} else {
  pass('runtime package name')
}

requireIncludes('packages/greenfield-module-engine-contracts/src/engine-kind.ts', [
  "'declarative-ui'",
  "'records'",
  "'actions'",
  "'functions'",
  "'automation'",
  "'ai'",
  "'media'",
  "'game'",
  "'spatial'",
  "'document'",
  "'connector'",
  "'custom-native'",
], 'canonical engine kinds')

requireIncludes('packages/greenfield-module-engine-contracts/src/session.ts', [
  "'creating'",
  "'resolving'",
  "'preparing'",
  "'ready'",
  "'starting'",
  "'active'",
  "'suspending'",
  "'suspended'",
  "'resuming'",
  "'stopping'",
  "'terminated'",
  "'failed'",
  "'recovering'",
  'assertRuntimeSessionTransition',
], 'runtime lifecycle')

requireIncludes('packages/greenfield-module-engine-contracts/src/compatibility.ts', [
  'compatibility',
  'launchPermission',
  'selectedProviders',
  'unresolvedRequirements',
  'requiredPermissions',
  'deniedCapabilities',
  'nativeBuildRequirement',
  'degradedModeEligible',
  'reasonCodes',
], 'resolution result shape')

requireIncludes('packages/greenfield-runtime/src/built-in-providers.ts', [
  'modula.declarative-ui',
  'modula.records',
  'modula.actions',
  'modula.functions',
  'modula.connector',
  'modula.ai',
  'modula.automation',
  "'not-configured'",
  'trusted-host',
], 'trusted built-in providers')

requireIncludes('packages/greenfield-runtime/src/compatibility-resolver.ts', [
  'resolveRuntimeRequirements',
  'selectedProviders',
  'unresolvedRequirements',
  'permission.denied',
  'provider.not-configured',
  'native-build.unavailable',
], 'runtime requirement resolver')

requireIncludes('packages/greenfield-runtime/src/runtime-manager.ts', [
  'createModuleSession',
  'createLogicalSession',
  'resolveRuntimeRequirements',
  'prepareProviders',
  'runtime.session.created',
  'runtime.session.failed',
], 'runtime manager')

const sessionStore = requireIncludes('packages/greenfield-runtime/src/session-store.ts', [
  'GreenfieldRuntimeSessionStore',
  'InMemoryGreenfieldRuntimeSessionStore',
  'providerIds',
  'metadata',
], 'logical session store')

requireIncludes('services/greenfield-api/migrations/015_phase7d_runtime_sessions.sql', [
  'greenfield_runtime_sessions',
  'greenfield_runtime_session_events',
  'provider_ids JSONB',
  'resolution JSONB',
  'metadata JSONB',
  "'connector-operation'",
  "'ai-conversation'",
  "'ai-tool-run'",
  "'automation-run'",
  "schema_version','015",
], 'runtime session persistence migration')

const persistedStore = requireIncludes('services/greenfield-api/src/runtime/session-store.ts', [
  'GreenfieldRuntimeSessionRepository',
  'implements GreenfieldRuntimeSessionStore',
  'greenfield_runtime_sessions',
  'greenfield_runtime_session_events',
  'assertNoPersistedImplementationReferences',
  'runtime.session.created',
  'runtime.session.terminated',
], 'persisted runtime session store')

for (const forbidden of ['providerHandle', 'implementationRef', 'adapterRef', 'functionPointer']) {
  if (sessionStore.includes(forbidden)) fail(`logical session store persists forbidden reference ${forbidden}`)
  if (!persistedStore.includes(forbidden)) fail(`persisted session store does not reject forbidden reference ${forbidden}`)
}

const sourcePaths = [
  'packages/greenfield-module-engine-contracts/src',
  'packages/greenfield-runtime/src',
]

const forbiddenPatterns = [
  ['eval(', 'arbitrary eval'],
  ['new Function', 'dynamic function construction'],
  ['child_process', 'shell access'],
  ['spawn(', 'process spawning'],
  ['exec(', 'process execution'],
  ['execFile(', 'process execution'],
  ['pnpm add', 'dynamic package installation'],
  ['npm install', 'dynamic package installation'],
  ['WebView', 'untrusted WebView execution'],
  ['dangerouslySetInnerHTML', 'remote HTML execution'],
]

for (const sourcePath of sourcePaths) {
  const {readdirSync, statSync} = await import('node:fs')
  const stack = [join(root, sourcePath)]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of readdirSync(current)) {
      const absolute = join(current, entry)
      if (statSync(absolute).isDirectory()) {
        stack.push(absolute)
        continue
      }
      if (!absolute.endsWith('.ts')) continue
      const text = readFileSync(absolute, 'utf8')
      for (const [pattern, description] of forbiddenPatterns) {
        if (text.includes(pattern)) fail(`${absolute.replace(`${root}/`, '')} includes ${description}: ${pattern}`)
      }
    }
  }
}
pass('runtime packages avoid forbidden execution primitives')

requireIncludes('packages/greenfield-runtime/tests/runtime-manager.test.ts', [
  'resolves an installed module to trusted providers',
  'does not launch controlled framework stubs',
  'allows degraded launch when optional runtime requirements are unavailable',
  'fails sessions without crashing',
  'rejects unsafe lifecycle jumps',
], 'runtime tests')

requireIncludes('services/greenfield-api/tests/phase7d.runtime-sessions.test.ts', [
  'persists logical sessions and lifecycle events without provider handles',
  'rejects database persistence of provider implementation references',
  'GreenfieldRuntimeSessionRepository',
], 'runtime persistence tests')

requireIncludes('packages/greenfield-module-engine-contracts/tests/engine-contracts.test.ts', [
  'canonical Phase 7D engine kinds',
  'rejects wildcard runtime capabilities',
  'keeps launch permission separate from compatibility',
], 'engine contract tests')

if (failures > 0) {
  console.error(`Phase 7D runtime platform verifier failed: ${failures} issue(s)`)
  process.exit(1)
}

console.log('Phase 7D runtime platform verifier passed')
