import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../../fixtures/mps')

describeIfDb('Greenfield × MPS 1.0-RC ingestion', () => {
  let db: ModulaDb
  let service: GreenfieldMpsIngestService

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    service = new GreenfieldMpsIngestService(db)
  })

  afterAll(async () => db?.destroy())

  it('ingests a reference module generically with family and release-bound assets', async () => {
    const bytes = readFileSync(join(fixtures, 'reference-module/modula.product.json'), 'utf8')
    const ingested = await service.ingest({filename: 'modula.product.json', bytes})
    expect(ingested?.productId).toBe('digital.modula.reference-notes')
    expect(ingested?.kind).toBe('module')
    expect(ingested?.backendMode).toBe('greenfield-records')
    expect(ingested?.familyId).toBe('digital.modula.reference-vault')
    expect(ingested?.assets.some(asset => asset.role === 'product.icon')).toBe(true)
    expect(ingested?.fakeBackendBound).toBe(false)
  })

  it('ingests a backend-free plugin without fake storage or services', async () => {
    const bytes = readFileSync(join(fixtures, 'reference-plugin/modula.product.json'), 'utf8')
    const ingested = await service.ingest({filename: 'modula.product.json', bytes})
    expect(ingested?.backendMode).toBe('none')
    expect(ingested?.storageMode).toBeNull()
    expect(ingested?.greenfieldBackendMode).toBe('frontend-only')
    const services = await db.selectFrom('greenfield_mps_ingestions')
      .select(['backend_mode', 'storage_mode'])
      .where('product_id', '=', 'digital.modula.reference-plugin')
      .executeTakeFirstOrThrow()
    expect(services.backend_mode).toBe('none')
    expect(services.storage_mode).toBeNull()
  })

  it('lets two notes providers coexist from metadata rather than names', async () => {
    const notes = readFileSync(join(fixtures, 'reference-module/modula.product.json'), 'utf8')
    const alt = readFileSync(join(fixtures, 'reference-notes-alt/modula.product.json'), 'utf8')
    await service.ingest({filename: 'modula.product.json', bytes: notes})
    await service.ingest({filename: 'modula.product.json', bytes: alt})
    const providers = await db.selectFrom('greenfield_mps_ingestions')
      .select(['product_id', 'projection'])
      .where('registry_kind', '=', 'module')
      .execute()
    const roles = providers.flatMap(row => {
      const projection = row.projection as {capabilities?: {providerRoles?: string[]}}
      return projection.capabilities?.providerRoles ?? []
    })
    expect(roles.filter(role => role === 'notes.provider').length).toBeGreaterThanOrEqual(2)
  })

  it('resolves legacy identity aliases without product-name branches', async () => {
    expect(await service.resolveCanonicalProductId('modula.vault-notes')).toBe('digital.modula.vault-notes')
    expect(await service.resolveCanonicalProductId(`example.${randomUUID().slice(0, 8)}.other`)).toMatch(/^example\./)
  })

  it('rejects public test fixtures and secret values', async () => {
    await expect(service.ingest({
      filename: 'modula.product.json',
      bytes: JSON.stringify({identity: {id: 'test.bad.secret', kind: 'plugin', version: '1.0.0'}, apiKey: 'sk-live'}),
    })).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
  })
})
