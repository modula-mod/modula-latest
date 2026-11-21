import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleRegistryService} from '../src/modules/registry-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)
const incompleteId = `digital.modula.listing-incomplete-${suffix}`
const completeId = `digital.modula.listing-complete-${suffix}`

describeIfDb('GET /v1/registry/products tolerates a release with no manifest.compatibility', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4157')
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()

    const complete = adapterManifest(completeId, '1.0.0')
    const releases = new GreenfieldModuleReleaseService(db)
    await releases.importPendingReview(complete, evidenceFor(complete))
    await releases.publishRelease(completeId, '1.0.0')

    const now = new Date()
    const publisherId = `publisher:listing-incomplete-${suffix}`
    const extensionId = `extension:${incompleteId}`
    const extensionVersionId = `${incompleteId}@1.0.0`
    const moduleVersionId = `module-version:${incompleteId}:1.0.0`
    const releaseId = `release:${incompleteId}:1.0.0`
    // Intentionally incomplete: published, visible in the catalogue, no compatibility field.
    const manifest = {
      moduleId: incompleteId,
      name: 'listing-incomplete',
      description: 'Published fixture with no manifest.compatibility',
      version: '1.0.0',
      permissions: [],
      contributions: {},
    }
    await db.insertInto('greenfield_publishers').values({
      publisher_id: publisherId, display_name: 'Listing Compatibility Fixture', website: null, status: 'verified',
      trust_level: 'firstParty', created_at: now, updated_at: now, verified_at: now, suspended_at: null, revoked_at: null,
    }).execute()
    await db.insertInto('greenfield_extensions').values({
      extension_id: extensionId, slug: incompleteId, publisher_account_id: null, status: 'published', created_at: now, updated_at: now,
    }).execute()
    await db.insertInto('greenfield_extension_versions').values({
      extension_version_id: extensionVersionId, extension_id: extensionId, version: '1.0.0', manifest, status: 'published', created_at: now,
    }).execute()
    await db.insertInto('greenfield_module_versions').values({
      module_version_id: moduleVersionId, extension_version_id: extensionVersionId, module_id: incompleteId,
      version: '1.0.0', publisher_id: publisherId, manifest, status: 'published', created_at: now, updated_at: now,
    }).execute()
    await db.insertInto('greenfield_module_releases').values({
      release_id: releaseId, module_version_id: moduleVersionId, extension_id: extensionId, extension_version_id: extensionVersionId,
      module_id: incompleteId, version: '1.0.0', publisher_id: publisherId, release_state: 'published',
      source_repository: 'modula-mod/listing-compat-fixture', source_commit: 'a'.repeat(40),
      manifest_path: 'manifest.json', manifest_sha256: 'b'.repeat(64), release_sha256: 'c'.repeat(64),
      signature_key_id: 'test-key', signature: 'test-signature', compatibility: {}, license_status: 'firstParty',
      trust_level: 'firstParty', product_kind: 'module', extension_product: {}, published_at: now,
      quarantined_at: null, revoked_at: null, superseded_at: null, created_at: now, updated_at: now,
    }).execute()
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('returns 200, skips the incomplete release, and still lists the other product', async () => {
    const warn = vi.fn()
    const items = (await new GreenfieldModuleRegistryService(db, {log: {warn}}).listModules({productKind: 'all', limit: 100})).items
    const ids = items.map(item => item.moduleId)
    expect(ids).toContain(completeId)
    expect(ids).not.toContain(incompleteId)
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: incompleteId,
        releaseId: `release:${incompleteId}:1.0.0`,
        version: '1.0.0',
        reason: 'missing_manifest_compatibility',
      }),
      'skipping registry listing entry with no manifest.compatibility',
    )
    const payload = JSON.stringify(warn.mock.calls)
    expect(payload).not.toMatch(/password|secret|token|authorization/i)

    const response = await app.inject({method: 'GET', url: '/v1/registry/products?productKind=all&limit=100'})
    expect(response.statusCode, response.body).toBe(200)
    const listed = (response.json().data.items as Array<{moduleId: string}>).map(item => item.moduleId)
    expect(listed).toContain(completeId)
    expect(listed).not.toContain(incompleteId)
  })
})
