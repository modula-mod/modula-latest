import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {isSupportedModulePermission, type GreenfieldModulePermission} from '@modula/greenfield-module-manifest'
import type {GreenfieldModuleInstallationStatus} from '@modula/greenfield-module-registry-contracts'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldModuleSettingsService} from '../src/modules/settings-service.js'
import {statusForError} from '../src/transport/envelope.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, registerAccount} from './helpers/registry-fixtures.js'
import {authorizeFirstPartyPublisherFixture} from './helpers/first-party-publisher.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

describe('module settings capability contracts', () => {
  it('accepts explicit settings capabilities without implication', () => {
    for (const capability of ['settings:register', 'settings:read', 'settings:write']) {
      expect(isSupportedModulePermission(capability)).toBe(true)
    }
    expect(['settings:register']).not.toContain('settings:read')
    expect(['settings:register']).not.toContain('settings:write')
  })

  it.each([
    ['REVISION_CONFLICT', 409],
    ['MUTATION_REUSE_CONFLICT', 409],
    ['INVALID_CURSOR', 400],
    ['FUNCTION_NOT_AVAILABLE', 404],
    ['CAPABILITY_UNAVAILABLE', 503],
    ['NOTE_REVISION_CONFLICT', 409],
  ] as const)('maps %s to HTTP %i', (code, status) => {
    expect(statusForError(code)).toBe(status)
  })
})

describeIfDb.sequential('neutral module settings authorization matrix', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let accountId = ''
  let token = ''
  let foreignToken = ''
  const suffix = `s${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const scenarios = new Map<string, {moduleId: string; installationId: string}>()

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4092')
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    // Online signing (GF-SIGN-01) requires reserved namespaces to be registry-authorized first-party policy.
    await authorizeFirstPartyPublisherFixture(db, 'modula', 'Modula', 'modula.mp02settings')
    const owner = await registerAccount(app, `settings-owner-${suffix}@example.com`, `setown${suffix}`.slice(0, 20), db)
    const foreign = await registerAccount(app, `settings-foreign-${suffix}@example.com`, `setfor${suffix}`.slice(0, 20), db)
    accountId = owner.accountId
    token = owner.token
    foreignToken = foreign.token
    await provision('alpha', 'register', ['settings:register'], ['settings:register'])
    await provision('beta', 'read', ['settings:register', 'settings:read'], ['settings:register', 'settings:read'])
    await provision('alpha', 'write', ['settings:register', 'settings:write'], ['settings:register', 'settings:write'])
    await provision('beta', 'readwrite', ['settings:register', 'settings:read', 'settings:write'], ['settings:register', 'settings:read', 'settings:write'])
    await provision('alpha', 'missingreview', ['settings:register', 'settings:read'], [], [], 'enabled', false)
    await provision('beta', 'denied', ['settings:register', 'settings:read', 'settings:write'], ['settings:register'], ['settings:read', 'settings:write'])
    await provision('alpha', 'disabled', ['settings:register', 'settings:read'], ['settings:register', 'settings:read'], [], 'installedDisabled')
    await provision('beta', 'untrusted', ['settings:register', 'settings:read'], ['settings:register', 'settings:read'])
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('register-only grants no data access', async () => {
    await expectError('GET', 'register', 'settings-schema', token, 403, 'MODULE_PERMISSION_DENIED')
    await expectError('GET', 'register', 'settings', token, 403, 'MODULE_PERMISSION_DENIED')
    await expectError('PATCH', 'register', 'settings', token, 403, 'MODULE_PERMISSION_DENIED', {values: {theme: 'dark'}})
  })

  it('read-only permits reads and denies mutation', async () => {
    const schema = await request('GET', 'read', 'settings-schema', token)
    expect(schema.statusCode, schema.body).toBe(200)
    expect(schema.json().data.defaults.theme).toBe('system')
    expect((await request('GET', 'read', 'settings', token)).statusCode).toBe(200)
    await expectError('PATCH', 'read', 'settings', token, 403, 'MODULE_PERMISSION_DENIED', {values: {theme: 'dark'}})
  })

  it('write-only returns an acknowledgement without values', async () => {
    const response = await request('PATCH', 'write', 'settings', token, {values: {theme: 'dark'}})
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json().data).toMatchObject({version: 1})
    expect(response.json().data).not.toHaveProperty('values')
    expect(response.json().data).not.toHaveProperty('secret_refs')
    await expectError('GET', 'write', 'settings', token, 403, 'MODULE_PERMISSION_DENIED')
    const stored = await db.selectFrom('greenfield_module_installation_settings')
      .select(['values']).where('installation_id', '=', scenarios.get('write')!.installationId)
      .executeTakeFirstOrThrow()
    expect(stored.values).toMatchObject({theme: 'dark'})
  })

  it('read plus write returns the non-secret document and audits the mutation', async () => {
    const response = await request('PATCH', 'readwrite', 'settings', token, {values: {theme: 'light'}})
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json().data.values.theme).toBe('light')
    expect(response.json().data.values.secretToken).toMatchObject({configured: false})
    const audit = await db.selectFrom('audit_events').select(['event_type'])
      .where('resource_id', '=', scenarios.get('readwrite')!.installationId)
      .where('event_type', '=', 'module.settings.updated').executeTakeFirst()
    expect(audit?.event_type).toBe('module.settings.updated')
  })

  it('returns exact review, denial, disabled, foreign and trust errors', async () => {
    await expectError('GET', 'missingreview', 'settings', token, 403, 'PERMISSION_REVIEW_REQUIRED')
    await expectError('GET', 'denied', 'settings', token, 403, 'MODULE_PERMISSION_DENIED')
    await expectError('GET', 'disabled', 'settings', token, 403, 'INSTALLATION_DISABLED')
    await expectError('GET', 'read', 'settings', foreignToken, 404, 'NOT_FOUND')
    const untrusted = scenarios.get('untrusted')!
    const productionConfig = {...loadConfig(), environment: 'production' as const, moduleAllowUntrustedDevelopmentReleases: false}
    await expect(new GreenfieldModuleSettingsService(db, productionConfig).get(accountId, untrusted.moduleId))
      .rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})
  })

  async function request(method: 'GET' | 'PATCH', scenario: string, endpoint: 'settings' | 'settings-schema', accessToken: string, payload?: Record<string, unknown>) {
    const target = scenarios.get(scenario)!
    return app.inject({method, url: `/v1/modules/${target.moduleId}/${endpoint}`, headers: {authorization: `Bearer ${accessToken}`}, payload})
  }

  async function expectError(method: 'GET' | 'PATCH', scenario: string, endpoint: 'settings' | 'settings-schema', accessToken: string, status: number, code: string, payload?: Record<string, unknown>) {
    const response = await request(method, scenario, endpoint, accessToken, payload)
    expect(response.statusCode, response.body).toBe(status)
    expect(response.json().error.code).toBe(code)
  }

  async function provision(family: 'alpha' | 'beta', label: string, requested: string[], granted: string[], denied: string[] = [], status: GreenfieldModuleInstallationStatus = 'enabled', review = true) {
    // Keep the namespace owned by the shared first-party fixture publisher so
    // this suite remains isolated when the full database test matrix runs.
    const moduleId = `modula.mp02settings.${family}.${label}.${suffix}`
    const permissions: GreenfieldModulePermission[] = requested.map(permission => ({permission, reason: `Test ${permission}`}))
    const manifest = adapterManifest(moduleId, '1.0.0', {
      permissions,
      contributions: {settings: [{id: `${moduleId}.settings.installation`, title: 'Neutral settings', schemaRef: 'schemas/settings.json', scope: 'installation'}]},
      extensions: {settingsDefaults: {theme: 'system', secretToken: ''}},
    })
    const releases = new GreenfieldModuleReleaseService(db)
    const imported = await releases.importPendingReview(manifest, evidenceFor(manifest))
    const published = await releases.publishRelease(moduleId, '1.0.0')
    const installationId = `settings-installation:${moduleId}:${accountId}`
    await db.insertInto('greenfield_extension_installations').values({
      installation_id: installationId, extension_version_id: imported.extensionVersionId,
      account_id: accountId, status, config: jsonb({}), created_at: new Date(), updated_at: new Date(),
    }).execute()
    if (review) {
      await db.insertInto('greenfield_module_permission_reviews').values({
        review_id: `settings-review:${moduleId}`, installation_id: installationId,
        release_id: published.releaseId, account_id: accountId,
        granted_permissions: jsonb(granted), denied_permissions: jsonb(denied),
        high_risk_increase: false, idempotency_key: `settings-review:${moduleId}`, reviewed_at: new Date(),
      }).execute()
    }
    scenarios.set(label, {moduleId, installationId})
  }
})
