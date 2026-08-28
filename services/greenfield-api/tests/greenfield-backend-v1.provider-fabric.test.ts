import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
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

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)
const role = 'notes.provider'
const products = ['test.modula.primary-notes', 'test.modula.reference-notes'] as const

describeIfDb('Greenfield Backend V1 generic provider fabric', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let accountA = ''
  let accountB = ''
  let tokenA = ''
  let tokenB = ''
  const installations = new Map<string, string>()

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    const first = await register(`providers-a-${suffix}@example.com`, `providera${suffix}`.slice(0, 20))
    accountA = first.accountId
    tokenA = first.token
    const second = await register(`providers-b-${suffix}@example.com`, `providerb${suffix}`.slice(0, 20))
    accountB = second.accountId
    tokenB = second.token

    for (const productId of products) {
      const manifest = providerManifest(productId)
      const releases = new GreenfieldModuleReleaseService(db)
      let release = await releases.getRelease(productId, manifest.version)
      if (!release) {
        await releases.importPendingReview(manifest)
        release = await releases.publishRelease(productId, manifest.version)
      }
      const installationId = `installation:${productId}:${accountA}`
      installations.set(productId, installationId)
      await db.insertInto('greenfield_extension_installations').values({
        installation_id: installationId,
        extension_version_id: release.extensionVersionId,
        account_id: accountA,
        status: 'enabled',
        config: {},
        created_at: new Date(),
        updated_at: new Date(),
      }).onConflict(conflict => conflict.column('installation_id').doUpdateSet({status: 'enabled', updated_at: new Date()})).execute()
    }
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('discovers all installed providers from manifests without a product-ID special case', async () => {
    const response = await request('GET', `/v1/providers/${role}`)
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json().data.providers.map((provider: any) => provider.providerProductId)).toEqual([...products])
    expect(response.json().data.providers.every((provider: any) => provider.enabled)).toBe(true)
    expect(response.json().data.defaultProvider).toBeNull()

    const fallback = await request('GET', `/v1/providers/${role}/resolve`)
    expect(fallback.statusCode, fallback.body).toBe(200)
    expect(fallback.json().data.providerProductId).toBe(products[0])
  })

  it('switches the account default without uninstalling either provider', async () => {
    const selected = await request('PUT', `/v1/providers/${role}/default`, {
      providerInstallationId: installations.get(products[1]),
    })
    expect(selected.statusCode, selected.body).toBe(200)
    expect(selected.json().data).toMatchObject({providerProductId: products[1], isDefault: true})

    const resolved = await request('GET', `/v1/providers/${role}/resolve`)
    expect(resolved.statusCode, resolved.body).toBe(200)
    expect(resolved.json().data.providerProductId).toBe(products[1])
    const rows = await db.selectFrom('greenfield_extension_installations')
      .select(['installation_id', 'status'])
      .where('account_id', '=', accountA)
      .where('installation_id', 'in', [...installations.values()])
      .execute()
    expect(rows).toHaveLength(2)
    expect(rows.every(row => row.status === 'enabled')).toBe(true)

    const events = await db.selectFrom('greenfield_domain_events')
      .select(['event_type', 'account_id', 'product_id', 'payload'])
      .where('event_type', '=', 'greenfield.provider.default.changed')
      .where('account_id', '=', accountA)
      .execute()
    expect(events.at(-1)).toMatchObject({product_id: products[1], payload: {capabilityRole: role, providerProductId: products[1]}})
  })

  it('enforces account ownership and refuses to route through a disabled selected provider', async () => {
    const foreign = await app.inject({
      method: 'PUT',
      url: `/v1/providers/${role}/default`,
      headers: {authorization: `Bearer ${tokenB}`},
      payload: {providerInstallationId: installations.get(products[0])},
    })
    expect(foreign.statusCode, foreign.body).toBe(404)
    await expect(db.insertInto('greenfield_account_default_providers').values({
      account_id: accountB,
      capability_role: role,
      provider_product_id: products[0],
      provider_installation_id: installations.get(products[0])!,
      selected_by_account_id: accountB,
      selected_at: new Date(),
      updated_at: new Date(),
    }).execute()).rejects.toMatchObject({code: '23514'})

    await db.updateTable('greenfield_extension_installations')
      .set({status: 'disabled', updated_at: new Date()})
      .where('installation_id', '=', installations.get(products[1])!)
      .execute()
    const disabled = await request('GET', `/v1/providers/${role}/resolve`)
    expect(disabled.statusCode, disabled.body).toBe(404)
    expect(disabled.json().error.message).toContain('not enabled')
    await db.updateTable('greenfield_extension_installations')
      .set({status: 'enabled', updated_at: new Date()})
      .where('installation_id', '=', installations.get(products[1])!)
      .execute()
  })

  async function request(method: 'GET' | 'PUT', url: string, payload?: unknown) {
    return app.inject({method, url, headers: {authorization: `Bearer ${tokenA}`}, payload})
  }

  async function register(email: string, handle: string) {
    const password = 'secure-pass-word-1'
    const registration = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, displayName: 'Provider Fabric User', acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(registration.statusCode, registration.body).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: registration.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(session.statusCode, session.body).toBe(200)
    return {accountId: registration.json().data.accountId as string, token: session.json().data.accessToken as string}
  }
})

function providerManifest(moduleId: string): GreenfieldModuleManifest {
  const manifest = {
    manifestVersion: GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
    moduleId,
    name: moduleId.endsWith('reference-notes') ? 'Reference Notes' : 'Primary Notes Fixture',
    description: `TEST_ONLY notes provider ${moduleId}`,
    version: '1.0.0',
    standardVersion: '2.0.0',
    sectionVersions: createDefaultModuleSectionVersions(),
    publisher: {publisherId: 'modula', displayName: 'Modula', website: 'https://modula.digital'},
    source: {provider: 'github', repository: 'modula-mod/greenfield-test-fixtures', commit: '0123456789abcdef0123456789abcdef01234567', manifestPath: `${moduleId}/manifest.json`},
    license: {status: 'firstParty', evidenceIds: ['greenfield-test-fixture']},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {minimumGreenfieldVersion: '0.1.0', minimumModulaHostVersion: '0.1.0', protocolVersions: ['greenfield.v1'], platforms: ['server', 'web']},
    permissions: [],
    dependencies: [],
    contributions: {},
    dependencyGraph: {version: '2.0.0', requires: [], optional: [], recommended: [], conflicts: [], replaces: [], provides: [{id: role, title: 'Notes Provider', version: '1.0.0', kind: 'capability'}]},
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
  } as GreenfieldModuleManifest
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

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
  process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
  process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'greenfield-provider-test-signing-key'
  process.env.MODULA_MODULE_SECRETS_KEY = 'greenfield-provider-test-secrets-key'
}
