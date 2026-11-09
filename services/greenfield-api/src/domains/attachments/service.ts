import {createHash, randomUUID} from 'node:crypto'
import {createReadStream} from 'node:fs'
import {access, mkdir, open, rename, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {Readable} from 'node:stream'
import type {AttachmentDto} from '@modula/api-contracts'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import {AttachmentPolicy, domainError} from './policy.js'

type UploadBody = Buffer | Uint8Array | AsyncIterable<Buffer | Uint8Array>

export class AttachmentService {
  constructor(private readonly db: ModulaDb, private readonly config: AppConfig) {}

  async createUpload(accountId: string, input: {
    filename?: string
    mimeType?: string
    size?: number
    checksum?: string
    metadata?: Record<string, unknown>
  }) {
    const filename = AttachmentPolicy.safeFilename(typeof input?.filename === 'string' ? input.filename : '')
    const definition = AttachmentPolicy.definition(typeof input?.mimeType === 'string' ? input.mimeType : '')
    const size = typeof input?.size === 'number' ? input.size : Number.NaN
    AttachmentPolicy.validateSize(definition, size)
    const checksum = normalizeChecksum(input?.checksum)
    const now = new Date()
    const attachmentId = randomUUID()
    const uploadId = randomUUID()
    const expiresAt = new Date(now.getTime() + AttachmentPolicy.uploadSessionTtlMs)
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('attachments').values({
        attachment_id: attachmentId,
        owner_account_id: accountId,
        kind: definition.kind,
        mime_type: definition.mimeType,
        original_filename: filename,
        byte_size: String(size),
        checksum,
        storage_key: null,
        storage_provider: 'filesystem',
        status: 'created',
        // Client hints remain provenance only. Canonical media metadata is
        // populated only by server inspection/processing.
        width: null,
        height: null,
        duration_seconds: null,
        page_count: null,
        thumbnail_key: null,
        preview_key: null,
        metadata: clientMetadata(input.metadata),
        attached_at: null,
        created_at: now,
        updated_at: now,
      }).execute()
      await trx.insertInto('attachment_upload_sessions').values({
        upload_id: uploadId,
        attachment_id: attachmentId,
        owner_account_id: accountId,
        expected_byte_size: String(size),
        expected_mime_type: definition.mimeType,
        expected_checksum: checksum,
        state: 'created',
        expires_at: expiresAt,
        completed_at: null,
        created_at: now,
        updated_at: now,
      }).execute()
    })
    return {
      uploadId,
      attachmentId,
      upload: {
        method: 'PUT' as const,
        url: `/v1/attachments/uploads/${uploadId}/content`,
        headers: {'Content-Type': 'application/octet-stream'},
      },
      expiresAt: expiresAt.toISOString(),
      policy: {kind: definition.kind, maxBytes: definition.maxBytes},
    }
  }

  async upload(accountId: string, uploadId: string, body: UploadBody): Promise<AttachmentDto> {
    const session = await this.db.selectFrom('attachment_upload_sessions').selectAll()
      .where('upload_id', '=', uploadId).executeTakeFirst()
    if (!session) throw domainError('Upload session not found', 'NOT_FOUND')
    if (session.owner_account_id !== accountId) throw domainError('Upload session unavailable', 'FORBIDDEN')
    if (session.expires_at <= new Date()) {
      await this.markExpired(session.attachment_id, uploadId)
      throw domainError('Upload session expired', 'CONFLICT')
    }
    if (session.state !== 'created' && session.state !== 'failed') {
      throw domainError('Upload session was already used', 'CONFLICT')
    }
    const attachment = await this.db.selectFrom('attachments').selectAll()
      .where('attachment_id', '=', session.attachment_id).executeTakeFirstOrThrow()
    const definition = AttachmentPolicy.definition(session.expected_mime_type)
    const directory = join(this.config.mediaRoot, 'attachments')
    await mkdir(directory, {recursive: true})
    const tempKey = `${attachment.attachment_id}.uploading`
    const finalKey = `${attachment.attachment_id}.${definition.extension}`
    const tempPath = join(directory, tempKey)
    const finalPath = join(directory, finalKey)
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      const claim = await trx.updateTable('attachment_upload_sessions').set({state: 'uploading', updated_at: now})
        .where('upload_id', '=', uploadId)
        .where('state', 'in', ['created', 'failed'])
        .executeTakeFirst()
      if (claim.numUpdatedRows !== 1n) throw domainError('Upload session is already in use', 'CONFLICT')
      await trx.updateTable('attachments').set({status: 'uploading', updated_at: now})
        .where('attachment_id', '=', attachment.attachment_id).execute()
    })

    const hash = createHash('sha256')
    let bytes = 0
    const handle = await open(tempPath, 'w', 0o600)
    try {
      const source = Buffer.isBuffer(body) || body instanceof Uint8Array ? Readable.from([body]) : body
      for await (const value of source) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value)
        bytes += chunk.length
        if (bytes > Number(session.expected_byte_size) || bytes > definition.maxBytes) {
          throw domainError('Uploaded bytes exceed declared size or policy', 'VALIDATION_FAILED')
        }
        hash.update(chunk)
        await handle.write(chunk)
      }
    } catch (error) {
      await handle.close().catch(() => undefined)
      await rm(tempPath, {force: true})
      await this.markFailed(attachment.attachment_id, uploadId)
      throw error
    }
    await handle.close()
    try {
      if (bytes !== Number(session.expected_byte_size)) throw domainError('Uploaded byte count does not match session', 'VALIDATION_FAILED')
      const digest = hash.digest('hex')
      if (session.expected_checksum && digest !== session.expected_checksum) throw domainError('Attachment checksum mismatch', 'VALIDATION_FAILED')
      const inspectionBytes = await readPrefix(tempPath, 64 * 1024)
      verifyAttachmentSignature(definition.mimeType, inspectionBytes)
      const dimensions = inspectImageDimensions(definition.mimeType, inspectionBytes)
      if (['image/jpeg', 'image/png', 'image/webp'].includes(definition.mimeType) && !dimensions) {
        throw domainError('Image dimensions are missing or outside policy', 'VALIDATION_FAILED')
      }
      await rename(tempPath, finalPath)
      const completedAt = new Date()
      await this.db.transaction().execute(async trx => {
        const completed = await trx.updateTable('attachment_upload_sessions').set({
          state: 'completed', completed_at: completedAt, updated_at: completedAt,
        }).where('upload_id', '=', uploadId).where('state', '=', 'uploading').executeTakeFirst()
        if (completed.numUpdatedRows !== 1n) throw domainError('Upload session expired during transfer', 'CONFLICT')
        await trx.updateTable('attachments').set({
          byte_size: String(bytes), checksum: digest, storage_key: finalKey, status: 'ready',
          width: dimensions?.width ?? null, height: dimensions?.height ?? null, updated_at: completedAt,
        }).where('attachment_id', '=', attachment.attachment_id).execute()
      })
      return await this.requireDto(accountId, attachment.attachment_id)
    } catch (error) {
      await rm(tempPath, {force: true})
      await rm(finalPath, {force: true})
      await this.markFailed(attachment.attachment_id, uploadId)
      throw error
    }
  }

  async status(accountId: string, attachmentId: string): Promise<AttachmentDto> {
    return this.requireDto(accountId, attachmentId)
  }

  async openStored(attachmentId: string): Promise<{stream: ReturnType<typeof createReadStream>; contentType: string} | null> {
    const row = await this.db.selectFrom('attachments').selectAll().where('attachment_id', '=', attachmentId)
      .where('status', '=', 'ready').executeTakeFirst()
    if (!row?.storage_key || !/^[0-9a-f-]{36}\.[a-z0-9]+$/i.test(row.storage_key)) return null
    try {
      const storedPath = join(this.config.mediaRoot, 'attachments', row.storage_key)
      await access(storedPath)
      return {stream: createReadStream(storedPath), contentType: row.mime_type}
    } catch {
      return null
    }
  }

  async removeOrphan(accountId: string, attachmentId: string): Promise<void> {
    const storageKey = await this.db.transaction().execute(async trx => {
      const row = await trx.selectFrom('attachments').selectAll().where('attachment_id', '=', attachmentId)
        .forUpdate().executeTakeFirst()
      if (!row) return null
      if (row.owner_account_id !== accountId) throw domainError('Attachment unavailable', 'FORBIDDEN')
      if (row.attached_at) throw domainError('Published attachments cannot be removed here', 'CONFLICT')
      const draftReservation = await trx.selectFrom('greenfield_post_draft_content').select('draft_id')
        .where('attachment_id', '=', attachmentId).executeTakeFirst()
      if (draftReservation) throw domainError('Draft attachments must be removed from the draft first', 'CONFLICT')
      await trx.deleteFrom('attachments').where('attachment_id', '=', attachmentId).execute()
      return row.storage_key
    })
    if (storageKey) await rm(join(this.config.mediaRoot, 'attachments', storageKey), {force: true})
  }

  private async requireDto(accountId: string, attachmentId: string): Promise<AttachmentDto> {
    const row = await this.db.selectFrom('attachments').selectAll().where('attachment_id', '=', attachmentId).executeTakeFirst()
    if (!row) throw domainError('Attachment not found', 'NOT_FOUND')
    if (row.owner_account_id !== accountId) throw domainError('Attachment unavailable', 'FORBIDDEN')
    return toDto(row, this.config.publicApiUrl)
  }

  private async markFailed(attachmentId: string, uploadId: string) {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      const failed = await trx.updateTable('attachment_upload_sessions').set({state: 'failed', updated_at: now})
        .where('upload_id', '=', uploadId).where('state', '=', 'uploading').executeTakeFirst()
      if (failed.numUpdatedRows === 1n) {
        await trx.updateTable('attachments').set({status: 'failed', updated_at: now})
          .where('attachment_id', '=', attachmentId).where('status', '=', 'uploading').execute()
      }
    })
  }

  private async markExpired(attachmentId: string, uploadId: string) {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('attachments').set({status: 'expired', updated_at: now}).where('attachment_id', '=', attachmentId).execute()
      await trx.updateTable('attachment_upload_sessions').set({state: 'expired', updated_at: now}).where('upload_id', '=', uploadId).execute()
    })
  }
}

export function toDto(row: any, publicApiUrl: string): AttachmentDto {
  const url = row.status === 'ready' ? `${publicApiUrl.replace(/\/+$/, '')}/v1/attachments/${row.attachment_id}/content` : undefined
  return {
    id: row.attachment_id, kind: row.kind, mimeType: row.mime_type, filename: row.original_filename,
    byteSize: Number(row.byte_size), checksum: row.checksum ?? undefined, status: row.status,
    width: row.width ?? undefined, height: row.height ?? undefined, duration: row.duration_seconds ?? undefined,
    pageCount: row.page_count ?? undefined, originalURL: url,
    previewURL: row.preview_key ? `${publicApiUrl.replace(/\/+$/, '')}/v1/attachments/${row.attachment_id}/preview` : undefined,
    thumbnailURL: row.thumbnail_key ? `${publicApiUrl.replace(/\/+$/, '')}/v1/attachments/${row.attachment_id}/thumbnail` : undefined,
  }
}

async function readPrefix(path: string, byteCount = 32): Promise<Buffer> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(byteCount)
    const result = await handle.read(buffer, 0, buffer.length, 0)
    return buffer.subarray(0, result.bytesRead)
  } finally {
    await handle.close()
  }
}

export function verifyAttachmentSignature(mime: string, bytes: Buffer): void {
  const ascii = bytes.toString('ascii')
  const hex = bytes.toString('hex')
  const isoBrand = ascii.slice(8, 12)
  const mp4VideoBrands = new Set(['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V '])
  const mp4AudioBrands = new Set(['M4A ', 'M4B ', 'isom', 'mp41', 'mp42'])
  const ok =
    (mime === 'image/jpeg' && hex.startsWith('ffd8ff')) ||
    (mime === 'image/png' && hex.startsWith('89504e470d0a1a0a')) ||
    (mime === 'image/webp' && ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') ||
    (mime === 'image/heic' && ascii.slice(4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(isoBrand)) ||
    (mime === 'video/mp4' && ascii.slice(4, 8) === 'ftyp' && mp4VideoBrands.has(isoBrand)) ||
    (mime === 'video/quicktime' && ascii.slice(4, 8) === 'ftyp' && isoBrand === 'qt  ') ||
    (mime === 'audio/mp4' && ascii.slice(4, 8) === 'ftyp' && mp4AudioBrands.has(isoBrand)) ||
    (mime === 'audio/mpeg' && (ascii.startsWith('ID3') || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0))) ||
    (mime === 'audio/wav' && ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE') ||
    (mime === 'application/pdf' && ascii.startsWith('%PDF-')) ||
    ((mime.includes('openxmlformats') || ['application/msword', 'application/vnd.ms-powerpoint', 'application/vnd.ms-excel'].includes(mime)) &&
      (hex.startsWith('504b0304') || hex.startsWith('d0cf11e0a1b11ae1'))) ||
    (mime === 'application/zip' && hex.startsWith('504b0304')) ||
    ((mime === 'text/rtf' || mime === 'application/rtf') && ascii.startsWith('{\\rtf')) ||
    (mime === 'text/plain' && !bytes.includes(0))
  if (!ok) throw domainError('Attachment bytes do not match declared MIME type', 'VALIDATION_FAILED')
}

/**
 * Extract image dimensions from the uploaded bytes rather than trusting client
 * metadata. The formats here cover every browser/native raster format whose
 * dimensions can be obtained without a platform codec. HEIC remains valid but
 * its dimensions stay unset until a media processor is available.
 */
export function inspectImageDimensions(mime: string, bytes: Buffer): {width: number; height: number} | null {
  if (mime === 'image/png' && bytes.length >= 24 && bytes.subarray(12, 16).toString('ascii') === 'IHDR') {
    return validDimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20))
  }
  if (mime === 'image/jpeg') {
    let offset = 2
    const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue }
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1
      const marker = bytes[offset]
      offset += 1
      if (marker === undefined || marker === 0xd9 || marker === 0xda) break
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      if (offset + 2 > bytes.length) break
      const length = bytes.readUInt16BE(offset)
      if (length < 2 || offset + length > bytes.length) break
      if (startOfFrame.has(marker) && length >= 7) {
        return validDimensions(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3))
      }
      offset += length
    }
  }
  if (mime === 'image/webp' && bytes.length >= 30) {
    const chunk = bytes.subarray(12, 16).toString('ascii')
    if (chunk === 'VP8X') {
      const width = 1 + bytes.readUIntLE(24, 3)
      const height = 1 + bytes.readUIntLE(27, 3)
      return validDimensions(width, height)
    }
    if (chunk === 'VP8 ' && bytes.subarray(23, 26).toString('hex') === '9d012a') {
      return validDimensions(bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff)
    }
    if (chunk === 'VP8L' && bytes[20] === 0x2f && bytes.length >= 25) {
      const width = 1 + (bytes[21] ?? 0) + (((bytes[22] ?? 0) & 0x3f) << 8)
      const height = 1 + (((bytes[22] ?? 0) & 0xc0) >> 6) + ((bytes[23] ?? 0) << 2) + (((bytes[24] ?? 0) & 0x0f) << 10)
      return validDimensions(width, height)
    }
  }
  return null
}

function validDimensions(width: number, height: number): {width: number; height: number} | null {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0 && width <= 100_000 && height <= 100_000
    ? {width, height}
    : null
}

function normalizeChecksum(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw domainError('Checksum must be SHA-256 hex', 'VALIDATION_FAILED')
  return value.toLowerCase()
}

function clientMetadata(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const output: Record<string, number> = {}
  for (const key of ['width', 'height', 'pageCount'] as const) {
    const candidate = source[key]
    if (typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate > 0) output[key] = candidate
  }
  if (typeof source.duration === 'number' && Number.isFinite(source.duration) && source.duration >= 0) {
    output.duration = source.duration
  }
  return output
}
