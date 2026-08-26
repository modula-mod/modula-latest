import {randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {
  GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
  createDefaultModuleSectionVersions,
  manifestChecksum,
  validateGreenfieldModuleManifest,
  type GreenfieldModuleManifest,
} from '@modula/greenfield-module-manifest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp, migrateDown} from '../src/database/migrate.js'
import {GreenfieldModuleDependencyResolver} from '../src/modules/dependency-resolver.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldModuleRuntime2Service} from '../src/modules/runtime2-service.js'
import {createDb as createWorkerDb, type ModulaWorkerDb} from '../../greenfield-worker/src/database.js'
import {loadConfig as loadWorkerConfig} from '../../greenfield-worker/src/config.js'
import {handleModuleInstall} from '../../greenfield-worker/src/modules/installation-handler.js'
import {handleModuleEnable} from '../../greenfield-worker/src/modules/enable-handler.js'
import {handleModuleDisable} from '../../greenfield-worker/src/modules/disable-handler.js'
import {handleModuleUpdate} from '../../greenfield-worker/src/modules/update-handler.js'
import {handleModuleUninstall} from '../../greenfield-worker/src/modules/uninstall-handler.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const referenceModuleRoot = resolve(workspaceRoot, 'fixtures/modules/standard2-reference')
const moduleId = 'digital.modula.standard2-reference'
const serviceId = 'digital.modula.standard2-reference.service.analyze-text'
const writePermission = 'records:module.digital.modula.standard2-reference.analysis:write'
const readPermission = 'records:module.digital.modula.standard2-reference.analysis:read'
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

describe('Phase 7E Standard 2 reference module repository', () => {
  it('exports a host-importable manifest with a real service contract', () => {
    const manifest = referenceManifest()
    const validation = validateGreenfieldModuleManifest(manifest)
    expect(validation.issues).toEqual([])
    expect(manifest.standardVersion).toBe('2.0.0')
    expect(manifest.serviceRegistry.items[0]?.kind).toBe('markdown')
    expect(manifest.storageModel.items.map((item: any) => item.kind)).toEqual(expect.arrayContaining([
      'structured-records',
      'settings',
      'cache',
      'temporary-storage',
      'object-storage',
      'attachments',
      'secrets',
      'history',
    ]))
  })
})

describeIfDb('Phase 7E Standard 2 dependency, capability, service, lifecycle, storage, jobs and UI runtime', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let workerDb: ModulaWorkerDb
  let token = ''
  let accountId = ''
  let installationId = ''
  let releaseId = ''
  const suffix = randomUUID().slice(0, 8)

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    workerDb = createWorkerDb(databaseUrl!)
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    await app.ready()

    const registered = await registerAccount(`runtime2-${suffix}@example.com`, `runtime2${suffix}`.slice(0, 20))
    token = registered.token
    accountId = registered.accountId
    await importRuntimeFixtures()
  })

  afterAll(async () => {
    await app?.close()
    await workerDb?.destroy()
    await db?.destroy()
  })

  it('rejects cycles and installed conflicts before installation planning', async () => {
    const resolver = new GreenfieldModuleDependencyResolver(db)
    const cycle = await resolver.resolve({moduleId: 'digital.modula.cycle-a', manifest: fixtureManifest('digital.modula.cycle-a', '1.0.0', {
      dependencyGraph: graph({requires: [{moduleId: 'digital.modula.cycle-a', versionRange: '^1.0.0', reason: 'Self-cycle'}]}),
    })})
    expect(cycle.circular).toBe(true)
    expect(cycle.installable).toBe(false)

    const conflictAccount = await registerAccount(`runtime2-conflict-${suffix}@example.com`, `r2conf${suffix}`.slice(0, 20))
    await seedInstalledRelease(conflictAccount.accountId, fixtureManifest('digital.modula.reference-conflict', '1.0.0'), 'enabled')
    const conflict = await resolver.resolve({moduleId, manifest: referenceManifest(), accountId: conflictAccount.accountId})
    expect(conflict.installable).toBe(false)
    expect(conflict.errors.join('\n')).toContain('Conflicting module digital.modula.reference-conflict is installed')
  })

  it('persists accepted dependency and permission state atomically during installation', async () => {
    const preview = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/install-preview`,
      headers: {authorization: `Bearer ${token}`},
      payload: {version: '2.0.0'},
    })
    expect(preview.statusCode).toBe(200)
    expect(preview.json().data.compatible).toBe(true)
    expect(preview.json().data.dependencyWarnings).toContain('Recommended dependency digital.modula.reference-recommender@^1.0.0 is unavailable')

    const install = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/install`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `install-runtime2-${suffix}`},
      payload: {version: '2.0.0', approvedPermissions: [readPermission, writePermission]},
    })
    expect(install.statusCode).toBe(202)
    installationId = install.json().data.installationId

    const dependencies = await db
      .selectFrom('greenfield_module_resolved_dependencies')
      .select(['relation', 'target_module_id', 'provided_contract', 'resolved_module_id', 'resolved_version', 'installed', 'satisfied', 'blocking', 'degraded'])
      .where('installation_id', '=', installationId)
      .orderBy('relation')
      .execute()
    expect(dependencies.map(row => row.relation)).toEqual(expect.arrayContaining(['requires', 'optional', 'recommended', 'conflicts', 'replaces', 'provides']))
    expect(dependencies.find(row => row.relation === 'requires')).toMatchObject({target_module_id: 'digital.modula.reference-provider', resolved_version: '1.0.0', installed: true, satisfied: true, blocking: true})
    expect(dependencies.find(row => row.relation === 'optional')).toMatchObject({provided_contract: 'modula.reference.calendar', resolved_module_id: null, degraded: true})
    expect(dependencies.find(row => row.relation === 'recommended')).toMatchObject({target_module_id: 'digital.modula.reference-recommender', resolved_module_id: null})
    expect(dependencies.find(row => row.relation === 'replaces')).toMatchObject({target_module_id: 'digital.modula.reference-legacy', resolved_version: '1.5.0'})

    const permissions = await db
      .selectFrom('greenfield_module_permission_states')
      .select(['permission', 'state', 'required', 'policy_mode'])
      .where('installation_id', '=', installationId)
      .orderBy('permission')
      .execute()
    expect(permissions.find(row => row.permission === readPermission)).toMatchObject({state: 'granted', required: true})
    expect(permissions.find(row => row.permission === writePermission)).toMatchObject({state: 'granted', required: true, policy_mode: 'warn'})
    expect(permissions.find(row => row.permission === 'search:index')).toMatchObject({state: 'denied', required: false})
    expect(permissions.find(row => row.permission.startsWith('requires-reauthorisation:'))).toMatchObject({state: 'requires-reauthorisation', required: false})

    const lifecycle = await db
      .selectFrom('greenfield_module_lifecycle_transactions')
      .select(['action', 'status', 'idempotency_key'])
      .where('installation_id', '=', installationId)
      .where('action', '=', 'install')
      .executeTakeFirstOrThrow()
    expect(lifecycle).toMatchObject({action: 'install', status: 'running'})
    expect(lifecycle.idempotency_key).toBeTruthy()
  })

  it('projects runtime registrations, invokes only through the service gateway, and handles disable/re-enable/uninstall', async () => {
    await handleModuleInstall(workerDb, loadWorkerConfig(), {planId: await planId(), installationId, releaseId, moduleId, accountId})
    let runtime = await runtimeSummary()
    expect(runtime.status).toBe('installedDisabled')
    expect(runtime.services).toHaveLength(1)
    expect(runtime.services[0]).toMatchObject({service_id: serviceId, status: 'disabled', health_state: 'disabled'})
    expect(runtime.jobs.every((job: any) => job.paused === true && job.status === 'paused')).toBe(true)
    expect(runtime.storage.map((row: any) => row.storage_kind).sort()).toEqual(['attachments', 'cache', 'history', 'object-storage', 'records', 'secrets', 'settings', 'temporary'])
    expect(runtime.ui.map((row: any) => row.surface)).toEqual(expect.arrayContaining(['board', 'profile-tabs', 'settings', 'composer-tools', 'context-menu', 'search-provider', 'module-route', 'widget']))

    const blockedInvoke = await invokeService('blocked-before-enable', {text: 'blocked before enable'})
    expect(blockedInvoke.statusCode).toBe(403)

    const enable = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/enable`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `enable-runtime2-${suffix}`},
    })
    expect(enable.statusCode).toBe(202)
    await handleModuleEnable(workerDb, loadWorkerConfig(), {installationId, releaseId, moduleId, accountId})
    runtime = await runtimeSummary()
    expect(runtime.status).toBe('enabled')
    expect(runtime.services[0]).toMatchObject({status: 'registered', health_state: 'healthy'})
    expect(runtime.apis[0]).toMatchObject({status: 'registered', path: '/api/modula/digital.modula.standard2-reference/analyze'})
    expect(runtime.hooks.map((hook: any) => hook.phase)).toEqual(['before', 'after'])
    expect(runtime.jobs.every((job: any) => job.paused === false && job.status === 'registered')).toBe(true)
    expect(runtime.capabilities.some((capability: any) => capability.capability === 'modula.reference.text-analysis' && capability.state === 'granted')).toBe(true)

    const invoked = await invokeService('invoke-enabled', {text: 'Runtime 2 gateway invocation'})
    expect(invoked.statusCode).toBe(200)
    expect(invoked.json().data.result).toMatchObject({ok: true, kind: 'markdown', wordCount: 4})
    const idempotent = await invokeService('invoke-enabled', {text: '# Runtime\nDifferent text is ignored by idempotency'})
    expect(idempotent.statusCode).toBe(200)
    expect(idempotent.json().data.idempotent).toBe(true)

    const invalidInput = await invokeService('invalid-input', 'not-an-object')
    expect(invalidInput.statusCode).toBe(400)
    const tooDeep = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/services/${serviceId}/invoke`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': 'invoke-too-deep'},
      payload: {callerModuleId: moduleId, input: {text: 'too deep'}, depth: 3},
    })
    expect(tooDeep.statusCode).toBe(400)

    const secret = await new GreenfieldModuleRuntime2Service(db).storeSecret({
      accountId,
      moduleId,
      secretKey: 'reference-api-key',
      plaintext: 'secret-runtime2-value',
    })
    expect(secret.descriptor).toMatchObject({configured: true, scope: 'installation'})
    const secretRow = await db
      .selectFrom('greenfield_module_secret_refs')
      .select(['secret_ref', 'redacted_descriptor', 'encrypted_value'])
      .where('secret_ref', '=', secret.secretRef)
      .executeTakeFirstOrThrow()
    expect(JSON.stringify(secretRow.redacted_descriptor)).not.toContain('secret-runtime2-value')
    expect(String(secretRow.encrypted_value)).not.toContain('secret-runtime2-value')
    expect(JSON.stringify(await runtimeSummary())).not.toContain('secret-runtime2-value')

    const disable = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/disable`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `disable-runtime2-${suffix}`},
    })
    expect(disable.statusCode).toBe(202)
    await handleModuleDisable(workerDb, {installationId, releaseId, moduleId, accountId})
    runtime = await runtimeSummary()
    expect(runtime.status).toBe('disabled')
    expect(runtime.services[0]).toMatchObject({status: 'disabled', health_state: 'disabled'})
    expect(runtime.jobs.every((job: any) => job.paused === true && job.status === 'paused')).toBe(true)
    expect((await invokeService('blocked-disabled', {text: 'disabled'})).statusCode).toBe(403)

    const reenable = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/enable`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `reenable-runtime2-${suffix}`},
    })
    expect(reenable.statusCode).toBe(202)
    await handleModuleEnable(workerDb, loadWorkerConfig(), {installationId, releaseId, moduleId, accountId})
    expect((await invokeService('invoke-reenabled', {text: 'reenabled service'})).statusCode).toBe(200)

    const updateRelease = await ensurePublishedRelease(referenceManifest('2.0.1'))
    const update = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/update`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `update-runtime2-${suffix}`},
      payload: {version: '2.0.1'},
    })
    expect(update.statusCode).toBe(202)
    expect(update.json().data.status).toBe('updating')
    await handleModuleUpdate(workerDb, {installationId, targetReleaseId: updateRelease.releaseId, previousStatus: 'enabled', moduleId, accountId})
    const updatedInstallation = await db
      .selectFrom('greenfield_extension_installations')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
      .select(['greenfield_extension_installations.status', 'greenfield_module_releases.version'])
      .where('greenfield_extension_installations.installation_id', '=', installationId)
      .executeTakeFirstOrThrow()
    expect(updatedInstallation).toMatchObject({status: 'enabled', version: '2.0.1'})
    const updatedResources = await db
      .selectFrom('greenfield_data_resources')
      .select(['release_id'])
      .where('installation_id', '=', installationId)
      .execute()
    expect(updatedResources).toHaveLength(8)
    expect(updatedResources.every(resource => resource.release_id === updateRelease.releaseId)).toBe(true)
    runtime = await runtimeSummary()
    expect(runtime.status).toBe('enabled')

    const uninstall = await app.inject({
      method: 'DELETE',
      url: `/v1/modules/${moduleId}/install`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `uninstall-runtime2-${suffix}`},
      payload: {choice: 'keepData'},
    })
    expect(uninstall.statusCode).toBe(202)
    await handleModuleUninstall(workerDb, {installationId, releaseId, moduleId, dataRetentionChoice: 'keepData'})
    await expect(new GreenfieldModuleRuntime2Service(db).runtimeSummary(accountId, moduleId)).rejects.toMatchObject({code: 'NOT_FOUND'})
    for (const table of [
      'greenfield_module_capability_registry',
      'greenfield_module_service_registrations',
      'greenfield_module_api_registrations',
      'greenfield_module_hook_registrations',
      'greenfield_module_storage_allocations',
      'greenfield_module_job_registrations',
      'greenfield_module_ui_contribution_registrations',
    ]) {
      const row = await (db as any).selectFrom(table).select(({fn}: any) => fn.countAll().as('count')).where('installation_id', '=', installationId).executeTakeFirst()
      expect(Number(row?.count ?? 0), table).toBe(0)
    }
  })

  it('rolls the Standard 2 runtime migration down and back up on the isolated database', async () => {
    const rolledDown: string[] = []
    while (!rolledDown.includes('027_phase7e_module_runtime_2')) {
      const down = await migrateDown(databaseUrl!)
      expect(down).not.toBeNull()
      rolledDown.push(down!)
    }
    const removed = await (db as any)
      .selectFrom('information_schema.tables')
      .select('table_name')
      .where('table_schema', '=', 'public')
      .where('table_name', '=', 'greenfield_module_service_invocations')
      .execute()
    expect(removed).toHaveLength(0)
    const up = await migrateUp(databaseUrl!)
    expect(up).toEqual(expect.arrayContaining(['027_phase7e_module_runtime_2']))
  })

  async function importRuntimeFixtures() {
    const provider = await seedInstalledRelease(accountId, fixtureManifest('digital.modula.reference-provider', '1.0.0', {
      dependencyGraph: graph({
        provides: [{id: 'modula.reference.provider', title: 'Reference dependency provider', version: '1.0.0', kind: 'capability'}],
      }),
    }), 'enabled')
    expect(provider.releaseId).toBeTruthy()
    await ensurePublishedRelease(fixtureManifest('digital.modula.reference-legacy', '1.5.0'))
    const published = await ensurePublishedRelease(referenceManifest())
    releaseId = published.releaseId
  }

  async function seedInstalledRelease(targetAccountId: string, manifest: GreenfieldModuleManifest, status: 'enabled' | 'disabled') {
    const published = await ensurePublishedRelease(manifest)
    await db
      .insertInto('greenfield_extension_installations')
      .values({
        installation_id: `installation:${manifest.moduleId}:${targetAccountId}`,
        extension_version_id: published.extensionVersionId,
        account_id: targetAccountId,
        status,
        config: {},
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
    return published
  }

  async function ensurePublishedRelease(manifest: GreenfieldModuleManifest) {
    const releases = new GreenfieldModuleReleaseService(db)
    const existing = await releases.getRelease(manifest.moduleId, manifest.version)
    if (existing) return existing
    await releases.importPendingReview(manifest)
    return releases.publishRelease(manifest.moduleId, manifest.version)
  }

  async function registerAccount(email: string, handle: string) {
    const password = 'secure-pass-word-1'
    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, displayName: 'Runtime 2 User', acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(session.statusCode).toBe(200)
    return {accountId: register.json().data.accountId as string, token: session.json().data.accessToken as string}
  }

  async function planId(): Promise<string> {
    const row = await db
      .selectFrom('greenfield_module_install_plans')
      .select('plan_id')
      .where('installation_id', '=', installationId)
      .executeTakeFirstOrThrow()
    return row.plan_id
  }

  async function runtimeSummary() {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/modules/${moduleId}/runtime`,
      headers: {authorization: `Bearer ${token}`},
    })
    expect(response.statusCode).toBe(200)
    return response.json().data
  }

  function invokeService(idempotencyKey: string, input: unknown) {
    return app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/services/${serviceId}/invoke`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': idempotencyKey},
      payload: {callerModuleId: moduleId, input},
    })
  }
})

function configureTestEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4029'
  process.env.MODULA_PUBLIC_API_URL = 'https://api.test.modula.digital'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
  process.env.MODULA_INVITE_ONLY = 'false'
  process.env.GREENFIELD_MODULE_REGISTRY_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_INSTALLATION_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED = 'true'
  process.env.GREENFIELD_AI_GATEWAY_ENABLED = 'true'
  process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
  process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'phase7e-module-runtime-2-test-signing-key'
  process.env.MODULA_MODULE_SECRETS_KEY = 'phase7e-module-runtime-2-secret-key'
}

function referenceManifest(version = '2.0.0'): GreenfieldModuleManifest {
  const manifest = JSON.parse(readFileSync(join(referenceModuleRoot, 'greenfield.manifest.json'), 'utf8')) as GreenfieldModuleManifest
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: workspaceRoot, encoding: 'utf8'}).trim()
  manifest.version = version
  manifest.source.commit = head
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

function fixtureManifest(moduleId: string, version: string, overrides: Partial<GreenfieldModuleManifest> = {}): GreenfieldModuleManifest {
  const manifest = {
    manifestVersion: GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
    moduleId,
    name: moduleId.split('.').at(-1) ?? moduleId,
    description: `Fixture module ${moduleId}`,
    version,
    standardVersion: '2.0.0',
    sectionVersions: createDefaultModuleSectionVersions(),
    publisher: {publisherId: 'modula', displayName: 'Modula', website: 'https://modula.digital'},
    source: {
      provider: 'github',
      repository: 'modula-mod/phase7e-runtime-fixtures',
      commit: '0123456789abcdef0123456789abcdef01234567',
      manifestPath: 'dist/greenfield.manifest.json',
    },
    license: {status: 'firstParty', evidenceIds: ['phase7e-runtime-fixture']},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {
      minimumGreenfieldVersion: '0.1.0',
      minimumModulaHostVersion: '0.1.0',
      protocolVersions: ['greenfield.v1'],
      platforms: ['server', 'web'],
    },
    permissions: [],
    dependencies: [],
    contributions: {},
    dependencyGraph: graph(),
    capabilityDiscovery: {version: '2.0.0'},
    serviceRegistry: {version: '2.0.0', items: []},
    apiRegistry: {version: '2.0.0', items: []},
    hookRegistry: {version: '2.0.0', items: []},
    permissionModel: {version: '2.0.0', categories: {}},
    jobRegistry: {version: '2.0.0', items: []},
    storageModel: {version: '2.0.0', items: []},
    widgetRegistry: {version: '2.0.0', items: []},
    navigationRegistry: {version: '2.0.0', items: []},
    uiContributions: {version: '2.0.0', items: []},
    eventBus: {version: '2.0.0', items: []},
    integrity: {manifestSha256: 'a'.repeat(64), releaseSha256: 'b'.repeat(64)},
    ...overrides,
  } as GreenfieldModuleManifest
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

function graph(overrides: Partial<NonNullable<(GreenfieldModuleManifest & {dependencyGraph?: any})['dependencyGraph']>> = {}) {
  return {
    version: '2.0.0',
    requires: [],
    optional: [],
    recommended: [],
    conflicts: [],
    replaces: [],
    provides: [],
    ...overrides,
  }
}
