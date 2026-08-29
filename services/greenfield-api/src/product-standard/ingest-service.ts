import {createHash} from 'node:crypto'
import {sql} from 'kysely'
import {ingestProductManifest, projectGreenfieldProduct} from '@modula/greenfield-product-standard'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from '../modules/module-errors.js'

export class GreenfieldMpsIngestService {
  constructor(private readonly db: ModulaDb) {}

  async ingest(input: {filename: string; bytes: string | Buffer; releaseId?: string | null}) {
    const result = ingestProductManifest({filename: input.filename, bytes: input.bytes})
    if (!result.ok || !result.product) {
      throw moduleError('VALIDATION_FAILED', result.diagnostics.map(item => `${item.code}: ${item.message}`).join('; ') || 'Invalid MPS manifest')
    }
    const product = result.product
    if (product.visibility === 'public' && product.testFixture) {
      throw moduleError('FORBIDDEN', 'Test fixtures cannot be public')
    }
    const projection = projectGreenfieldProduct(product)
    const manifestSha256 = createHash('sha256')
      .update(typeof input.bytes === 'string' ? input.bytes : input.bytes)
      .digest('hex')
    const ingestionId = uuidv7()
    const now = new Date()

    await this.db.transaction().execute(async trx => {
      if (product.familyId) {
        await trx.insertInto('greenfield_product_families')
          .values({family_id: product.familyId, display_name: product.familyId, created_at: now, updated_at: now})
          .onConflict(oc => oc.column('family_id').doUpdateSet({updated_at: now}))
          .execute()
        await trx.insertInto('greenfield_product_family_members')
          .values({
            family_id: product.familyId,
            product_id: product.productId,
            member_role: product.familyRole ?? 'member',
            created_at: now,
          })
          .onConflict(oc => oc.columns(['family_id', 'product_id']).doUpdateSet({member_role: product.familyRole ?? 'member'}))
          .execute()
      }

      for (const alias of product.aliases) {
        await trx.insertInto('greenfield_product_identity_aliases')
          .values({alias_id: alias, canonical_product_id: product.productId, reason: 'mps identity.aliases', created_at: now})
          .onConflict(oc => oc.column('alias_id').doUpdateSet({canonical_product_id: product.productId, reason: 'mps identity.aliases'}))
          .execute()
      }

      await trx.deleteFrom('greenfield_product_relationships').where('product_id', '=', product.productId).execute()
      if (product.relationships.length > 0) {
        await trx.insertInto('greenfield_product_relationships').values(product.relationships.map(rel => ({
          relationship_id: uuidv7(),
          product_id: product.productId,
          relationship_type: rel.type as any,
          target_product_id: rel.productId,
          version_range: rel.versionRange ?? null,
          created_at: now,
        }))).execute()
      }

      await trx.insertInto('greenfield_mps_ingestions')
        .values({
          ingestion_id: ingestionId,
          product_id: product.productId,
          version: product.version,
          release_id: input.releaseId ?? null,
          manifest_sha256: manifestSha256,
          product_standard: String(product.raw.productStandard ?? '1.0-RC'),
          manifest_format: product.format,
          registry_kind: product.kind as any,
          frontend_mode: product.frontendMode,
          backend_mode: product.backendMode,
          storage_mode: projection.storageMode,
          greenfield_backend_mode: product.greenfieldBackendMode,
          test_fixture: product.testFixture,
          visibility: product.visibility,
          manifest: sql`${JSON.stringify(product.raw)}::jsonb`,
          projection: sql`${JSON.stringify(projection)}::jsonb`,
          ingested_at: now,
        })
        .onConflict(oc => oc.columns(['product_id', 'version']).doUpdateSet({
          release_id: input.releaseId ?? null,
          manifest_sha256: manifestSha256,
          manifest_format: product.format,
          registry_kind: product.kind as any,
          frontend_mode: product.frontendMode,
          backend_mode: product.backendMode,
          storage_mode: projection.storageMode,
          greenfield_backend_mode: product.greenfieldBackendMode,
          test_fixture: product.testFixture,
          visibility: product.visibility,
          manifest: sql`${JSON.stringify(product.raw)}::jsonb`,
          projection: sql`${JSON.stringify(projection)}::jsonb`,
          ingested_at: now,
        }))
        .execute()

      const stored = await trx.selectFrom('greenfield_mps_ingestions')
        .select('ingestion_id')
        .where('product_id', '=', product.productId)
        .where('version', '=', product.version)
        .executeTakeFirstOrThrow()

      await trx.deleteFrom('greenfield_release_presentation_assets').where('ingestion_id', '=', stored.ingestion_id).execute()
      if (product.presentationAssets.length > 0) {
        await trx.insertInto('greenfield_release_presentation_assets').values(product.presentationAssets.map(asset => ({
          asset_id: uuidv7(),
          ingestion_id: stored.ingestion_id,
          release_id: input.releaseId ?? null,
          product_id: product.productId,
          version: product.version,
          role: asset.role,
          artifact_path: asset.path,
          media_type: asset.mediaType,
          width: asset.width ?? null,
          height: asset.height ?? null,
          sha256: asset.sha256 ?? null,
          development_asset: asset.developmentAsset === true,
          created_at: now,
        }))).execute()
      }

      if (product.privacy) {
        await trx.insertInto('greenfield_product_privacy_declarations')
          .values({
            ingestion_id: stored.ingestion_id,
            product_id: product.productId,
            version: product.version,
            data_accessed: sql`${JSON.stringify(product.privacy.dataAccessed ?? [])}::jsonb`,
            data_created: sql`${JSON.stringify(product.privacy.dataCreated ?? [])}::jsonb`,
            data_transmitted: sql`${JSON.stringify(product.privacy.dataTransmitted ?? [])}::jsonb`,
            processors: sql`${JSON.stringify(product.privacy.externalProcessors ?? [])}::jsonb`,
            retention: typeof product.privacy.retention === 'string' ? product.privacy.retention : null,
            export_policy: typeof product.privacy.export === 'string' ? product.privacy.export : null,
            deletion_policy: typeof product.privacy.deletion === 'string' ? product.privacy.deletion : null,
            telemetry: typeof product.privacy.telemetry === 'string' ? product.privacy.telemetry : null,
            declaration: sql`${JSON.stringify(product.privacy)}::jsonb`,
            created_at: now,
          })
          .onConflict(oc => oc.column('ingestion_id').doUpdateSet({
            data_accessed: sql`${JSON.stringify(product.privacy.dataAccessed ?? [])}::jsonb`,
            data_created: sql`${JSON.stringify(product.privacy.dataCreated ?? [])}::jsonb`,
            data_transmitted: sql`${JSON.stringify(product.privacy.dataTransmitted ?? [])}::jsonb`,
            processors: sql`${JSON.stringify(product.privacy.externalProcessors ?? [])}::jsonb`,
            retention: typeof product.privacy.retention === 'string' ? product.privacy.retention : null,
            export_policy: typeof product.privacy.export === 'string' ? product.privacy.export : null,
            deletion_policy: typeof product.privacy.deletion === 'string' ? product.privacy.deletion : null,
            telemetry: typeof product.privacy.telemetry === 'string' ? product.privacy.telemetry : null,
            declaration: sql`${JSON.stringify(product.privacy)}::jsonb`,
          }))
          .execute()
      }
    })

    return this.get(product.productId, product.version)
  }

  async getLatest(productId: string) {
    const canonical = await this.resolveCanonicalProductId(productId)
    const row = await this.db.selectFrom('greenfield_mps_ingestions')
      .select(['product_id', 'version'])
      .where('product_id', '=', canonical)
      .orderBy('ingested_at', 'desc')
      .executeTakeFirst()
    if (!row) return null
    return this.get(row.product_id, row.version)
  }

  async get(productId: string, version: string) {
    const row = await this.db.selectFrom('greenfield_mps_ingestions')
      .selectAll()
      .where('product_id', '=', productId)
      .where('version', '=', version)
      .executeTakeFirst()
    if (!row) return null
    const assets = await this.db.selectFrom('greenfield_release_presentation_assets')
      .selectAll()
      .where('ingestion_id', '=', row.ingestion_id)
      .execute()
    const family = await this.db.selectFrom('greenfield_product_family_members')
      .selectAll()
      .where('product_id', '=', productId)
      .executeTakeFirst()
    const privacy = await this.db.selectFrom('greenfield_product_privacy_declarations')
      .selectAll()
      .where('ingestion_id', '=', row.ingestion_id)
      .executeTakeFirst()
    return {
      ingestionId: row.ingestion_id,
      productId: row.product_id,
      version: row.version,
      kind: row.registry_kind,
      frontendMode: row.frontend_mode,
      backendMode: row.backend_mode,
      storageMode: row.storage_mode,
      greenfieldBackendMode: row.greenfield_backend_mode,
      testFixture: row.test_fixture,
      visibility: row.visibility,
      familyId: family?.family_id ?? null,
      familyRole: family?.member_role ?? null,
      assets: assets.map(asset => ({
        role: asset.role,
        path: asset.artifact_path,
        mediaType: asset.media_type,
        sha256: asset.sha256,
        developmentAsset: asset.development_asset,
      })),
      privacy: privacy?.declaration ?? null,
      projection: row.projection,
      fakeBackendBound: row.backend_mode !== 'none' && row.greenfield_backend_mode === 'frontend-only' ? true : false,
    }
  }

  async resolveCanonicalProductId(productId: string) {
    const alias = await this.db.selectFrom('greenfield_product_identity_aliases')
      .select('canonical_product_id')
      .where('alias_id', '=', productId)
      .executeTakeFirst()
    return alias?.canonical_product_id ?? productId
  }
}
