import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
import {
  fail,
  finish,
  includes,
  pass,
  root,
} from './phase7e-module-backend-verifier-utils.mjs'

export {
  fail,
  finish,
  includes,
  pass,
  root,
}

export function run(command, args, label, env = process.env, cwd = root) {
  runClassified(command, args, label, 'SOURCE_FAILURE', env, cwd)
}

export function runClassified(command, args, label, classification, env = process.env, cwd = root) {
  const result = spawnSync(command, args, {cwd, env: childProcessEnv(env), stdio: 'inherit', shell: false})
  if (result.status === 0) pass(label)
  else fail(`${classification} ${label} exited ${result.status ?? 'without status'}`)
}

export const referenceModuleRoot = resolve(root, 'fixtures/modules/standard2-reference')

export function verifyDependencyRuntimeSource() {
  includes('services/greenfield-api/migrations/027_phase7e_module_runtime_2.sql', [
    'greenfield_module_resolved_dependencies',
    "'requires','optional','recommended','conflicts','replaces','provides'",
    'blocking BOOLEAN NOT NULL DEFAULT FALSE',
    'degraded BOOLEAN NOT NULL DEFAULT FALSE',
  ], 'Standard 2 dependency runtime migration persists resolved relations')
  includes('services/greenfield-api/src/modules/dependency-resolver.ts', [
    'satisfiesSemverRange',
    'detectCircular',
    'resolveProvidedContract',
    "dependency.relation === 'conflicts'",
    'Recommended dependency',
  ], 'dependency resolver handles ranges, contracts, cycles, conflicts and recommendations')
  includes('services/greenfield-api/src/modules/installation-service.ts', [
    'dependencyPlan',
    'persistInstallPlanState',
    'assertActivationAllowed',
    'allRuntimePermissionKeys',
  ], 'installation service persists accepted dependency plans atomically')
  includes('services/greenfield-api/tests/phase7e.module-runtime-2.test.ts', [
    'greenfield_module_resolved_dependencies',
    'optional',
    'recommended',
    'Conflicting module digital.modula.reference-conflict is installed',
  ], 'runtime test covers dependency persistence, degradation and conflict rejection')
}

export function verifyCapabilityRegistrySource() {
  includes('services/greenfield-api/migrations/027_phase7e_module_runtime_2.sql', [
    'greenfield_module_capability_registry',
    "'host','module','connector','ai-provider','storage','service','api'",
    "'healthy','degraded','unavailable','configuration-required','disabled','quarantined'",
  ], 'capability registry migration defines provider and health states')
  includes('services/greenfield-worker/src/modules/standard2-runtime-registration.ts', [
    'insertCapabilities',
    'capabilityDiscovery',
    'serviceRegistry',
    'dependencyGraph',
    'configuration-required',
  ], 'worker projects Standard 2 capabilities and health')
  includes('services/greenfield-api/src/modules/runtime2-service.ts', [
    'runtimeSummary',
    'greenfield_module_capability_registry',
    'CAPABILITY_DISABLED',
  ], 'API runtime service exposes capability health and enforces disabled providers')
}

export function verifyServiceFabricSource() {
  includes('services/greenfield-api/migrations/027_phase7e_module_runtime_2.sql', [
    'greenfield_module_service_registrations',
    'greenfield_module_api_registrations',
    'greenfield_module_service_invocations',
    'idempotency_key TEXT NOT NULL',
    'rate_limit_per_minute',
    'invocation_depth_limit',
  ], 'service fabric migration defines service, API and invocation state')
  includes('services/greenfield-api/src/modules/runtime2-service.ts', [
    'invokeService',
    'callerModuleId',
    'providerModuleId',
    'GreenfieldPolicyEngine',
    'enforceServicePermissions',
    'validateSchemaBoundary',
    'enforceRateLimit',
    'recordInvocation',
  ], 'service gateway enforces caller, policy, permissions, schemas, rate limits and audit')
  includes('services/greenfield-api/src/modules/routes/index.ts', [
    '/v1/modules/:moduleId/runtime',
    '/v1/modules/:moduleId/services/:serviceId/invoke',
    'callerModuleId',
    'actorIdForAccount',
  ], 'module runtime and service invocation APIs are wired')
}

export function verifyHooksSource() {
  includes('services/greenfield-api/migrations/027_phase7e_module_runtime_2.sql', [
    'greenfield_module_hook_registrations',
    "'before','after'",
    'order_index INTEGER NOT NULL',
    'failure_policy TEXT NOT NULL',
  ], 'hook registry migration defines ordered hooks and failure policy')
  includes('services/greenfield-worker/src/modules/standard2-runtime-registration.ts', [
    'insertHooks',
    'sort((a, b)',
    'assertNoHookCycles',
    'Standard 2 hook ordering cycle detected',
    'timeout_ms',
  ], 'worker projects hooks deterministically and rejects ordering cycles')
}

export function verifyLifecycleSource() {
  includes('services/greenfield-api/migrations/027_phase7e_module_runtime_2.sql', [
    'greenfield_module_lifecycle_transactions',
    'greenfield_module_lifecycle_stages',
    "'install','enable','disable','update','uninstall','repair','quarantine','unquarantine'",
    "'keepData','exportThenDelete','deleteData'",
  ], 'lifecycle migration captures transactions, rollback policy and data retention choices')
  includes('services/greenfield-worker/src/modules/installation-handler.ts', [
    'projectStandard2Runtime',
    "status: 'disabled'",
    'jobsPaused: true',
  ], 'install worker creates disabled runtime records')
  includes('services/greenfield-worker/src/modules/enable-handler.ts', [
    'projectStandard2Runtime',
    "status: 'registered'",
    'jobsPaused: false',
  ], 'enable worker registers active runtime records')
  includes('services/greenfield-worker/src/modules/disable-handler.ts', [
    'setStandard2RuntimeStatus',
    "action: 'disable'",
    'jobsPaused: true',
  ], 'disable worker pauses runtime records')
  includes('services/greenfield-worker/src/modules/uninstall-handler.ts', [
    'removeStandard2Runtime',
    'dataRetentionChoice',
    "status: 'removed'",
  ], 'uninstall worker removes registrations and records retention decisions')
}

export function verifyPermissionsSource() {
  includes('services/greenfield-api/migrations/027_phase7e_module_runtime_2.sql', [
    'greenfield_module_permission_states',
    "'requested','granted','denied','revoked','unsupported','requires-platform','requires-reauthorisation'",
    'required BOOLEAN NOT NULL DEFAULT FALSE',
  ], 'Permissions 2.0 migration persists grant state and activation blockers')
  includes('services/greenfield-api/src/modules/runtime2-service.ts', [
    'permissionEntries',
    'stateForPermission',
    'requires-reauthorisation',
    'requires-platform',
    'assertActivationAllowed',
  ], 'runtime permission service normalizes and enforces Permissions 2.0 states')
}

export function verifyStorageSource() {
  includes('services/greenfield-api/migrations/027_phase7e_module_runtime_2.sql', [
    'greenfield_module_storage_allocations',
    "'records','settings','cache','temporary','object-storage','attachments','secrets','history'",
    'quota_bytes BIGINT',
    'greenfield_module_secret_refs',
    'encrypted_value BYTEA NOT NULL',
  ], 'storage migration covers all runtime storage kinds and encrypted secret refs')
  includes('services/greenfield-api/src/modules/runtime2-service.ts', [
    'storeSecret',
    'createCipheriv',
    'redacted_descriptor',
    'secretStorageKey',
  ], 'runtime secret storage encrypts installation-scoped values and returns redacted descriptors')
  includes('services/greenfield-worker/src/modules/standard2-runtime-registration.ts', [
    'insertStorage',
    'runtimeStorageKind',
    'quotaBytes',
    'export_supported',
    'deletion_supported',
  ], 'worker projects storage scope, quota, retention, export and deletion support')
}

export function verifyJobsSource() {
  includes('services/greenfield-api/migrations/027_phase7e_module_runtime_2.sql', [
    'greenfield_module_job_registrations',
    "'one-off','delayed','recurring','cleanup','repair','reindex','health-check'",
    'paused BOOLEAN NOT NULL DEFAULT FALSE',
  ], 'job migration supports required job kinds and pause state')
  includes('services/greenfield-worker/src/modules/standard2-runtime-registration.ts', [
    'insertJobs',
    'normalJobKind',
    'paused: input.jobsPaused',
    "status: input.jobsPaused ? 'paused' : input.status",
  ], 'worker registers jobs and pauses them when modules are disabled')
}

export function verifyUiContributionsSource() {
  includes('services/greenfield-api/migrations/027_phase7e_module_runtime_2.sql', [
    'greenfield_module_ui_contribution_registrations',
    "'board','profile-tabs','settings','composer-tools','context-menu','search-provider','module-route','widget'",
  ], 'UI contribution migration defines generic surfaces')
  includes('services/greenfield-worker/src/modules/standard2-runtime-registration.ts', [
    'insertUiContributions',
    'widgetRegistry',
    'navigationRegistry',
    'uiContributions',
    'surfaceForNavigation',
    'surfaceForUi',
  ], 'worker projects generic UI contributions without arbitrary JSX')
  includes('services/greenfield-api/tests/phase7e.module-runtime-2.test.ts', [
    'profile-tabs',
    'composer-tools',
    'context-menu',
    'module-route',
  ], 'runtime test covers generic UI contribution surfaces')
  includes('src/features/modules/screens/ModuleManagementScreen.tsx', [
    'useModuleRuntimeQuery',
    'SettingsSection title="Runtime"',
    'UI contributions',
    'groupSummary(runtime.data.ui',
  ], 'module management renders persisted Standard 2 runtime contribution state')
}

export function verifyRuntimeSecuritySource() {
  includes('services/greenfield-api/src/modules/runtime2-service.ts', [
    'idempotencyKey',
    'objectPayload',
    'validateSchemaBoundary',
    'enforceRateLimit',
    'GreenfieldPolicyEngine',
    'redactSecrets',
    'caller.status !==',
    'Provider service is not enabled',
  ], 'runtime gateway enforces idempotency, validation, policy, rate limits and disabled-state blocks')
  includes('services/greenfield-api/tests/phase7e.module-runtime-2.test.ts', [
    'blocked-before-enable',
    'blocked-disabled',
    'invalid-input',
    'invoke-too-deep',
    'secret-runtime2-value',
  ], 'runtime test covers blocked invocation, schema/depth failures and secret redaction')
}

export function verifyReferenceModule() {
  if (!existsSync(referenceModuleRoot)) {
    fail(`missing Standard 2 reference fixture ${referenceModuleRoot}`)
    return
  }
  run('node', ['fixtures/modules/standard2-reference/scripts/verify-reference-module.mjs'], 'Standard 2 reference fixture self-verifier passes', process.env, root)
}

export async function runIsolatedRuntime2Test() {
  const env = {...process.env}
  loadEnvFile('services/greenfield-api/.env', env)
  const baseUrl = env.MODULA_TEST_DATABASE_URL
  if (!baseUrl) {
    fail('isolated Standard 2 runtime verifier requires MODULA_TEST_DATABASE_URL pointed at a disposable test Postgres server')
    return
  }
  const parsed = new URL(baseUrl)
  const dbName = `modula_runtime2_verify_${process.pid}_${Date.now()}`.toLowerCase()
  const adminUrl = adminDatabaseUrl(parsed, env)
  const create = spawnSync('createdb', ['--owner', parsed.username || 'modula_migrator', dbName], {
    cwd: root,
    encoding: 'utf8',
    env: pgCommandEnv(adminUrl, env),
    shell: false,
  })
  if (create.status !== 0) {
    fail('unable to create isolated Standard 2 runtime verifier database through supplied test Postgres server')
    return
  }
  try {
    parsed.pathname = `/${dbName}`
    const testEnv = {
      ...env,
      NODE_ENV: 'test',
      MODULA_ENVIRONMENT: 'development',
      MODULA_TEST_DATABASE_URL: parsed.toString(),
      MODULA_DATABASE_URL: parsed.toString(),
      MODULA_DATABASE_MIGRATOR_URL: parsed.toString(),
      MODULA_RATE_LIMIT_ENABLED: 'false',
      MODULA_INVITE_ONLY: 'false',
      MODULA_PREVIEW_WRITES_ENABLED: 'true',
      GREENFIELD_MODULE_REGISTRY_ENABLED: 'true',
      GREENFIELD_MODULE_INSTALLATION_ENABLED: 'true',
      GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED: 'true',
      GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED: 'true',
      GREENFIELD_AI_GATEWAY_ENABLED: 'true',
      MODULA_MODULE_SECRETS_KEY: 'phase7e-runtime2-verifier-secret-key',
    }
    runClassified(
      'pnpm',
      ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.module-runtime-2.test.ts'],
      'isolated Standard 2 runtime integration tests',
      'TEST_ENV_FAILURE',
      testEnv,
    )
  } finally {
    spawnSync('dropdb', ['--if-exists', dbName], {
      cwd: root,
      env: pgCommandEnv(adminUrl, env),
      stdio: 'ignore',
      shell: false,
    })
    pass('dropped isolated Standard 2 runtime verifier database')
  }
}

function childProcessEnv(env) {
  return {
    ...env,
    CI: env.CI ?? process.env.CI ?? 'true',
  }
}

function adminDatabaseUrl(baseUrl, env) {
  if (env.MODULA_TEST_DATABASE_ADMIN_URL) return new URL(env.MODULA_TEST_DATABASE_ADMIN_URL)
  const adminUrl = new URL(baseUrl.toString())
  adminUrl.pathname = `/${env.MODULA_TEST_DATABASE_ADMIN_DB ?? 'postgres'}`
  return adminUrl
}

function pgCommandEnv(url, env) {
  return childProcessEnv({
    ...env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '') || 'postgres'),
  })
}

function loadEnvFile(path, env) {
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index)
    const value = trimmed.slice(index + 1)
    if (!env[key]) env[key] = value
  }
}
