import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'
import {descriptorDigest} from '../src/modules/install-descriptor-service.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, fixtureProduct, registerAccount, sha256} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)

describeIfDb('registry trust pipeline: immutable install descriptor', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let token = ''
  const productId = `digital.modula.install-${suffix}`
  const facts: Record<string, {releaseId: string; artifactSha: string; frontendSha: string; mpsSha: string; manifestSha: string}> = {}

  async function publish(id: string, version: string) {
    const product = fixtureProduct(id, version)
    const releases = new GreenfieldModuleReleaseService(db)
    const manifest = adapterManifest(id, version)
    const evidence = evidenceFor(manifest)
    await releases.importPendingReview(manifest, evidence)
    const release = await releases.publishRelease(id, version)
    await new GreenfieldMpsIngestService(db).ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: release.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.assets})
    facts[`${id}@${version}`] = {releaseId: release.releaseId, artifactSha: evidence.artifactSha256, frontendSha: sha256(product.frontend.bytes), mpsSha: sha256(product.mpsBytes), manifestSha: manifest.integrity.manifestSha256}
  }

  function install(id: string, payload: Record<string, unknown>, key: string) {
    return app.inject({method: 'POST', url: `/v1/modules/${id}/install`, headers: {authorization: `Bearer ${token}`, 'idempotency-key': key}, payload})
  }

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!)
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    await publish(productId, '0.1.0')
    await publish(productId, '0.2.0')
    token = (await registerAccount(app, `install-${suffix}@example.com`, `inst${suffix}`)).token
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('returns an install descriptor pinned to the exact requested release', async () => {
    const response = await install(productId, {version: '0.1.0', approvedPermissions: [], hostVersion: '1.3.0'}, `install-${suffix}-a`)
    expect(response.statusCode, response.body).toBe(202)
    const {descriptor, installationId} = response.json().data
    const expected = facts[`${productId}@0.1.0`]!
    expect(descriptor).toMatchObject({
      descriptorVersion: '1.0.0',
      moduleId: productId,
      version: '0.1.0',
      registryReleaseId: expected.releaseId,
      releaseState: 'published',
      publisherId: 'modula',
      installationId,
      artifact: {sha256: expected.artifactSha, mediaType: 'application/gzip', ref: null, source: {provider: 'github', repository: 'modula-mod/registry-trust-fixtures'}},
      manifest: {productManifestSha256: expected.mpsSha, adapterManifestSha256: expected.manifestSha},
      frontend: {mode: 'declarative', sha256: expected.frontendSha, mediaType: 'application/vnd.modula.frontend+json', entryView: 'home'},
      trust: {verified: true, publisherVerified: true, signatureState: 'unsigned', revoked: false, quarantined: false},
      compatibility: {evaluated: true, hostVersion: '1.3.0', compatible: true},
    })
    expect(descriptor.frontend.ref).toBe(`https://api.test.modula.digital/v1/modules/${productId}/frontend`)
    expect(descriptor.trust.warnings).toContain('RELEASE_UNSIGNED')
    const {descriptorSha256, issuedAt, ...body} = descriptor
    expect(typeof issuedAt).toBe('string')
    expect(descriptorDigest(body)).toBe(descriptorSha256)
    const plan = await db.selectFrom('greenfield_module_install_plans').select(['install_descriptor_sha256', 'release_id']).where('installation_id', '=', installationId).executeTakeFirstOrThrow()
    expect(plan).toEqual({install_descriptor_sha256: descriptorSha256, release_id: expected.releaseId})
  })

  it('replays the same descriptor for the same idempotency key and from the descriptor endpoint', async () => {
    const first = (await install(productId, {version: '0.1.0'}, `install-${suffix}-a`)).json().data.descriptor
    const lookup = await app.inject({method: 'GET', url: `/v1/modules/${productId}/install-descriptor`, headers: {authorization: `Bearer ${token}`}})
    expect(lookup.statusCode, lookup.body).toBe(200)
    expect(lookup.json().data.descriptorSha256).toBe(first.descriptorSha256)
    expect(lookup.json().data.version).toBe('0.1.0')
  })

  it('refuses to silently swap versions for an installed module', async () => {
    const response = await install(productId, {version: '0.2.0'}, `install-${suffix}-b`)
    expect(response.statusCode, response.body).toBe(409)
  })

  it('rejects installs for an incompatible host version and malformed host versions', async () => {
    const other = `digital.modula.install-host-${suffix}`
    await publish(other, '0.1.0')
    const incompatible = await install(other, {version: '0.1.0', hostVersion: '0.5.0'}, `install-${suffix}-c`)
    expect(incompatible.statusCode, incompatible.body).toBe(400)
    expect(incompatible.body).toContain('HOST_RANGE_UNSATISFIED')
    const malformed = await install(other, {version: '0.1.0', hostVersion: 'not-a-version'}, `install-${suffix}-d`)
    expect(malformed.statusCode).toBe(400)
    const missing = await app.inject({method: 'GET', url: `/v1/modules/${other}/install-descriptor`, headers: {authorization: `Bearer ${token}`}})
    expect(missing.statusCode).toBe(404)
  })
})
