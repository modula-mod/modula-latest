import {createHash} from 'node:crypto'
import {sql} from 'kysely'
import {
  ingestProductManifest,
  projectGreenfieldProduct,
  validateMpsFrontendArtifact,
  type MpsFrontendArtifact,
} from '@modula/greenfield-product-standard'
import {registerModuleIdentityAliases, resolveCanonicalModuleId} from '@modula/greenfield-contracts'
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
    /** Verified bytes of declared presentation assets (paths relative to the product root). */
    assets?: Array<{path: string; bytes: Buffer}>
    packageArtifact?: {path: string; bytes: Buffer; sha256: string; mediaType: string; sharing: 'public-immutable' | 'account-private'} | null
    /** True only when every supplied byte was extracted from the verified release package. */
    distributionVerified?: boolean
  }) {
    const result = ingestProductManifest({filename: input.filename, bytes: input.bytes})
    if (!result.ok || !result.product) {
      throw moduleError('VALIDATION_FAILED', result.diagnostics.map(item => `${item.code}: ${item.message}`).join('; ') || 'Invalid MPS manifest')
    }
    const product = result.product
    const packageMeta = (product.raw as Record<string, any>).distribution as Record<string, any> | undefined
    if (packageMeta) {
      const artifact = input.packageArtifact
      if (input.distributionVerified !== true || !artifact || artifact.path !== packageMeta.artifact?.path ||
          artifact.sha256 !== packageMeta.artifact?.sha256 || artifact.mediaType !== packageMeta.artifact?.mediaType ||
          artifact.sharing !== packageMeta.sharing || artifact.bytes.length !== packageMeta.artifact?.compressedSizeBytes ||
          createHash('sha256').update(artifact.bytes).digest('hex') !== artifact.sha256) {
        throw moduleError('VALIDATION_FAILED', 'Optional package bytes must match a verified signed release artifact')
      }
    } else if (input.packageArtifact) {
      throw moduleError('VALIDATION_FAILED', 'Undeclared optional package artifact')
    }
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
    const assetBytes = verifyPresentationAssetBytes(product.presentationAssets, input.assets ?? [])
    const frontendBytes = input.frontend
      ? Buffer.isBuffer(input.frontend.bytes) ? input.frontend.bytes : Buffer.from(input.frontend.bytes)
      : null
    if (input.releaseId) await assertSignedDigestsMatch(this.db, input.releaseId, manifestSha256, product.frontendArtifact?.sha256 ?? null)
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
      if (assetBytes.length) await storeAssetBlobs(this.db, assetBytes)
      if (input.releaseId && input.distributionVerified === true) {
        await storeDistributionArtifacts(this.db, {
          releaseId: input.releaseId,
          productId: product.productId,
          version: product.version,
          frontend: product.frontendArtifact && frontendBytes ? {
            path: product.frontendArtifact.path,
            sha256: product.frontendArtifact.sha256,
            mediaType: product.frontendArtifact.mediaType,
            bytes: frontendBytes,
          } : null,
          schemas: input.schemas ?? [],
          assets: assetBytes.map(asset => ({...asset, role: product.presentationAssets.find(item => item.path === asset.path)?.role ?? 'product.background'})),
          packageArtifact: input.packageArtifact ?? null,
        })
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
        await assertAliasClaimable(trx, alias, product.productId, product.publisherId)
        await trx.insertInto('greenfield_product_identity_aliases')
          .values({alias_id: alias, canonical_product_id: product.productId, reason: 'mps identity.aliases', created_at: now})
          .onConflict(oc => oc.column('alias_id').doNothing())
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
          sha256: asset.sha256 ?? assetBytes.find(item => item.path === asset.path)?.sha256 ?? null,
          development_asset: asset.developmentAsset === true,
          alt_text: asset.alt ?? null,
          presentation_slot: asset.slot,
          sort_order: asset.sortOrder,
          created_at: now,
        }))).execute()
      }
      if (assetBytes.length) await storeAssetBlobs(trx, assetBytes)
      if (input.releaseId && input.distributionVerified === true) {
        await storeDistributionArtifacts(trx, {
          releaseId: input.releaseId,
          productId: product.productId,
          version: product.version,
          frontend: product.frontendArtifact && frontendBytes ? {
            path: product.frontendArtifact.path,
            sha256: product.frontendArtifact.sha256,
            mediaType: product.frontendArtifact.mediaType,
            bytes: frontendBytes,
          } : null,
          schemas: input.schemas ?? [],
          assets: assetBytes.map(asset => ({...asset, role: product.presentationAssets.find(item => item.path === asset.path)?.role ?? 'product.background'})),
          packageArtifact: input.packageArtifact ?? null,
        })
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

    if (product.aliases.length) registerModuleIdentityAliases(product.aliases.map(alias => ({alias, canonicalId: product.productId})))
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
        width: asset.width,
        height: asset.height,
        alt: asset.alt_text,
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

const ASSET_MEDIA_TYPES = new Set(['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg', 'video/mp4', 'video/webm'])
const MAX_ASSET_BYTES = 25 * 1024 * 1024

type VerifiedAssetBytes = {path: string; sha256: string; mediaType: string; bytes: Buffer}

/**
 * Bind supplied bytes to the presentation assets the verified manifest declares.
 * Declared SHA-256 digests and PNG dimensions must match the bytes exactly; any
 * undeclared path is rejected so a package cannot smuggle extra media.
 */
export function verifyPresentationAssetBytes(
  declared: Array<{path: string; mediaType: string; sha256?: string; width?: number; height?: number}>,
  supplied: Array<{path: string; bytes: Buffer}>,
): VerifiedAssetBytes[] {
  const verified: VerifiedAssetBytes[] = []
  for (const item of supplied) {
    const matches = declared.filter(asset => asset.path === item.path)
    if (!matches.length) throw moduleError('VALIDATION_FAILED', `Presentation asset ${item.path} is not declared by the product manifest`)
    if (!isSafeRelativePath(item.path)) throw moduleError('VALIDATION_FAILED', `Presentation asset path ${item.path} is unsafe`)
    const bytes = Buffer.isBuffer(item.bytes) ? item.bytes : Buffer.from(item.bytes)
    if (bytes.length === 0 || bytes.length > MAX_ASSET_BYTES) throw moduleError('VALIDATION_FAILED', `Presentation asset ${item.path} has an invalid size`)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    for (const asset of matches) {
      if (!ASSET_MEDIA_TYPES.has(asset.mediaType)) throw moduleError('VALIDATION_FAILED', `Presentation asset ${item.path} has unsupported media type ${asset.mediaType}`)
      if (asset.sha256 && asset.sha256 !== sha256) throw moduleError('VALIDATION_FAILED', `Presentation asset ${item.path} does not match its declared SHA-256`)
      if (!mediaMatches(asset.mediaType, bytes)) throw moduleError('VALIDATION_FAILED', `Presentation asset ${item.path} bytes are not ${asset.mediaType}`)
      const png = asset.mediaType === 'image/png' ? pngDimensions(bytes) : null
      if (png && ((asset.width && asset.width !== png.width) || (asset.height && asset.height !== png.height))) {
        throw moduleError('VALIDATION_FAILED', `Presentation asset ${item.path} dimensions do not match the declaration`)
      }
    }
    verified.push({path: item.path, sha256, mediaType: matches[0]!.mediaType, bytes})
  }
  return verified
}

async function storeAssetBlobs(db: any, assets: VerifiedAssetBytes[]) {
  for (const asset of assets) {
    await db.insertInto('greenfield_release_asset_blobs')
      .values({sha256: asset.sha256, media_type: asset.mediaType, byte_size: asset.bytes.length, bytes: asset.bytes, created_at: new Date()})
      .onConflict((oc: any) => oc.column('sha256').doNothing())
      .execute()
  }
}

async function storeDistributionArtifacts(db: any, input: {
  releaseId: string
  productId: string
  version: string
  frontend: {path: string; sha256: string; mediaType: string; bytes: Buffer} | null
  schemas: MpsSchemaArtifact[]
  assets: Array<VerifiedAssetBytes & {role: string}>
  packageArtifact: {path: string; bytes: Buffer; sha256: string; mediaType: string; sharing: 'public-immutable' | 'account-private'} | null
}) {
  const now = new Date()
  const artifacts: Array<{
    artifactId: string
    kind: 'frontend' | 'schema' | 'asset' | 'icon' | 'cover' | 'screenshot'
    sha256: string
    filename: string
    mediaType: string
    bytes: Buffer
    access: 'public' | 'installation'
    required: boolean
  }> = []
  if (input.frontend) {
    artifacts.push({
      artifactId: `release:${input.releaseId}:frontend`,
      kind: 'frontend',
      sha256: input.frontend.sha256,
      filename: safeFilename(input.frontend.path, 'frontend.json'),
      mediaType: input.frontend.mediaType,
      bytes: input.frontend.bytes,
      access: 'installation',
      required: true,
    })
  }
  for (const schema of input.schemas) {
    const bytes = Buffer.isBuffer(schema.bytes) ? schema.bytes : Buffer.from(schema.bytes)
    const digest = createHash('sha256').update(bytes).digest('hex')
    artifacts.push({
      artifactId: `release:${input.releaseId}:schema:${digest}`,
      kind: 'schema',
      sha256: digest,
      filename: safeFilename(schema.path, 'schema.json'),
      mediaType: 'application/schema+json',
      bytes,
      access: 'installation',
      required: true,
    })
  }
  for (const asset of input.assets) {
    const kind = asset.role === 'product.icon'
      ? 'icon'
      : asset.role === 'product.cover' || asset.role === 'product.hero'
        ? 'cover'
        : asset.role === 'product.screenshot'
          ? 'screenshot'
          : 'asset'
    artifacts.push({
      artifactId: `release:${input.releaseId}:${kind}:${asset.sha256}`,
      kind,
      sha256: asset.sha256,
      filename: safeFilename(asset.path, `${kind}-${asset.sha256.slice(0, 12)}`),
      mediaType: asset.mediaType,
      bytes: asset.bytes,
      access: 'public',
      required: false,
    })
  }
  if (input.packageArtifact) {
    artifacts.push({
      artifactId: `release:${input.releaseId}:optional-package`, kind: 'asset',
      sha256: input.packageArtifact.sha256,
      // The signed web-game compatibility artifact already uses game.tgz for
      // this digest. Give the optional-package record its own immutable name
      // so both access contracts can coexist under the release tuple key.
      filename: input.packageArtifact.path === 'game/game.tgz'
        ? 'game-content.tgz' : safeFilename(input.packageArtifact.path, 'optional-package'),
      mediaType: input.packageArtifact.mediaType, bytes: input.packageArtifact.bytes,
      access: input.packageArtifact.sharing === 'public-immutable' ? 'public' : 'installation',
      required: true,
    })
  }
  for (const artifact of artifacts) {
    await db.insertInto('greenfield_release_asset_blobs').values({
      sha256: artifact.sha256,
      media_type: artifact.mediaType,
      byte_size: artifact.bytes.length,
      bytes: artifact.bytes,
      created_at: now,
    }).onConflict((oc: any) => oc.column('sha256').doNothing()).execute()
    await db.insertInto('greenfield_release_artifacts').values({
      artifact_id: artifact.artifactId,
      release_id: input.releaseId,
      kind: artifact.kind,
      sha256: artifact.sha256,
      filename: artifact.filename,
      access_class: artifact.access,
      required_for_offline_launch: artifact.required,
      created_at: now,
    }).onConflict((oc: any) => oc.column('artifact_id').doNothing()).execute()
  }
}

function safeFilename(path: string, fallback: string): string {
  const value = path.replace(/^.*[/\\]/, '').replace(/[^A-Za-z0-9._-]/g, '-')
  return value && value !== '.' && value !== '..' ? value : fallback
}

function isSafeRelativePath(path: string) {
  return Boolean(path) && !path.startsWith('/') && !path.includes('\\') && !path.split('/').some(part => part === '..' || part === '')
}

function mediaMatches(mediaType: string, bytes: Buffer) {
  switch (mediaType) {
    case 'image/png': return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    case 'image/jpeg': return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    case 'image/webp': return bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP'
    case 'image/svg+xml': return /<svg[\s>]/i.test(bytes.subarray(0, 4096).toString('utf8'))
    case 'video/mp4': return bytes.subarray(4, 8).toString('latin1') === 'ftyp'
    case 'video/webm': return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    default: return false
  }
}

function pngDimensions(bytes: Buffer): {width: number; height: number} | null {
  if (bytes.length < 24 || bytes.subarray(12, 16).toString('latin1') !== 'IHDR') return null
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)}
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

/**
 * A signed release binds the exact modula.product.json and frontend bytes in
 * its publisher statement. Bytes that differ from what the publisher signed
 * are rejected rather than ingested next to a "verified" signature.
 */
async function assertSignedDigestsMatch(db: ModulaDb, releaseId: string, productManifestSha256: string, frontendSha256: string | null) {
  const rows = await db.selectFrom('greenfield_module_release_signatures')
    .select(['statement', 'verification_state'])
    .where('release_id', '=', releaseId)
    .execute()
  for (const row of rows) {
    const statement = (row.statement ?? null) as {productManifestSha256?: string | null; frontendSha256?: string | null} | null
    if (!statement || (statement.productManifestSha256 ?? null) !== productManifestSha256) {
      throw moduleError('VALIDATION_FAILED', 'modula.product.json does not match the digest the publisher signed')
    }
    if ((statement.frontendSha256 ?? null) !== frontendSha256) {
      throw moduleError('VALIDATION_FAILED', 'Frontend artifact does not match the digest the publisher signed')
    }
  }
}

/**
 * An MPS may claim identity aliases, but never one that already resolves to a
 * different product or that is another publisher's live product id: aliases
 * are never re-pointed (previously an ingest could silently re-point one).
 */
async function assertAliasClaimable(db: ModulaDb, alias: string, productId: string, publisherId: string) {
  if (alias === productId) throw moduleError('VALIDATION_FAILED', 'A product cannot alias its own id')
  const existing = await db.selectFrom('greenfield_product_identity_aliases').select('canonical_product_id').where('alias_id', '=', alias).executeTakeFirst()
  if (existing && existing.canonical_product_id !== productId) throw moduleError('CONFLICT', `Identity alias ${alias} already belongs to ${existing.canonical_product_id}`)
  const resolved = resolveCanonicalModuleId(alias)
  if (resolved !== alias && resolved !== productId) throw moduleError('CONFLICT', `Identity alias ${alias} already resolves to ${resolved}`)
  if (existing) return
  const foreign = await db.selectFrom('greenfield_module_releases').select('publisher_id').where('module_id', '=', alias).where('publisher_id', '!=', publisherId).executeTakeFirst()
  if (foreign) throw moduleError('CONFLICT', `Identity alias ${alias} is a product id owned by another publisher`)
}
