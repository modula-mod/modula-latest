import type {AttachmentKind} from '@modula/api-contracts'

export type AttachmentDefinition = {
  kind: Exclude<AttachmentKind, 'unknown'>
  mimeType: string
  extension: string
  maxBytes: number
}

const MiB = 1024 * 1024

// Conservative filesystem-provider limits. These are server-authoritative and
// can move to configuration when object storage is introduced.
const definitions: AttachmentDefinition[] = [
  {kind: 'image', mimeType: 'image/jpeg', extension: 'jpg', maxBytes: 20 * MiB},
  {kind: 'image', mimeType: 'image/png', extension: 'png', maxBytes: 20 * MiB},
  {kind: 'image', mimeType: 'image/webp', extension: 'webp', maxBytes: 20 * MiB},
  {kind: 'image', mimeType: 'image/heic', extension: 'heic', maxBytes: 20 * MiB},
  {kind: 'video', mimeType: 'video/mp4', extension: 'mp4', maxBytes: 100 * MiB},
  {kind: 'video', mimeType: 'video/quicktime', extension: 'mov', maxBytes: 100 * MiB},
  {kind: 'audio', mimeType: 'audio/mpeg', extension: 'mp3', maxBytes: 50 * MiB},
  {kind: 'audio', mimeType: 'audio/mp4', extension: 'm4a', maxBytes: 50 * MiB},
  {kind: 'audio', mimeType: 'audio/wav', extension: 'wav', maxBytes: 50 * MiB},
  {kind: 'pdf', mimeType: 'application/pdf', extension: 'pdf', maxBytes: 50 * MiB},
  {kind: 'document', mimeType: 'text/plain', extension: 'txt', maxBytes: 25 * MiB},
  {kind: 'document', mimeType: 'text/rtf', extension: 'rtf', maxBytes: 25 * MiB},
  {kind: 'document', mimeType: 'application/rtf', extension: 'rtf', maxBytes: 25 * MiB},
  {kind: 'document', mimeType: 'application/msword', extension: 'doc', maxBytes: 25 * MiB},
  {kind: 'document', mimeType: 'application/vnd.ms-powerpoint', extension: 'ppt', maxBytes: 25 * MiB},
  {kind: 'document', mimeType: 'application/vnd.ms-excel', extension: 'xls', maxBytes: 25 * MiB},
  {kind: 'document', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx', maxBytes: 25 * MiB},
  {kind: 'document', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: 'pptx', maxBytes: 25 * MiB},
  {kind: 'document', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx', maxBytes: 25 * MiB},
  {kind: 'document', mimeType: 'application/zip', extension: 'zip', maxBytes: 25 * MiB},
]

export class AttachmentPolicy {
  static readonly uploadSessionTtlMs = 30 * 60 * 1000
  static readonly orphanRetentionMs = 7 * 24 * 60 * 60 * 1000
  static readonly absoluteMaxBytes = 100 * MiB

  static definition(mimeType: string): AttachmentDefinition {
    const normalized = mimeType.toLowerCase().split(';', 1)[0]?.trim() ?? ''
    const found = definitions.find(item => item.mimeType === normalized)
    if (!found) throw domainError('Unsupported attachment type', 'VALIDATION_FAILED')
    return found
  }

  static validateSize(definition: AttachmentDefinition, size: number): void {
    if (!Number.isSafeInteger(size) || size < 1 || size > definition.maxBytes || size > this.absoluteMaxBytes) {
      throw domainError(`Attachment exceeds the ${definition.kind} upload limit`, 'VALIDATION_FAILED')
    }
  }

  static safeFilename(value: string): string {
    const leaf = value.replace(/\\/g, '/').split('/').pop()?.trim() ?? ''
    const cleaned = leaf.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 240)
    if (!cleaned || cleaned === '.' || cleaned === '..') throw domainError('Valid filename required', 'VALIDATION_FAILED')
    return cleaned
  }
}

export function domainError(message: string, code: 'VALIDATION_FAILED' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT') {
  return Object.assign(new Error(message), {code})
}
