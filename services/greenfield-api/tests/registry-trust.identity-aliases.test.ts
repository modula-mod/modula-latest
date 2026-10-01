import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {
  CANONICAL_VAULT_NOTES_MODULE_ID,
  LEGACY_VAULT_NOTES_MODULE_IDS,
  moduleIdFamily,
  registerModuleIdentityAliases,
  resolveCanonicalModuleId,
  rewriteLegacyVaultNotesId,
  rewriteModuleIdentityAliases,
} from '@modula/greenfield-contracts'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {classifyBetaModule} from '../src/modules/beta-catalogue-policy.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, fixtureProduct} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)

describe('generic product identity aliases', () => {
  it('keeps the published Vault Notes identity and aliases resolving exactly as before', () => {
    for (const alias of LEGACY_VAULT_NOTES_MODULE_IDS) expect(resolveCanonicalModuleId(alias)).toBe(CANONICAL_VAULT_NOTES_MODULE_ID)
    expect(resolveCanonicalModuleId(CANONICAL_VAULT_NOTES_MODULE_ID)).toBe(CANONICAL_VAULT_NOTES_MODULE_ID)
    expect(moduleIdFamily('modula.vault-notes')).toEqual([CANONICAL_VAULT_NOTES_MODULE_ID, ...LEGACY_VAULT_NOTES_MODULE_IDS])
    expect(moduleIdFamily('digital.modula.tasks')).toEqual(['digital.modula.tasks'])
  })

  it('rewrites embedded aliases generically without double-prefixing canonical ids', () => {
    for (const value of [
      'digital.modula.vault-notes',
      'modula.vault-notes.views.home',
      'records:module.modula.vault-notes.note:read',
      'modula.module.vaultNotes.notes.read',
      'module-vault-notes',
      'records:module.digital.modula.vault-notes.note:read',
      'unrelated.permission',
    ]) {
      expect(rewriteModuleIdentityAliases(value)).toBe(rewriteLegacyVaultNotesId(value))
    }
  })

  it('never re-points an alias, and refuses chains', () => {
    const canonical = `digital.modula.alias-unit-${suffix}`
    expect(registerModuleIdentityAliases([{alias: `old.unit-${suffix}`, canonicalId: canonical}]).registered).toBe(1)
    expect(registerModuleIdentityAliases([{alias: `old.unit-${suffix}`, canonicalId: 'digital.someone.else'}]).rejected[0]?.reason).toMatch(/already resolves/)
    expect(registerModuleIdentityAliases([{alias: 'modula.vault-notes', canonicalId: canonical}]).rejected).toHaveLength(1)
    expect(registerModuleIdentityAliases([{alias: `chain-${suffix}`, canonicalId: `old.unit-${suffix}`}]).rejected[0]?.reason).toMatch(/itself an alias/)
    expect(registerModuleIdentityAliases([{alias: canonical, canonicalId: `x.${suffix}`}]).rejected[0]?.reason).toMatch(/canonical product id/)
    expect(rewriteModuleIdentityAliases(`old.unit-${suffix}.records:read`)).toBe(`${canonical}.records:read`)
  })

  it('classifies identity aliases and historical replacements as duplicates', () => {
    expect(classifyBetaModule({moduleId: 'modula.vault-notes', status: 'published'})).toMatchObject({classification: 'DUPLICATE', canonicalModuleId: CANONICAL_VAULT_NOTES_MODULE_ID})
    expect(classifyBetaModule({moduleId: 'modula.module.tasks', status: 'published'})).toMatchObject({classification: 'DUPLICATE', canonicalModuleId: 'digital.modula.tasks'})
  })
})

describeIfDb('registry trust pipeline: aliases come from modula.product.json, not product-specific code', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  const productId = `digital.modula.alias-${suffix}`
  const alias = `legacy.alias-${suffix}`

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!)
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    const releases = new GreenfieldModuleReleaseService(db)
    const manifest = adapterManifest(productId, '1.0.0')
    await releases.importPendingReview(manifest, evidenceFor(manifest))
    const release = await releases.publishRelease(productId, '1.0.0')
    const product = fixtureProduct(productId, '1.0.0', mps => { mps.identity.aliases = [alias] })
    await new GreenfieldMpsIngestService(db).ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: release.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.assets})
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('resolves a declared alias to the canonical product through the registry', async () => {
    expect(resolveCanonicalModuleId(alias)).toBe(productId)
    const response = await app.inject({method: 'GET', url: `/v1/registry/modules/${alias}`})
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json().data.moduleId).toBe(productId)
  })

  it('refuses to import a release under an alias instead of rewriting it', async () => {
    const manifest = adapterManifest(alias, '2.0.0')
    await expect(new GreenfieldModuleReleaseService(db).importPendingReview(manifest, evidenceFor(manifest))).rejects.toMatchObject({code: 'CONFLICT'})
    await expect(new GreenfieldModuleReleaseService(db).importPendingReview(adapterManifest('modula.vault-notes', '9.9.9'), evidenceFor(adapterManifest('modula.vault-notes', '9.9.9')))).rejects.toMatchObject({code: 'CONFLICT'})
  })

  it('refuses another product claiming an existing alias', async () => {
    const other = `digital.modula.alias-thief-${suffix}`
    const releases = new GreenfieldModuleReleaseService(db)
    const manifest = adapterManifest(other, '1.0.0')
    await releases.importPendingReview(manifest, evidenceFor(manifest))
    const release = await releases.publishRelease(other, '1.0.0')
    const product = fixtureProduct(other, '1.0.0', mps => { mps.identity.aliases = [alias] })
    await expect(new GreenfieldMpsIngestService(db).ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: release.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.assets}))
      .rejects.toMatchObject({code: 'CONFLICT'})
    const row = await db.selectFrom('greenfield_product_identity_aliases').select('canonical_product_id').where('alias_id', '=', alias).executeTakeFirstOrThrow()
    expect(row.canonical_product_id).toBe(productId)
  })
})
