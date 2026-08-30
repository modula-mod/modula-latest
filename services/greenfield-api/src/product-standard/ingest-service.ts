import {createHash} from 'node:crypto'
import {sql} from 'kysely'
import {
  ingestProductManifest,
  projectGreenfieldProduct,
  validateMpsFrontendArtifact,
  type MpsFrontendArtifact,
} from '@modula/greenfield-product-standard'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from '../modules/module-errors.js'
import {
  projectMpsRecordCollections,
  type MpsRecordCollectionProjection,
  type MpsSchemaArtifact,
} from './record-projection.js'

export class GreenfieldMpsIngestService {
  constructor(private readonly db: ModulaDb) {}

  async ingest(input: {
    filename: string
    bytes: string | Buffer
    releaseId?: string | null
    frontend?: {path: string; bytes: string | Buffer} | null
    schemas?: MpsSchemaArtifact[]
  }) {
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
    let frontendArtifact: MpsFrontendArtifact | null = null
    if (product.frontendArtifact) {
      if (!input.frontend || input.frontend.path !== product.frontendArtifact.path) {
        throw moduleError('VALIDATION_FAILED', `Verified frontend artifact ${product.frontendArtifact.path} is required`)
      }
      const validated = validateMpsFrontendArtifact({
        bytes: input.frontend.bytes,
        metadata: product.frontendArtifact,
        productId: product.productId,
        version: product.version,
        mode: product.frontendMode as 'declarative' | 'host-contribution',
      })
      if (!validated.ok || !validated.artifact) {
        throw moduleError('VALIDATION_FAILED', validated.diagnostics.map(item => `${item.code}: ${item.message}`).join('; ') || 'Invalid MPS frontend artifact')
      }
      frontendArtifact = validated.artifact
    } else if (input.frontend) {
      throw moduleError('VALIDATION_FAILED', 'frontend.mode none cannot ingest a frontend artifact')
    }
    const recordCollections = input.releaseId
      ? projectMpsRecordCollections({
          manifest: product.raw,
          frontend: frontendArtifact as Record<string, unknown> | null,
          schemas: input.schemas ?? [],
        })
      : []
    const existing = await this.db.selectFrom('greenfield_mps_ingestions')
      .select(['ingestion_id', 'release_id', 'manifest_sha256'])
      .where('product_id', '=', product.productId)
      .where('version', '=', product.version)
      .executeTakeFirst()
    if (existing) {
      const storedFrontend = await this.db.selectFrom('greenfield_release_frontends')
        .select(['artifact_sha256', 'release_id'])
        .where('ingestion_id', '=', existing.ingestion_id)
        .executeTakeFirst()
      if (existing.manifest_sha256 !== manifestSha256
        || (product.frontendArtifact?.sha256 ?? null) !== (storedFrontend?.artifact_sha256 ?? null)) {
        throw moduleError('CONFLICT', `Product release ${product.productId}@${product.version} is immutable`)
      }
      if (input.releaseId && existing.release_id && existing.release_id !== input.releaseId) {
        throw moduleError('CONFLICT', `Product release ${product.productId}@${product.version} is already bound to another registry release`)
      }
      if (input.releaseId) {
        await this.db.transaction().execute(async trx => {
          if (!existing.release_id) {
            await trx.updateTable('greenfield_mps_ingestions').set({release_id: input.releaseId!}).where('ingestion_id', '=', existing.ingestion_id).execute()
            if (storedFrontend) await trx.updateTable('greenfield_release_frontends').set({release_id: input.releaseId!}).where('ingestion_id', '=', existing.ingestion_id).execute()
            await trx.updateTable('greenfield_release_presentation_assets').set({release_id: input.releaseId!}).where('ingestion_id', '=', existing.ingestion_id).execute()
          }
          await projectRecordCollections(trx, input.releaseId!, product.productId, recordCollections)
        })
      }
      return this.get(product.productId, product.version)
    }
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
      const relationships = [...product.relationships]
      if (product.familyId && !relationships.some(rel => rel.type === 'belongsToFamily' && rel.productId === product.familyId)) {
        relationships.push({type: 'belongsToFamily', productId: product.familyId})
      }
      if (relationships.length > 0) {
        await trx.insertInto('greenfield_product_relationships').values(relationships.map(rel => ({
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
        .execute()

      const stored = await trx.selectFrom('greenfield_mps_ingestions')
        .select('ingestion_id')
        .where('product_id', '=', product.productId)
        .where('version', '=', product.version)
        .executeTakeFirstOrThrow()

      if (product.frontendArtifact && frontendArtifact) {
        await trx.insertInto('greenfield_release_frontends').values({
          frontend_id: uuidv7(),
          ingestion_id: stored.ingestion_id,
          release_id: input.releaseId ?? null,
          product_id: product.productId,
          version: product.version,
          frontend_mode: product.frontendMode as 'declarative' | 'host-contribution',
          artifact_role: 'product.frontend',
          artifact_path: product.frontendArtifact.path,
          media_type: product.frontendArtifact.mediaType,
          artifact_sha256: product.frontendArtifact.sha256,
          schema_version: product.frontendArtifact.schemaVersion as '1.0.0',
          mps_version: frontendArtifact.mpsVersion,
          entry_view: frontendArtifact.entry ?? null,
          route_count: frontendArtifact.routes?.length ?? 0,
          routes: sql`${JSON.stringify(frontendArtifact.routes ?? [])}::jsonb`,
          compatibility: sql`${JSON.stringify(frontendArtifact.hostRuntime)}::jsonb`,
          required_capabilities: sql`${JSON.stringify(frontendArtifact.capabilities?.required ?? [])}::jsonb`,
          runtime_projection: sql`${JSON.stringify(frontendArtifact)}::jsonb`,
          verified_at: now,
          created_at: now,
        }).execute()
      }

      if (input.releaseId) {
        await projectRecordCollections(trx, input.releaseId, product.productId, recordCollections)
      }

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

      const privacy = product.privacy
      if (privacy) {
        await trx.insertInto('greenfield_product_privacy_declarations')
          .values({
            ingestion_id: stored.ingestion_id,
            product_id: product.productId,
            version: product.version,
            data_accessed: sql`${JSON.stringify(privacy.dataAccessed ?? [])}::jsonb`,
            data_created: sql`${JSON.stringify(privacy.dataCreated ?? [])}::jsonb`,
            data_transmitted: sql`${JSON.stringify(privacy.dataTransmitted ?? [])}::jsonb`,
            processors: sql`${JSON.stringify(privacy.externalProcessors ?? [])}::jsonb`,
            retention: typeof privacy.retention === 'string' ? privacy.retention : null,
            export_policy: typeof privacy.export === 'string' ? privacy.export : null,
            deletion_policy: typeof privacy.deletion === 'string' ? privacy.deletion : null,
            telemetry: typeof privacy.telemetry === 'string' ? privacy.telemetry : null,
            declaration: sql`${JSON.stringify(privacy)}::jsonb`,
            created_at: now,
          })
          .onConflict(oc => oc.column('ingestion_id').doUpdateSet({
            data_accessed: sql`${JSON.stringify(privacy.dataAccessed ?? [])}::jsonb`,
            data_created: sql`${JSON.stringify(privacy.dataCreated ?? [])}::jsonb`,
            data_transmitted: sql`${JSON.stringify(privacy.dataTransmitted ?? [])}::jsonb`,
            processors: sql`${JSON.stringify(privacy.externalProcessors ?? [])}::jsonb`,
            retention: typeof privacy.retention === 'string' ? privacy.retention : null,
            export_policy: typeof privacy.export === 'string' ? privacy.export : null,
            deletion_policy: typeof privacy.deletion === 'string' ? privacy.deletion : null,
            telemetry: typeof privacy.telemetry === 'string' ? privacy.telemetry : null,
            declaration: sql`${JSON.stringify(privacy)}::jsonb`,
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
    const frontend = await this.db.selectFrom('greenfield_release_frontends')
      .select(['frontend_mode', 'artifact_path', 'media_type', 'artifact_sha256', 'schema_version', 'mps_version', 'entry_view', 'route_count', 'compatibility', 'required_capabilities', 'verified_at'])
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
      frontend: frontend ? {
        mode: frontend.frontend_mode,
        artifact: {
          path: frontend.artifact_path,
          mediaType: frontend.media_type,
          sha256: frontend.artifact_sha256,
          schemaVersion: frontend.schema_version,
        },
        mpsVersion: frontend.mps_version,
        entryView: frontend.entry_view,
        routeCount: frontend.route_count,
        compatibility: frontend.compatibility,
        requiredCapabilities: frontend.required_capabilities,
        verifiedAt: frontend.verified_at.toISOString(),
      } : null,
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

async function projectRecordCollections(
  db: any,
  releaseId: string,
  productId: string,
  collections: MpsRecordCollectionProjection[],
) {
  for (const collection of collections) {
    const values = {
      collection_id: `mps-collection:${releaseId}:${collection.collection}`,
      release_id: releaseId,
      module_id: productId,
      collection: collection.collection,
      schema_ref: collection.schemaRef,
      default_visibility: collection.defaultVisibility,
      fields: sql`${JSON.stringify(collection.fields)}::jsonb`,
      searchable_fields: sql`${JSON.stringify(collection.searchableFields)}::jsonb`,
      filterable_fields: sql`${JSON.stringify(collection.filterableFields)}::jsonb`,
      sortable_fields: sql`${JSON.stringify(collection.sortableFields)}::jsonb`,
      folder_field: null,
      reference_fields: sql`${JSON.stringify(collection.referenceFields)}::jsonb`,
      schema_definition: sql`${JSON.stringify(collection.schemaDefinition)}::jsonb`,
      retention_policy: collection.retentionPolicy,
      registration_status: 'registered',
      created_at: new Date(),
      updated_at: new Date(),
    }
    await db.insertInto('greenfield_module_record_collections')
      .values(values)
      .onConflict((conflict: any) => conflict.column('collection_id').doUpdateSet({
        schema_ref: values.schema_ref,
        default_visibility: values.default_visibility,
        fields: values.fields,
        searchable_fields: values.searchable_fields,
        filterable_fields: values.filterable_fields,
        sortable_fields: values.sortable_fields,
        reference_fields: values.reference_fields,
        schema_definition: values.schema_definition,
        retention_policy: values.retention_policy,
        registration_status: values.registration_status,
        updated_at: values.updated_at,
      }))
      .execute()
  }
}
