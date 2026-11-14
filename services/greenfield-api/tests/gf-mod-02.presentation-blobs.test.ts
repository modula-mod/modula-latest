/**
 * GF-MOD-02 acceptance (G004): presentation metadata is never ingested or
 * published without its bytes, existing releases keep their read path, and
 * the missing-blob count is exposed on the internal admin report.
 *
 * Isolated fixtures only: product ids are test.modula.gf-mod-02-*.
 */
import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {presentationAssetsMissingBlobs} from '../src/modules/presentation-blob-gaps.js'
import {GreenfieldRegistryPresentationService} from '../src/modules/registry-presentation-service.js'
import {GreenfieldMpsIngestService, assertPresentationAssetBlobsAvailable} from '../src/product-standard/ingest-service.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, fixtureProduct, registerAccount, sha256} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)
const UNIQUE_PATH = 'assets/gf-mod-02/icon.svg'

/** The reference fixture with its icon replaced by an SVG whose bytes no other suite stores. */
function uniqueIconProduct(id: string, opts: {iconBytes?: Buffer; withoutDigest?: boolean} = {}) {
  const base = fixtureProduct(id, '1.0.0')
  const iconBytes = opts.iconBytes ?? Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><!-- gf-mod-02 ${id} --><rect width="8" height="8"/></svg>\n`)
  const mps = JSON.parse(base.mpsBytes)
  const previousIcon = mps.presentation.icon.path as string
  mps.presentation.icon = {role: 'product.icon', path: UNIQUE_PATH, mediaType: 'image/svg+xml', ...(opts.withoutDigest ? {} : {sha256: sha256(iconBytes)}), developmentAsset: true}
  const others = base.assets.filter(asset => asset.path !== previousIcon)
  return {
    ...base,
    mpsBytes: `${JSON.stringify(mps, null, 2)}\n`,
    iconBytes,
    iconSha256: sha256(iconBytes),
    withIcon: [...others, {path: UNIQUE_PATH, bytes: iconBytes}],
    withoutIcon: others,
  }
}

describe('GF-MOD-02 presentation blob gate (no database round trip needed)', () => {
  it('passes without querying when every declared asset has supplied bytes', async () => {
    await expect(assertPresentationAssetBlobsAvailable(null, [{path: 'a.svg', sha256: 'a'.repeat(64)}], [{path: 'a.svg', sha256: 'a'.repeat(64)}])).resolves.toBeUndefined()
  })
  it('rejects a declaration with neither bytes nor digest before querying', async () => {
    await expect(assertPresentationAssetBlobsAvailable(null, [{path: 'a.svg'}], [])).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
  })
})

describeIfDb('GF-MOD-02 presentation bytes required at ingestion and publication', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let ingest: GreenfieldMpsIngestService
  let releases: GreenfieldModuleReleaseService
  let adminToken = ''
  let userToken = ''
  let n = 0
  const nextId = () => `test.modula.gf-mod-02-${suffix}-${++n}`
  const adminHandle = `gfmod02a${suffix}`.slice(0, 20)
  const ingestionRows = (productId: string) => db.selectFrom('greenfield_mps_ingestions').select('ingestion_id').where('product_id', '=', productId).execute()
  const presentationRows = (productId: string) => db.selectFrom('greenfield_release_presentation_assets').select('asset_id').where('product_id', '=', productId).execute()

  /** Historic G004 shape: a metadata row whose digest has no stored blob. */
  async function insertGhostAsset(releaseId: string, productId: string) {
    const template = await db.selectFrom('greenfield_release_presentation_assets').selectAll().where('release_id', '=', releaseId).executeTakeFirstOrThrow()
    const ghost = {assetId: `gf-mod-02-ghost-${suffix}-${++n}`, sha256: sha256(`gf-mod-02-ghost-${suffix}-${n}`)}
    await db.insertInto('greenfield_release_presentation_assets').values({
      ...template, asset_id: ghost.assetId, product_id: productId, artifact_path: `assets/ghost-${n}.png`, sha256: ghost.sha256, sort_order: 999,
    } as any).execute()
    return ghost
  }

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4092')
    process.env.MODULA_ADMIN_HANDLES = adminHandle
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    ingest = new GreenfieldMpsIngestService(db)
    releases = new GreenfieldModuleReleaseService(db)
    adminToken = (await registerAccount(app, `gf-mod-02-admin-${suffix}@example.com`, adminHandle, db)).token
    userToken = (await registerAccount(app, `gf-mod-02-user-${suffix}@example.com`, `gfmod02u${suffix}`.slice(0, 20), db)).token
  })

  afterAll(async () => {
    delete process.env.MODULA_ADMIN_HANDLES
    await app?.close()
    await db?.destroy()
  })

  it('rejects metadata whose bytes are neither supplied nor stored, leaving no ingestion rows', async () => {
    const id = nextId()
    const product = uniqueIconProduct(id)
    await expect(ingest.ingest({filename: 'modula.product.json', bytes: product.mpsBytes, frontend: product.frontend, schemas: product.schemas, assets: product.withoutIcon}))
      .rejects.toMatchObject({code: 'VALIDATION_FAILED', message: expect.stringContaining(`Presentation asset bytes are required: ${UNIQUE_PATH}`)})
    expect(await ingestionRows(id)).toHaveLength(0)
    expect(await presentationRows(id)).toHaveLength(0)
    expect(await db.selectFrom('greenfield_release_asset_blobs').select('sha256').where('sha256', '=', product.iconSha256).execute()).toHaveLength(0)
  })

  it('rejects a declared asset without a digest when no bytes are supplied', async () => {
    const id = nextId()
    const product = uniqueIconProduct(id, {withoutDigest: true})
    await expect(ingest.ingest({filename: 'modula.product.json', bytes: product.mpsBytes, frontend: product.frontend, schemas: product.schemas, assets: product.withoutIcon}))
      .rejects.toMatchObject({code: 'VALIDATION_FAILED', message: expect.stringContaining('no declared SHA-256')})
    expect(await ingestionRows(id)).toHaveLength(0)
  })

  it('rejects through the admin ingest route, which carries no asset bytes, and stays rejected on replay', async () => {
    const id = nextId()
    const product = uniqueIconProduct(id)
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await app.inject({method: 'POST', url: '/v1/admin/product-standard/ingest', headers: {authorization: `Bearer ${adminToken}`},
        payload: {filename: 'modula.product.json', bytes: product.mpsBytes, frontend: {path: product.frontend.path, bytes: product.frontend.bytes.toString('utf8')},
          schemas: product.schemas.map(schema => ({path: schema.path, bytes: schema.bytes.toString('utf8')}))}})
      expect(response.statusCode, response.body).toBe(400)
      expect(response.json().error.code).toBe('VALIDATION_FAILED')
    }
    expect(await ingestionRows(id)).toHaveLength(0)
  })

  it('rejects every concurrent ingest of the same blobless metadata and writes nothing', async () => {
    const id = nextId()
    const product = uniqueIconProduct(id)
    const results = await Promise.allSettled(Array.from({length: 5}, () => ingest.ingest({filename: 'modula.product.json', bytes: product.mpsBytes, frontend: product.frontend, schemas: product.schemas, assets: product.withoutIcon})))
    expect(results.every(result => result.status === 'rejected' && (result.reason as any).code === 'VALIDATION_FAILED')).toBe(true)
    expect(await ingestionRows(id)).toHaveLength(0)
  })

  it('accepts supplied bytes, and a later product may reference the same stored blob by digest', async () => {
    const first = nextId()
    const product = uniqueIconProduct(first)
    const ingested = await ingest.ingest({filename: 'modula.product.json', bytes: product.mpsBytes, frontend: product.frontend, schemas: product.schemas, assets: product.withIcon})
    expect(ingested?.assets.find(asset => asset.path === UNIQUE_PATH)).toMatchObject({sha256: product.iconSha256})
    // Identical replay of an accepted release without re-supplying bytes is fine: they are stored.
    await expect(ingest.ingest({filename: 'modula.product.json', bytes: product.mpsBytes, frontend: product.frontend, schemas: product.schemas, assets: product.withoutIcon})).resolves.toBeTruthy()
    const second = nextId()
    const reuse = uniqueIconProduct(second, {iconBytes: product.iconBytes})
    await expect(ingest.ingest({filename: 'modula.product.json', bytes: reuse.mpsBytes, frontend: reuse.frontend, schemas: reuse.schemas, assets: reuse.withoutIcon})).resolves.toBeTruthy()
    for (const productId of [first, second]) {
      expect((await presentationAssetsMissingBlobs(db)).filter(gap => gap.productId === productId)).toHaveLength(0)
    }
  })

  it('refuses to publish a release whose bound presentation metadata lacks bytes', async () => {
    const id = nextId()
    const product = uniqueIconProduct(id)
    const manifest = adapterManifest(id, '1.0.0')
    const imported = await releases.importPendingReview(manifest, evidenceFor(manifest))
    await ingest.ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: imported.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.withIcon})
    const ghost = await insertGhostAsset(imported.releaseId, id)
    await expect(releases.publishRelease(id, '1.0.0')).rejects.toMatchObject({code: 'VALIDATION_FAILED', message: expect.stringContaining('presentation assets without stored bytes')})
    expect((await releases.getRelease(id, '1.0.0'))!.releaseState).not.toBe('published')
    expect(ghost.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('leaves existing releases unaffected: read path unchanged, internal admin count exposes the gap', async () => {
    const id = nextId()
    const product = uniqueIconProduct(id)
    const manifest = adapterManifest(id, '1.0.0')
    const imported = await releases.importPendingReview(manifest, evidenceFor(manifest))
    const published = await releases.publishRelease(id, '1.0.0')
    await ingest.ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: published.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.withIcon})
    // Simulates a historic release ingested before this gate existed.
    const ghost = await insertGhostAsset(imported.releaseId, id)

    // Registry presentation projection (the catalogue read path) still tolerates the gap.
    const projection = await new GreenfieldRegistryPresentationService(db, 'https://api.test.modula.digital').forRelease(published.releaseId)
    expect(projection).not.toBeNull()
    expect(JSON.stringify(projection)).toContain(ghost.sha256)
    const asset = await app.inject({method: 'GET', url: `/v1/registry/releases/${published.releaseId}/assets/${ghost.assetId}`})
    expect(asset.statusCode, asset.body).toBe(404)
    expect(asset.json().error.code).toBe('NOT_FOUND')
    const icon = await db.selectFrom('greenfield_release_presentation_assets').select('asset_id').where('release_id', '=', published.releaseId).where('artifact_path', '=', UNIQUE_PATH).executeTakeFirstOrThrow()
    const served = await app.inject({method: 'GET', url: `/v1/registry/releases/${published.releaseId}/assets/${icon.asset_id}`})
    expect(served.statusCode, served.body).toBe(200)
    expect(sha256(served.rawPayload)).toBe(product.iconSha256)

    const report = await app.inject({method: 'GET', url: '/v1/admin/registry/artifacts/orphans', headers: {authorization: `Bearer ${adminToken}`}})
    expect(report.statusCode, report.body).toBe(200)
    const missing = report.json().data.missingPresentationBlobs
    expect(missing.count).toBeGreaterThanOrEqual(1)
    expect(missing.releases).toBeGreaterThanOrEqual(1)
    expect(missing.assets).toEqual(expect.arrayContaining([expect.objectContaining({assetId: ghost.assetId, releaseId: published.releaseId, productId: id, sha256: ghost.sha256})]))
    expect(report.json().data.mode).toBe('DRY_RUN')
    const forbidden = await app.inject({method: 'GET', url: '/v1/admin/registry/artifacts/orphans', headers: {authorization: `Bearer ${userToken}`}})
    expect(forbidden.statusCode).toBe(403)
    expect(id).not.toContain('vault-notes')
  })
})
