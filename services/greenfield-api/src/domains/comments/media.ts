import type {ModulaDb} from '../../database/client.js'
import {sql} from 'kysely'

import {findSticker} from './stickers.js'

/** Stored comment media item. Attachments go through the attachment pipeline; GIFs come from the GIF proxy. */
export type CommentMediaItem =
  | {type: 'attachment'; attachmentId: string; kind: 'image' | 'video' | 'audio' | 'pdf' | 'document'; mimeType: string; width: number | null; height: number | null;
     fileName?: string; byteSize?: number; voice?: {durationMs: number; waveform: number[]}}
  | {type: 'gif'; provider: 'giphy'; id: string; url: string; previewUrl: string | null; width: number | null; height: number | null; title: string | null}
  | {type: 'sticker'; packId: string; stickerId: string; emoji: string; label: string}
  | {type: 'poll'; question: string; options: string[]; closesAt: string | null}
  | {type: 'location'; latitude: number; longitude: number; name: string | null}

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
        .select(['attachment_id', 'owner_account_id', 'kind', 'mime_type', 'status', 'attached_at', 'width', 'height', 'original_filename', 'byte_size'])
        .where('attachment_id', '=', entry.attachmentId)
        .executeTakeFirst()
      if (!row || row.owner_account_id !== accountId) throw invalid('Attachment not found')
      if (row.status !== 'ready') throw invalid('Attachment is not ready')
      if (row.attached_at) throw invalid('Attachment is already bound')
      if (row.kind === 'unknown') throw invalid('Unsupported attachment type')
      const item: CommentMediaItem = {type: 'attachment', attachmentId: row.attachment_id, kind: row.kind, mimeType: row.mime_type, width: row.width, height: row.height}
      if (row.kind === 'audio' || row.kind === 'pdf' || row.kind === 'document') {
        item.fileName = String(row.original_filename ?? 'file').slice(0, 200)
        item.byteSize = Number(row.byte_size) || undefined
      }
      if (row.kind === 'audio' && entry.voice && typeof entry.voice === 'object') {
        const durationMs = Number(entry.voice.durationMs)
        const waveform = Array.isArray(entry.voice.waveform) ? entry.voice.waveform.slice(0, 64).map((v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)))) : []
        if (Number.isFinite(durationMs) && durationMs > 0 && durationMs <= 15 * 60_000) item.voice = {durationMs: Math.round(durationMs), waveform}
      }
      items.push(item)
    } else if (entry?.type === 'gif') {
      const url = httpsUrl(entry.url, GIF_HOST)
      if (!url || typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(entry.id)) throw invalid('Invalid GIF')
      items.push({
        type: 'gif', provider: 'giphy', id: entry.id, url,
        previewUrl: httpsUrl(entry.previewUrl, GIF_HOST),
        width: dimension(entry.width), height: dimension(entry.height),
        title: typeof entry.title === 'string' ? entry.title.slice(0, 140) : null,
      })
    } else if (entry?.type === 'sticker') {
      const found = findSticker(entry.stickerId)
      if (!found) throw invalid('Unknown sticker')
      items.push({type: 'sticker', packId: found.pack.id, stickerId: found.sticker.id, emoji: found.sticker.emoji, label: found.sticker.label})
    } else if (entry?.type === 'poll') {
      const question = typeof entry.question === 'string' ? entry.question.trim().slice(0, 200) : ''
      const options = Array.isArray(entry.options) ? entry.options.map((o: unknown) => typeof o === 'string' ? o.trim().slice(0, 80) : '').filter(Boolean) : []
      if (!question || options.length < 2 || options.length > 4 || new Set(options.map((o: string) => o.toLowerCase())).size !== options.length) throw invalid('Polls need a question and 2-4 distinct options')
      const hours = Number(entry.durationHours)
      const closesAt = Number.isFinite(hours) && hours > 0 ? new Date(Date.now() + Math.min(hours, 24 * 7) * 3_600_000).toISOString() : null
      items.push({type: 'poll', question, options, closesAt})
    } else if (entry?.type === 'location') {
      const latitude = Number(entry.latitude), longitude = Number(entry.longitude)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw invalid('Invalid location')
      items.push({type: 'location', latitude: Math.round(latitude * 1e5) / 1e5, longitude: Math.round(longitude * 1e5) / 1e5, name: typeof entry.name === 'string' ? entry.name.trim().slice(0, 120) || null : null})
    } else {
      throw invalid('Unsupported media item')
    }
  }
  if (new Set(items.filter(i => i.type === 'attachment').map(i => (i as any).attachmentId)).size !== items.filter(i => i.type === 'attachment').length) {
    throw invalid('Duplicate attachment')
  }
  if (items.filter(i => i.type === 'poll').length > 1 || items.filter(i => i.type === 'location').length > 1) throw invalid('One poll and one location per comment')
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

export function commentAttachmentIds(media: unknown): string[] {
  if (!Array.isArray(media)) return []
  return [...new Set(media.flatMap((item: any) => item?.type === 'attachment' && typeof item.attachmentId === 'string'
    ? [item.attachmentId]
    : []))]
}

/** Expires comment-owned media only when no other live binding still refers to it. */
export async function expireUnreferencedCommentAttachments(
  db: ModulaDb,
  attachmentIds: string[],
  commentId: string,
  now: Date,
): Promise<number> {
  let expired = 0
  for (const attachmentId of attachmentIds) {
    const [post, profile, story, moduleRecord, comment] = await Promise.all([
      db.selectFrom('post_content').select('content_id').where('attachment_id', '=', attachmentId).executeTakeFirst(),
      db.selectFrom('profile_media').select('profile_id').where('attachment_id', '=', attachmentId).executeTakeFirst(),
      db.selectFrom('greenfield_story_items').select('item_id').where('attachment_id', '=', attachmentId).executeTakeFirst(),
      db.selectFrom('greenfield_module_record_media_bindings').select('binding_id').where('asset_id', '=', attachmentId).executeTakeFirst(),
      db.selectFrom('greenfield_comments').select('comment_id')
        .where('comment_id', '!=', commentId).where('deleted_at', 'is', null)
        .where(sql<boolean>`media @> ${JSON.stringify([{type: 'attachment', attachmentId}])}::jsonb`)
        .executeTakeFirst(),
    ])
    if (post || profile || story || moduleRecord || comment) continue
    const updated = await db.updateTable('attachments').set({status: 'expired', attached_at: null, updated_at: now})
      .where('attachment_id', '=', attachmentId).where('attached_at', 'is not', null).executeTakeFirst()
    expired += Number(updated.numUpdatedRows ?? 0)
  }
  return expired
}
