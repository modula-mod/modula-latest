import {createHash, createPublicKey, verify} from 'node:crypto'
import {compareSemver} from '@modula/greenfield-module-manifest'
import type {ModulaDb} from '../../database/client.js'
import {STICKER_PACKS, type Sticker, type StickerPack} from './stickers.js'

const SHA256 = /^[0-9a-f]{64}$/
const PACK_ID = /^[a-z0-9][a-z0-9-]{1,79}$/
const STICKER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/

type PackRow = {
  release_id: string; manifest_artifact_id: string; pack_id: string; version: string; title: string; icon: string
  series: number | null; availability: 'approved' | 'withdrawn'; sort_order: number
  module_id: string; release_version: string; release_state: string; release_sha256: string | null; release_revoked_at: Date | null
  publisher_id: string; publisher_status: string; integrity_mismatch_at: Date | null
  manifest_release_id: string; manifest_sha256: string; manifest_media_type: string; manifest_byte_size: number; manifest_bytes: Buffer
  signature: string; signed_digest: string; signature_state: string; signature_verified_at: Date
  key_id: string; key_publisher_id: string; key_state: string; key_public_pem: string; key_fingerprint: string
  key_valid_from: Date; key_valid_until: Date | null; key_rotated_at: Date | null; key_revoked_at: Date | null
  release_signature_state: string | null; release_signature_revoked_at: Date | null
}

type ImageRow = {
  sticker_id: string; label: string; emoji: string; sort_order: number
  artifact_id: string; artifact_release_id: string; sha256: string; media_type: string; byte_size: number; bytes: Buffer
}

type StickerManifest = {
  schemaVersion: 'modula.sticker-pack.1'; packId: string; version: string
  stickers: Array<{id: string; label: string; path: string; mediaType: 'image/png'; sha256: string; bytes: number}>
}

export type DeliveredSticker = Sticker & {
  asset?: {sha256: string; mediaType: 'image/png'; bytes: number; url: string}
}

export type DeliveredStickerPack = Omit<StickerPack, 'stickers'> & {
  series?: number | null; version?: string; releaseId?: string
  package?: {
    schemaVersion: 'modula.sticker-pack.1'; sha256: string; bytes: number; mediaType: 'application/json'
    download: {pathOrUrl: string; authorization: 'none'}
    signature: {algorithm: 'Ed25519'; keyId: string; signature: string}
  }
  stickers: DeliveredSticker[]
}

export class StickerService {
  constructor(private readonly db: ModulaDb, private readonly publicApiUrl: string) {}

  async list(input: {cursor?: unknown; limit?: unknown; series?: unknown} = {}) {
    const limit = integer(input.limit, 'limit', 1, 50) ?? 20
    const series = integer(input.series, 'series', 1, 99)
    const after = decodeCursor(input.cursor)
    const databasePacks = await this.trustedDatabasePacks(series)
    const legacy: DeliveredStickerPack[] = series === null ? STICKER_PACKS.map(pack => ({...pack, series: null})) : []
    const combined = [...legacy, ...databasePacks]
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter(pack => !after || pack.id > after)
    const page = combined.slice(0, limit)
    const hasMore = combined.length > limit
    return {packs: page, nextCursor: hasMore ? encodeCursor(page.at(-1)!.id) : null, hasMore}
  }

  async find(stickerId: unknown): Promise<{pack: DeliveredStickerPack; sticker: DeliveredSticker} | null> {
    if (typeof stickerId !== 'string' || !STICKER_ID.test(stickerId)) return null
    for (const pack of STICKER_PACKS) {
      const sticker = pack.stickers.find(item => item.id === stickerId)
      if (sticker) return {pack, sticker}
    }
    const packs = await this.trustedDatabasePacks(null)
    for (const pack of packs) {
      const sticker = pack.stickers.find(item => item.id === stickerId)
      if (sticker) return {pack, sticker}
    }
    return null
  }

  private async trustedDatabasePacks(series: number | null): Promise<DeliveredStickerPack[]> {
    let query = this.packRows().where('pack.availability', '=', 'approved')
    if (series !== null) query = query.where('pack.series', '=', series)
    const rows = await query.execute() as PackRow[]
    const latest = new Map<string, PackRow>()
    for (const row of rows) {
      try {
        await this.assertTrusted(row)
        const current = latest.get(row.pack_id)
        if (!current || compareSemver(row.version, current.version) > 0) latest.set(row.pack_id, row)
      } catch {
        // One invalid release never makes the public catalogue partially trusted.
      }
    }
    const result: DeliveredStickerPack[] = []
    for (const row of latest.values()) {
      try { result.push(await this.presentPack(row)) } catch { /* fail closed for the invalid release */ }
    }
    return result
  }

  private packRows() {
    return this.db.selectFrom('greenfield_sticker_pack_releases as pack')
      .innerJoin('greenfield_module_releases as release', 'release.release_id', 'pack.release_id')
      .innerJoin('greenfield_publishers as publisher', 'publisher.publisher_id', 'release.publisher_id')
      .innerJoin('greenfield_module_release_integrity as integrity', 'integrity.release_id', 'release.release_id')
      .innerJoin('greenfield_release_artifacts as manifest_artifact', 'manifest_artifact.artifact_id', 'pack.manifest_artifact_id')
      .innerJoin('greenfield_release_asset_blobs as manifest_blob', 'manifest_blob.sha256', 'manifest_artifact.sha256')
      .innerJoin('greenfield_release_artifact_signatures as artifact_signature', 'artifact_signature.artifact_id', 'manifest_artifact.artifact_id')
      .innerJoin('greenfield_publisher_signing_keys as signing_key', 'signing_key.key_id', 'artifact_signature.signature_key_id')
      .innerJoin('greenfield_module_release_signatures as release_signature', join => join
        .onRef('release_signature.release_id', '=', 'release.release_id')
        .onRef('release_signature.signature_key_id', '=', 'artifact_signature.signature_key_id'))
      .select([
        'pack.release_id', 'pack.manifest_artifact_id', 'pack.pack_id', 'pack.version', 'pack.title', 'pack.icon',
        'pack.series', 'pack.availability', 'pack.sort_order', 'release.module_id', 'release.version as release_version',
        'release.release_state', 'release.release_sha256', 'release.revoked_at as release_revoked_at', 'release.publisher_id',
        'publisher.status as publisher_status', 'integrity.mismatch_at as integrity_mismatch_at',
        'manifest_artifact.release_id as manifest_release_id', 'manifest_artifact.sha256 as manifest_sha256',
        'manifest_blob.media_type as manifest_media_type', 'manifest_blob.byte_size as manifest_byte_size',
        'manifest_blob.bytes as manifest_bytes', 'artifact_signature.signature', 'artifact_signature.signed_digest',
        'artifact_signature.verification_state as signature_state', 'artifact_signature.verified_at as signature_verified_at',
        'signing_key.key_id', 'signing_key.publisher_id as key_publisher_id', 'signing_key.state as key_state',
        'signing_key.public_key_pem as key_public_pem', 'signing_key.fingerprint as key_fingerprint',
        'signing_key.valid_from as key_valid_from', 'signing_key.valid_until as key_valid_until',
        'signing_key.rotated_at as key_rotated_at', 'signing_key.revoked_at as key_revoked_at',
        'release_signature.verification_state as release_signature_state',
        'release_signature.revoked_at as release_signature_revoked_at',
      ])
  }

  private async assertTrusted(row: PackRow) {
    const [revocation, quarantine] = await Promise.all([
      this.db.selectFrom('greenfield_module_revocations').select('revocation_id').where(eb => eb.or([
        eb.and([eb('scope', '=', 'release'), eb('target_id', '=', row.release_id)]),
        eb.and([eb('scope', '=', 'module'), eb('target_id', '=', row.module_id)]),
        eb.and([eb('scope', '=', 'publisher'), eb('target_id', '=', row.publisher_id)]),
        eb.and([eb('scope', '=', 'signingKey'), eb('target_id', '=', row.key_id)]),
      ])).executeTakeFirst(),
      this.db.selectFrom('greenfield_module_quarantines').select('quarantine_id')
        .where('release_id', '=', row.release_id).where('lifted_at', 'is', null).executeTakeFirst(),
    ])
    if (revocation || quarantine || row.release_revoked_at || row.key_revoked_at) throw untrusted('Sticker release is revoked')
    if (!['published', 'superseded'].includes(row.release_state) || row.publisher_status !== 'verified'
        || row.integrity_mismatch_at || row.release_version !== row.version || row.manifest_release_id !== row.release_id
        || row.release_sha256 !== row.manifest_sha256 || row.manifest_media_type !== 'application/json'
        || row.manifest_byte_size !== row.manifest_bytes.length || row.signed_digest !== row.manifest_sha256
        || row.signature_state !== 'verified' || row.release_signature_state !== 'verified' || row.release_signature_revoked_at
        || row.key_publisher_id !== row.publisher_id || row.key_state === 'REVOKED') throw untrusted('Sticker release trust facts are incomplete')
    if (row.signature_verified_at < row.key_valid_from || (row.key_valid_until && row.signature_verified_at > row.key_valid_until)
        || (row.key_state === 'ROTATED' && row.key_rotated_at && row.signature_verified_at > row.key_rotated_at)) throw untrusted('Sticker signer validity window failed')
    const publicKey = createPublicKey(row.key_public_pem)
    const derived = createHash('sha256').update(publicKey.export({format: 'der', type: 'spki'})).digest('hex')
    const signature = Buffer.from(row.signature, 'base64')
    if (row.key_id !== derived || row.key_fingerprint !== `sha256:${derived}` || signature.length !== 64
        || !verify(null, Buffer.from(row.signed_digest), publicKey, signature)) throw untrusted('Sticker manifest signature is invalid')
  }

  private async presentPack(row: PackRow): Promise<DeliveredStickerPack> {
    const manifest = parseManifest(row.manifest_bytes, row.pack_id, row.version)
    const images = await this.db.selectFrom('greenfield_stickers as sticker')
      .innerJoin('greenfield_release_artifacts as artifact', 'artifact.artifact_id', 'sticker.artifact_id')
      .innerJoin('greenfield_release_asset_blobs as blob', 'blob.sha256', 'artifact.sha256')
      .select([
        'sticker.sticker_id', 'sticker.label', 'sticker.emoji', 'sticker.sort_order', 'sticker.artifact_id',
        'artifact.release_id as artifact_release_id', 'artifact.sha256', 'blob.media_type', 'blob.byte_size', 'blob.bytes',
      ]).where('sticker.release_id', '=', row.release_id).orderBy('sticker.sort_order').execute() as ImageRow[]
    if (images.length !== manifest.stickers.length) throw untrusted('Sticker inventory does not match its signed manifest')
    const manifestById = new Map(manifest.stickers.map(item => [item.id, item]))
    const base = this.publicApiUrl.replace(/\/+$/, '')
    const stickers: DeliveredSticker[] = images.map(image => {
      const fact = manifestById.get(image.sticker_id)
      if (!fact || image.artifact_release_id !== row.release_id || image.media_type !== 'image/png'
          || image.byte_size !== image.bytes.length || image.sha256 !== fact.sha256 || image.byte_size !== fact.bytes
          || image.label !== fact.label || !image.bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        throw untrusted(`Sticker ${image.sticker_id} does not match its signed manifest`)
      }
      return {
        id: image.sticker_id, emoji: image.emoji, label: image.label,
        asset: {sha256: image.sha256, mediaType: 'image/png', bytes: image.byte_size, url: `${base}/v1/registry/artifacts/${image.sha256}`},
      }
    })
    return {
      id: row.pack_id, title: row.title, icon: row.icon, series: row.series, version: row.version, releaseId: row.release_id,
      package: {
        schemaVersion: 'modula.sticker-pack.1', sha256: row.manifest_sha256, bytes: row.manifest_byte_size,
        mediaType: 'application/json', download: {pathOrUrl: `${base}/v1/registry/artifacts/${row.manifest_sha256}`, authorization: 'none'},
        signature: {algorithm: 'Ed25519', keyId: row.key_id, signature: row.signature},
      },
      stickers,
    }
  }
}

function parseManifest(bytes: Buffer, packId: string, version: string): StickerManifest {
  let value: unknown
  try { value = JSON.parse(bytes.toString('utf8')) } catch { throw untrusted('Sticker manifest is malformed') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw untrusted('Sticker manifest is malformed')
  const manifest = value as StickerManifest
  if (manifest.schemaVersion !== 'modula.sticker-pack.1' || manifest.packId !== packId || manifest.version !== version
      || !Array.isArray(manifest.stickers) || manifest.stickers.length === 0 || manifest.stickers.length > 100) throw untrusted('Sticker manifest identity is invalid')
  const ids = new Set<string>(), paths = new Set<string>()
  for (const sticker of manifest.stickers) {
    if (!sticker || !STICKER_ID.test(sticker.id) || ids.has(sticker.id) || typeof sticker.label !== 'string'
        || sticker.label.length < 1 || sticker.label.length > 100 || typeof sticker.path !== 'string'
        || !/^stickers\/[A-Za-z0-9][A-Za-z0-9_-]{1,99}\.png$/.test(sticker.path) || paths.has(sticker.path)
        || sticker.mediaType !== 'image/png' || !SHA256.test(sticker.sha256)
        || !Number.isInteger(sticker.bytes) || sticker.bytes < 1 || sticker.bytes > 4 * 1024 * 1024) throw untrusted('Sticker manifest inventory is invalid')
    ids.add(sticker.id); paths.add(sticker.path)
  }
  return manifest
}

function integer(value: unknown, field: string, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return null
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  if (!Number.isSafeInteger(number) || Number(number) < min || Number(number) > max) throw validation(`${field} is invalid`)
  return Number(number)
}

function encodeCursor(packId: string) { return Buffer.from(JSON.stringify({packId})).toString('base64url') }
function decodeCursor(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > 256) throw invalidCursor()
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed.packId !== 'string' || !PACK_ID.test(parsed.packId)) throw new Error()
    return parsed.packId
  } catch { throw invalidCursor() }
}

function validation(message: string) { return Object.assign(new Error(message), {code: 'VALIDATION_FAILED'}) }
function invalidCursor() { return Object.assign(new Error('Invalid sticker pack cursor'), {code: 'INVALID_CURSOR'}) }
function untrusted(message: string) { return Object.assign(new Error(message), {code: 'UNTRUSTED_RELEASE'}) }
