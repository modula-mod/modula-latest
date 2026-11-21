import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, expect, it, describe} from 'vitest'
import {
  GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
  createDefaultModuleSectionVersions,
  manifestChecksum,
  type GreenfieldModuleManifest,
} from '@modula/greenfield-module-manifest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'

// #192 (Sentinel FLOWS-01 MOD-08): DELETE /v1/modules/:id/install with choice deleteData
// must use the server-side step-up policy, never a client-asserted body.recentAuth.

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

describeIfDb('#192 module data deletion requires server-side step-up', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  const suffix = randomUUID().slice(0, 8)

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    await app.ready()
    account = await registerAccount()
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  // One account (a single registration keeps this file out of the shared per-IP verification
  // budget); each test signs in for its own session, then ages the account's sessions as needed.
  let account: {accountId: string; email: string; password: string}

  async function registerAccount() {
    const email = `fix192-${suffix}@example.com`
    const password = 'secure-pass-word-1'
    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle: `fix192${suffix}`, displayName: 'Fix 192', acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    return {accountId: register.json().data.accountId as string, email, password}
  }

  async function signIn() {
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email: account.email, password: account.password}})
    expect(session.statusCode).toBe(200)
    return {accountId: account.accountId, token: session.json().data.accessToken as string}
  }

  async function ageSessions(accountId: string, ageMs: number) {
    await db.updateTable('greenfield_sessions').set({recent_authentication_at: new Date(Date.now() - ageMs)}).where('account_id', '=', accountId).execute()
  }

  async function installEnabled(accountId: string, label: string) {
    const moduleId = `test.modula.fix192-${label}-${suffix}`
    const manifest = fixtureManifest(moduleId, '1.0.0')
    const releases = new GreenfieldModuleReleaseService(db)
    await releases.importPendingReview(manifest)
    const published = await releases.publishRelease(moduleId, '1.0.0')
    const installationId = `installation:${moduleId}:${accountId}`
    await db.insertInto('greenfield_extension_installations').values({
      installation_id: installationId, extension_version_id: published.extensionVersionId, account_id: accountId,
      status: 'enabled', config: {}, created_at: new Date(), updated_at: new Date(),
    }).execute()
    return {moduleId, installationId}
  }

  const uninstall = (token: string, moduleId: string, payload: Record<string, unknown>) => app.inject({
    method: 'DELETE',
    url: `/v1/modules/${moduleId}/install`,
    headers: {authorization: `Bearer ${token}`, 'idempotency-key': `fix192-${randomUUID()}`},
    payload,
  })

  const installationStatus = async (installationId: string) => (await db.selectFrom('greenfield_extension_installations')
    .select('status').where('installation_id', '=', installationId).executeTakeFirstOrThrow()).status

  it('refuses deleteData on a 7-day-old session with the same status and error shape as DELETE /v1/accounts/me/sessions', async () => {
    const session = await signIn()
    const {moduleId, installationId} = await installEnabled(session.accountId, 'stale')
    await ageSessions(session.accountId, SEVEN_DAYS_MS)

    const sessionsReference = await app.inject({method: 'DELETE', url: '/v1/accounts/me/sessions', headers: {authorization: `Bearer ${session.token}`}})
    const refused = await uninstall(session.token, moduleId, {choice: 'deleteData', confirmDelete: true})

    expect(refused.statusCode).toBe(sessionsReference.statusCode)
    expect(refused.statusCode).toBe(401)
    const {requestId: _refusedRequestId, ...refusedError} = refused.json().error
    const {requestId: _referenceRequestId, ...referenceError} = sessionsReference.json().error
    expect(refusedError).toEqual(referenceError)
    expect(Object.keys(refused.json()).sort()).toEqual(Object.keys(sessionsReference.json()).sort())
    expect(refused.json()).toMatchObject({ok: false, error: {code: 'STEP_UP_REQUIRED'}})
    expect(await installationStatus(installationId)).toBe('enabled')
  })

  it('still refuses a stale session that sends body.recentAuth=true', async () => {
    const session = await signIn()
    const {moduleId, installationId} = await installEnabled(session.accountId, 'claim')
    await ageSessions(session.accountId, SEVEN_DAYS_MS)
    const refused = await uninstall(session.token, moduleId, {choice: 'deleteData', confirmDelete: true, recentAuth: true})
    expect(refused.statusCode).toBe(401)
    expect(refused.json().error.code).toBe('STEP_UP_REQUIRED')
    expect(await installationStatus(installationId)).toBe('enabled')
  })

  it('refuses just outside the 15-minute recent-auth window and accepts after a fresh login', async () => {
    const session = await signIn()
    const {moduleId} = await installEnabled(session.accountId, 'window')
    await ageSessions(session.accountId, 16 * 60 * 1000)
    expect((await uninstall(session.token, moduleId, {choice: 'deleteData', confirmDelete: true, recentAuth: true})).statusCode).toBe(401)
    await ageSessions(session.accountId, 60 * 1000)
    expect((await uninstall(session.token, moduleId, {choice: 'deleteData', confirmDelete: true})).statusCode).toBe(202)
  })

  it('accepts deleteData on a fresh session without any body.recentAuth', async () => {
    const session = await signIn()
    const {moduleId, installationId} = await installEnabled(session.accountId, 'fresh')
    const accepted = await uninstall(session.token, moduleId, {choice: 'deleteData', confirmDelete: true})
    expect(accepted.statusCode).toBe(202)
    expect(accepted.json().data.status).toBe('uninstalling')
    expect(await installationStatus(installationId)).toBe('uninstalling')
  })

  it('still requires explicit confirmDelete on a fresh session', async () => {
    const session = await signIn()
    const {moduleId, installationId} = await installEnabled(session.accountId, 'confirm')
    const refused = await uninstall(session.token, moduleId, {choice: 'deleteData', recentAuth: true})
    expect(refused.statusCode).toBe(400)
    expect(refused.json().error.code).toBe('VALIDATION_FAILED')
    expect(await installationStatus(installationId)).toBe('enabled')
  })

  it('leaves keepData unchanged: no step-up needed, even on a 7-day-old session', async () => {
    const session = await signIn()
    const {moduleId, installationId} = await installEnabled(session.accountId, 'keep')
    await ageSessions(session.accountId, SEVEN_DAYS_MS)
    const accepted = await uninstall(session.token, moduleId, {choice: 'keepData'})
    expect(accepted.statusCode).toBe(202)
    expect(accepted.json().data.status).toBe('uninstalling')
    expect(await installationStatus(installationId)).toBe('uninstalling')
  })
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
  process.env.GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES = 'true'
  process.env.GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED = 'true'
  process.env.GREENFIELD_AI_GATEWAY_ENABLED = 'true'
  process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
  process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'fix-192-module-delete-stepup-signing-key'
  process.env.MODULA_MODULE_SECRETS_KEY = 'fix-192-module-delete-stepup-secret-key'
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
      repository: 'modula-mod/fix-192-fixtures',
      commit: '0123456789abcdef0123456789abcdef01234567',
      manifestPath: 'dist/greenfield.manifest.json',
    },
    license: {status: 'firstParty', evidenceIds: ['fix-192-fixture']},
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
