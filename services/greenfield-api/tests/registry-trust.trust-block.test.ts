import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'
import {GreenfieldModuleVersionSwitchService} from '../src/modules/version-switch-service.js'
import {GreenfieldModuleRuntimeAccessService} from '../src/modules/runtime-access.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, fixtureProduct, registerAccount, sha256} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)

describe('registry trust error contracts', () => {
  it('preserves UNTRUSTED_RELEASE for version-switch denials', () => {
    try {
      GreenfieldModuleVersionSwitchService.assertAllowed({blockers: [{code: 'UNTRUSTED_RELEASE', message: 'Unsigned target'}]} as any)
      throw new Error('Expected untrusted release denial')
    } catch (error) {
      expect(error).toMatchObject({code: 'UNTRUSTED_RELEASE', message: 'Unsigned target'})
    }
  })
})

describeIfDb('registry trust pipeline: verified trust block', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let token = ''
  let accountId = ''
  const productId = `digital.modula.trust-${suffix}`
  const releases: Record<string, {releaseId: string; mpsBytes: string; frontendSha: string; artifactSha: string; manifestSha: string}> = {}

  async function publish(version: string) {
    const product = fixtureProduct(productId, version)
    const service = new GreenfieldModuleReleaseService(db)
    const manifest = adapterManifest(productId, version)
    const evidence = evidenceFor(manifest)
    await service.importPendingReview(manifest, evidence)
    const release = await service.publishRelease(productId, version)
    await new GreenfieldMpsIngestService(db).ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: release.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.assets})
    releases[version] = {releaseId: release.releaseId, mpsBytes: product.mpsBytes, frontendSha: sha256(product.frontend.bytes), artifactSha: evidence.artifactSha256, manifestSha: manifest.integrity.manifestSha256}
  }

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!)
    process.env.GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES = 'false'
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    await publish('0.1.0')
    const account = await registerAccount(app, `unsigned-${suffix}@example.com`, `unsigned${suffix}`.slice(0, 20), db)
    token = account.token
    accountId = account.accountId
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('returns registry-owned trust facts and the verified modula.product.json projection', async () => {
    const response = await app.inject({method: 'GET', url: `/v1/registry/modules/${productId}`})
    expect(response.statusCode, response.body).toBe(200)
    const {registryTrust: trust, product} = response.json().data
    const expected = releases['0.1.0']!
    expect(trust).toMatchObject({
      registryReleaseId: expected.releaseId,
      moduleId: productId,
      version: '0.1.0',
      releaseState: 'published',
      verified: false,
      publisher: {publisherId: 'modula', status: 'verified', verified: true},
      signature: {state: 'unsigned'},
      digests: {
        releaseSha256: expected.artifactSha,
        adapterManifestSha256: expected.manifestSha,
        productManifestSha256: sha256(expected.mpsBytes),
        frontendSha256: expected.frontendSha,
      },
      provenance: {provider: 'github', repository: 'modula-mod/registry-trust-fixtures', releaseTag: `${productId}-v0.1.0`},
      compatibility: {evaluated: false, requirements: {host: '>=1.0.0', frontendHostRuntime: '>=1.0.0 <2.0.0'}},
      revocation: {revoked: false},
      quarantine: {quarantined: false},
      update: {latestPublishedVersion: '0.1.0', updateAvailable: false},
    })
    expect(typeof trust.publishedAt).toBe('string')
    expect(trust.warnings.map((warning: {code: string}) => warning.code)).toEqual(expect.arrayContaining(['RELEASE_UNSIGNED', 'DEVELOPMENT_ASSETS']))
    expect(product).toMatchObject({manifestSha256: sha256(expected.mpsBytes), identity: {id: productId, version: '0.1.0'}, publisher: {id: 'modula'}})
  })

  it('evaluates compatibility for a requested host version and platform', async () => {
    const compatible = (await app.inject({method: 'GET', url: `/v1/registry/modules/${productId}?hostVersion=1.4.0&platform=ios`})).json().data.registryTrust.compatibility
    expect(compatible).toMatchObject({evaluated: true, hostVersion: '1.4.0', platform: 'ios', compatible: true, reasons: []})
    const tooOld = (await app.inject({method: 'GET', url: `/v1/registry/products/${productId}?hostVersion=0.9.0`})).json().data.registryTrust
    expect(tooOld.compatibility.compatible).toBe(false)
    expect(tooOld.compatibility.reasons.map((reason: {code: string}) => reason.code)).toEqual(['HOST_RANGE_UNSATISFIED', 'FRONTEND_HOST_RUNTIME_UNSATISFIED'])
    expect(tooOld.warnings.map((warning: {code: string}) => warning.code)).toContain('HOST_INCOMPATIBLE')
    const tooNew = (await app.inject({method: 'GET', url: `/v1/registry/modules/${productId}/versions/0.1.0?hostVersion=2.0.0`})).json().data.registryTrust.compatibility
    expect(tooNew.reasons.map((reason: {code: string}) => reason.code)).toEqual(['FRONTEND_HOST_RUNTIME_UNSATISFIED'])
    const desktop = (await app.inject({method: 'GET', url: `/v1/registry/modules/${productId}?platform=desktop`})).json().data.registryTrust.compatibility
    expect(desktop.reasons.map((reason: {code: string}) => reason.code)).toEqual(['PLATFORM_UNSUPPORTED'])
    const invalid = await app.inject({method: 'GET', url: `/v1/registry/modules/${productId}?hostVersion=latest`})
    expect(invalid.statusCode).toBe(400)
  })

  it('distinguishes the latest stable release from the newest published prerelease', async () => {
    const channelProductId = `digital.modula.channels-${suffix}`
    const service = new GreenfieldModuleReleaseService(db)
    for (const [version, channel] of [['1.2.0', 'stable'], ['1.8.0', 'beta']] as const) {
      const manifest = adapterManifest(channelProductId, version)
      const pending = await service.importPendingReview(manifest, evidenceFor(manifest))
      await db.updateTable('greenfield_module_releases')
        .set({release_channel: channel})
        .where('release_id', '=', pending.releaseId)
        .execute()
      const release = await service.publishRelease(channelProductId, version)
      const product = fixtureProduct(channelProductId, version, mps => { mps.release.channel = channel })
      await new GreenfieldMpsIngestService(db).ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: release.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.assets})
    }

    const response = await app.inject({method: 'GET', url: `/v1/registry/modules/${channelProductId}`})
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json().data).toMatchObject({
      latestVersion: '1.2.0',
      latestStableVersion: '1.2.0',
      releaseChannel: 'stable',
      newestPublishedVersion: '1.8.0',
      newestPublishedChannel: 'beta',
    })
  })

  it('exposes an unsigned published release as untrusted and refuses install preview', async () => {
    const catalogue = await app.inject({method: 'GET', url: `/v1/registry/modules?q=${encodeURIComponent(productId)}`})
    expect(catalogue.statusCode, catalogue.body).toBe(200)
    const item = catalogue.json().data.items.find((candidate: {moduleId: string}) => candidate.moduleId === productId)
    expect(item).toMatchObject({moduleId: productId, status: 'published', installable: false})
    const detail = await app.inject({method: 'GET', url: `/v1/registry/modules/${productId}`})
    expect(detail.json().data.registryTrust).toMatchObject({verified: false, signature: {state: 'unsigned'}})

    const preview = await app.inject({
      method: 'POST', url: `/v1/modules/${productId}/install-preview`,
      headers: {authorization: `Bearer ${token}`}, payload: {version: '0.1.0', platform: 'ios'},
    })
    expect(preview.statusCode, preview.body).toBe(403)
    expect(preview.json().error).toMatchObject({code: 'UNTRUSTED_RELEASE'})
  })

  it('refuses runtime access to an already-enabled unsigned release', async () => {
    const release = await db.selectFrom('greenfield_module_releases')
      .select(['release_id', 'extension_version_id'])
      .where('release_id', '=', releases['0.1.0']!.releaseId)
      .executeTakeFirstOrThrow()
    const installationId = randomUUID()
    await db.insertInto('greenfield_extension_installations').values({
      installation_id: installationId,
      extension_version_id: release.extension_version_id!,
      account_id: accountId,
      status: 'enabled',
      config: {},
      created_at: new Date(),
      updated_at: new Date(),
    }).execute()
    await db.insertInto('greenfield_module_permission_reviews').values({
      review_id: randomUUID(),
      installation_id: installationId,
      release_id: release.release_id,
      account_id: accountId,
      granted_permissions: [],
      denied_permissions: [],
      high_risk_increase: false,
      idempotency_key: `runtime-review-${suffix}`,
      reviewed_at: new Date(),
    }).execute()

    await expect(new GreenfieldModuleRuntimeAccessService(db, loadConfig()).resolve(accountId, productId, {requireEnabled: true}))
      .rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})
  })

  it('reports update availability and revocation per immutable release', async () => {
    await publish('0.2.0')
    const older = (await app.inject({method: 'GET', url: `/v1/registry/modules/${productId}/versions/0.1.0`})).json().data
    expect(older.registryTrust.update).toEqual({latestPublishedVersion: '0.2.0', updateAvailable: true})
    expect(older.registryTrust.registryReleaseId).toBe(releases['0.1.0']!.releaseId)
    await new GreenfieldModuleReleaseService(db).revokeRelease(releases['0.1.0']!.releaseId, 'test revocation')
    const revoked = (await app.inject({method: 'GET', url: `/v1/registry/modules/${productId}/versions/0.1.0`})).json().data.registryTrust
    expect(revoked).toMatchObject({verified: false, releaseState: 'revoked', revocation: {revoked: true, scope: 'release', reason: 'test revocation'}})
    expect(revoked.warnings.map((warning: {code: string}) => warning.code)).toContain('RELEASE_REVOKED')
    const latest = (await app.inject({method: 'GET', url: `/v1/registry/modules/${productId}`})).json().data.registryTrust
    expect(latest).toMatchObject({version: '0.2.0', verified: false, signature: {state: 'unsigned'}, revocation: {revoked: false}})
  })
})
