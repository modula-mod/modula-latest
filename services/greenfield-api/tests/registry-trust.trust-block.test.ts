import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, fixtureProduct, sha256} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)

describeIfDb('registry trust pipeline: verified trust block', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
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
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    await publish('0.1.0')
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
      verified: true,
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
    expect(latest).toMatchObject({version: '0.2.0', verified: true, revocation: {revoked: false}})
  })
})
