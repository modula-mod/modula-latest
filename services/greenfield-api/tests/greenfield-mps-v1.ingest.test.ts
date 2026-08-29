import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import pg from 'pg'
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

  it('ingests service, connector, engine, and game through the same generic path', async () => {
    const kinds = [
      ['reference-service', 'digital.modula.reference-service', 'service'],
      ['reference-connector', 'digital.modula.reference-connector', 'connector'],
      ['reference-engine', 'digital.modula.reference-engine', 'engine'],
      ['reference-game', 'digital.modula.reference-game', 'game'],
    ] as const
    for (const [name, productId, kind] of kinds) {
      const bytes = readFileSync(join(fixtures, name, 'modula.product.json'), 'utf8')
      const ingested = await service.ingest({filename: 'modula.product.json', bytes})
      expect(ingested?.productId, name).toBe(productId)
      expect(ingested?.kind, name).toBe(kind)
      expect(ingested?.fakeBackendBound, name).toBe(false)
    }
  })

  it('grants runtime DML and backup SELECT on every 054 object', async () => {
    const tables = [
      'greenfield_product_families',
      'greenfield_product_family_members',
      'greenfield_product_relationships',
      'greenfield_product_identity_aliases',
      'greenfield_mps_ingestions',
      'greenfield_release_presentation_assets',
      'greenfield_product_privacy_declarations',
    ]
    for (const table of tables) {
      for (const role of ['modula_api', 'modula_worker']) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          const result = await sql<{allowed: boolean}>`
            SELECT has_table_privilege(${role}, ${`public.${table}`}, ${privilege}) AS allowed
          `.execute(db)
          expect(result.rows[0]?.allowed, `${role} ${privilege} on ${table}`).toBe(true)
        }
      }
      const backup = await sql<{allowed: boolean; writable: boolean}>`
        SELECT
          has_table_privilege('modula_backup', ${`public.${table}`}, 'SELECT') AS allowed,
          has_table_privilege('modula_backup', ${`public.${table}`}, 'INSERT,UPDATE,DELETE') AS writable
      `.execute(db)
      expect(backup.rows[0]?.allowed, `modula_backup SELECT on ${table}`).toBe(true)
      expect(backup.rows[0]?.writable, `modula_backup DML on ${table}`).toBe(false)
    }
  })

  it('lets the API runtime role ingest and read family, relationship, asset, privacy, and alias rows', async () => {
    const bytes = readFileSync(join(fixtures, 'reference-module/modula.product.json'), 'utf8')
    await service.ingest({filename: 'modula.product.json', bytes})
    const client = new pg.Client({connectionString: databaseUrl})
    await client.connect()
    try {
      await client.query('SET ROLE modula_api')
      const family = await client.query(
        `INSERT INTO greenfield_product_families (family_id, display_name)
         VALUES ('digital.modula.runtime-acl-family', 'Runtime ACL Family')
         ON CONFLICT (family_id) DO UPDATE SET updated_at = NOW()
         RETURNING family_id`,
      )
      const member = await client.query(
        `INSERT INTO greenfield_product_family_members (family_id, product_id, member_role)
         VALUES ('digital.modula.runtime-acl-family', 'digital.modula.reference-notes', 'root')
         ON CONFLICT (family_id, product_id) DO UPDATE SET member_role = EXCLUDED.member_role
         RETURNING product_id`,
      )
      const relationship = await client.query(
        `INSERT INTO greenfield_product_relationships (
           relationship_id, product_id, relationship_type, target_product_id
         ) VALUES (
           'rel:runtime-acl',
           'digital.modula.reference-notes',
           'belongsToFamily',
           'digital.modula.reference-vault'
         )
         ON CONFLICT (relationship_id) DO UPDATE SET target_product_id = EXCLUDED.target_product_id
         RETURNING relationship_type`,
      )
      const relationships = await client.query(
        `SELECT count(*)::int AS c FROM greenfield_product_relationships WHERE product_id = 'digital.modula.reference-notes'`,
      )
      const assets = await client.query(
        `SELECT count(*)::int AS c FROM greenfield_release_presentation_assets WHERE product_id = 'digital.modula.reference-notes'`,
      )
      const privacy = await client.query(
        `SELECT count(*)::int AS c FROM greenfield_product_privacy_declarations WHERE product_id = 'digital.modula.reference-notes'`,
      )
      const alias = await client.query(
        `SELECT canonical_product_id FROM greenfield_product_identity_aliases WHERE alias_id = 'modula.vault-notes'`,
      )
      expect(family.rows[0]?.family_id).toBe('digital.modula.runtime-acl-family')
      expect(member.rows[0]?.product_id).toBe('digital.modula.reference-notes')
      expect(relationship.rows[0]?.relationship_type).toBe('belongsToFamily')
      expect(Number(relationships.rows[0]?.c)).toBeGreaterThan(0)
      expect(Number(assets.rows[0]?.c)).toBeGreaterThan(0)
      expect(Number(privacy.rows[0]?.c)).toBeGreaterThan(0)
      expect(alias.rows[0]?.canonical_product_id).toBe('digital.modula.vault-notes')
    } finally {
      await client.query('RESET ROLE').catch(() => undefined)
      await client.end()
    }
  })
})
