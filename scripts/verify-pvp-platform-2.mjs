#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {join, resolve} from 'node:path'

const root = process.cwd()
const requestedMode = process.argv[2] ?? 'all'
const knownModes = new Set([
  'all', 'contracts', 'manifest', 'points', 'graph', 'lifecycle', 'capabilities',
  'contributions', 'isolation', 'events', 'jobs', 'service-fabric', 'provenance',
  'security', 'vault-notes', 'vault-ai', 'vault-voice', 'cross-account',
])
if (!knownModes.has(requestedMode)) {
  console.error(`Unknown PVP Platform 2 verifier mode: ${requestedMode}`)
  process.exit(2)
}

const failures = []
const file = path => join(root, path)
const read = path => existsSync(file(path)) ? readFileSync(file(path), 'utf8') : ''

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(46)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}${detail ? `: ${detail}` : ''}`)
}

function source(label, path, needles, absent = []) {
  const content = read(path)
  record(label, Boolean(content) && needles.every(needle => content.includes(needle)) && absent.every(needle => !content.includes(needle)), path)
}

function run(label, command, args, cwd = root, env = process.env) {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit'})
  record(label, result.status === 0, cwd)
}

function tagAt(repoRoot, tag) {
  const result = spawnSync('git', ['rev-list', '-n', '1', tag], {cwd: repoRoot, encoding: 'utf8'})
  return result.status === 0 ? result.stdout.trim() : ''
}

function staticChecks(mode) {
  const all = mode === 'all'
  if (all || mode === 'contracts') {
    source('UNIVERSAL PRODUCT TAXONOMY', 'packages/greenfield-contracts/src/extension.ts', ["'module'", "'addon'", "'plugin'", "'function'", "'tool'", "'widget'", "'connector'", "'service'"])
    source('STANDARD 2.1 HOST CONTRACT', 'packages/greenfield-module-manifest/src/standard.ts', ['MODULA_MODULE_STANDARD_VERSION', 'MODULA_EXTENSION_PRODUCT_KINDS'])
  }
  if (all || mode === 'manifest') {
    source('EXTENSION MANIFEST VALIDATION', 'packages/greenfield-module-manifest/src/validation.ts', ['validateExtensionProduct', 'EXTENSION_PRODUCT_REQUIRES_STANDARD_2_1', 'MODULE_TARGETS_PRODUCT', 'INVALID_METADATA_NAMESPACE'])
    source('MANIFEST CHECKSUM QUARANTINE', 'services/greenfield-api/src/modules/release-service.ts', ['manifestChecksum', "release_state: 'quarantined'", 'greenfield_extension_targets'])
  }
  if (all || mode === 'points') {
    source('DECLARATIVE EXTENSION POINTS', 'services/greenfield-api/migrations/039_pvp_platform_2_extension_fabric.sql', ['greenfield_extension_points', 'max_contributions', 'contextMenu.item', 'background.action'])
    source('GENERIC HOST COMPOSITION', 'services/greenfield-api/src/modules/extension-fabric-service.ts', ['composeHost', 'target_product_id', 'failureIsolation: true', 'arbitraryRemoteCode: false'])
  }
  if (all || mode === 'graph') {
    source('BOUNDED DEPENDENCY GRAPH', 'services/greenfield-api/src/modules/dependency-resolver.ts', ['DEPENDENCY_CYCLE', 'DEPENDENCY_GRAPH_BOUNDS_EXCEEDED', 'cyclePath', 'maxNodes'])
    source('DEPENDENT UNINSTALL REVIEW', 'services/greenfield-api/src/modules/uninstall-service.ts', ['activeDependants', 'removeDependants', 'dependencyCascadeFrom'])
  }
  if (all || mode === 'lifecycle') {
    source('AUTHORITATIVE LIFECYCLE', 'services/greenfield-api/migrations/039_pvp_platform_2_extension_fabric.sql', ["'NOT_INSTALLED'", "'RESOLVING'", "'ENABLED'", "'UPDATE_AVAILABLE'", "'QUARANTINED'"])
    source('WORKER LIFECYCLE PROJECTION', 'services/greenfield-worker/src/modules/extension-fabric-projection.ts', ['projectExtensionLifecycle', 'ExtensionRuntimeProjectionState'])
  }
  if (all || mode === 'capabilities') {
    source('TYPED CAPABILITY GRANTS', 'services/greenfield-api/src/modules/extension-fabric-service.ts', ['assertInvocation', 'greenfield_extension_capability_grants', 'Undeclared or ungranted capability denied', "moduleError('NOT_FOUND', 'Scoped target resource not found')"])
    source('UI PLACEMENT IS NOT DATA ACCESS', 'services/greenfield-api/src/modules/routes/index.ts', ['extensionFabric.assertInvocation', 'requiredCapabilities', 'resource'])
  }
  if (all || mode === 'contributions') {
    source('PER-CONTRIBUTION FAILURE BOUNDARY', 'src/features/modules/runtime/module-extension-contributions.tsx', ['ModuleErrorBoundary', 'reportExtensionContributionFailure', 'contribution.declaration.actionId'], ['digital.modula.vault-notes.ai', 'digital.modula.vault-notes.voice', 'digital.modula.vault-notes.formatting'])
    source('MODULE HOST HAS NO PRODUCT SPECIAL CASE', 'src/features/modules/runtime/module-host.tsx', ['useModuleHostCompositionQuery', 'ModuleExtensionContributions', 'ModuleViewRenderer'], ['vaultAIInstalled', 'digital.modula.vault-notes.ai', 'digital.modula.vault-notes.voice'])
  }
  if (all || mode === 'isolation' || mode === 'cross-account') {
    source('ACCOUNT-SCOPED BROKER', 'services/greenfield-api/src/modules/extension-fabric-service.ts', ["where('account_id', '=', input.accountId)", "where('account_id', '=', accountId)", 'Scoped target resource not found'])
    source('ACCOUNT-SCOPED EVENT DISPATCH', 'services/greenfield-worker/src/modules/extension-event-handler.ts', ["where('account_id', '=', event.accountId)", 'idempotency_key: event.eventId'])
  }
  if (all || mode === 'events') {
    source('VERSIONED EVENT SUBSCRIPTIONS', 'services/greenfield-api/src/modules/extension-fabric-service.ts', ['greenfield_extension_event_subscriptions', 'eventVersion', 'extension.event.dispatch'])
    source('EVENT TARGET FILTER', 'services/greenfield-worker/src/events/runner.ts', ['targetProductId', 'payload.moduleId'])
  }
  if (all || mode === 'jobs') {
    source('EXTENSION JOB LIFECYCLE', 'services/greenfield-worker/src/modules/extension-job-handler.ts', ["status: 'RUNNING'", "status: 'RETRYING'", "status: 'FAILED'", 'PROVIDER_NOT_CONFIGURED'])
    source('DECLARED BACKGROUND ACTION GATE', 'services/greenfield-api/src/modules/extension-fabric-service.ts', ["contributionKind !== 'background.action'", 'redactMetadata', 'maximum_attempts: 3'])
  }
  if (all || mode === 'service-fabric') {
    source('SCOPED SERVICE ASSERTION', 'services/greenfield-api/src/modules/backend/token-service.ts', ['consumerProductId', 'targetProductId', 'actionId', 'jti', 'raw_user_bearer_forwarded: false'])
    source('GATEWAY TIMEOUT AND CIRCUIT', 'services/greenfield-api/src/modules/backend/gateway-service.ts', ['circuit is open', 'timeoutMs: action.timeoutMs', 'recordFailure'])
  }
  if (all || mode === 'provenance') {
    source('IMMUTABLE RELEASE VERIFICATION', 'services/greenfield-api/src/modules/release-service.ts', ['source_commit', 'manifest_sha256', 'release_sha256', 'publishRelease'])
  }
  if (all || mode === 'security') {
    source('RAW BEARER DATABASE GUARD', 'services/greenfield-api/migrations/039_pvp_platform_2_extension_fabric.sql', ['raw_user_bearer_forwarded BOOLEAN NOT NULL DEFAULT FALSE', 'CHECK (raw_user_bearer_forwarded = FALSE)', "namespace = extension_product_id"])
    source('NO ARBITRARY EXECUTABLE UI', 'packages/greenfield-module-manifest/src/validation.ts', ['rejectUnknown', 'UNDECLARED_EXTENSION_FIELD', 'WILDCARD_CONTRACT_DENIED'])
    source('CHECKSUM TAMPER TEST', 'services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts', ['quarantines an artifact', 'denies undeclared capability escalation', 'cross-account resource access'])
  }
}

function behaviouralChecks(mode) {
  const databaseModes = new Set(['all', 'graph', 'lifecycle', 'capabilities', 'contributions', 'isolation', 'events', 'jobs', 'service-fabric', 'provenance', 'security', 'cross-account'])
  if (!databaseModes.has(mode)) return
  const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
  record('DISPOSABLE DATABASE URL PROVIDED', Boolean(databaseUrl), databaseUrl ? 'configured' : 'MODULA_TEST_DATABASE_URL is required; no silent skip')
  if (!databaseUrl) return
  run('CURRENT GREENFIELD PREREQUISITES', 'pnpm', ['--filter', '@modula/greenfield-api...', 'build'])
  run('EXTENSION FABRIC DB INTEGRATION', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/pvp-platform-2.extension-fabric.test.ts'], root, {...process.env, CI: 'true'})
  if (mode === 'all' || mode === 'contributions' || mode === 'isolation' || mode === 'provenance' || mode === 'cross-account') {
    run('IMMUTABLE REFERENCE JOURNEY', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/pvp-platform-2.reference-products.test.ts'], root, {...process.env, CI: 'true'})
  }
}

function externalChecks(mode) {
  const all = mode === 'all'
  const repositories = {
    standard: resolve(process.env.MODULA_MODULE_STANDARD_ROOT ?? '/root/modula-mod/modula-module-standard'),
    notes: resolve(process.env.MODULA_VAULT_NOTES_ROOT ?? '/root/modula-mod/modula-vault-notes'),
    ai: resolve(process.env.MODULA_VAULT_AI_ROOT ?? '/root/modula-mod/modula-vault-ai'),
    voice: resolve(process.env.MODULA_VAULT_VOICE_ROOT ?? '/root/modula-mod/modula-vault-voice'),
    formatting: resolve(process.env.MODULA_VAULT_FORMATTING_ROOT ?? '/root/modula-mod/modula-vault-formatting'),
  }
  const requireRepo = (label, repoRoot) => {
    const present = existsSync(join(repoRoot, '.git')) && existsSync(join(repoRoot, 'package.json'))
    record(`${label} REPOSITORY`, present, repoRoot)
    return present
  }
  if (all || mode === 'contracts' || mode === 'manifest') {
    if (requireRepo('MODULE STANDARD', repositories.standard)) run('MODULE STANDARD VERIFY', 'pnpm', ['verify'], repositories.standard)
  }
  if (all || mode === 'vault-notes' || mode === 'points') {
    if (requireRepo('VAULT NOTES', repositories.notes)) run('VAULT NOTES VERIFY', 'pnpm', ['verify'], repositories.notes)
  }
  if (all || mode === 'vault-ai') {
    if (requireRepo('VAULT AI', repositories.ai)) run('VAULT AI VERIFY', 'pnpm', ['verify'], repositories.ai)
  }
  if (all || mode === 'vault-voice') {
    if (requireRepo('VAULT VOICE', repositories.voice)) run('VAULT VOICE VERIFY', 'pnpm', ['verify'], repositories.voice)
  }
  if (all || mode === 'contributions') {
    if (requireRepo('VAULT FORMATTING', repositories.formatting)) run('VAULT FORMATTING VERIFY', 'pnpm', ['verify'], repositories.formatting)
  }
  if (all || mode === 'provenance') {
    for (const [label, repoRoot, tag] of [
      ['MODULE STANDARD', repositories.standard, 'mms-v2.1.0'],
      ['VAULT NOTES', repositories.notes, 'vault-notes-v1.2.0'],
      ['VAULT AI', repositories.ai, 'vault-ai-v0.1.0'],
      ['VAULT VOICE', repositories.voice, 'vault-voice-v0.1.0'],
      ['VAULT FORMATTING', repositories.formatting, 'vault-formatting-v0.1.0'],
    ]) {
      const commit = existsSync(join(repoRoot, '.git')) ? tagAt(repoRoot, tag) : ''
      record(`${label} IMMUTABLE TAG`, /^[0-9a-f]{40}$/.test(commit), commit || tag)
    }
  }
}

console.log('MODULA')
console.log('PVP PLATFORM PHASE 2')
console.log(`VERIFIER ${requestedMode.toUpperCase()}\n`)
staticChecks(requestedMode)
behaviouralChecks(requestedMode)
externalChecks(requestedMode)
run('GIT DIFF CHECK', 'git', ['diff', '--check'])

console.log('\nRESULT')
if (failures.length) {
  console.log(`PVP PLATFORM PHASE 2 ${requestedMode.toUpperCase()} FAIL (${failures.length})`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log(`PVP PLATFORM PHASE 2 ${requestedMode.toUpperCase()} PASS`)
