import {createHash, createPublicKey, randomUUID, verify} from 'node:crypto'
import {compareSemver} from '@modula/greenfield-module-manifest'
import type {ModulaDb} from '../../database/client.js'
import {AuditRepository} from '../audit/repository.js'

const ARTIFACT_MEDIA_TYPE = 'application/vnd.modula.moliboo-asset-pack+json'
const MAX_ARTIFACT_BYTES = 6 * 1024 * 1024
const MAX_DECODED_BYTES = 8 * 1024 * 1024
const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_FILES = 16
const SAFE_PATH = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(?:json|png)$/
const SHA256 = /^[0-9a-f]{64}$/
const PACKAGE_ID = /^moliboo\.character\.[0-9]{1,4}$/
const ITEM_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,159}$/
const SLOT = /^[a-z][a-z0-9-]{1,31}$/

type MolibooFile = {path: string; mediaType: string; sha256: string; bytes: number; data: string}
type MolibooContainer = {
  schemaVersion: 'modula.moliboo.assetpack.1'
  packageId: string
  version: string
  characterId: string
  files: MolibooFile[]
}

export type MolibooPackageDescriptor = {
  schemaVersion: 'modula.package.1'
  packageId: string
  publisherId: string
  category: 'asset-pack'
  version: string
  releaseId: string
  artifact: {
    sha256: string
    compressedSizeBytes: number
    installedSizeEstimateBytes: number
    mediaType: typeof ARTIFACT_MEDIA_TYPE
    download: {pathOrUrl: string; authorization: 'none'; range: false}
  }
  signature: {algorithm: 'Ed25519'; keyId: string; signature: string; statementDigest: string | null}
  minimumHostVersion: string
  platforms: ['ios']
  dependencies: []
  requiredCapabilities: []
  cachePolicy: 'immutable'
  sharing: 'public'
  moliboo: {
    characterId: string
    familyId: string
    runtimeVersion: number
    assetCapabilities: string[]
    rollbackCompatible: boolean
  }
}

type PackRow = {
  release_id: string
  artifact_id: string
  package_id: string
  version: string
  character_id: string
  family_id: string
  minimum_host_version: string
  runtime_version: number
  asset_capabilities: unknown
  rollback_compatible: boolean
  availability: 'approved' | 'withdrawn'
  state_revision: number
  approved_at: Date
  withdrawn_at: Date | null
  release_module_id: string
  release_version: string
  release_state: string
  release_sha256: string | null
  release_revoked_at: Date | null
  publisher_id: string
  publisher_status: string
  integrity_verified_at: Date | null
  integrity_mismatch_at: Date | null
  artifact_release_id: string
  artifact_kind: string
  artifact_sha256: string
  artifact_access_class: string
  artifact_required: boolean
  media_type: string
  byte_size: number
  bytes: Buffer
  artifact_signature: string
  artifact_signed_digest: string
  artifact_signature_state: string
  artifact_signature_verified_at: Date
  signature_key_id: string
  key_publisher_id: string
  key_state: string
  key_public_pem: string
  key_fingerprint: string
  key_valid_from: Date
  key_valid_until: Date | null
  key_rotated_at: Date | null
  key_revoked_at: Date | null
  release_signature_state: string | null
  release_signature_revoked_at: Date | null
  release_statement_digest: string | null
  character_family_id: string
  character_key: string
  character_number: number
  display_name: string
  series: number
  wearable: boolean
}

type RevocationRow = {scope: 'release' | 'module' | 'publisher' | 'signingKey'; target_id: string}

export class MolibooService {
  constructor(private readonly db: ModulaDb, private readonly publicApiUrl: string) {}

  async listPacks(input: {cursor?: unknown; limit?: unknown; familyId?: unknown; series?: unknown; availability?: unknown} = {}) {
    const limit = pageLimit(input.limit)
    const after = decodePackCursor(input.cursor)
    const familyId = optionalSlug(input.familyId, 'familyId')
    const series = optionalInteger(input.series, 'series', 1, 99)
    if (input.availability !== undefined && input.availability !== 'approved') {
      fail('VALIDATION_FAILED', 'Only approved releases are advertised')
    }
    const trusted = await this.trustedRows({familyId, series})
    const latest = new Map<string, PackRow>()
    for (const row of trusted) {
      const current = latest.get(row.package_id)
      if (!current || compareSemver(row.version, current.version) > 0) latest.set(row.package_id, row)
    }
    const rows = [...latest.values()]
      .sort((a, b) => a.package_id.localeCompare(b.package_id))
      .filter(row => !after || row.package_id > after)
      .slice(0, limit + 1)
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    return {
      items: page.map(row => this.descriptor(row)),
      nextCursor: hasMore ? encodePackCursor(page.at(-1)!.package_id) : null,
      hasMore,
    }
  }

  async catalog() {
    const rows = await this.trustedRows({})
    const latest = new Map<string, PackRow>()
    for (const row of rows) {
      const current = latest.get(row.package_id)
      if (!current || compareSemver(row.version, current.version) > 0) latest.set(row.package_id, row)
    }
    return {
      schemaVersion: 'modula.moliboo.catalog.1' as const,
      packages: [...latest.values()].sort((a, b) => a.package_id.localeCompare(b.package_id)).map(row => this.descriptor(row)),
    }
  }

  async manifest(packageIdInput: unknown, versionInput?: unknown): Promise<MolibooPackageDescriptor> {
    return this.descriptor(await this.requireTrustedPack(packageIdInput, versionInput))
  }

  async download(packageIdInput: unknown, versionInput?: unknown) {
    const row = await this.requireTrustedPack(packageIdInput, versionInput)
    return {sha256: row.artifact_sha256, bytes: row.bytes, byteSize: row.byte_size, mediaType: ARTIFACT_MEDIA_TYPE}
  }

  async ownership(accountId: string, input: {cursor?: unknown; limit?: unknown} = {}) {
    const limit = pageLimit(input.limit)
    const cursor = decodeOwnershipCursor(input.cursor)
    let query = this.db.selectFrom('greenfield_moliboo_ownership as ownership')
      .innerJoin('greenfield_moliboo_items as item', 'item.item_id', 'ownership.item_id')
      .leftJoin('greenfield_moliboo_characters as character', 'character.character_id', 'item.character_id')
      .select([
        'ownership.item_id', 'ownership.grant_source', 'ownership.granted_at',
        'item.item_type', 'item.slot', 'item.wearable', 'item.revoked_at',
        'character.character_id', 'character.character_number', 'character.character_key',
        'character.display_name', 'character.family_id', 'character.series',
      ])
      .where('ownership.account_id', '=', accountId)
    if (cursor) {
      query = query.where(eb => eb.or([
        eb('ownership.granted_at', '<', cursor.grantedAt),
        eb.and([
          eb('ownership.granted_at', '=', cursor.grantedAt),
          eb('ownership.item_id', '>', cursor.itemId),
        ]),
      ]))
    }
    const rows = await query.orderBy('ownership.granted_at', 'desc').orderBy('ownership.item_id').limit(limit + 1).execute()
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    return {
      items: page.map(row => ({
        itemId: row.item_id,
        type: row.item_type,
        slot: row.slot,
        wearable: row.wearable,
        revoked: row.revoked_at !== null,
        grantedAt: row.granted_at.toISOString(),
        grantSource: row.grant_source,
        character: row.character_id ? {
          characterId: row.character_id,
          number: row.character_number,
          key: row.character_key,
          name: row.display_name,
          familyId: row.family_id,
          series: row.series,
        } : null,
      })),
      nextCursor: hasMore ? encodeOwnershipCursor(page.at(-1)!.granted_at, page.at(-1)!.item_id) : null,
      hasMore,
    }
  }

  async outfit(accountId: string) {
    const outfit = await this.db.selectFrom('greenfield_moliboo_outfits').selectAll().where('account_id', '=', accountId).executeTakeFirst()
    if (!outfit) return {revision: 0, updatedAt: null, items: []}
    const items = await this.outfitItems(this.db, accountId)
    return {revision: outfit.revision, updatedAt: outfit.updated_at.toISOString(), items}
  }

  async setOutfit(accountId: string, actorId: string, input: unknown) {
    const parsed = parseOutfit(input)
    return this.db.transaction().execute(async trx => {
      const inserted = await trx.insertInto('greenfield_moliboo_outfits')
        .values({account_id: accountId, revision: 1, updated_at: new Date()})
        .onConflict(oc => oc.column('account_id').doNothing())
        .returning('account_id')
        .executeTakeFirst()
      const outfit = await trx.selectFrom('greenfield_moliboo_outfits').selectAll()
        .where('account_id', '=', accountId).forUpdate().executeTakeFirstOrThrow()
      const currentRevision = inserted ? 0 : outfit.revision
      if (parsed.expectedRevision !== null && parsed.expectedRevision !== currentRevision) {
        fail('REVISION_CONFLICT', `Outfit revision is ${currentRevision}, not ${parsed.expectedRevision}`)
      }
      const itemIds = parsed.items.map(item => item.itemId)
      const owned = itemIds.length ? await trx.selectFrom('greenfield_moliboo_items as item')
        .innerJoin('greenfield_moliboo_ownership as ownership', join => join
          .onRef('ownership.item_id', '=', 'item.item_id')
          .on('ownership.account_id', '=', accountId))
        .leftJoin('greenfield_moliboo_characters as character', 'character.character_id', 'item.character_id')
        .select([
          'item.item_id', 'item.item_type', 'item.slot', 'item.wearable', 'item.revoked_at',
          'character.character_id', 'character.character_number', 'character.character_key',
          'character.display_name', 'character.family_id', 'character.series',
        ])
        .where('item.item_id', 'in', itemIds).execute() : []
      if (owned.length !== itemIds.length) fail('FORBIDDEN', 'Every equipped item must be owned by the authenticated account')
      const byId = new Map(owned.map(item => [item.item_id, item]))
      for (const requested of parsed.items) {
        const item = byId.get(requested.itemId)!
        if (!item.wearable || item.revoked_at) fail('FORBIDDEN', 'Unknown, revoked, or non-wearable items cannot be equipped')
        if (item.slot !== requested.slot) fail('VALIDATION_FAILED', `Item ${requested.itemId} does not belong in slot ${requested.slot}`)
      }
      await trx.deleteFrom('greenfield_moliboo_outfit_items').where('account_id', '=', accountId).execute()
      const now = new Date()
      if (parsed.items.length) {
        await trx.insertInto('greenfield_moliboo_outfit_items').values(parsed.items.map(item => ({
          account_id: accountId,
          slot: item.slot,
          item_id: item.itemId,
          equipped_at: now,
        }))).execute()
      }
      const revision = currentRevision + 1
      await trx.updateTable('greenfield_moliboo_outfits').set({revision, updated_at: now}).where('account_id', '=', accountId).execute()
      await new AuditRepository(trx).append('moliboo.outfit.updated', {
        revision,
        slots: parsed.items.map(item => item.slot).sort(),
      }, {type: 'account', id: accountId, actorId}, {accountId})
      return {revision, updatedAt: now.toISOString(), items: parsed.items.map(requested => itemView(requested.slot, byId.get(requested.itemId)!))}
    })
  }

  async setAvailability(actorAccountId: string, packageIdInput: unknown, input: unknown, availability: 'approved' | 'withdrawn') {
    const packageId = requiredPackageId(packageIdInput)
    const body = object(input, 'body')
    rejectUnknown(body, ['version', 'reason'])
    const version = optionalSemver(body.version, 'version')
    const reason = optionalText(body.reason, 'reason', 500)
    if (availability === 'withdrawn' && !reason) fail('VALIDATION_FAILED', 'A withdrawal reason is required')
    // Restoration is an activation decision, so re-evaluate the complete
    // release, signer, direct artifact signature, bytes and content contract.
    // A stale database flag can never make an invalid pack advertisable.
    if (availability === 'approved') await this.requireTrustedPack(packageId, version, true)
    return this.db.transaction().execute(async trx => {
      let query = trx.selectFrom('greenfield_moliboo_pack_releases as pack')
        .innerJoin('greenfield_module_releases as release', 'release.release_id', 'pack.release_id')
        .innerJoin('greenfield_release_artifact_signatures as artifact_signature', 'artifact_signature.artifact_id', 'pack.artifact_id')
        .innerJoin('greenfield_publisher_signing_keys as signing_key', 'signing_key.key_id', 'artifact_signature.signature_key_id')
        .select([
          'pack.release_id', 'pack.package_id', 'pack.version', 'pack.availability', 'pack.state_revision',
          'release.release_state', 'release.revoked_at', 'signing_key.state as key_state', 'signing_key.revoked_at as key_revoked_at',
          'artifact_signature.verification_state as artifact_signature_state',
        ])
        .where('pack.package_id', '=', packageId)
        .forUpdate('pack')
      if (version) query = query.where('pack.version', '=', version)
      const candidates = await query.execute()
      const row = candidates.sort((a, b) => compareSemver(b.version, a.version))[0]
      if (!row) fail('NOT_FOUND', 'Moliboo package release not found')
      if (row.availability === availability) return {packageId, version: row.version, availability, revision: row.state_revision}
      if (availability === 'approved' && (row.release_state === 'revoked' || row.release_state === 'quarantined' || row.revoked_at
          || row.key_state === 'REVOKED' || row.key_revoked_at || row.artifact_signature_state !== 'verified')) {
        fail('RELEASE_REVOKED', 'A revoked, quarantined, or untrusted package cannot be restored')
      }
      const now = new Date()
      const revision = row.state_revision + 1
      await trx.updateTable('greenfield_moliboo_pack_releases').set({
        availability,
        state_revision: revision,
        withdrawn_at: availability === 'withdrawn' ? now : null,
        withdrawal_reason: availability === 'withdrawn' ? reason : null,
        updated_at: now,
      }).where('release_id', '=', row.release_id).execute()
      const eventType = availability === 'withdrawn' ? 'withdrawn' as const : 'restored' as const
      await trx.insertInto('greenfield_moliboo_pack_release_events').values({
        event_id: randomUUID(), release_id: row.release_id, event_type: eventType,
        state_revision: revision, actor_account_id: actorAccountId, reason, occurred_at: now,
      }).execute()
      await new AuditRepository(trx).append(`moliboo.pack.${eventType}`, {packageId, version: row.version, revision, reason},
        {type: 'moduleRelease', id: row.release_id}, {accountId: actorAccountId})
      return {packageId, version: row.version, availability, revision}
    })
  }

  private async trustedRows(filters: {familyId?: string | null; series?: number | null}): Promise<PackRow[]> {
    let query = this.packRows().where('pack.availability', '=', 'approved')
    if (filters.familyId) query = query.where('pack.family_id', '=', filters.familyId)
    if (filters.series) query = query.where('character.series', '=', filters.series)
    const rows = await query.execute() as PackRow[]
    const {revocations, quarantines} = await this.securityState(rows.map(row => row.release_id))
    const trusted: PackRow[] = []
    for (const row of rows) {
      try {
        assertTrusted(row, revocations, quarantines)
        validateMolibooArtifact(row.bytes, {packageId: row.package_id, version: row.version, characterId: row.character_id})
        trusted.push(row)
      } catch {
        // Public catalogues fail closed per release: an invalid candidate is not advertised.
      }
    }
    return trusted
  }

  private async requireTrustedPack(packageIdInput: unknown, versionInput?: unknown, allowWithdrawn = false): Promise<PackRow> {
    const packageId = requiredPackageId(packageIdInput)
    const version = optionalSemver(versionInput, 'version')
    let query = this.packRows().where('pack.package_id', '=', packageId)
    if (version) query = query.where('pack.version', '=', version)
    const candidates = await query.execute() as PackRow[]
    const sorted = candidates.sort((a, b) => compareSemver(b.version, a.version))
    const row = version ? sorted[0] : allowWithdrawn ? sorted[0] : sorted.find(candidate => candidate.availability === 'approved')
    if (!row) fail('NOT_FOUND', 'Moliboo package release not found')
    if (row.availability === 'withdrawn' && !allowWithdrawn) fail('RELEASE_REVOKED', 'Moliboo package release has been withdrawn')
    const {revocations, quarantines} = await this.securityState([row.release_id])
    assertTrusted(row, revocations, quarantines)
    validateMolibooArtifact(row.bytes, {packageId: row.package_id, version: row.version, characterId: row.character_id})
    return row
  }

  private packRows() {
    return this.db.selectFrom('greenfield_moliboo_pack_releases as pack')
      .innerJoin('greenfield_moliboo_characters as character', 'character.character_id', 'pack.character_id')
      .innerJoin('greenfield_module_releases as release', 'release.release_id', 'pack.release_id')
      .innerJoin('greenfield_module_release_integrity as integrity', 'integrity.release_id', 'release.release_id')
      .innerJoin('greenfield_publishers as publisher', 'publisher.publisher_id', 'release.publisher_id')
      .innerJoin('greenfield_release_artifacts as artifact', 'artifact.artifact_id', 'pack.artifact_id')
      .innerJoin('greenfield_release_asset_blobs as blob', 'blob.sha256', 'artifact.sha256')
      .innerJoin('greenfield_release_artifact_signatures as artifact_signature', 'artifact_signature.artifact_id', 'artifact.artifact_id')
      .innerJoin('greenfield_publisher_signing_keys as signing_key', 'signing_key.key_id', 'artifact_signature.signature_key_id')
      .innerJoin('greenfield_module_release_signatures as release_signature', join => join
        .onRef('release_signature.release_id', '=', 'release.release_id')
        .onRef('release_signature.signature_key_id', '=', 'artifact_signature.signature_key_id'))
      .select([
        'pack.release_id', 'pack.artifact_id', 'pack.package_id', 'pack.version', 'pack.character_id', 'pack.family_id',
        'pack.minimum_host_version', 'pack.runtime_version', 'pack.asset_capabilities', 'pack.rollback_compatible',
        'pack.availability', 'pack.state_revision', 'pack.approved_at', 'pack.withdrawn_at',
        'release.module_id as release_module_id', 'release.version as release_version', 'release.release_state',
        'release.release_sha256', 'release.revoked_at as release_revoked_at', 'release.publisher_id',
        'publisher.status as publisher_status', 'integrity.verified_at as integrity_verified_at',
        'integrity.mismatch_at as integrity_mismatch_at', 'artifact.release_id as artifact_release_id',
        'artifact.kind as artifact_kind', 'artifact.sha256 as artifact_sha256',
        'artifact.access_class as artifact_access_class', 'artifact.required_for_offline_launch as artifact_required',
        'blob.media_type', 'blob.byte_size', 'blob.bytes', 'artifact_signature.signature as artifact_signature',
        'artifact_signature.signed_digest as artifact_signed_digest',
        'artifact_signature.verification_state as artifact_signature_state',
        'artifact_signature.verified_at as artifact_signature_verified_at',
        'signing_key.key_id as signature_key_id', 'signing_key.publisher_id as key_publisher_id',
        'signing_key.state as key_state', 'signing_key.public_key_pem as key_public_pem',
        'signing_key.fingerprint as key_fingerprint', 'signing_key.valid_from as key_valid_from',
        'signing_key.valid_until as key_valid_until', 'signing_key.rotated_at as key_rotated_at',
        'signing_key.revoked_at as key_revoked_at',
        'release_signature.verification_state as release_signature_state',
        'release_signature.revoked_at as release_signature_revoked_at',
        'release_signature.statement_sha256 as release_statement_digest',
        'character.family_id as character_family_id', 'character.character_key', 'character.character_number',
        'character.display_name', 'character.series', 'character.wearable',
      ])
  }

  private async securityState(releaseIds: string[]) {
    if (!releaseIds.length) return {revocations: [] as RevocationRow[], quarantines: new Set<string>()}
    const [revocations, quarantines] = await Promise.all([
      this.db.selectFrom('greenfield_module_revocations').select(['scope', 'target_id']).execute() as Promise<RevocationRow[]>,
      this.db.selectFrom('greenfield_module_quarantines').select('release_id')
        .where('release_id', 'in', releaseIds).where('lifted_at', 'is', null).execute(),
    ])
    return {revocations, quarantines: new Set(quarantines.map(row => row.release_id))}
  }

  private descriptor(row: PackRow): MolibooPackageDescriptor {
    const installedSizeEstimateBytes = validateMolibooArtifact(row.bytes, {
      packageId: row.package_id, version: row.version, characterId: row.character_id,
    }).files.reduce((sum, file) => sum + file.bytes, 0)
    const base = this.publicApiUrl.replace(/\/+$/, '')
    const download = `${base}/v1/moliboos/packs/${encodeURIComponent(row.package_id)}/download?version=${encodeURIComponent(row.version)}`
    return {
      schemaVersion: 'modula.package.1', packageId: row.package_id, publisherId: row.publisher_id,
      category: 'asset-pack', version: row.version, releaseId: row.release_id,
      artifact: {
        sha256: row.artifact_sha256, compressedSizeBytes: row.byte_size, installedSizeEstimateBytes,
        mediaType: ARTIFACT_MEDIA_TYPE, download: {pathOrUrl: download, authorization: 'none', range: false},
      },
      signature: {
        algorithm: 'Ed25519', keyId: row.signature_key_id, signature: row.artifact_signature,
        statementDigest: row.release_statement_digest,
      },
      minimumHostVersion: row.minimum_host_version, platforms: ['ios'], dependencies: [], requiredCapabilities: [],
      cachePolicy: 'immutable', sharing: 'public',
      moliboo: {
        characterId: row.character_id, familyId: row.family_id, runtimeVersion: row.runtime_version,
        assetCapabilities: stringArray(row.asset_capabilities), rollbackCompatible: row.rollback_compatible,
      },
    }
  }

  private async outfitItems(db: ModulaDb, accountId: string) {
    const rows = await db.selectFrom('greenfield_moliboo_outfit_items as outfit')
      .innerJoin('greenfield_moliboo_items as item', 'item.item_id', 'outfit.item_id')
      .leftJoin('greenfield_moliboo_characters as character', 'character.character_id', 'item.character_id')
      .select([
        'outfit.slot', 'item.item_id', 'item.item_type', 'item.wearable', 'item.revoked_at',
        'character.character_id', 'character.character_number', 'character.character_key',
        'character.display_name', 'character.family_id', 'character.series',
      ])
      .where('outfit.account_id', '=', accountId).orderBy('outfit.slot').execute()
    return rows.map(row => itemView(row.slot, row))
  }
}

export function validateMolibooArtifact(bytes: Buffer, identity: {packageId: string; version: string; characterId: string}): MolibooContainer {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_ARTIFACT_BYTES) fail('UNTRUSTED_RELEASE', 'Moliboo artifact size is invalid')
  let parsed: unknown
  try { parsed = JSON.parse(bytes.toString('utf8')) } catch { fail('UNTRUSTED_RELEASE', 'Moliboo artifact is malformed') }
  const container = object(parsed, 'artifact') as unknown as MolibooContainer
  rejectUnknown(container as unknown as Record<string, unknown>, ['schemaVersion', 'packageId', 'version', 'characterId', 'files'])
  if (container.schemaVersion !== 'modula.moliboo.assetpack.1'
      || container.packageId !== identity.packageId || container.version !== identity.version
      || container.characterId !== identity.characterId || !Array.isArray(container.files)
      || container.files.length === 0 || container.files.length > MAX_FILES) {
    fail('UNTRUSTED_RELEASE', 'Moliboo artifact identity or inventory is invalid')
  }
  const paths = new Set<string>()
  let total = 0
  for (const raw of container.files) {
    const file = object(raw, 'file') as unknown as MolibooFile
    rejectUnknown(file as unknown as Record<string, unknown>, ['path', 'mediaType', 'sha256', 'bytes', 'data'])
    if (typeof file.path !== 'string' || file.path.length > 128 || !SAFE_PATH.test(file.path)
        || file.path.startsWith('/') || file.path.includes('..') || file.path.includes('\\')
        || paths.has(file.path.toLowerCase())) fail('UNTRUSTED_RELEASE', 'Moliboo artifact contains an unsafe or duplicate path')
    paths.add(file.path.toLowerCase())
    const expectedMedia = file.path.endsWith('.png') ? 'image/png' : 'application/json'
    if (file.mediaType !== expectedMedia || !SHA256.test(file.sha256)
        || !Number.isInteger(file.bytes) || file.bytes <= 0 || file.bytes > MAX_FILE_BYTES
        || typeof file.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) {
      fail('UNTRUSTED_RELEASE', 'Moliboo artifact file metadata is invalid')
    }
    const decoded = Buffer.from(file.data, 'base64')
    if (decoded.length !== file.bytes || decoded.toString('base64') !== file.data
        || createHash('sha256').update(decoded).digest('hex') !== file.sha256) {
      fail('ARTIFACT_DIGEST_MISMATCH', `Moliboo file integrity failed for ${file.path}`)
    }
    if (file.mediaType === 'image/png' && !decoded.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      fail('UNTRUSTED_RELEASE', `Moliboo PNG signature is invalid for ${file.path}`)
    }
    total += decoded.length
    if (total > MAX_DECODED_BYTES) fail('UNTRUSTED_RELEASE', 'Moliboo artifact expanded size is invalid')
  }
  if (!paths.has('character.json') || !paths.has('portrait.png')) fail('UNTRUSTED_RELEASE', 'Moliboo artifact requires character.json and portrait.png')
  const characterFile = container.files.find(file => file.path === 'character.json')!
  let character: Record<string, unknown>
  try { character = object(JSON.parse(Buffer.from(characterFile.data, 'base64').toString('utf8')), 'character.json') } catch {
    fail('UNTRUSTED_RELEASE', 'Moliboo character.json is malformed')
  }
  if (character.schemaVersion !== 'modula.moliboo.character.1' || character.characterId !== identity.characterId
      || typeof character.key !== 'string' || typeof character.assetVersion !== 'string') {
    fail('UNTRUSTED_RELEASE', 'Moliboo character.json identity is invalid')
  }
  return container
}

function assertTrusted(row: PackRow, revocations: RevocationRow[], quarantines: Set<string>) {
  const revoked = row.release_state === 'revoked' || row.release_revoked_at || quarantines.has(row.release_id)
    || revocations.some(item => (item.scope === 'release' && item.target_id === row.release_id)
      || (item.scope === 'module' && item.target_id === row.package_id)
      || (item.scope === 'publisher' && item.target_id === row.publisher_id))
  if (revoked) fail('RELEASE_REVOKED', 'Moliboo release is revoked or quarantined')
  if (row.key_state === 'REVOKED' || row.key_revoked_at
      || revocations.some(item => item.scope === 'signingKey' && item.target_id === row.signature_key_id)) {
    fail('SIGNER_REVOKED', 'Moliboo release signer is revoked')
  }
  if (!['published', 'superseded'].includes(row.release_state) || row.publisher_status !== 'verified'
      || row.integrity_mismatch_at
      || row.release_signature_state !== 'verified' || row.release_signature_revoked_at
      || row.artifact_signature_state !== 'verified' || row.release_module_id !== row.package_id
      || row.release_version !== row.version || row.artifact_release_id !== row.release_id
      || row.release_sha256 !== row.artifact_sha256 || row.artifact_signed_digest !== row.artifact_sha256
      || row.artifact_kind !== 'asset' || row.artifact_access_class !== 'public' || !row.artifact_required
      || row.media_type !== ARTIFACT_MEDIA_TYPE || row.byte_size !== row.bytes.length
      || row.family_id !== row.character_family_id || row.key_publisher_id !== row.publisher_id) {
    fail('UNTRUSTED_RELEASE', 'Moliboo release trust facts are incomplete or inconsistent')
  }
  const now = row.artifact_signature_verified_at
  if (now < row.key_valid_from || (row.key_valid_until && now > row.key_valid_until)
      || (row.key_state === 'ROTATED' && row.key_rotated_at && now > row.key_rotated_at)) {
    fail('UNTRUSTED_RELEASE', 'Moliboo artifact signature was observed outside the signer validity window')
  }
  let publicKey
  try { publicKey = createPublicKey(row.key_public_pem) } catch { fail('UNTRUSTED_RELEASE', 'Moliboo signer public key is invalid') }
  const der = publicKey.export({format: 'der', type: 'spki'})
  const derivedKeyId = createHash('sha256').update(der).digest('hex')
  const signature = Buffer.from(row.artifact_signature, 'base64')
  if (row.key_fingerprint !== `sha256:${derivedKeyId}` || row.signature_key_id !== derivedKeyId
      || signature.length !== 64 || !verify(null, Buffer.from(row.artifact_signed_digest, 'utf8'), publicKey, signature)) {
    fail('UNTRUSTED_RELEASE', 'Moliboo artifact signature is invalid')
  }
}

function parseOutfit(input: unknown) {
  const body = object(input, 'body')
  rejectUnknown(body, ['expectedRevision', 'items'])
  const expectedRevision = body.expectedRevision === undefined ? null : optionalInteger(body.expectedRevision, 'expectedRevision', 0, Number.MAX_SAFE_INTEGER)
  if (!Array.isArray(body.items) || body.items.length > 16) fail('VALIDATION_FAILED', 'items must be an array with at most 16 entries')
  const slots = new Set<string>()
  const ids = new Set<string>()
  const items = body.items.map((value, index) => {
    const item = object(value, `items[${index}]`)
    rejectUnknown(item, ['slot', 'itemId'])
    if (typeof item.slot !== 'string' || !SLOT.test(item.slot)) fail('VALIDATION_FAILED', `items[${index}].slot is invalid`)
    if (typeof item.itemId !== 'string' || !ITEM_ID.test(item.itemId)) fail('VALIDATION_FAILED', `items[${index}].itemId is invalid`)
    if (!slots.add(item.slot)) fail('VALIDATION_FAILED', `Duplicate outfit slot ${item.slot}`)
    if (!ids.add(item.itemId)) fail('VALIDATION_FAILED', `Duplicate outfit item ${item.itemId}`)
    return {slot: item.slot, itemId: item.itemId}
  })
  return {expectedRevision, items}
}

function itemView(slot: string, row: any) {
  return {
    slot,
    itemId: row.item_id,
    type: row.item_type,
    wearable: row.wearable,
    revoked: row.revoked_at !== null,
    character: row.character_id ? {
      characterId: row.character_id, number: row.character_number, key: row.character_key,
      name: row.display_name, familyId: row.family_id, series: row.series,
    } : null,
  }
}

function requiredPackageId(value: unknown) {
  if (typeof value !== 'string' || !PACKAGE_ID.test(value)) fail('VALIDATION_FAILED', 'packId is invalid')
  return value
}

function optionalSemver(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(value)) fail('VALIDATION_FAILED', `${field} must be a semantic version`)
  return value
}

function optionalSlug(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(value)) fail('VALIDATION_FAILED', `${field} is invalid`)
  return value
}

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail('VALIDATION_FAILED', `${field} is invalid`)
  return value.trim()
}

function optionalInteger(value: unknown, field: string, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return null
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  if (!Number.isSafeInteger(number) || Number(number) < min || Number(number) > max) fail('VALIDATION_FAILED', `${field} is invalid`)
  return Number(number)
}

function pageLimit(value: unknown) {
  return optionalInteger(value, 'limit', 1, 50) ?? 20
}

function encodePackCursor(packageId: string) {
  return Buffer.from(JSON.stringify({packageId})).toString('base64url')
}

function decodePackCursor(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > 256) fail('INVALID_CURSOR', 'Invalid Moliboo pack cursor')
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed.packageId !== 'string' || !PACKAGE_ID.test(parsed.packageId)) throw new Error()
    return parsed.packageId
  } catch { fail('INVALID_CURSOR', 'Invalid Moliboo pack cursor') }
}

function encodeOwnershipCursor(grantedAt: Date, itemId: string) {
  return Buffer.from(JSON.stringify({grantedAt: grantedAt.toISOString(), itemId})).toString('base64url')
}

function decodeOwnershipCursor(value: unknown): {grantedAt: Date; itemId: string} | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > 512) fail('INVALID_CURSOR', 'Invalid ownership cursor')
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    const grantedAt = new Date(parsed.grantedAt)
    if (!Number.isFinite(grantedAt.getTime()) || typeof parsed.itemId !== 'string' || !ITEM_ID.test(parsed.itemId)) throw new Error()
    return {grantedAt, itemId: parsed.itemId}
  } catch { fail('INVALID_CURSOR', 'Invalid ownership cursor') }
}

function object(value: unknown, field: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('VALIDATION_FAILED', `${field} must be an object`)
  return value as Record<string, any>
}

function rejectUnknown(value: Record<string, unknown>, allowed: string[]) {
  const unknown = Object.keys(value).filter(key => !allowed.includes(key))
  if (unknown.length) fail('VALIDATION_FAILED', `Unknown fields: ${unknown.sort().join(', ')}`)
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') as string[] : []
}

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), {code})
}
