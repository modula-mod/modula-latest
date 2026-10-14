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

describeIfDb('registry trust pipeline: immutable release media', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  const productId = `digital.modula.media-${suffix}`
  let releaseId = ''

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!)
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    const product = fixtureProduct(productId, '0.1.0', mps => {
      mps.presentation.screenshots = [{
        role: 'product.screenshot', path: 'assets/cover/default.png', mediaType: 'image/png', width: 1280, height: 720,
        sha256: '371918b2de29331c5f08584525469c4ed0d03a6a500b042db37593b41ec47f3b', alt: 'Reference screenshot', developmentAsset: true,
      }]
    })
    const releases = new GreenfieldModuleReleaseService(db)
    const manifest = adapterManifest(productId, '0.1.0')
    await releases.importPendingReview(manifest, evidenceFor(manifest))
    releaseId = (await releases.publishRelease(productId, '0.1.0')).releaseId
    await new GreenfieldMpsIngestService(db).ingest({
      filename: 'modula.product.json', bytes: product.mpsBytes, releaseId,
      frontend: product.frontend, schemas: product.schemas, assets: product.assets,
    })
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('projects icon, cover and screenshots with registry URLs, digests, dimensions and development flags', async () => {
    const response = await app.inject({method: 'GET', url: `/v1/registry/modules/${productId}`})
    expect(response.statusCode, response.body).toBe(200)
    const data = response.json().data
    expect(data.registryReleaseId).toBe(releaseId)
    const presentation = data.presentation
    expect(presentation.icon).toMatchObject({
      role: 'product.icon', slot: 'icon', mediaType: 'image/svg+xml',
      sha256: '9534b516b144c7e8e22a1a6ab181ade6b39fe527587d17863f18d051000ad120', developmentAsset: true, available: true,
    })
    expect(presentation.icon.url).toMatch(/^https:\/\/api\.test\.modula\.digital\/v1\/registry\/releases\//)
    expect(presentation.cover).toMatchObject({role: 'product.cover', width: 1280, height: 720, mediaType: 'image/png', available: true})
    expect(presentation.screenshots).toHaveLength(1)
    expect(presentation.screenshots[0]).toMatchObject({alt: 'Reference screenshot', width: 1280, height: 720})
    expect(presentation.alternates.map((asset: {mediaType: string}) => asset.mediaType)).toEqual(['image/png'])
    expect(presentation.developmentAssets).toBe(true)
    expect(JSON.stringify(data.presentation)).not.toContain('github')
  })

  it('includes the presentation summary on registry product listings', async () => {
    const response = await app.inject({method: 'GET', url: `/v1/registry/products?q=media-${suffix}`})
    expect(response.statusCode, response.body).toBe(200)
    const item = response.json().data.items.find((entry: {moduleId: string}) => entry.moduleId === productId)
    expect(item.registryReleaseId).toBe(releaseId)
    expect(item.presentation.icon.sha256).toBe('9534b516b144c7e8e22a1a6ab181ade6b39fe527587d17863f18d051000ad120')
    expect(item.presentation.screenshots).toHaveLength(1)
    expect(item.presentation.version).toBe('0.1.0')
    expect(item.presentation.icon.url).toMatch(/^https:\/\/api\.test\.modula\.digital\/v1\/registry\/releases\//)
    expect(item.presentation.cover.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(item.presentation.screenshots[0].url).toMatch(/\/assets\//)
    expect(item.trustSummary).toMatchObject({
      registryReleaseId: releaseId, version: '0.1.0', releaseState: 'published',
      signatureState: 'unsigned', revoked: false, quarantined: false,
    })
    expect(item.trustSummary.warnings).toContain('RELEASE_UNSIGNED')
    expect(item.trustSummary).not.toHaveProperty('provenance')
  })

  it('serves the exact verified bytes with immutable caching headers', async () => {
    const detail = (await app.inject({method: 'GET', url: `/v1/registry/modules/${productId}/versions/0.1.0`})).json().data
    expect(detail.presentation.cover.sha256).toBe('371918b2de29331c5f08584525469c4ed0d03a6a500b042db37593b41ec47f3b')
    const path = new URL(detail.presentation.cover.url).pathname
    const asset = await app.inject({method: 'GET', url: path})
    expect(asset.statusCode).toBe(200)
    expect(asset.headers['content-type']).toBe('image/png')
    expect(asset.headers['cache-control']).toContain('immutable')
    expect(asset.headers['x-content-type-options']).toBe('nosniff')
    expect(sha256(asset.rawPayload)).toBe(detail.presentation.cover.sha256)
    const notModified = await app.inject({method: 'GET', url: path, headers: {'if-none-match': asset.headers.etag as string}})
    expect(notModified.statusCode).toBe(304)
    const weakNotModified = await app.inject({method: 'GET', url: path, headers: {'if-none-match': `W/${asset.headers.etag as string}`}})
    expect(weakNotModified.statusCode).toBe(304)
    const svg = await app.inject({method: 'GET', url: new URL(detail.presentation.icon.url).pathname})
    expect(svg.headers['content-security-policy']).toContain('sandbox')
  })

  it('returns 404 for unknown assets and for assets of non-published releases', async () => {
    const unknown = await app.inject({method: 'GET', url: `/v1/registry/releases/${encodeURIComponent(releaseId)}/assets/missing`})
    expect(unknown.statusCode).toBe(404)
    const draftId = `digital.modula.media-draft-${suffix}`
    const product = fixtureProduct(draftId)
    const releases = new GreenfieldModuleReleaseService(db)
    const manifest = adapterManifest(draftId, '0.1.0')
    const draft = await releases.importPendingReview(manifest, evidenceFor(manifest))
    await new GreenfieldMpsIngestService(db).ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: draft.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.assets})
    const assetId = (await db.selectFrom('greenfield_release_presentation_assets').select('asset_id').where('release_id', '=', draft.releaseId).executeTakeFirstOrThrow()).asset_id
    const hidden = await app.inject({method: 'GET', url: `/v1/registry/releases/${encodeURIComponent(draft.releaseId)}/assets/${assetId}`})
    expect(hidden.statusCode).toBe(404)
  })

  it('rejects asset bytes that do not match the declared digest, media type or dimensions, and undeclared paths', async () => {
    const ingest = new GreenfieldMpsIngestService(db)
    const tamperedId = `digital.modula.media-tampered-${suffix}`
    const tampered = fixtureProduct(tamperedId)
    const swapped = tampered.assets.map(asset => asset.path.endsWith('.svg') ? {...asset, bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')} : asset)
    await expect(ingest.ingest({filename: 'modula.product.json', bytes: tampered.mpsBytes, frontend: tampered.frontend, assets: swapped}))
      .rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    await expect(ingest.ingest({filename: 'modula.product.json', bytes: tampered.mpsBytes, frontend: tampered.frontend, assets: [{path: 'assets/extra.png', bytes: Buffer.from('x')}]}))
      .rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    const wrongSize = fixtureProduct(`digital.modula.media-size-${suffix}`, '0.1.0', mps => {
      mps.presentation.cover.width = 999
    })
    await expect(ingest.ingest({filename: 'modula.product.json', bytes: wrongSize.mpsBytes, frontend: wrongSize.frontend, assets: wrongSize.assets}))
      .rejects.toMatchObject({code: 'VALIDATION_FAILED'})
  })

  it('keeps blobs content-addressed and immutable', async () => {
    const row = await db.selectFrom('greenfield_release_asset_blobs').select(['sha256', 'byte_size']).where('sha256', '=', '371918b2de29331c5f08584525469c4ed0d03a6a500b042db37593b41ec47f3b').executeTakeFirstOrThrow()
    expect(row.byte_size).toBe(3767)
    await expect(db.updateTable('greenfield_release_asset_blobs').set({media_type: 'image/jpeg'}).where('sha256', '=', row.sha256).execute()).rejects.toThrow(/immutable|permission denied/)
  })
})
