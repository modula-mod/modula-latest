import {randomUUID} from 'node:crypto'
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import type {CreatePostMediaInput} from '@modula/api-contracts'
import type {AppConfig} from '../../config/index.js'

const SUPPORTED_MEDIA = {
  'image/jpeg': {extension: 'jpg', contentType: 'image/jpeg'},
  'image/jpg': {extension: 'jpg', contentType: 'image/jpeg'},
  'image/png': {extension: 'png', contentType: 'image/png'},
  'image/webp': {extension: 'webp', contentType: 'image/webp'},
} as const

export type PersistedPostMedia = {
  id: string
  url: string
  title: string | null
  colour: string | null
  aspectRatio: string | null
  altText: string | null
  fileName: string
}

export type StoredPostMedia = {
  bytes: Buffer
  contentType: string
}

export class PostMediaStorage {
  constructor(private readonly config: AppConfig) {}

  async persistPostMedia(input: {
    postId: string
    media: CreatePostMediaInput[]
  }): Promise<PersistedPostMedia[]> {
    if (input.media.length === 0) return []
    if (input.media.length > 1) {
      throw Object.assign(new Error('Only one image attachment is supported in Founder Alpha'), {
        code: 'VALIDATION_FAILED',
      })
    }

    const directory = join(this.config.mediaRoot, 'posts')
    await mkdir(directory, {recursive: true})

    const persisted: PersistedPostMedia[] = []
    for (const [index, item] of input.media.entries()) {
      const definition = this.validateMedia(item)
      const id = randomUUID()
      const fileName = `${id}.${definition.extension}`
      const bytes = Buffer.from(item.base64, 'base64')
      await writeFile(join(directory, fileName), bytes, {flag: 'wx'})
      const aspectRatio =
        typeof item.width === 'number' &&
        Number.isFinite(item.width) &&
        item.width > 0 &&
        typeof item.height === 'number' &&
        Number.isFinite(item.height) &&
        item.height > 0
          ? String(item.width / item.height)
          : null
      persisted.push({
        id,
        url: `${this.config.publicApiUrl.replace(/\/+$/, '')}/v1/media/${fileName}`,
        title: input.media.length > 1 ? `Image ${index + 1}` : 'Published image',
        colour: null,
        aspectRatio,
        altText: boundedOptionalText(item.altText, 240),
        fileName,
      })
    }
    return persisted
  }

  async readPostMedia(fileName: string): Promise<StoredPostMedia | null> {
    const match = /^([0-9a-f-]{36})\.(jpg|png|webp)$/i.exec(fileName)
    if (!match) return null
    const extension = match[2]?.toLowerCase()
    if (!extension) return null
    const contentType =
      extension === 'jpg'
        ? 'image/jpeg'
        : extension === 'png'
          ? 'image/png'
          : 'image/webp'
    try {
      const bytes = await readFile(join(this.config.mediaRoot, 'posts', fileName))
      return {bytes, contentType}
    } catch {
      return null
    }
  }

  async removePersistedMedia(media: PersistedPostMedia[]): Promise<void> {
    await Promise.all(
      media.map(item =>
        rm(join(this.config.mediaRoot, 'posts', item.fileName), {force: true}).catch(() => undefined),
      ),
    )
  }

  private validateMedia(item: CreatePostMediaInput): (typeof SUPPORTED_MEDIA)[keyof typeof SUPPORTED_MEDIA] {
    if (item.kind !== 'image') {
      throw Object.assign(new Error('Only image media is supported'), {code: 'VALIDATION_FAILED'})
    }
    const mimeType = item.mimeType ?? 'image/jpeg'
    const definition = SUPPORTED_MEDIA[mimeType]
    if (!definition) {
      throw Object.assign(new Error('Unsupported image type'), {code: 'VALIDATION_FAILED'})
    }
    if (typeof item.base64 !== 'string' || item.base64.length < 1) {
      throw Object.assign(new Error('Image upload data is required'), {code: 'VALIDATION_FAILED'})
    }
    if (!/^[a-zA-Z0-9+/]+={0,2}$/.test(item.base64) || item.base64.length % 4 !== 0) {
      throw Object.assign(new Error('Invalid image upload data'), {code: 'VALIDATION_FAILED'})
    }
    const byteLength = Buffer.byteLength(item.base64, 'base64')
    if (byteLength < 1 || byteLength > this.config.mediaUploadMaxBytes) {
      throw Object.assign(new Error('Image upload is too large'), {code: 'VALIDATION_FAILED'})
    }
    return definition
  }
}

function boundedOptionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  if (text.length > maxLength) {
    throw Object.assign(new Error('Media text is too long'), {code: 'VALIDATION_FAILED'})
  }
  return text
}
