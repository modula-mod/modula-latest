import type {ModulaDb} from '../../database/client.js'

/** Stored comment media item. Attachments go through the attachment pipeline; GIFs come from the GIF proxy. */
export type CommentMediaItem =
  | {type: 'attachment'; attachmentId: string; kind: 'image' | 'video'; mimeType: string; width: number | null; height: number | null}
  | {type: 'gif'; provider: 'giphy'; id: string; url: string; previewUrl: string | null; width: number | null; height: number | null; title: string | null}

const MAX_ITEMS = 4
const GIF_HOST = /^(media\d*|i)\.giphy\.com$/

const invalid = (message: string) => Object.assign(new Error(message), {code: 'VALIDATION_FAILED'})

function httpsUrl(value: unknown, hostPattern: RegExp): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !hostPattern.test(url.hostname) || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

const dimension = (value: unknown) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 && n <= 10000 ? n : null
}

/** Validates client-supplied media. Attachments must be ready, owned by the author, and image/video. */
export async function normalizeCommentMedia(db: ModulaDb, accountId: string, raw: unknown): Promise<CommentMediaItem[]> {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw) || raw.length > MAX_ITEMS) throw invalid(`Up to ${MAX_ITEMS} media items per comment`)
  const items: CommentMediaItem[] = []
  for (const entry of raw as any[]) {
    if (entry?.type === 'attachment' && typeof entry.attachmentId === 'string') {
      const row = await db.selectFrom('attachments')
        .select(['attachment_id', 'owner_account_id', 'kind', 'mime_type', 'status', 'width', 'height'])
        .where('attachment_id', '=', entry.attachmentId)
        .executeTakeFirst()
      if (!row || row.owner_account_id !== accountId) throw invalid('Attachment not found')
      if (row.status !== 'ready') throw invalid('Attachment is not ready')
      if (row.kind !== 'image' && row.kind !== 'video') throw invalid('Only photos and videos can be added to comments')
      items.push({type: 'attachment', attachmentId: row.attachment_id, kind: row.kind, mimeType: row.mime_type, width: row.width, height: row.height})
    } else if (entry?.type === 'gif') {
      const url = httpsUrl(entry.url, GIF_HOST)
      if (!url || typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(entry.id)) throw invalid('Invalid GIF')
      items.push({
        type: 'gif', provider: 'giphy', id: entry.id, url,
        previewUrl: httpsUrl(entry.previewUrl, GIF_HOST),
        width: dimension(entry.width), height: dimension(entry.height),
        title: typeof entry.title === 'string' ? entry.title.slice(0, 140) : null,
      })
    } else {
      throw invalid('Unsupported media item')
    }
  }
  if (new Set(items.filter(i => i.type === 'attachment').map(i => (i as any).attachmentId)).size !== items.filter(i => i.type === 'attachment').length) {
    throw invalid('Duplicate attachment')
  }
  return items
}

/** Adds absolute content URLs for attachments when serialising a comment. */
export function presentCommentMedia(publicApiUrl: string | undefined, media: unknown) {
  if (!Array.isArray(media)) return []
  const base = (publicApiUrl ?? '').replace(/\/+$/, '')
  return media.map((item: any) => item?.type === 'attachment'
    ? {...item, url: `${base}/v1/attachments/${item.attachmentId}/content`}
    : item)
}
