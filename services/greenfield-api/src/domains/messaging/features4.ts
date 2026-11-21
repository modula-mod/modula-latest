import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'

import type {ModulaDb} from '../../database/client.js'
import {MESSAGE_MAX, MessagingService, type ParticipantDto} from './service.js'

/**
 * Messaging features 4 (migration 093): pinned messages, saved messages,
 * edit history, scheduled messages, disappearing messages, synced chat
 * folders and pins, notification levels, quick replies, forwarding and chat
 * themes. Every method runs the same membership gate as the core routes
 * (non-members get 404) and respects blocks the way listMessages does.
 */

export const PINNED_MESSAGES_MAX = 10
export const CHAT_PINS_MAX = 10
export const CHAT_FOLDERS_MAX = 20
export const CHAT_FOLDER_ITEMS_MAX = 200
export const CHAT_FOLDER_NAME_MAX = 32
export const QUICK_REPLIES_MAX = 50
export const QUICK_REPLY_BODY_MAX = 1000
export const FORWARD_TARGETS_MAX = 5
export const SCHEDULED_PENDING_MAX = 50
export const SCHEDULE_MIN_LEAD_MS = 10_000
export const SCHEDULE_MAX_LEAD_MS = 365 * 24 * 60 * 60 * 1000
export const DISAPPEARING_TTL_OPTIONS = [3600, 86400, 604800, 7776000] as const
export const CHAT_THEMES = ['default', 'coral', 'ocean', 'forest', 'sunset', 'midnight', 'lavender', 'mono'] as const
export const NOTIFICATION_LEVELS = ['all', 'mentions', 'none'] as const

type Code = 'VALIDATION_FAILED' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT'
function fail(code: Code, message: string, reason?: string): never {
  throw Object.assign(new Error(message), {code, ...(reason ? {details: {reason}} : {})})
}

const live = (eb: any, column = 'expires_at') => eb.or([eb(column, 'is', null), eb(column, '>', new Date())])

export type MessagePreviewLiteDto = {id: string; conversationId: string; body: string; kind: string; sentAt: string; sender: ParticipantDto}
export type PinnedMessageDto = {messageId: string; pinnedAt: string; pinnedBy: ParticipantDto | null; message: MessagePreviewLiteDto}
export type SavedMessageDto = {messageId: string; conversationId: string; savedAt: string; message: MessagePreviewLiteDto}
export type ScheduledMessageDto = {
  id: string; conversationId: string; text: string; replyToMessageId: string | null; sendAt: string
  state: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'; sentMessageId: string | null; failureReason: string | null
  createdAt: string; updatedAt: string
}
export type ChatFolderDto = {id: string; name: string; emoji: string | null; sortOrder: number; conversationIds: string[]; updatedAt: string}
export type QuickReplyDto = {id: string; shortcut: string; text: string; updatedAt: string}

function encodeCursor(at: Date, id: string) {
  return Buffer.from(`${at.toISOString()}|${id}`, 'utf8').toString('base64url')
}
function decodeCursor(raw: unknown): {at: Date; id: string} | null {
  if (typeof raw !== 'string' || !raw || raw.length > 200) return null
  const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|')
  const at = new Date(iso ?? '')
  return id && !Number.isNaN(at.getTime()) ? {at, id} : null
}
function clampLimit(raw: unknown, fallback: number, max: number) {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : typeof raw === 'number' ? raw : Number.NaN
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), max) : fallback
}
function text(raw: unknown, max: number, label: string): string {
  if (typeof raw !== 'string') fail('VALIDATION_FAILED', `${label} is required`)
  const value = raw.trim()
  if (!value || value.length > max) fail('VALIDATION_FAILED', `${label} must be 1-${max} characters`)
  return value
}
function scheduledDto(row: any): ScheduledMessageDto {
  return {
    id: row.scheduled_id, conversationId: row.conversation_id, text: row.body, replyToMessageId: row.reply_to_message_id,
    sendAt: row.send_at.toISOString(), state: row.state, sentMessageId: row.sent_message_id, failureReason: row.failure_reason,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
  }
}

export class MessagingFeaturesService extends MessagingService {
  constructor(private readonly fdb: ModulaDb, options: {publicApiUrl?: string} = {}) {
    super(fdb, options)
  }

  /** Active chat membership (pending requests and In-Mail are excluded). */
  private async activeChat(viewer: string, conversationId: string) {
    const member = await this.membership(conversationId, viewer, 'chat')
    if (member.state !== 'active') fail('NOT_FOUND', 'Conversation not found')
    return member
  }

  /** A live, unexpired message the viewer may see (group blocks hide senders). */
  private async visibleMessage(viewer: string, conversationId: string, messageId: string) {
    const {member, row} = await this.liveMessage(viewer, conversationId, messageId)
    if (member.state !== 'active') fail('NOT_FOUND', 'Message not found')
    if ((row as any).expires_at && (row as any).expires_at <= new Date()) fail('NOT_FOUND', 'Message not found')
    if (member.kind === 'group' && row.sender_actor_id !== viewer && (await this.blockedSet(viewer)).has(row.sender_actor_id)) {
      fail('NOT_FOUND', 'Message not found')
    }
    return {member, row}
  }

  /** Shared conversation settings: any active member in a DM, owner/admin in a group. */
  private async canManageShared(viewer: string, conversationId: string) {
    const member = await this.activeChat(viewer, conversationId)
    if (member.kind === 'group' && member.role !== 'owner' && member.role !== 'admin') {
      fail('FORBIDDEN', 'Only group admins can change this', 'admin-required')
    }
    return member
  }

  private async previews(viewer: string, rows: {message_id: string; conversation_id: string; body: string; message_kind: string; created_at: Date; sender_actor_id: string}[]) {
    const people = await this.participants([...new Set(rows.map(r => r.sender_actor_id))])
    const map = new Map<string, MessagePreviewLiteDto>()
    for (const r of rows) {
      map.set(r.message_id, {
        id: r.message_id, conversationId: r.conversation_id, body: r.body, kind: r.message_kind, sentAt: r.created_at.toISOString(),
        sender: people.get(r.sender_actor_id) ?? {id: r.sender_actor_id, handle: '', displayName: 'Member', avatarUrl: null} as ParticipantDto,
      })
    }
    void viewer
    return map
  }

  // ---- pinned messages -------------------------------------------------------

  async pinMessage(viewer: string, conversationId: string, messageId: string, pinned: boolean) {
    const member = await this.activeChat(viewer, conversationId)
    if (member.kind === 'group' && member.role !== 'owner' && member.role !== 'admin') {
      fail('FORBIDDEN', 'Only group admins can pin messages', 'admin-required')
    }
    if (!pinned) {
      const result = await this.fdb.deleteFrom('greenfield_message_pins').where('conversation_id', '=', conversationId).where('message_id', '=', messageId).executeTakeFirst()
      return {messageId, pinned: false, changed: Number(result.numDeletedRows) > 0}
    }
    await this.visibleMessage(viewer, conversationId, messageId)
    const changed = await this.fdb.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`message-pins:${conversationId}`}))`.execute(trx)
      const existing = await trx.selectFrom('greenfield_message_pins').select('message_id').where('conversation_id', '=', conversationId).execute()
      if (existing.some(r => r.message_id === messageId)) return false
      if (existing.length >= PINNED_MESSAGES_MAX) fail('CONFLICT', 'Pinned message limit reached', 'pin-limit')
      await trx.insertInto('greenfield_message_pins').values({conversation_id: conversationId, message_id: messageId, pinned_by_actor_id: viewer, pinned_at: new Date()}).execute()
      return true
    })
    return {messageId, pinned: true, changed}
  }

  async listPins(viewer: string, conversationId: string): Promise<{items: PinnedMessageDto[]}> {
    const member = await this.activeChat(viewer, conversationId)
    const hidden = member.kind === 'group' ? [...await this.blockedSet(viewer)] : []
    let query = this.fdb.selectFrom('greenfield_message_pins as p')
      .innerJoin('greenfield_conversation_messages as m', 'm.message_id', 'p.message_id')
      .select(['p.message_id', 'p.pinned_at', 'p.pinned_by_actor_id', 'm.conversation_id', 'm.body', 'm.message_kind', 'm.created_at', 'm.sender_actor_id'])
      .where('p.conversation_id', '=', conversationId)
      .where('m.deleted_at', 'is', null)
      .where(eb => live(eb, 'm.expires_at'))
    if (hidden.length) query = query.where('m.sender_actor_id', 'not in', hidden)
    const rows = await query.orderBy('p.pinned_at', 'desc').execute()
    const [previews, people] = await Promise.all([this.previews(viewer, rows), this.participants(rows.map(r => r.pinned_by_actor_id))])
    return {items: rows.map(r => ({messageId: r.message_id, pinnedAt: r.pinned_at.toISOString(), pinnedBy: people.get(r.pinned_by_actor_id) ?? null, message: previews.get(r.message_id)!}))}
  }

  // ---- saved messages --------------------------------------------------------

  async saveMessage(viewer: string, conversationId: string, messageId: string, saved: boolean) {
    if (!saved) {
      const result = await this.fdb.deleteFrom('greenfield_saved_messages').where('actor_id', '=', viewer).where('message_id', '=', messageId).executeTakeFirst()
      return {messageId, saved: false, changed: Number(result.numDeletedRows) > 0}
    }
    await this.visibleMessage(viewer, conversationId, messageId)
    const result = await this.fdb.insertInto('greenfield_saved_messages')
      .values({actor_id: viewer, message_id: messageId, conversation_id: conversationId, saved_at: new Date()})
      .onConflict(oc => oc.columns(['actor_id', 'message_id']).doNothing()).returning('message_id').executeTakeFirst()
    return {messageId, saved: true, changed: Boolean(result)}
  }

  /** Saved messages the viewer can still see: active membership, live message, no block with the sender. */
  async listSaved(viewer: string, cursorRaw: unknown, limitRaw: unknown) {
    const limit = clampLimit(limitRaw, 30, 100)
    const cursor = decodeCursor(cursorRaw)
    const blocked = [...await this.blockedSet(viewer)]
    let query = this.fdb.selectFrom('greenfield_saved_messages as s')
      .innerJoin('greenfield_conversation_messages as m', 'm.message_id', 's.message_id')
      .innerJoin('greenfield_conversation_members as cm', join => join.onRef('cm.conversation_id', '=', 's.conversation_id').on('cm.actor_id', '=', viewer))
      .select(['s.message_id', 's.saved_at', 'm.conversation_id', 'm.body', 'm.message_kind', 'm.created_at', 'm.sender_actor_id'])
      .where('s.actor_id', '=', viewer)
      .where('cm.state', '=', 'active')
      .where('m.deleted_at', 'is', null)
      .where(eb => live(eb, 'm.expires_at'))
    if (blocked.length) query = query.where('m.sender_actor_id', 'not in', blocked)
    if (cursor) {
      query = query.where(eb => eb.or([eb('s.saved_at', '<', cursor.at), eb.and([eb('s.saved_at', '=', cursor.at), eb('s.message_id', '<', cursor.id)])]))
    }
    const rows = await query.orderBy('s.saved_at', 'desc').orderBy('s.message_id', 'desc').limit(limit + 1).execute()
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)
    const previews = await this.previews(viewer, page)
    const last = page.at(-1)
    return {
      items: page.map(r => ({messageId: r.message_id, conversationId: r.conversation_id, savedAt: r.saved_at.toISOString(), message: previews.get(r.message_id)!})),
      nextCursor: hasMore && last ? encodeCursor(last.saved_at, last.message_id) : null,
      hasMore,
    }
  }

  // ---- edit history ----------------------------------------------------------

  async editHistory(viewer: string, conversationId: string, messageId: string) {
    const {row} = await this.visibleMessage(viewer, conversationId, messageId)
    const edits = await this.fdb.selectFrom('greenfield_message_edits').select(['previous_body', 'edited_at'])
      .where('message_id', '=', messageId).orderBy('edited_at', 'asc').orderBy('edit_id', 'asc').execute()
    // versions[i] was the text from (i === 0 ? sentAt : edits[i-1].editedAt) until edits[i].editedAt.
    return {
      messageId,
      current: {text: row.body, editedAt: row.edited_at ? row.edited_at.toISOString() : null},
      versions: edits.map(e => ({text: e.previous_body, replacedAt: e.edited_at.toISOString()})),
    }
  }

  // ---- scheduled messages ----------------------------------------------------

  private parseSendAt(raw: unknown): Date {
    if (typeof raw !== 'string') fail('VALIDATION_FAILED', 'sendAt must be an ISO-8601 timestamp')
    const at = new Date(raw)
    if (Number.isNaN(at.getTime())) fail('VALIDATION_FAILED', 'sendAt must be an ISO-8601 timestamp')
    const lead = at.getTime() - Date.now()
    if (lead < SCHEDULE_MIN_LEAD_MS) fail('VALIDATION_FAILED', 'sendAt must be at least 10 seconds in the future', 'too-soon')
    if (lead > SCHEDULE_MAX_LEAD_MS) fail('VALIDATION_FAILED', 'sendAt must be within one year', 'too-far')
    return at
  }

  private async replyTarget(conversationId: string, raw: unknown): Promise<string | null> {
    if (raw === undefined || raw === null || raw === '') return null
    if (typeof raw !== 'string' || raw.length > 64) fail('VALIDATION_FAILED', 'Reply target not found')
    const parent = await this.fdb.selectFrom('greenfield_conversation_messages').select('message_id')
      .where('message_id', '=', raw).where('conversation_id', '=', conversationId).executeTakeFirst()
    if (!parent) fail('VALIDATION_FAILED', 'Reply target not found')
    return parent.message_id
  }

  async schedule(viewer: string, conversationId: string, input: {text?: unknown; sendAt?: unknown; replyToMessageId?: unknown}) {
    await this.activeChat(viewer, conversationId)
    const body = text(input.text, MESSAGE_MAX, 'Message')
    const sendAt = this.parseSendAt(input.sendAt)
    const replyTo = await this.replyTarget(conversationId, input.replyToMessageId)
    const id = randomUUID()
    const now = new Date()
    await this.fdb.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`scheduled:${viewer}`}))`.execute(trx)
      const pending = await trx.selectFrom('greenfield_scheduled_messages').select(eb => eb.fn.countAll<number>().as('count'))
        .where('sender_actor_id', '=', viewer).where('state', '=', 'pending').executeTakeFirst()
      if (Number(pending?.count ?? 0) >= SCHEDULED_PENDING_MAX) fail('CONFLICT', 'Too many scheduled messages', 'scheduled-limit')
      await trx.insertInto('greenfield_scheduled_messages').values({
        scheduled_id: id, conversation_id: conversationId, sender_actor_id: viewer, body, reply_to_message_id: replyTo,
        send_at: sendAt, state: 'pending', attempts: 0, created_at: now, updated_at: now,
      }).execute()
    })
    return this.getScheduled(viewer, id)
  }

  async getScheduled(viewer: string, scheduledId: string): Promise<ScheduledMessageDto> {
    const row = await this.fdb.selectFrom('greenfield_scheduled_messages').selectAll()
      .where('scheduled_id', '=', scheduledId).where('sender_actor_id', '=', viewer).executeTakeFirst()
    if (!row) fail('NOT_FOUND', 'Scheduled message not found')
    return scheduledDto(row)
  }

  async listScheduled(viewer: string, conversationId: string | null) {
    let query = this.fdb.selectFrom('greenfield_scheduled_messages').selectAll()
      .where('sender_actor_id', '=', viewer).where('state', 'in', ['pending', 'sending', 'failed'])
    if (conversationId) {
      await this.activeChat(viewer, conversationId)
      query = query.where('conversation_id', '=', conversationId)
    }
    const rows = await query.orderBy('send_at', 'asc').limit(SCHEDULED_PENDING_MAX * 2).execute()
    return {items: rows.map(scheduledDto)}
  }

  async updateScheduled(viewer: string, scheduledId: string, input: {text?: unknown; sendAt?: unknown}) {
    const current = await this.getScheduled(viewer, scheduledId)
    if (current.state !== 'pending' && current.state !== 'failed') fail('CONFLICT', 'This message can no longer be changed', 'not-pending')
    if (input.text === undefined && input.sendAt === undefined) fail('VALIDATION_FAILED', 'Nothing to update')
    const set: Record<string, unknown> = {updated_at: new Date(), state: 'pending', failure_reason: null}
    if (input.text !== undefined) set.body = text(input.text, MESSAGE_MAX, 'Message')
    if (input.sendAt !== undefined) set.send_at = this.parseSendAt(input.sendAt)
    else if (current.state === 'failed') set.send_at = new Date(Math.max(Date.parse(current.sendAt), Date.now()))
    const result = await this.fdb.updateTable('greenfield_scheduled_messages').set(set as any)
      .where('scheduled_id', '=', scheduledId).where('sender_actor_id', '=', viewer).where('state', 'in', ['pending', 'failed']).executeTakeFirst()
    if (Number(result.numUpdatedRows) === 0) fail('CONFLICT', 'This message can no longer be changed', 'not-pending')
    return this.getScheduled(viewer, scheduledId)
  }

  async cancelScheduled(viewer: string, scheduledId: string) {
    const result = await this.fdb.updateTable('greenfield_scheduled_messages').set({state: 'cancelled', updated_at: new Date()})
      .where('scheduled_id', '=', scheduledId).where('sender_actor_id', '=', viewer).where('state', 'in', ['pending', 'failed']).executeTakeFirst()
    if (Number(result.numUpdatedRows) === 0) {
      await this.getScheduled(viewer, scheduledId)
      fail('CONFLICT', 'This message can no longer be cancelled', 'not-pending')
    }
    return this.getScheduled(viewer, scheduledId)
  }

  /** Make a pending message due now; the dispatcher (or the caller) sends it. */
  async makeDueNow(viewer: string, scheduledId: string) {
    const result = await this.fdb.updateTable('greenfield_scheduled_messages').set({send_at: new Date(), updated_at: new Date()})
      .where('scheduled_id', '=', scheduledId).where('sender_actor_id', '=', viewer).where('state', '=', 'pending').executeTakeFirst()
    if (Number(result.numUpdatedRows) === 0) {
      await this.getScheduled(viewer, scheduledId)
      fail('CONFLICT', 'This message is not pending', 'not-pending')
    }
  }

  /**
   * Claim due rows (SKIP LOCKED, safe with several API processes). Rows stuck
   * in `sending` for 5 minutes are re-claimed; delivery is idempotent through
   * clientMessageId `sched-<id>`.
   */
  async claimDue(limit = 20, onlyId?: string) {
    const stale = new Date(Date.now() - 5 * 60 * 1000)
    const result = await sql<any>`
      UPDATE greenfield_scheduled_messages SET state = 'sending', attempts = attempts + 1, updated_at = NOW()
      WHERE scheduled_id IN (
        SELECT scheduled_id FROM greenfield_scheduled_messages
        WHERE ((state = 'pending' AND send_at <= NOW()) OR (state = 'sending' AND updated_at < ${stale}))
          ${onlyId ? sql`AND scheduled_id = ${onlyId}` : sql``}
        ORDER BY send_at FOR UPDATE SKIP LOCKED LIMIT ${limit}
      )
      RETURNING *`.execute(this.fdb)
    return result.rows
  }

  async finishScheduled(scheduledId: string, outcome: {messageId: string} | {failure: string}) {
    await this.fdb.updateTable('greenfield_scheduled_messages')
      .set('messageId' in outcome
        ? {state: 'sent', sent_message_id: outcome.messageId, failure_reason: null, updated_at: new Date()}
        : {state: 'failed', failure_reason: outcome.failure.slice(0, 80), updated_at: new Date()})
      .where('scheduled_id', '=', scheduledId).execute()
  }

  // ---- disappearing messages -------------------------------------------------

  async setDisappearing(viewer: string, conversationId: string, raw: unknown) {
    await this.canManageShared(viewer, conversationId)
    const ttl = raw === null || raw === 0 ? null : raw
    if (ttl !== null && !(DISAPPEARING_TTL_OPTIONS as readonly unknown[]).includes(ttl)) {
      fail('VALIDATION_FAILED', `ttlSeconds must be null or one of ${DISAPPEARING_TTL_OPTIONS.join(', ')}`)
    }
    await this.fdb.updateTable('greenfield_conversations').set({disappearing_ttl_seconds: ttl as number | null, updated_at: new Date()})
      .where('conversation_id', '=', conversationId).execute()
    return {ttlSeconds: ttl as number | null}
  }

  /** Wipe expired messages server-side (text, reactions, pins, saves, history, attachment access). */
  async sweepExpired(limit = 500): Promise<{conversationId: string; messageIds: string[]}[]> {
    const now = new Date()
    return this.fdb.transaction().execute(async trx => {
      const rows = await trx.selectFrom('greenfield_conversation_messages').select(['message_id', 'conversation_id'])
        .where('expires_at', '<=', now).where('deleted_at', 'is', null)
        .orderBy('expires_at').limit(limit).forUpdate().skipLocked().execute()
      if (rows.length === 0) return []
      const ids = rows.map(r => r.message_id)
      await trx.updateTable('greenfield_conversation_messages').set({body: '-', deleted_at: now, edited_at: null}).where('message_id', 'in', ids).execute()
      for (const table of ['greenfield_message_reactions', 'greenfield_message_edits', 'greenfield_message_pins', 'greenfield_saved_messages'] as const) {
        await trx.deleteFrom(table).where('message_id', 'in', ids).execute()
      }
      // Attachment access is already denied once the message has deleted_at (canViewMessageAttachment).
      const grouped = new Map<string, string[]>()
      for (const r of rows) grouped.set(r.conversation_id, [...(grouped.get(r.conversation_id) ?? []), r.message_id])
      return [...grouped.entries()].map(([conversationId, messageIds]) => ({conversationId, messageIds}))
    })
  }

  // ---- themes ----------------------------------------------------------------

  async setTheme(viewer: string, conversationId: string, raw: unknown) {
    await this.canManageShared(viewer, conversationId)
    const theme = raw === null || raw === 'default' ? null : raw
    if (theme !== null && !(CHAT_THEMES as readonly unknown[]).includes(theme)) fail('VALIDATION_FAILED', 'Unknown theme')
    await this.fdb.updateTable('greenfield_conversations').set({theme: theme as string | null, updated_at: new Date()})
      .where('conversation_id', '=', conversationId).execute()
    return {theme: theme as string | null}
  }

  // ---- per-member chat pins and notification levels -------------------------

  async pinChat(viewer: string, conversationId: string, pinned: boolean) {
    await this.activeChat(viewer, conversationId)
    const now = new Date()
    return this.fdb.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`chat-pins:${viewer}`}))`.execute(trx)
      if (pinned) {
        const count = await trx.selectFrom('greenfield_conversation_members').select(eb => eb.fn.countAll<number>().as('count'))
          .where('actor_id', '=', viewer).where('pinned_at', 'is not', null).where('conversation_id', '!=', conversationId).executeTakeFirst()
        if (Number(count?.count ?? 0) >= CHAT_PINS_MAX) fail('CONFLICT', 'Pinned chat limit reached', 'pin-limit')
      }
      const current = await trx.selectFrom('greenfield_conversation_members').select('pinned_at')
        .where('conversation_id', '=', conversationId).where('actor_id', '=', viewer).executeTakeFirstOrThrow()
      const pinnedAt = pinned ? (current.pinned_at ?? now) : null
      await trx.updateTable('greenfield_conversation_members').set({pinned_at: pinnedAt, updated_at: now})
        .where('conversation_id', '=', conversationId).where('actor_id', '=', viewer).execute()
      return {pinned, pinnedAt: pinnedAt ? pinnedAt.toISOString() : null}
    })
  }

  async setNotificationLevel(viewer: string, conversationId: string, raw: unknown) {
    await this.activeChat(viewer, conversationId)
    if (!(NOTIFICATION_LEVELS as readonly unknown[]).includes(raw)) fail('VALIDATION_FAILED', 'level must be all, mentions or none')
    const level = raw as typeof NOTIFICATION_LEVELS[number]
    await this.fdb.updateTable('greenfield_conversation_members').set({notify_level: level, updated_at: new Date()})
      .where('conversation_id', '=', conversationId).where('actor_id', '=', viewer).execute()
    return {level}
  }

  // ---- chat folders ----------------------------------------------------------

  private folderInput(input: Record<string, unknown>, creating: boolean) {
    const out: {name?: string; emoji?: string | null; conversationIds?: string[]; sortOrder?: number} = {}
    if (creating || input.name !== undefined) out.name = text(input.name, CHAT_FOLDER_NAME_MAX, 'Folder name')
    if (input.emoji !== undefined) {
      if (input.emoji !== null && (typeof input.emoji !== 'string' || !input.emoji.trim() || input.emoji.length > 16)) fail('VALIDATION_FAILED', 'Invalid folder emoji')
      out.emoji = input.emoji === null ? null : (input.emoji as string).trim()
    }
    if (input.conversationIds !== undefined) {
      if (!Array.isArray(input.conversationIds) || input.conversationIds.length > CHAT_FOLDER_ITEMS_MAX) fail('VALIDATION_FAILED', `conversationIds must be a list of at most ${CHAT_FOLDER_ITEMS_MAX}`)
      const ids: string[] = []
      for (const id of input.conversationIds) {
        if (typeof id !== 'string' || !id || id.length > 64) fail('VALIDATION_FAILED', 'Invalid conversation id')
        if (!ids.includes(id)) ids.push(id)
      }
      out.conversationIds = ids
    }
    if (input.sortOrder !== undefined) {
      if (typeof input.sortOrder !== 'number' || !Number.isSafeInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 1000) fail('VALIDATION_FAILED', 'Invalid sortOrder')
      out.sortOrder = input.sortOrder
    }
    if (Object.keys(input).some(k => !['name', 'emoji', 'conversationIds', 'sortOrder'].includes(k))) fail('VALIDATION_FAILED', 'Unknown folder field')
    return out
  }

  /** Folders may only hold chats the viewer is an active or pending member of. */
  private async assertMemberChats(viewer: string, ids: string[]) {
    if (ids.length === 0) return
    const rows = await this.fdb.selectFrom('greenfield_conversation_members as m')
      .innerJoin('greenfield_conversations as c', 'c.conversation_id', 'm.conversation_id')
      .select('m.conversation_id').where('m.actor_id', '=', viewer).where('m.conversation_id', 'in', ids)
      .where('m.state', 'in', ['active', 'pending']).where('c.kind', 'in', ['direct', 'group']).execute()
    if (rows.length !== ids.length) fail('VALIDATION_FAILED', 'Folders can only contain your own chats', 'not-member')
  }

  async listFolders(viewer: string): Promise<{items: ChatFolderDto[]}> {
    const folders = await this.fdb.selectFrom('greenfield_chat_folders').selectAll().where('actor_id', '=', viewer)
      .orderBy('sort_order', 'asc').orderBy('created_at', 'asc').execute()
    if (folders.length === 0) return {items: []}
    const items = await this.fdb.selectFrom('greenfield_chat_folder_items as f')
      .innerJoin('greenfield_conversation_members as m', join => join.onRef('m.conversation_id', '=', 'f.conversation_id').on('m.actor_id', '=', viewer))
      .select(['f.folder_id', 'f.conversation_id']).where('f.folder_id', 'in', folders.map(f => f.folder_id))
      .where('m.state', 'in', ['active', 'pending']).orderBy('f.added_at').execute()
    return {
      items: folders.map(f => ({
        id: f.folder_id, name: f.name, emoji: f.emoji, sortOrder: f.sort_order,
        conversationIds: items.filter(i => i.folder_id === f.folder_id).map(i => i.conversation_id),
        updatedAt: f.updated_at.toISOString(),
      })),
    }
  }

  async createFolder(viewer: string, input: Record<string, unknown>) {
    const data = this.folderInput(input, true)
    await this.assertMemberChats(viewer, data.conversationIds ?? [])
    const id = randomUUID()
    const now = new Date()
    await this.fdb.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`chat-folders:${viewer}`}))`.execute(trx)
      const count = await trx.selectFrom('greenfield_chat_folders').select(eb => eb.fn.countAll<number>().as('count')).where('actor_id', '=', viewer).executeTakeFirst()
      const n = Number(count?.count ?? 0)
      if (n >= CHAT_FOLDERS_MAX) fail('CONFLICT', 'Folder limit reached', 'folder-limit')
      await trx.insertInto('greenfield_chat_folders').values({folder_id: id, actor_id: viewer, name: data.name!, emoji: data.emoji ?? null, sort_order: data.sortOrder ?? n, created_at: now, updated_at: now}).execute()
      if (data.conversationIds?.length) {
        await trx.insertInto('greenfield_chat_folder_items').values(data.conversationIds.map(c => ({folder_id: id, conversation_id: c, added_at: now}))).execute()
      }
    })
    return (await this.listFolders(viewer)).items.find(f => f.id === id)!
  }

  async updateFolder(viewer: string, folderId: string, input: Record<string, unknown>) {
    const data = this.folderInput(input, false)
    if (Object.keys(data).length === 0) fail('VALIDATION_FAILED', 'Nothing to update')
    const folder = await this.fdb.selectFrom('greenfield_chat_folders').select('folder_id').where('folder_id', '=', folderId).where('actor_id', '=', viewer).executeTakeFirst()
    if (!folder) fail('NOT_FOUND', 'Folder not found')
    if (data.conversationIds) await this.assertMemberChats(viewer, data.conversationIds)
    const now = new Date()
    await this.fdb.transaction().execute(async trx => {
      await trx.updateTable('greenfield_chat_folders').set({
        ...(data.name !== undefined ? {name: data.name} : {}),
        ...(data.emoji !== undefined ? {emoji: data.emoji} : {}),
        ...(data.sortOrder !== undefined ? {sort_order: data.sortOrder} : {}),
        updated_at: now,
      }).where('folder_id', '=', folderId).execute()
      if (data.conversationIds) {
        await trx.deleteFrom('greenfield_chat_folder_items').where('folder_id', '=', folderId).execute()
        if (data.conversationIds.length) {
          await trx.insertInto('greenfield_chat_folder_items').values(data.conversationIds.map(c => ({folder_id: folderId, conversation_id: c, added_at: now}))).execute()
        }
      }
    })
    return (await this.listFolders(viewer)).items.find(f => f.id === folderId)!
  }

  async deleteFolder(viewer: string, folderId: string) {
    const result = await this.fdb.deleteFrom('greenfield_chat_folders').where('folder_id', '=', folderId).where('actor_id', '=', viewer).executeTakeFirst()
    if (Number(result.numDeletedRows) === 0) fail('NOT_FOUND', 'Folder not found')
    return {deleted: true}
  }

  // ---- quick replies ---------------------------------------------------------

  private shortcut(raw: unknown): string {
    if (typeof raw !== 'string' || !/^[a-z0-9_-]{1,24}$/.test(raw.trim().toLowerCase())) fail('VALIDATION_FAILED', 'shortcut must be 1-24 of a-z, 0-9, _ or -')
    return raw.trim().toLowerCase()
  }

  async listQuickReplies(viewer: string): Promise<{items: QuickReplyDto[]}> {
    const rows = await this.fdb.selectFrom('greenfield_quick_replies').selectAll().where('actor_id', '=', viewer).orderBy('shortcut').execute()
    return {items: rows.map(r => ({id: r.reply_id, shortcut: r.shortcut, text: r.body, updatedAt: r.updated_at.toISOString()}))}
  }

  async createQuickReply(viewer: string, input: {shortcut?: unknown; text?: unknown}) {
    const shortcut = this.shortcut(input.shortcut)
    const body = text(input.text, QUICK_REPLY_BODY_MAX, 'Quick reply')
    const id = randomUUID()
    const now = new Date()
    await this.fdb.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`quick-replies:${viewer}`}))`.execute(trx)
      const count = await trx.selectFrom('greenfield_quick_replies').select(eb => eb.fn.countAll<number>().as('count')).where('actor_id', '=', viewer).executeTakeFirst()
      if (Number(count?.count ?? 0) >= QUICK_REPLIES_MAX) fail('CONFLICT', 'Quick reply limit reached', 'quick-reply-limit')
      const clash = await trx.selectFrom('greenfield_quick_replies').select('reply_id').where('actor_id', '=', viewer).where('shortcut', '=', shortcut).executeTakeFirst()
      if (clash) fail('CONFLICT', 'That shortcut is already used', 'shortcut-taken')
      await trx.insertInto('greenfield_quick_replies').values({reply_id: id, actor_id: viewer, shortcut, body, created_at: now, updated_at: now}).execute()
    })
    return {id, shortcut, text: body, updatedAt: now.toISOString()}
  }

  async updateQuickReply(viewer: string, replyId: string, input: {shortcut?: unknown; text?: unknown}) {
    const row = await this.fdb.selectFrom('greenfield_quick_replies').selectAll().where('reply_id', '=', replyId).where('actor_id', '=', viewer).executeTakeFirst()
    if (!row) fail('NOT_FOUND', 'Quick reply not found')
    if (input.shortcut === undefined && input.text === undefined) fail('VALIDATION_FAILED', 'Nothing to update')
    const shortcut = input.shortcut === undefined ? row.shortcut : this.shortcut(input.shortcut)
    const body = input.text === undefined ? row.body : text(input.text, QUICK_REPLY_BODY_MAX, 'Quick reply')
    const now = new Date()
    try {
      await this.fdb.updateTable('greenfield_quick_replies').set({shortcut, body, updated_at: now}).where('reply_id', '=', replyId).execute()
    } catch (error: any) {
      if (error?.code === '23505') fail('CONFLICT', 'That shortcut is already used', 'shortcut-taken')
      throw error
    }
    return {id: replyId, shortcut, text: body, updatedAt: now.toISOString()}
  }

  async deleteQuickReply(viewer: string, replyId: string) {
    const result = await this.fdb.deleteFrom('greenfield_quick_replies').where('reply_id', '=', replyId).where('actor_id', '=', viewer).executeTakeFirst()
    if (Number(result.numDeletedRows) === 0) fail('NOT_FOUND', 'Quick reply not found')
    return {deleted: true}
  }

  // ---- forwarding ------------------------------------------------------------

  /** Source checks for a forward; returns the attribution to carry. */
  async forwardSource(viewer: string, conversationId: string, messageId: string) {
    const {row} = await this.visibleMessage(viewer, conversationId, messageId)
    if ((row.message_kind ?? 'text') !== 'text') fail('VALIDATION_FAILED', 'Only text messages can be forwarded', 'unsupported-kind')
    const original = row.forwarded_from_actor_id
      ? {actorId: row.forwarded_from_actor_id, sentAt: row.forwarded_from_sent_at ?? row.created_at, messageId: row.forwarded_from_message_id ?? row.message_id}
      : {actorId: row.sender_actor_id, sentAt: row.created_at, messageId: row.message_id}
    return {text: row.body, original}
  }

  parseTargets(raw: unknown, source: string): string[] {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > FORWARD_TARGETS_MAX) fail('VALIDATION_FAILED', `conversationIds must list 1-${FORWARD_TARGETS_MAX} chats`)
    const ids: string[] = []
    for (const id of raw) {
      if (typeof id !== 'string' || !id || id.length > 64) fail('VALIDATION_FAILED', 'Invalid conversation id')
      if (!ids.includes(id)) ids.push(id)
    }
    void source
    return ids
  }

  /** The original sender must not be in a block relationship with the forwarder. */
  async assertForwardAllowed(viewer: string, originalActorId: string) {
    if (originalActorId !== viewer && await this.isBlockedEitherWay(viewer, originalActorId)) fail('FORBIDDEN', 'This message cannot be forwarded', 'blocked')
  }
}
