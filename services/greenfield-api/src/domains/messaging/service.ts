import {randomUUID} from 'node:crypto'
import {sql, type Transaction} from 'kysely'
import {badgesForActors, NO_BADGES, type PublicBadgeFields} from '../../premium/badges.js'

import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'

export type ParticipantDto = {id: string; handle: string; displayName: string; avatarUrl: string | null} & Partial<PublicBadgeFields>
export type MessagePreviewDto = {id: string; body: string; sentAt: string; senderId: string; kind?: MessageKind}
export type ConversationDto = {
  id: string
  /** `group` conversations carry `group`; pending invites and DM requests are `request`. */
  kind: 'direct' | 'request' | 'group'
  participants: ParticipantDto[]
  group?: GroupSummaryDto | null
  lastMessage: MessagePreviewDto | null
  unreadCount: number
  updatedAt: string
  muted?: boolean
  archived?: boolean
}
export type StartConversationResult = {conversation: ConversationDto; created: boolean}
export type MessageDto = {
  id: string
  conversationId: string
  sender: ParticipantDto
  body: string
  subject: string | null
  sentAt: string
  createdAt: string
  isOwn: boolean
  delivery: 'sent' | 'read'
  /** `text` (default), `voice` (voice note) or `media` (photo/video, capability-gated). */
  kind?: MessageKind
  attachments?: MessageAttachmentDto[]
  mentions?: MentionDto[]
  clientMessageId?: string | null
  replyTo?: ReplyPreviewDto | null
  reactions?: ReactionDto[]
  editedAt?: string | null
  deleted?: boolean
  storyContext?: StoryMessageContext
}
export type StoryMessageContext = {
  type: 'story'
  storyId: string
  groupId: string
  ownerActorId: string
  mediaKind: 'image' | 'video'
  createdAt: string
  expiresAt: string
}
export type MessageRequestDto = {
  id: string
  conversationId: string
  kind?: 'direct' | 'group'
  group?: GroupSummaryDto | null
  sender: ParticipantDto
  preview: string
  createdAt: string
}
export type InMailThreadDto = {
  id: string
  subject: string
  participants: ParticipantDto[]
  preview: string
  unread: boolean
  updatedAt: string
}
export type ReactionDto = {emoji: string; count: number; mine: boolean}
export type ReplyPreviewDto = {id: string; senderId: string; senderName: string; body: string; deleted: boolean}
export type MessageKind = 'text' | 'voice' | 'media'
export type MessageAttachmentDto = {
  id: string
  kind: 'audio' | 'image' | 'video'
  mimeType: string
  byteSize: number
  durationMs: number | null
  waveform: number[] | null
  width: number | null
  height: number | null
  /** Authenticated URL; requires the viewer's bearer token and active membership. */
  url: string
}
export type MentionDto = {actorId: string; handle: string}
export type GroupSummaryDto = {title: string; description: string | null; memberCount: number; myRole: GroupRole}
export type GroupRole = 'owner' | 'admin' | 'member'
type MessageExtras = {
  reactions: Map<string, ReactionDto[]>
  replies: Map<string, ReplyPreviewDto>
  attachments?: Map<string, MessageAttachmentDto[]>
  mentions?: Map<string, MentionDto[]>
}
type MessageRow = {
  message_id: string
  conversation_id: string
  sender_actor_id: string
  subject: string | null
  body: string
  created_at: Date
  reply_to_message_id?: string | null
  edited_at?: Date | null
  deleted_at?: Date | null
  message_kind?: MessageKind
  client_message_id?: string | null
}

/** Own messages can be edited for 15 minutes (like iMessage). */
export const EDIT_WINDOW_MS = 15 * 60 * 1000
/** A typing ping counts for 6 seconds. */
export const TYPING_TTL_MS = 6_000
export const REACTION_MAX = 16

export type Page<T> = {items: T[]; nextCursor: string | null; hasMore: boolean}

export const MESSAGE_MAX = 5_000
export const INMAIL_BODY_MAX = 20_000
export const SUBJECT_MAX = 180
/** Group size cap, including the owner. */
export const GROUP_MAX_MEMBERS = 32
export const GROUP_TITLE_MAX = 80
export const GROUP_DESCRIPTION_MAX = 500
export const MESSAGE_ATTACHMENTS_MAX = 4
export const VOICE_NOTE_MAX_MS = 5 * 60 * 1000
export const MENTIONS_MAX = 20
const INACTIVE_MEMBER_STATES = ['declined', 'left', 'removed'] as const

type DirectConversationRecord = {
  conversationId: string
  created: boolean
  recipientState: 'active' | 'pending' | 'declined'
}

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), {code})
}

function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`, 'utf8').toString('base64url')
}

function decodeCursor(cursor: string | undefined | null): {at: Date; id: string} | null {
  if (!cursor) return null
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
    const at = new Date(iso ?? '')
    if (!id || Number.isNaN(at.getTime())) return null
    return {at, id}
  } catch {
    return null
  }
}

function clampLimit(raw: unknown, fallback: number, max: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), max)
}

function cleanText(raw: unknown, max: number, label: string): string {
  if (typeof raw !== 'string') fail('VALIDATION_FAILED', `${label} is required`)
  const text = (raw as string).trim()
  if (!text) fail('VALIDATION_FAILED', `${label} is required`)
  if (text.length > max) fail('VALIDATION_FAILED', `${label} is too long`)
  return text
}

export function normalizeMessageText(raw: unknown): string {
  return cleanText(raw, MESSAGE_MAX, 'Message')
}

export class MessagingService {
  private readonly publicApiUrl: string

  constructor(private readonly db: ModulaDb, options: {publicApiUrl?: string} = {}) {
    this.publicApiUrl = (options.publicApiUrl ?? '').replace(/\/+$/, '')
  }

  // ---- shared helpers -------------------------------------------------

  private async participants(actorIds: string[]): Promise<Map<string, ParticipantDto>> {
    const map = new Map<string, ParticipantDto>()
    if (actorIds.length === 0) return map
    const rows = await this.db
      .selectFrom('profiles')
      .select(['actor_id', 'handle', 'display_name', 'avatar_url'])
      .where('actor_id', 'in', [...new Set(actorIds)])
      .execute()
    const badges = await badgesForActors(this.db, rows.map(row => row.actor_id))
    for (const row of rows) {
      map.set(row.actor_id, {id: row.actor_id, handle: row.handle, displayName: row.display_name, avatarUrl: row.avatar_url, ...(badges.get(row.actor_id) ?? NO_BADGES)})
    }
    for (const id of actorIds) {
      if (!map.has(id)) map.set(id, {id, handle: '', displayName: 'Member', avatarUrl: null})
    }
    return map
  }

  private async resolveHandle(raw: unknown): Promise<string> {
    const handle = cleanText(raw, 80, 'Recipient').replace(/^@/, '').toLowerCase()
    const row = await this.db
      .selectFrom('profiles as p')
      .innerJoin('actors as a', 'a.id', 'p.actor_id')
      .innerJoin('greenfield_accounts as ga', 'ga.account_id', 'a.account_id')
      .select('p.actor_id')
      .where('p.handle', '=', handle)
      .where('p.deleted_at', 'is', null)
      .where('a.deleted_at', 'is', null)
      .where('ga.status', '=', 'active')
      .executeTakeFirst()
    if (!row) fail('NOT_FOUND', 'Recipient not found')
    return row.actor_id
  }

  private async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    return this.isBlockedEitherWayWith(this.db, a, b)
  }

  private async isBlockedEitherWayWith(db: ModulaDb | Transaction<Database>, a: string, b: string): Promise<boolean> {
    const row = await db
      .selectFrom('blocks')
      .select('id')
      .where('deleted_at', 'is', null)
      .where(eb =>
        eb.or([
          eb.and([eb('blocker_actor_id', '=', a), eb('blocked_actor_id', '=', b)]),
          eb.and([eb('blocker_actor_id', '=', b), eb('blocked_actor_id', '=', a)]),
        ]),
      )
      .executeTakeFirst()
    return Boolean(row)
  }

  /**
   * Membership gate for every conversation route. `chat` admits direct and
   * group conversations. Declined, left and removed members are treated as
   * strangers (404) so conversation ids never confirm existence.
   */
  protected async membership(conversationId: string, actorId: string, kind: 'chat' | 'inmail') {
    const row = await this.db
      .selectFrom('greenfield_conversation_members as m')
      .innerJoin('greenfield_conversations as c', 'c.conversation_id', 'm.conversation_id')
      .select(['m.state', 'm.role', 'm.last_read_at', 'c.kind', 'c.subject', 'c.title', 'c.description', 'c.last_message_at', 'c.created_by_actor_id'])
      .where('m.conversation_id', '=', conversationId)
      .where('m.actor_id', '=', actorId)
      .executeTakeFirst()
    const kindOk = row && (kind === 'chat' ? row.kind === 'direct' || row.kind === 'group' : row.kind === kind)
    if (!row || !kindOk || (INACTIVE_MEMBER_STATES as readonly string[]).includes(row.state)) fail('NOT_FOUND', 'Conversation not found')
    return row!
  }

  /** Actors the viewer has blocked or been blocked by. Used to hide group content. */
  protected async blockedSet(viewer: string): Promise<Set<string>> {
    const rows = await this.db
      .selectFrom('blocks')
      .select(['blocker_actor_id', 'blocked_actor_id'])
      .where('deleted_at', 'is', null)
      .where(eb => eb.or([eb('blocker_actor_id', '=', viewer), eb('blocked_actor_id', '=', viewer)]))
      .execute()
    const set = new Set<string>()
    for (const row of rows) set.add(row.blocker_actor_id === viewer ? row.blocked_actor_id : row.blocker_actor_id)
    return set
  }

  private async otherMembers(conversationIds: string[], viewer: string): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>()
    if (conversationIds.length === 0) return map
    const rows = await this.db
      .selectFrom('greenfield_conversation_members')
      .select(['conversation_id', 'actor_id'])
      .where('conversation_id', 'in', conversationIds)
      .where('actor_id', '!=', viewer)
      .where('state', 'not in', ['left', 'removed'])
      .orderBy('joined_at')
      .execute()
    for (const row of rows) {
      const list = map.get(row.conversation_id) ?? []
      list.push(row.actor_id)
      map.set(row.conversation_id, list)
    }
    return map
  }

  private async latestMessages(conversationIds: string[], hiddenSenders: string[] = []) {
    const map = new Map<string, {message_id: string; body: string; created_at: Date; sender_actor_id: string; deleted_at: Date | null; message_kind: MessageKind}>()
    if (conversationIds.length === 0) return map
    let query = this.db
      .selectFrom('greenfield_conversation_messages')
      .select(['conversation_id', 'message_id', 'body', 'created_at', 'sender_actor_id', 'deleted_at', 'message_kind'])
      .distinctOn('conversation_id')
      .where('conversation_id', 'in', conversationIds)
    if (hiddenSenders.length > 0) query = query.where('sender_actor_id', 'not in', hiddenSenders)
    const rows = await query
      .orderBy('conversation_id')
      .orderBy('created_at', 'desc')
      .orderBy('message_id', 'desc')
      .execute()
    for (const row of rows) map.set(row.conversation_id, row)
    return map
  }

  /** Latest previews: group previews skip blocked senders; direct previews are unchanged. */
  private async latestPreviews(rows: Array<{conversation_id: string; kind: string}>, viewer: string) {
    const groupIds = rows.filter(r => r.kind === 'group').map(r => r.conversation_id)
    const otherIds = rows.filter(r => r.kind !== 'group').map(r => r.conversation_id)
    const hidden = groupIds.length > 0 ? [...await this.blockedSet(viewer)] : []
    const [a, b] = await Promise.all([this.latestMessages(otherIds), this.latestMessages(groupIds, hidden)])
    return new Map([...a, ...b])
  }

  private async storyContexts(messageIds: string[]): Promise<Map<string, StoryMessageContext>> {
    const contexts = new Map<string, StoryMessageContext>()
    if (messageIds.length === 0) return contexts
    const rows = await this.db
      .selectFrom('greenfield_domain_events')
      .select(['aggregate_id', 'payload'])
      .where('event_type', '=', 'message.story-replied')
      .where('aggregate_type', '=', 'conversation-message')
      .where('aggregate_id', 'in', messageIds)
      .execute()
    for (const row of rows) {
      const payload = asRecord(row.payload)
      const context = storyMessageContext(payload.storyContext)
      if (context) contexts.set(row.aggregate_id, context)
    }
    return contexts
  }

  private async unreadCounts(rows: {conversation_id: string; last_read_at: Date | null; kind?: string}[], viewer: string) {
    const map = new Map<string, number>()
    const hidden = rows.some(row => row.kind === 'group') ? [...await this.blockedSet(viewer)] : []
    for (const row of rows) {
      let query = this.db
        .selectFrom('greenfield_conversation_messages')
        .select(eb => eb.fn.countAll<number>().as('count'))
        .where('conversation_id', '=', row.conversation_id)
        .where('sender_actor_id', '!=', viewer)
      if (row.kind === 'group' && hidden.length > 0) query = query.where('sender_actor_id', 'not in', hidden)
      if (row.last_read_at) query = query.where('created_at', '>', row.last_read_at)
      const result = await query.executeTakeFirst()
      map.set(row.conversation_id, Number(result?.count ?? 0))
    }
    return map
  }

  private async insertMessage(
    conversationId: string,
    sender: string,
    body: string,
    subject: string | null = null,
    replyTo: string | null = null,
    extra: {
      kind?: MessageKind
      clientMessageId?: string | null
      attachments?: Array<{attachmentId: string; durationMs: number | null; waveform: number[] | null}>
      mentions?: string[]
      senderAccountId?: string
    } = {},
  ) {
    const now = new Date()
    const messageId = randomUUID()
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_conversation_messages')
        .values({
          message_id: messageId, conversation_id: conversationId, sender_actor_id: sender, subject, body, created_at: now,
          reply_to_message_id: replyTo, message_kind: extra.kind ?? 'text', client_message_id: extra.clientMessageId ?? null,
        })
        .execute()
      for (const [position, item] of (extra.attachments ?? []).entries()) {
        // Claim the attachment atomically: owned by the sender, ready, and never bound before.
        const claimed = await trx
          .updateTable('attachments')
          .set({attached_at: now, updated_at: now})
          .where('attachment_id', '=', item.attachmentId)
          .where('owner_account_id', '=', extra.senderAccountId ?? '')
          .where('status', '=', 'ready')
          .where('attached_at', 'is', null)
          .executeTakeFirst()
        if (claimed.numUpdatedRows !== 1n) fail('CONFLICT', 'Attachment is not available')
        await trx
          .insertInto('greenfield_message_attachments')
          .values({message_id: messageId, attachment_id: item.attachmentId, position, duration_ms: item.durationMs, waveform: item.waveform ? JSON.stringify(item.waveform) : null, created_at: now})
          .execute()
      }
      if (extra.mentions && extra.mentions.length > 0) {
        await trx
          .insertInto('greenfield_message_mentions')
          .values(extra.mentions.map(actorId => ({message_id: messageId, actor_id: actorId, created_at: now})))
          .execute()
      }
      await trx
        .updateTable('greenfield_conversations')
        .set({last_message_at: now, updated_at: now})
        .where('conversation_id', '=', conversationId)
        .execute()
      await trx
        .updateTable('greenfield_conversation_members')
        .set({last_read_at: now, updated_at: now})
        .where('conversation_id', '=', conversationId)
        .where('actor_id', '=', sender)
        .execute()
    })
    return {messageId, now}
  }

  /**
   * Transaction-scoped primitive used by other authenticated domains. The
   * caller must first obtain the conversation through
   * ensureDirectConversationInTransaction so the actor-pair moderation lock
   * and recipient checks cover this write.
   */
  async insertDirectMessageInTransaction(
    trx: Transaction<Database>,
    conversationId: string,
    sender: string,
    body: string,
    messageId: string = randomUUID(),
    now: Date = new Date(),
  ): Promise<{messageId: string; createdAt: Date}> {
    await trx
      .insertInto('greenfield_conversation_messages')
      .values({message_id: messageId, conversation_id: conversationId, sender_actor_id: sender, subject: null, body, created_at: now})
      .execute()
    await trx
      .updateTable('greenfield_conversations')
      .set({last_message_at: now, updated_at: now})
      .where('conversation_id', '=', conversationId)
      .execute()
    await trx
      .updateTable('greenfield_conversation_members')
      .set({last_read_at: now, updated_at: now})
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '=', sender)
      .execute()
    return {messageId, createdAt: now}
  }

  private async listForViewer(viewer: string, kind: 'chat' | 'inmail', state: 'active' | 'pending', cursorRaw: unknown, limitRaw: unknown, archived: boolean | null = null) {
    const limit = clampLimit(limitRaw, 30, 50)
    const cursor = decodeCursor(typeof cursorRaw === 'string' ? cursorRaw : null)
    let query = this.db
      .selectFrom('greenfield_conversation_members as m')
      .innerJoin('greenfield_conversations as c', 'c.conversation_id', 'm.conversation_id')
      .select(['c.conversation_id', 'c.kind', 'c.subject', 'c.title', 'c.description', 'c.last_message_at', 'c.created_at', 'm.last_read_at', 'm.muted_until', 'm.archived_at', 'm.role'])
      .where('m.actor_id', '=', viewer)
      .where('m.state', '=', state)
      .where('c.kind', 'in', kind === 'chat' ? ['direct', 'group'] : ['inmail'])
    if (archived === true) query = query.where('m.archived_at', 'is not', null)
    if (archived === false) query = query.where('m.archived_at', 'is', null)
    if (cursor) {
      query = query.where(eb =>
        eb.or([
          eb('c.last_message_at', '<', cursor.at),
          eb.and([eb('c.last_message_at', '=', cursor.at), eb('c.conversation_id', '<', cursor.id)]),
        ]),
      )
    }
    const rows = await query
      .orderBy('c.last_message_at', 'desc')
      .orderBy('c.conversation_id', 'desc')
      .limit(limit + 1)
      .execute()
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)
    const last = page.at(-1)
    return {page, hasMore, nextCursor: hasMore && last ? encodeCursor(last.last_message_at, last.conversation_id) : null}
  }

  // ---- direct conversations ------------------------------------------

  async listConversations(viewer: string, cursor: unknown, limit: unknown, archived: unknown = undefined): Promise<Page<ConversationDto>> {
    const {page, hasMore, nextCursor} = await this.listForViewer(viewer, 'chat', 'active', cursor, limit, archived === 'true' || archived === true)
    const ids = page.map(row => row.conversation_id)
    const groupIds = page.filter(row => row.kind === 'group').map(row => row.conversation_id)
    const [others, latest, unread, counts] = await Promise.all([
      this.otherMembers(ids, viewer),
      this.latestPreviews(page, viewer),
      this.unreadCounts(page, viewer),
      this.activeMemberCounts(groupIds),
    ])
    const people = await this.participants([...others.values()].flat())
    const items = page.map(row => {
      const lastRow = latest.get(row.conversation_id)
      const isGroup = row.kind === 'group'
      return {
        id: row.conversation_id,
        kind: isGroup ? 'group' as const : 'direct' as const,
        participants: (others.get(row.conversation_id) ?? []).map(id => people.get(id)!),
        group: isGroup ? {title: row.title ?? 'Group', description: row.description ?? null, memberCount: counts.get(row.conversation_id) ?? 1, myRole: row.role} : null,
        lastMessage: lastRow
          ? {id: lastRow.message_id, body: lastRow.deleted_at ? '' : lastRow.body, sentAt: lastRow.created_at.toISOString(), senderId: lastRow.sender_actor_id, kind: lastRow.message_kind}
          : null,
        unreadCount: unread.get(row.conversation_id) ?? 0,
        updatedAt: row.last_message_at.toISOString(),
        muted: Boolean(row.muted_until && row.muted_until.getTime() > Date.now()),
        archived: Boolean(row.archived_at),
      }
    })
    return {items, nextCursor, hasMore}
  }

  async unreadSummary(viewer: string): Promise<{unreadCount: number}> {
    const rows = await this.db
      .selectFrom('greenfield_conversation_members as m')
      .innerJoin('greenfield_conversations as c', 'c.conversation_id', 'm.conversation_id')
      .select(['m.conversation_id', 'm.last_read_at'])
      .where('m.actor_id', '=', viewer)
      .where('m.state', '=', 'active')
      .where('c.kind', 'in', ['direct', 'group'])
      .select('c.kind')
      .execute()
    const counts = await this.unreadCounts(rows, viewer)
    let total = 0
    for (const value of counts.values()) total += value
    return {unreadCount: total}
  }

  /** Resolve a public handle, then atomically create or reuse its direct conversation. */
  async startConversation(viewer: string, input: {handle?: unknown; text?: unknown}): Promise<StartConversationResult> {
    const recipient = await this.resolveHandle(input.handle)
    return this.startDirectConversation(viewer, recipient, input.text)
  }

  /**
   * Server-side direct-conversation primitive for trusted domain integrations.
   * The optional text is an initial message: it is written only by the request
   * that creates the conversation, making retries safe after a lost response.
   */
  async startDirectConversation(viewer: string, recipient: string, initialText?: unknown): Promise<StartConversationResult> {
    if (recipient === viewer) fail('VALIDATION_FAILED', 'You cannot message yourself')
    const text = initialText === undefined || initialText === '' ? null : cleanText(initialText, MESSAGE_MAX, 'Message')
    const result = await this.db.transaction().execute(async trx => {
      const ensured = await this.ensureDirectConversationInTransaction(trx, viewer, recipient)
      if (ensured.created && text) {
        await this.insertDirectMessageInTransaction(trx, ensured.conversationId, viewer, text)
      }
      return ensured
    })
    return {conversation: await this.conversationFor(viewer, result.conversationId), created: result.created}
  }

  /**
   * Create or reuse the canonical direct conversation while holding the same
   * actor-pair advisory lock used by moderation block creation. Trusted
   * domain integrations can keep their message, event and outbox records in
   * the same database transaction as this operation.
   */
  async ensureDirectConversationInTransaction(
    trx: Transaction<Database>,
    viewer: string,
    recipient: string,
  ): Promise<DirectConversationRecord> {
    if (recipient === viewer) fail('VALIDATION_FAILED', 'You cannot message yourself')
    const directKey = [viewer, recipient].sort().join(':')
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${directKey}, 0))`.execute(trx)
    const activeRecipient = await trx
      .selectFrom('actors as a')
      .innerJoin('greenfield_accounts as ga', 'ga.account_id', 'a.account_id')
      .select('a.id')
      .where('a.id', '=', recipient)
      .where('a.deleted_at', 'is', null)
      .where('ga.status', '=', 'active')
      .executeTakeFirst()
    if (!activeRecipient) fail('NOT_FOUND', 'Recipient not found')
    if (await this.isBlockedEitherWayWith(trx, viewer, recipient)) {
      fail('FORBIDDEN', 'You cannot message this account')
    }

    const follows = await trx
      .selectFrom('follows')
      .select('id')
      .where('follower_actor_id', '=', recipient)
      .where('followed_actor_id', '=', viewer)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    const newRecipientState: 'active' | 'pending' = follows ? 'active' : 'pending'
    const conversationId = randomUUID()
    const now = new Date()
    const inserted = await trx
      .insertInto('greenfield_conversations')
      .values({conversation_id: conversationId, kind: 'direct', subject: null, direct_key: directKey, created_by_actor_id: viewer, created_at: now, updated_at: now, last_message_at: now})
      .onConflict(oc => oc.column('direct_key').doNothing())
      .returning('conversation_id')
      .executeTakeFirst()

    if (inserted) {
      await trx
        .insertInto('greenfield_conversation_members')
        .values([
          {conversation_id: conversationId, actor_id: viewer, state: 'active', last_read_at: now, joined_at: now, updated_at: now},
          {conversation_id: conversationId, actor_id: recipient, state: newRecipientState, last_read_at: null, joined_at: now, updated_at: now},
        ])
        .execute()
      return {conversationId, created: true, recipientState: newRecipientState}
    }

    const existing = await trx
      .selectFrom('greenfield_conversations')
      .select('conversation_id')
      .where('direct_key', '=', directKey)
      .executeTakeFirstOrThrow()
    await trx
      .updateTable('greenfield_conversation_members')
      .set({state: 'active', updated_at: now})
      .where('conversation_id', '=', existing.conversation_id)
      .where('actor_id', '=', viewer)
      .execute()
    const recipientMember = await trx
      .selectFrom('greenfield_conversation_members')
      .select('state')
      .where('conversation_id', '=', existing.conversation_id)
      .where('actor_id', '=', recipient)
      .executeTakeFirstOrThrow()
    return {conversationId: existing.conversation_id, created: false, recipientState: recipientMember.state as DirectConversationRecord['recipientState']}
  }

  async conversationFor(viewer: string, conversationId: string): Promise<ConversationDto> {
    const member = await this.membership(conversationId, viewer, 'chat')
    const others = await this.otherMembers([conversationId], viewer)
    const latest = await this.latestMessages([conversationId])
    const unread = await this.unreadCounts([{conversation_id: conversationId, last_read_at: member.last_read_at, kind: member.kind}], viewer)
    const people = await this.participants(others.get(conversationId) ?? [])
    const lastRow = latest.get(conversationId)
    const isGroup = member.kind === 'group'
    const counts = isGroup ? await this.activeMemberCounts([conversationId]) : new Map<string, number>()
    return {
      id: conversationId,
      kind: member.state === 'pending' ? 'request' : isGroup ? 'group' : 'direct',
      participants: (others.get(conversationId) ?? []).map(id => people.get(id)!),
      group: isGroup ? {title: member.title ?? 'Group', description: member.description ?? null, memberCount: counts.get(conversationId) ?? 1, myRole: member.role} : null,
      lastMessage: lastRow
        ? {id: lastRow.message_id, body: lastRow.body, sentAt: lastRow.created_at.toISOString(), senderId: lastRow.sender_actor_id}
        : null,
      unreadCount: unread.get(conversationId) ?? 0,
      updatedAt: member.last_message_at.toISOString(),
    }
  }

  async listMessages(viewer: string, conversationId: string, cursorRaw: unknown, limitRaw: unknown): Promise<Page<MessageDto>> {
    const member = await this.membership(conversationId, viewer, 'chat')
    const limit = clampLimit(limitRaw, 40, 100)
    const cursor = decodeCursor(typeof cursorRaw === 'string' ? cursorRaw : null)
    let query = this.db
      .selectFrom('greenfield_conversation_messages')
      .selectAll()
      .where('conversation_id', '=', conversationId)
    if (member.kind === 'group') {
      // Blocks are respected inside groups: content from an actor the viewer
      // blocked (or who blocked the viewer) is not delivered to the viewer.
      const hidden = [...await this.blockedSet(viewer)]
      if (hidden.length > 0) query = query.where('sender_actor_id', 'not in', hidden)
    }
    if (cursor) {
      query = query.where(eb =>
        eb.or([
          eb('created_at', '<', cursor.at),
          eb.and([eb('created_at', '=', cursor.at), eb('message_id', '<', cursor.id)]),
        ]),
      )
    }
    const rows = await query.orderBy('created_at', 'desc').orderBy('message_id', 'desc').limit(limit + 1).execute()
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)
    const oldest = page.at(-1)
    const others = await this.otherMembers([conversationId], viewer)
    const othersReadAt = await this.visibleReadTimes(viewer, conversationId)
    const [people, contexts, extras] = await Promise.all([
      this.participants([viewer, ...(others.get(conversationId) ?? []), ...page.map(r => r.sender_actor_id)]),
      this.storyContexts(page.map(row => row.message_id)),
      this.messageExtras(page, viewer),
    ])
    const items = page.reverse().map(row => this.messageDto(row, viewer, people, othersReadAt, extras, contexts.get(row.message_id)))
    return {items, nextCursor: hasMore && oldest ? encodeCursor(oldest.created_at, oldest.message_id) : null, hasMore}
  }

  /**
   * Read times of the other active members that the viewer may see. Read
   * receipts are reciprocal: a member with receipts off publishes none, and a
   * viewer with receipts off sees none (an empty list means never `read`).
   */
  private async visibleReadTimes(viewer: string, conversationId: string): Promise<number[]> {
    const mine = await this.privacyFor([viewer])
    if (!mine.get(viewer)!.readReceipts) return []
    const rows = await this.db
      .selectFrom('greenfield_conversation_members')
      .select(['actor_id', 'last_read_at'])
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '!=', viewer)
      .where('state', '=', 'active')
      .execute()
    if (rows.length === 0) return []
    const privacy = await this.privacyFor(rows.map(r => r.actor_id))
    // Any member hiding receipts means `read` (everyone read it) can never be shown.
    if (rows.some(r => !privacy.get(r.actor_id)!.readReceipts)) return []
    return rows.map(r => r.last_read_at?.getTime() ?? 0)
  }

  private messageDto(
    row: MessageRow,
    viewer: string,
    people: Map<string, ParticipantDto>,
    othersReadAt: number[] = [],
    extras?: MessageExtras,
    storyContext?: StoryMessageContext,
  ): MessageDto {
    const isOwn = row.sender_actor_id === viewer
    const read = isOwn && othersReadAt.length > 0 && othersReadAt.every(t => t >= row.created_at.getTime())
    const deleted = Boolean(row.deleted_at)
    return {
      id: row.message_id,
      conversationId: row.conversation_id,
      sender: people.get(row.sender_actor_id) ?? {id: row.sender_actor_id, handle: '', displayName: 'Member', avatarUrl: null},
      body: deleted ? '' : row.body,
      subject: row.subject,
      sentAt: row.created_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      isOwn,
      delivery: read ? 'read' : 'sent',
      kind: row.message_kind ?? 'text',
      attachments: deleted ? [] : (extras?.attachments?.get(row.message_id) ?? []),
      mentions: deleted ? [] : (extras?.mentions?.get(row.message_id) ?? []),
      clientMessageId: isOwn ? (row.client_message_id ?? null) : null,
      replyTo: row.reply_to_message_id ? (extras?.replies.get(row.reply_to_message_id) ?? null) : null,
      reactions: extras?.reactions.get(row.message_id) ?? [],
      editedAt: row.edited_at ? row.edited_at.toISOString() : null,
      deleted,
      ...(storyContext ? {storyContext} : {}),
    }
  }

  /**
   * Send a message. Text, a voice note (`kind: 'voice'` with one ready audio
   * attachment) or, when the media capability is on, photos/videos. A
   * `clientMessageId` makes retries (e.g. reply-from-notification) idempotent.
   */
  async send(
    viewer: string,
    conversationId: string,
    input: {text?: unknown; replyToMessageId?: unknown; clientMessageId?: unknown; kind?: unknown; attachments?: unknown},
    context: {accountId?: string; mediaEnabled?: boolean} = {},
  ): Promise<MessageDto> {
    const result = await this.sendDetailed(viewer, conversationId, input, context)
    return result.message
  }

  async sendDetailed(
    viewer: string,
    conversationId: string,
    input: {text?: unknown; replyToMessageId?: unknown; clientMessageId?: unknown; kind?: unknown; attachments?: unknown},
    context: {accountId?: string; mediaEnabled?: boolean} = {},
  ): Promise<{message: MessageDto; created: boolean; conversationKind: 'direct' | 'group'; mentionedActorIds: string[]}> {
    const member = await this.membership(conversationId, viewer, 'chat')
    if (member.state !== 'active') fail('FORBIDDEN', 'Accept this request before replying')
    const conversationKind = member.kind === 'group' ? 'group' as const : 'direct' as const
    const kind: MessageKind = input.kind === undefined || input.kind === 'text' ? 'text' : input.kind === 'voice' ? 'voice' : input.kind === 'media' ? 'media' : fail('VALIDATION_FAILED', 'Unsupported message kind')
    if (kind === 'media' && !context.mediaEnabled) fail('FORBIDDEN', 'Photo and video messages are not enabled')
    const text = kind === 'text'
      ? cleanText(input.text, MESSAGE_MAX, 'Message')
      : input.text === undefined || input.text === null || input.text === '' ? '' : cleanText(input.text, MESSAGE_MAX, 'Caption')
    const clientMessageId = parseClientMessageId(input.clientMessageId)
    if (clientMessageId) {
      const existing = await this.db
        .selectFrom('greenfield_conversation_messages')
        .selectAll()
        .where('conversation_id', '=', conversationId)
        .where('sender_actor_id', '=', viewer)
        .where('client_message_id', '=', clientMessageId)
        .executeTakeFirst()
      if (existing) {
        const people = await this.participants([viewer])
        return {message: this.messageDto(existing, viewer, people, [], await this.messageExtras([existing], viewer)), created: false, conversationKind, mentionedActorIds: []}
      }
    }
    const others = await this.otherMembers([conversationId], viewer)
    if (conversationKind === 'direct') {
      for (const other of others.get(conversationId) ?? []) {
        if (await this.isBlockedEitherWay(viewer, other)) fail('FORBIDDEN', 'You cannot message this account')
      }
    }
    const attachments = kind === 'text' ? [] : await this.validateAttachments(input.attachments, kind, context)
    let replyTo: string | null = null
    if (typeof input.replyToMessageId === 'string' && input.replyToMessageId) {
      const parent = await this.db
        .selectFrom('greenfield_conversation_messages')
        .select('message_id')
        .where('message_id', '=', input.replyToMessageId)
        .where('conversation_id', '=', conversationId)
        .executeTakeFirst()
      if (!parent) fail('VALIDATION_FAILED', 'Reply target not found')
      replyTo = parent!.message_id
    }
    const mentionedActorIds = conversationKind === 'group' && text ? await this.resolveMentions(conversationId, viewer, text) : []
    let inserted: {messageId: string; now: Date}
    try {
      inserted = await this.insertMessage(conversationId, viewer, text, null, replyTo, {
        kind, clientMessageId, attachments, mentions: mentionedActorIds, senderAccountId: context.accountId,
      })
    } catch (error: any) {
      // Concurrent retry with the same clientMessageId: return the winner.
      if (clientMessageId && error?.code === '23505') {
        return this.sendDetailed(viewer, conversationId, {...input}, context)
      }
      throw error
    }
    const people = await this.participants([viewer])
    const row: MessageRow = {
      message_id: inserted.messageId, conversation_id: conversationId, sender_actor_id: viewer, subject: null, body: text,
      created_at: inserted.now, reply_to_message_id: replyTo, message_kind: kind, client_message_id: clientMessageId,
    }
    return {
      message: this.messageDto(row, viewer, people, [], await this.messageExtras([row], viewer)),
      created: true,
      conversationKind,
      mentionedActorIds,
    }
  }

  private async validateAttachments(raw: unknown, kind: MessageKind, context: {accountId?: string}) {
    if (!Array.isArray(raw) || raw.length === 0) fail('VALIDATION_FAILED', 'Attachments are required')
    const list = raw as unknown[]
    if (kind === 'voice' && list.length !== 1) fail('VALIDATION_FAILED', 'A voice message has exactly one recording')
    if (list.length > MESSAGE_ATTACHMENTS_MAX) fail('VALIDATION_FAILED', 'Too many attachments')
    if (!context.accountId) fail('FORBIDDEN', 'Attachment unavailable')
    const parsed = list.map(item => {
      const record = asRecord(item)
      const attachmentId = typeof record.attachmentId === 'string' && record.attachmentId.length <= 64 ? record.attachmentId : fail('VALIDATION_FAILED', 'attachmentId is required')
      const durationMs = record.durationMs === undefined || record.durationMs === null ? null : Number(record.durationMs)
      if (durationMs !== null && (!Number.isInteger(durationMs) || durationMs < 1 || durationMs > VOICE_NOTE_MAX_MS)) fail('VALIDATION_FAILED', 'Invalid duration')
      let waveform: number[] | null = null
      if (record.waveform !== undefined && record.waveform !== null) {
        if (!Array.isArray(record.waveform) || record.waveform.length > 128 || !record.waveform.every(v => typeof v === 'number' && v >= 0 && v <= 1)) {
          fail('VALIDATION_FAILED', 'Waveform must be up to 128 numbers between 0 and 1')
        }
        waveform = (record.waveform as number[]).map(v => Math.round(v * 1000) / 1000)
      }
      return {attachmentId, durationMs, waveform}
    })
    if (new Set(parsed.map(p => p.attachmentId)).size !== parsed.length) fail('VALIDATION_FAILED', 'Duplicate attachment')
    const rows = await this.db
      .selectFrom('attachments')
      .select(['attachment_id', 'owner_account_id', 'kind', 'status', 'attached_at'])
      .where('attachment_id', 'in', parsed.map(p => p.attachmentId))
      .execute()
    for (const item of parsed) {
      const row = rows.find(r => r.attachment_id === item.attachmentId)
      // Never reveal whether someone else's attachment id exists.
      if (!row || row.owner_account_id !== context.accountId) fail('NOT_FOUND', 'Attachment not found')
      if (row!.status !== 'ready') fail('CONFLICT', 'Attachment is not ready')
      if (row!.attached_at) fail('CONFLICT', 'Attachment is already used')
      const allowed = kind === 'voice' ? ['audio'] : ['image', 'video']
      if (!allowed.includes(String(row!.kind))) fail('VALIDATION_FAILED', kind === 'voice' ? 'Voice messages need an audio attachment' : 'Unsupported attachment kind')
      if (kind === 'voice' && item.durationMs === null) fail('VALIDATION_FAILED', 'Voice messages need durationMs')
    }
    return parsed
  }

  /** Resolve `@handle` tokens to active members of the group (excluding the sender). */
  private async resolveMentions(conversationId: string, viewer: string, text: string): Promise<string[]> {
    const handles = [...new Set([...text.matchAll(/(^|[^\w@])@([a-z0-9_]{1,30})\b/gi)].map(m => m[2]!.toLowerCase()))].slice(0, MENTIONS_MAX)
    if (handles.length === 0) return []
    const rows = await this.db
      .selectFrom('greenfield_conversation_members as m')
      .innerJoin('profiles as p', 'p.actor_id', 'm.actor_id')
      .select('m.actor_id')
      .where('m.conversation_id', '=', conversationId)
      .where('m.state', '=', 'active')
      .where('m.actor_id', '!=', viewer)
      .where('p.deleted_at', 'is', null)
      .where('p.handle', 'in', handles)
      .execute()
    return rows.map(r => r.actor_id)
  }

  // ---- messaging v2: reactions, edit, unsend, typing, mute, archive ----

  private async messageExtras(rows: Array<{message_id: string; reply_to_message_id?: string | null}>, viewer: string): Promise<MessageExtras> {
    const reactions = new Map<string, ReactionDto[]>()
    const replies = new Map<string, ReplyPreviewDto>()
    const ids = rows.map(row => row.message_id)
    if (ids.length > 0) {
      const found = await this.db
        .selectFrom('greenfield_message_reactions')
        .select(['message_id', 'actor_id', 'emoji'])
        .where('message_id', 'in', ids)
        .orderBy('created_at')
        .execute()
      for (const r of found) {
        const list = reactions.get(r.message_id) ?? []
        let item = list.find(i => i.emoji === r.emoji)
        if (!item) {
          item = {emoji: r.emoji, count: 0, mine: false}
          list.push(item)
        }
        item.count += 1
        if (r.actor_id === viewer) item.mine = true
        reactions.set(r.message_id, list)
      }
    }
    const parentIds = [...new Set(rows.map(row => row.reply_to_message_id).filter((id): id is string => Boolean(id)))]
    if (parentIds.length > 0) {
      const parents = await this.db
        .selectFrom('greenfield_conversation_messages')
        .select(['message_id', 'sender_actor_id', 'body', 'deleted_at'])
        .where('message_id', 'in', parentIds)
        .execute()
      const people = await this.participants(parents.map(p => p.sender_actor_id))
      for (const p of parents) {
        replies.set(p.message_id, {
          id: p.message_id,
          senderId: p.sender_actor_id,
          senderName: people.get(p.sender_actor_id)?.displayName ?? 'Member',
          body: p.deleted_at ? '' : p.body.slice(0, 200),
          deleted: Boolean(p.deleted_at),
        })
      }
    }
    const attachments = new Map<string, MessageAttachmentDto[]>()
    const mentions = new Map<string, MentionDto[]>()
    if (ids.length > 0) {
      const files = await this.db
        .selectFrom('greenfield_message_attachments as ma')
        .innerJoin('attachments as a', 'a.attachment_id', 'ma.attachment_id')
        .select(['ma.message_id', 'ma.attachment_id', 'ma.position', 'ma.duration_ms', 'ma.waveform', 'a.kind', 'a.mime_type', 'a.byte_size', 'a.width', 'a.height'])
        .where('ma.message_id', 'in', ids)
        .orderBy('ma.position')
        .execute()
      for (const f of files) {
        const list = attachments.get(f.message_id) ?? []
        list.push({
          id: f.attachment_id,
          kind: f.kind as MessageAttachmentDto['kind'],
          mimeType: f.mime_type,
          byteSize: Number(f.byte_size),
          durationMs: f.duration_ms,
          waveform: Array.isArray(f.waveform) ? f.waveform as number[] : null,
          width: f.width,
          height: f.height,
          url: `${this.publicApiUrl}/v1/attachments/${f.attachment_id}/content`,
        })
        attachments.set(f.message_id, list)
      }
      const tagged = await this.db
        .selectFrom('greenfield_message_mentions as mm')
        .innerJoin('profiles as p', 'p.actor_id', 'mm.actor_id')
        .select(['mm.message_id', 'mm.actor_id', 'p.handle'])
        .where('mm.message_id', 'in', ids)
        .execute()
      for (const t of tagged) {
        const list = mentions.get(t.message_id) ?? []
        list.push({actorId: t.actor_id, handle: t.handle})
        mentions.set(t.message_id, list)
      }
    }
    return {reactions, replies, attachments, mentions}
  }

  private async liveMessage(viewer: string, conversationId: string, messageId: string) {
    const member = await this.membership(conversationId, viewer, 'chat')
    const row = await this.db
      .selectFrom('greenfield_conversation_messages')
      .selectAll()
      .where('message_id', '=', messageId)
      .where('conversation_id', '=', conversationId)
      .executeTakeFirst()
    if (!row || row.deleted_at) fail('NOT_FOUND', 'Message not found')
    return {member, row: row!}
  }

  async editMessage(viewer: string, conversationId: string, messageId: string, input: {text?: unknown}): Promise<MessageDto> {
    const {row} = await this.liveMessage(viewer, conversationId, messageId)
    if (row.sender_actor_id !== viewer) fail('FORBIDDEN', 'You can only edit your own messages')
    if (Date.now() - row.created_at.getTime() > EDIT_WINDOW_MS) fail('CONFLICT', 'This message can no longer be edited')
    const text = cleanText(input.text, MESSAGE_MAX, 'Message')
    const now = new Date()
    await this.db
      .updateTable('greenfield_conversation_messages')
      .set({body: text, edited_at: now})
      .where('message_id', '=', messageId)
      .execute()
    const people = await this.participants([viewer])
    const updated = {...row, body: text, edited_at: now}
    return this.messageDto(updated, viewer, people, [], await this.messageExtras([updated], viewer))
  }

  /** Unsend: the text is wiped server-side and the message shows as removed for everyone. */
  async unsendMessage(viewer: string, conversationId: string, messageId: string): Promise<void> {
    const {row} = await this.liveMessage(viewer, conversationId, messageId)
    if (row.sender_actor_id !== viewer) fail('FORBIDDEN', 'You can only unsend your own messages')
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_conversation_messages')
        .set({body: '-', deleted_at: new Date(), edited_at: null})
        .where('message_id', '=', messageId)
        .execute()
      await trx.deleteFrom('greenfield_message_reactions').where('message_id', '=', messageId).execute()
    })
  }

  async react(viewer: string, conversationId: string, messageId: string, input: {emoji?: unknown}, on: boolean): Promise<{reactions: ReactionDto[]}> {
    const {member} = await this.liveMessage(viewer, conversationId, messageId)
    if (member.state !== 'active') fail('FORBIDDEN', 'Accept this request before reacting')
    const emoji = cleanText(input.emoji, REACTION_MAX, 'Reaction')
    if (on) {
      await this.db
        .insertInto('greenfield_message_reactions')
        .values({message_id: messageId, actor_id: viewer, emoji, created_at: new Date()})
        .onConflict(oc => oc.doNothing())
        .execute()
    } else {
      await this.db
        .deleteFrom('greenfield_message_reactions')
        .where('message_id', '=', messageId)
        .where('actor_id', '=', viewer)
        .where('emoji', '=', emoji)
        .execute()
    }
    const extras = await this.messageExtras([{message_id: messageId}], viewer)
    return {reactions: extras.reactions.get(messageId) ?? []}
  }

  /** Returns false when nothing was published (inactive member or typing indicators off). */
  async setTyping(viewer: string, conversationId: string): Promise<boolean> {
    const member = await this.membership(conversationId, viewer, 'chat')
    if (member.state !== 'active') return false
    // Typing off is enforced server-side: nothing is stored or broadcast.
    if (!(await this.privacyFor([viewer])).get(viewer)!.typingIndicators) return false
    await this.db
      .updateTable('greenfield_conversation_members')
      .set({typing_at: new Date()})
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '=', viewer)
      .execute()
    return true
  }

  async typing(viewer: string, conversationId: string): Promise<{typing: ParticipantDto[]}> {
    await this.membership(conversationId, viewer, 'chat')
    const rows = await this.db
      .selectFrom('greenfield_conversation_members')
      .select('actor_id')
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '!=', viewer)
      .where('state', '=', 'active')
      .where('typing_at', '>', new Date(Date.now() - TYPING_TTL_MS))
      .execute()
    const [privacy, blocked] = await Promise.all([this.privacyFor(rows.map(r => r.actor_id)), this.blockedSet(viewer)])
    const visible = rows.filter(r => privacy.get(r.actor_id)!.typingIndicators && !blocked.has(r.actor_id))
    const people = await this.participants(visible.map(r => r.actor_id))
    return {typing: visible.map(r => people.get(r.actor_id)!)}
  }

  async setMuted(viewer: string, conversationId: string, input: {muted?: unknown; until?: unknown}): Promise<{muted: boolean; mutedUntil: string | null}> {
    await this.membership(conversationId, viewer, 'chat')
    const muted = input.muted === true
    let until: Date | null = null
    if (muted) {
      const parsed = typeof input.until === 'string' ? new Date(input.until) : null
      until = parsed && !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now() ? parsed : new Date('9999-12-31T00:00:00Z')
    }
    await this.db
      .updateTable('greenfield_conversation_members')
      .set({muted_until: until, updated_at: new Date()})
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '=', viewer)
      .execute()
    return {muted, mutedUntil: until ? until.toISOString() : null}
  }

  async setArchived(viewer: string, conversationId: string, input: {archived?: unknown}): Promise<{archived: boolean}> {
    await this.membership(conversationId, viewer, 'chat')
    const archived = input.archived !== false
    await this.db
      .updateTable('greenfield_conversation_members')
      .set({archived_at: archived ? new Date() : null, updated_at: new Date()})
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '=', viewer)
      .execute()
    return {archived}
  }

  async markRead(viewer: string, conversationId: string): Promise<void> {
    await this.membership(conversationId, viewer, 'chat')
    const now = new Date()
    await this.db
      .updateTable('greenfield_conversation_members')
      .set({last_read_at: now, updated_at: now})
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '=', viewer)
      .execute()
  }

  // ---- messaging v3: groups, privacy, receipts, reactors, search, presence ----

  private async activeMemberCounts(conversationIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>()
    if (conversationIds.length === 0) return map
    const rows = await this.db
      .selectFrom('greenfield_conversation_members')
      .select(['conversation_id', eb => eb.fn.countAll<number>().as('count')])
      .where('conversation_id', 'in', conversationIds)
      .where('state', '=', 'active')
      .groupBy('conversation_id')
      .execute()
    for (const row of rows) map.set(row.conversation_id, Number(row.count))
    return map
  }

  /** Messaging privacy with defaults for actors who never saved settings. */
  async privacyFor(actorIds: string[]): Promise<Map<string, MessagingPrivacyDto>> {
    const map = new Map<string, MessagingPrivacyDto>()
    const ids = [...new Set(actorIds)]
    if (ids.length === 0) return map
    const rows = await this.db.selectFrom('greenfield_messaging_privacy').selectAll().where('actor_id', 'in', ids).execute()
    for (const row of rows) map.set(row.actor_id, privacyDto(row))
    for (const id of ids) if (!map.has(id)) map.set(id, {...DEFAULT_PRIVACY})
    return map
  }

  async getPrivacy(viewer: string): Promise<MessagingPrivacyDto> {
    return (await this.privacyFor([viewer])).get(viewer)!
  }

  /** Partial update with optimistic concurrency on `version` (optional). */
  async updatePrivacy(viewer: string, input: Record<string, unknown>): Promise<MessagingPrivacyDto> {
    const allowed = new Set(['readReceipts', 'typingIndicators', 'presenceVisibility', 'notificationPreview', 'version'])
    for (const key of Object.keys(input)) if (!allowed.has(key)) fail('VALIDATION_FAILED', `Unknown field ${key}`)
    const current = await this.getPrivacy(viewer)
    if (input.version !== undefined && input.version !== current.version) fail('CONFLICT', 'Privacy settings changed; reload and retry')
    const bool = (key: string, fallback: boolean) => {
      const value = input[key]
      if (value === undefined) return fallback
      if (typeof value !== 'boolean') fail('VALIDATION_FAILED', `${key} must be a boolean`)
      return value as boolean
    }
    const presence = input.presenceVisibility ?? current.presenceVisibility
    if (presence !== 'contacts' && presence !== 'nobody') fail('VALIDATION_FAILED', 'presenceVisibility must be contacts or nobody')
    const preview = input.notificationPreview ?? current.notificationPreview
    if (preview !== 'full' && preview !== 'name_only' && preview !== 'none') fail('VALIDATION_FAILED', 'notificationPreview must be full, name_only or none')
    const next = {
      read_receipts_enabled: bool('readReceipts', current.readReceipts),
      typing_indicators_enabled: bool('typingIndicators', current.typingIndicators),
      presence_visibility: presence as 'contacts' | 'nobody',
      notification_preview: preview as 'full' | 'name_only' | 'none',
    }
    const now = new Date()
    const row = await this.db
      .insertInto('greenfield_messaging_privacy')
      .values({actor_id: viewer, ...next, version: 1, updated_at: now})
      .onConflict(oc => oc.column('actor_id').doUpdateSet({...next, version: sql`greenfield_messaging_privacy.version + 1`, updated_at: now}))
      .returningAll()
      .executeTakeFirstOrThrow()
    if (!next.typing_indicators_enabled) {
      // Turning typing off also withdraws any live typing signal immediately.
      await this.db.updateTable('greenfield_conversation_members').set({typing_at: null}).where('actor_id', '=', viewer).execute()
    }
    return privacyDto(row)
  }

  // ---- groups ----------------------------------------------------------

  private async resolveHandles(raw: unknown, max: number): Promise<string[]> {
    if (!Array.isArray(raw) || raw.length === 0) fail('VALIDATION_FAILED', 'Add at least one person')
    if ((raw as unknown[]).length > max) fail('VALIDATION_FAILED', `A group can have at most ${GROUP_MAX_MEMBERS} members`)
    const ids: string[] = []
    for (const handle of raw as unknown[]) ids.push(await this.resolveHandle(handle))
    return [...new Set(ids)]
  }

  /** Followers of the inviter join directly; everyone else gets a group invite (pending). */
  private async inviteStates(trx: Transaction<Database>, inviter: string, actorIds: string[]): Promise<Map<string, 'active' | 'pending'>> {
    const map = new Map<string, 'active' | 'pending'>()
    if (actorIds.length === 0) return map
    for (const id of actorIds) {
      if (await this.isBlockedEitherWayWith(trx, inviter, id)) fail('FORBIDDEN', 'You cannot add one or more of these accounts')
    }
    const follows = await trx
      .selectFrom('follows')
      .select('follower_actor_id')
      .where('follower_actor_id', 'in', actorIds)
      .where('followed_actor_id', '=', inviter)
      .where('deleted_at', 'is', null)
      .execute()
    const following = new Set(follows.map(f => f.follower_actor_id))
    for (const id of actorIds) map.set(id, following.has(id) ? 'active' : 'pending')
    return map
  }

  async createGroup(viewer: string, input: {title?: unknown; description?: unknown; handles?: unknown}): Promise<ConversationDto> {
    const title = cleanText(input.title, GROUP_TITLE_MAX, 'Group name')
    const description = input.description === undefined || input.description === null || input.description === '' ? null : cleanText(input.description, GROUP_DESCRIPTION_MAX, 'Description')
    const members = (await this.resolveHandles(input.handles, GROUP_MAX_MEMBERS - 1)).filter(id => id !== viewer)
    if (members.length === 0) fail('VALIDATION_FAILED', 'Add at least one person')
    const conversationId = randomUUID()
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      const states = await this.inviteStates(trx, viewer, members)
      await trx
        .insertInto('greenfield_conversations')
        .values({conversation_id: conversationId, kind: 'group', subject: null, title, description, direct_key: null, created_by_actor_id: viewer, created_at: now, updated_at: now, last_message_at: now})
        .execute()
      await trx
        .insertInto('greenfield_conversation_members')
        .values([
          {conversation_id: conversationId, actor_id: viewer, state: 'active', role: 'owner', added_by_actor_id: null, last_read_at: now, joined_at: now, updated_at: now},
          ...members.map(id => ({conversation_id: conversationId, actor_id: id, state: states.get(id)!, role: 'member' as const, added_by_actor_id: viewer, last_read_at: null, joined_at: now, updated_at: now})),
        ])
        .execute()
    })
    return this.conversationFor(viewer, conversationId)
  }

  private async groupMembership(viewer: string, conversationId: string) {
    const member = await this.membership(conversationId, viewer, 'chat')
    if (member.kind !== 'group') fail('NOT_FOUND', 'Group not found')
    return member
  }

  async getGroup(viewer: string, conversationId: string): Promise<GroupDetailDto> {
    const member = await this.groupMembership(viewer, conversationId)
    const rows = await this.db
      .selectFrom('greenfield_conversation_members')
      .select(['actor_id', 'state', 'role', 'joined_at', 'added_by_actor_id'])
      .where('conversation_id', '=', conversationId)
      .where('state', 'in', ['active', 'pending'])
      .orderBy('joined_at')
      .execute()
    const people = await this.participants(rows.map(r => r.actor_id))
    const blocked = await this.blockedSet(viewer)
    return {
      id: conversationId,
      title: member.title ?? 'Group',
      description: member.description ?? null,
      createdBy: member.created_by_actor_id,
      myRole: member.role,
      myState: member.state as 'active' | 'pending',
      maxMembers: GROUP_MAX_MEMBERS,
      members: rows.map(r => ({
        participant: people.get(r.actor_id)!,
        role: r.role,
        state: r.state as 'active' | 'pending',
        joinedAt: r.joined_at.toISOString(),
        isMe: r.actor_id === viewer,
        blocked: blocked.has(r.actor_id),
      })),
    }
  }

  async updateGroup(viewer: string, conversationId: string, input: {title?: unknown; description?: unknown}): Promise<GroupDetailDto> {
    const member = await this.groupMembership(viewer, conversationId)
    if (member.state !== 'active' || member.role === 'member') fail('FORBIDDEN', 'Only group admins can change group info')
    for (const key of Object.keys(input ?? {})) if (key !== 'title' && key !== 'description') fail('VALIDATION_FAILED', `Unknown field ${key}`)
    const set: {title?: string; description?: string | null; updated_at: Date} = {updated_at: new Date()}
    if (input.title !== undefined) set.title = cleanText(input.title, GROUP_TITLE_MAX, 'Group name')
    if (input.description !== undefined) set.description = input.description === null || input.description === '' ? null : cleanText(input.description, GROUP_DESCRIPTION_MAX, 'Description')
    await this.db.updateTable('greenfield_conversations').set(set).where('conversation_id', '=', conversationId).execute()
    return this.getGroup(viewer, conversationId)
  }

  async addGroupMembers(viewer: string, conversationId: string, input: {handles?: unknown}): Promise<{added: string[]; group: GroupDetailDto}> {
    const member = await this.groupMembership(viewer, conversationId)
    if (member.state !== 'active' || member.role === 'member') fail('FORBIDDEN', 'Only group admins can add people')
    const ids = (await this.resolveHandles(input.handles, GROUP_MAX_MEMBERS)).filter(id => id !== viewer)
    const added: string[] = []
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`group:${conversationId}`}, 0))`.execute(trx)
      const existing = await trx.selectFrom('greenfield_conversation_members').select(['actor_id', 'state'])
        .where('conversation_id', '=', conversationId).execute()
      const current = new Map(existing.map(r => [r.actor_id, r.state]))
      const fresh = ids.filter(id => !['active', 'pending'].includes(current.get(id) ?? ''))
      const activeOrPending = existing.filter(r => r.state === 'active' || r.state === 'pending').length
      if (activeOrPending + fresh.length > GROUP_MAX_MEMBERS) fail('CONFLICT', `A group can have at most ${GROUP_MAX_MEMBERS} members`)
      const states = await this.inviteStates(trx, viewer, fresh)
      for (const id of fresh) {
        await trx.insertInto('greenfield_conversation_members')
          .values({conversation_id: conversationId, actor_id: id, state: states.get(id)!, role: 'member', added_by_actor_id: viewer, last_read_at: null, joined_at: now, updated_at: now})
          .onConflict(oc => oc.columns(['conversation_id', 'actor_id']).doUpdateSet({state: states.get(id)!, role: 'member', added_by_actor_id: viewer, last_read_at: null, joined_at: now, updated_at: now, archived_at: null, muted_until: null}))
          .execute()
        added.push(id)
      }
    })
    return {added, group: await this.getGroup(viewer, conversationId)}
  }

  /** Admins remove members; owners can also remove admins. Removing yourself is `leaveGroup`. */
  async removeGroupMember(viewer: string, conversationId: string, targetActorId: string): Promise<GroupDetailDto> {
    if (targetActorId === viewer) fail('VALIDATION_FAILED', 'Use leave to remove yourself')
    const member = await this.groupMembership(viewer, conversationId)
    if (member.state !== 'active' || member.role === 'member') fail('FORBIDDEN', 'Only group admins can remove people')
    const target = await this.db.selectFrom('greenfield_conversation_members').select(['role', 'state'])
      .where('conversation_id', '=', conversationId).where('actor_id', '=', targetActorId).executeTakeFirst()
    if (!target || !['active', 'pending'].includes(target.state)) fail('NOT_FOUND', 'Member not found')
    if (target!.role === 'owner') fail('FORBIDDEN', 'The group owner cannot be removed')
    if (target!.role === 'admin' && member.role !== 'owner') fail('FORBIDDEN', 'Only the owner can remove an admin')
    await this.db.updateTable('greenfield_conversation_members')
      .set({state: 'removed', role: 'member', typing_at: null, updated_at: new Date()})
      .where('conversation_id', '=', conversationId).where('actor_id', '=', targetActorId).execute()
    return this.getGroup(viewer, conversationId)
  }

  /** Leave a group. An owner hands ownership to the longest-standing admin, else member. */
  async leaveGroup(viewer: string, conversationId: string): Promise<void> {
    const member = await this.groupMembership(viewer, conversationId)
    await this.db.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`group:${conversationId}`}, 0))`.execute(trx)
      const now = new Date()
      await trx.updateTable('greenfield_conversation_members')
        .set({state: member.state === 'pending' ? 'declined' : 'left', role: 'member', typing_at: null, updated_at: now})
        .where('conversation_id', '=', conversationId).where('actor_id', '=', viewer).execute()
      if (member.role === 'owner') {
        const heir = await trx.selectFrom('greenfield_conversation_members').select('actor_id')
          .where('conversation_id', '=', conversationId).where('state', '=', 'active')
          .orderBy(sql`CASE role WHEN 'admin' THEN 0 ELSE 1 END`).orderBy('joined_at').executeTakeFirst()
        if (heir) {
          await trx.updateTable('greenfield_conversation_members').set({role: 'owner', updated_at: now})
            .where('conversation_id', '=', conversationId).where('actor_id', '=', heir.actor_id).execute()
        }
      }
    })
  }

  async setGroupRole(viewer: string, conversationId: string, targetActorId: string, input: {role?: unknown}): Promise<GroupDetailDto> {
    const member = await this.groupMembership(viewer, conversationId)
    if (member.state !== 'active' || member.role !== 'owner') fail('FORBIDDEN', 'Only the group owner can change roles')
    const role = input.role
    if (role !== 'admin' && role !== 'member' && role !== 'owner') fail('VALIDATION_FAILED', 'role must be owner, admin or member')
    if (targetActorId === viewer) fail('VALIDATION_FAILED', 'Choose another member')
    const target = await this.db.selectFrom('greenfield_conversation_members').select(['state'])
      .where('conversation_id', '=', conversationId).where('actor_id', '=', targetActorId).executeTakeFirst()
    if (!target || target.state !== 'active') fail('NOT_FOUND', 'Member not found')
    await this.db.transaction().execute(async trx => {
      const now = new Date()
      await trx.updateTable('greenfield_conversation_members').set({role: role as GroupRole, updated_at: now})
        .where('conversation_id', '=', conversationId).where('actor_id', '=', targetActorId).execute()
      if (role === 'owner') {
        // Ownership transfer: the previous owner becomes an admin.
        await trx.updateTable('greenfield_conversation_members').set({role: 'admin', updated_at: now})
          .where('conversation_id', '=', conversationId).where('actor_id', '=', viewer).execute()
      }
    })
    return this.getGroup(viewer, conversationId)
  }

  // ---- who reacted / seen by -------------------------------------------

  async reactionDetails(viewer: string, conversationId: string, messageId: string): Promise<{reactions: Array<ReactionDto & {actors: ParticipantDto[]}>}> {
    await this.liveMessage(viewer, conversationId, messageId)
    const blocked = await this.blockedSet(viewer)
    const rows = await this.db
      .selectFrom('greenfield_message_reactions')
      .select(['actor_id', 'emoji'])
      .where('message_id', '=', messageId)
      .orderBy('created_at')
      .execute()
    const visible = rows.filter(r => !blocked.has(r.actor_id))
    const people = await this.participants(visible.map(r => r.actor_id))
    const grouped = new Map<string, ReactionDto & {actors: ParticipantDto[]}>()
    for (const r of visible) {
      const item = grouped.get(r.emoji) ?? {emoji: r.emoji, count: 0, mine: false, actors: []}
      item.count += 1
      if (r.actor_id === viewer) item.mine = true
      item.actors.push(people.get(r.actor_id)!)
      grouped.set(r.emoji, item)
    }
    return {reactions: [...grouped.values()]}
  }

  /**
   * Seen-by for the viewer's own message. `readAt` is the member's latest
   * read position, so it means "read on or before". Members with receipts
   * off are counted in `hiddenCount`; a viewer with receipts off sees none.
   */
  async messageReceipts(viewer: string, conversationId: string, messageId: string): Promise<MessageReceiptsDto> {
    const {row} = await this.liveMessage(viewer, conversationId, messageId)
    if (row.sender_actor_id !== viewer) fail('FORBIDDEN', 'Read receipts are only available for your own messages')
    const mine = await this.getPrivacy(viewer)
    const members = await this.db
      .selectFrom('greenfield_conversation_members')
      .select(['actor_id', 'last_read_at'])
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '!=', viewer)
      .where('state', '=', 'active')
      .execute()
    if (!mine.readReceipts) return {readBy: [], notYet: [], hiddenCount: members.length, receiptsDisabled: true}
    const [privacy, blocked] = await Promise.all([this.privacyFor(members.map(m => m.actor_id)), this.blockedSet(viewer)])
    const shown = members.filter(m => privacy.get(m.actor_id)!.readReceipts && !blocked.has(m.actor_id))
    const people = await this.participants(shown.map(m => m.actor_id))
    const at = row.created_at.getTime()
    return {
      readBy: shown.filter(m => (m.last_read_at?.getTime() ?? 0) >= at)
        .map(m => ({participant: people.get(m.actor_id)!, readAt: m.last_read_at!.toISOString()})),
      notYet: shown.filter(m => (m.last_read_at?.getTime() ?? 0) < at).map(m => people.get(m.actor_id)!),
      hiddenCount: members.length - shown.length,
      receiptsDisabled: false,
    }
  }

  // ---- full history search ---------------------------------------------

  /**
   * Search every direct and group conversation the viewer is an active
   * member of. Unsent messages, declined requests, left groups and group
   * content from blocked actors never match.
   */
  async searchMessages(viewer: string, query: {q?: unknown; conversationId?: unknown; cursor?: unknown; limit?: unknown}): Promise<Page<SearchHitDto>> {
    const q = typeof query.q === 'string' ? query.q.trim() : ''
    if (q.length < 2) fail('VALIDATION_FAILED', 'Search needs at least 2 characters')
    if (q.length > 200) fail('VALIDATION_FAILED', 'Search is too long')
    const limit = clampLimit(query.limit, 20, 50)
    const cursor = decodeCursor(typeof query.cursor === 'string' ? query.cursor : null)
    const conversationId = typeof query.conversationId === 'string' && query.conversationId ? query.conversationId : null
    if (conversationId) await this.membership(conversationId, viewer, 'chat')
    const hidden = [...await this.blockedSet(viewer)]
    const pattern = `%${q.replace(/[\\%_]/g, ch => `\\${ch}`)}%`
    let search = this.db
      .selectFrom('greenfield_conversation_messages as msg')
      .innerJoin('greenfield_conversation_members as m', join => join.onRef('m.conversation_id', '=', 'msg.conversation_id').on('m.actor_id', '=', viewer))
      .innerJoin('greenfield_conversations as c', 'c.conversation_id', 'msg.conversation_id')
      .select(['msg.message_id', 'msg.conversation_id', 'msg.sender_actor_id', 'msg.body', 'msg.created_at', 'msg.message_kind', 'c.kind', 'c.title'])
      .where('m.state', '=', 'active')
      .where('c.kind', 'in', ['direct', 'group'])
      .where('msg.deleted_at', 'is', null)
      .where(eb => eb.or([
        sql<boolean>`to_tsvector('simple', msg.body) @@ websearch_to_tsquery('simple', ${q})`,
        eb('msg.body', 'ilike', pattern),
      ]))
    if (conversationId) search = search.where('msg.conversation_id', '=', conversationId)
    if (hidden.length > 0) {
      search = search.where(eb => eb.or([eb('c.kind', '=', 'direct'), eb('msg.sender_actor_id', 'not in', hidden)]))
    }
    if (cursor) {
      search = search.where(eb => eb.or([
        eb('msg.created_at', '<', cursor.at),
        eb.and([eb('msg.created_at', '=', cursor.at), eb('msg.message_id', '<', cursor.id)]),
      ]))
    }
    const rows = await search.orderBy('msg.created_at', 'desc').orderBy('msg.message_id', 'desc').limit(limit + 1).execute()
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)
    const people = await this.participants(page.map(r => r.sender_actor_id))
    const last = page.at(-1)
    return {
      items: page.map(r => ({
        messageId: r.message_id,
        conversationId: r.conversation_id,
        conversationKind: r.kind as 'direct' | 'group',
        groupTitle: r.kind === 'group' ? r.title : null,
        sender: people.get(r.sender_actor_id)!,
        isOwn: r.sender_actor_id === viewer,
        snippet: snippetFor(r.body, q),
        kind: r.message_kind,
        sentAt: r.created_at.toISOString(),
      })),
      nextCursor: hasMore && last ? encodeCursor(last.created_at, last.message_id) : null,
      hasMore,
    }
  }

  // ---- presence ----------------------------------------------------------

  async touchPresence(viewer: string, at: Date = new Date()): Promise<void> {
    await this.db
      .insertInto('greenfield_actor_presence')
      .values({actor_id: viewer, last_active_at: at})
      .onConflict(oc => oc.column('actor_id').doUpdateSet({last_active_at: at}))
      .execute()
  }

  /** Actors sharing an active direct or group conversation with `viewer`, minus blocks. */
  async contactsOf(viewer: string, among?: string[]): Promise<Set<string>> {
    let query = this.db
      .selectFrom('greenfield_conversation_members as mine')
      .innerJoin('greenfield_conversation_members as theirs', 'theirs.conversation_id', 'mine.conversation_id')
      .innerJoin('greenfield_conversations as c', 'c.conversation_id', 'mine.conversation_id')
      .select('theirs.actor_id')
      .distinct()
      .where('mine.actor_id', '=', viewer)
      .where('mine.state', '=', 'active')
      .where('theirs.state', '=', 'active')
      .where('theirs.actor_id', '!=', viewer)
      .where('c.kind', 'in', ['direct', 'group'])
    if (among) {
      if (among.length === 0) return new Set()
      query = query.where('theirs.actor_id', 'in', among)
    }
    const [rows, blocked] = await Promise.all([query.execute(), this.blockedSet(viewer)])
    return new Set(rows.map(r => r.actor_id).filter(id => !blocked.has(id)))
  }

  /**
   * Presence for up to 50 actors. Only contacts are answered; `nobody`
   * hides an actor, and is reciprocal (you then see no one). Anything not
   * visible is returned as `hidden` rather than guessed.
   */
  async presence(viewer: string, rawIds: unknown, onlineNow: (actorId: string) => boolean = () => false): Promise<{items: PresenceDto[]}> {
    const ids = typeof rawIds === 'string' ? rawIds.split(',').map(id => id.trim()).filter(Boolean) : Array.isArray(rawIds) ? rawIds.filter((v): v is string => typeof v === 'string') : []
    if (ids.length === 0) fail('VALIDATION_FAILED', 'actorIds is required')
    if (ids.length > 50) fail('VALIDATION_FAILED', 'At most 50 actors per request')
    const unique = [...new Set(ids)].filter(id => id !== viewer)
    const [contacts, privacy, rows] = await Promise.all([
      this.contactsOf(viewer, unique),
      this.privacyFor([viewer, ...unique]),
      unique.length > 0 ? this.db.selectFrom('greenfield_actor_presence').selectAll().where('actor_id', 'in', unique).execute() : Promise.resolve([]),
    ])
    const viewerHidden = privacy.get(viewer)!.presenceVisibility === 'nobody'
    const seen = new Map(rows.map(r => [r.actor_id, r.last_active_at]))
    return {
      items: unique.map(id => {
        if (viewerHidden || !contacts.has(id) || privacy.get(id)!.presenceVisibility === 'nobody') {
          return {actorId: id, status: 'hidden' as const, lastActiveAt: null}
        }
        const last = seen.get(id) ?? null
        const online = onlineNow(id) || Boolean(last && Date.now() - last.getTime() < PRESENCE_ONLINE_MS)
        return {actorId: id, status: online ? 'online' as const : 'offline' as const, lastActiveAt: last ? last.toISOString() : null}
      }),
    }
  }

  // ---- realtime fan-out helpers ---------------------------------------

  /**
   * Recipients for a realtime event about `conversationId` caused by
   * `actorId`: active members, minus anyone blocked either way with the actor.
   */
  async realtimeRecipients(conversationId: string, actorId: string, options: {includeActor?: boolean} = {}): Promise<string[]> {
    const rows = await this.db
      .selectFrom('greenfield_conversation_members')
      .select('actor_id')
      .where('conversation_id', '=', conversationId)
      .where('state', '=', 'active')
      .execute()
    const blocked = await this.blockedSet(actorId)
    return rows.map(r => r.actor_id).filter(id => (options.includeActor || id !== actorId) && !blocked.has(id))
  }

  /** True when the reader publishes receipts; recipients with receipts off are filtered by the caller. */
  async receiptRecipients(conversationId: string, reader: string): Promise<string[]> {
    if (!(await this.getPrivacy(reader)).readReceipts) return []
    const recipients = await this.realtimeRecipients(conversationId, reader)
    const privacy = await this.privacyFor(recipients)
    return recipients.filter(id => privacy.get(id)!.readReceipts)
  }

  /** Recipients of a presence change: contacts who may see it (both sides `contacts`). */
  async presenceRecipients(actorId: string): Promise<string[]> {
    if ((await this.getPrivacy(actorId)).presenceVisibility === 'nobody') return []
    const contacts = [...await this.contactsOf(actorId)]
    const privacy = await this.privacyFor(contacts)
    return contacts.filter(id => privacy.get(id)!.presenceVisibility !== 'nobody')
  }

  /** Attachment read gate for message-bound files (see register-attachment-routes). */
  async canViewMessageAttachment(actorId: string, attachmentId: string): Promise<boolean> {
    const binding = await this.db
      .selectFrom('greenfield_message_attachments as ma')
      .innerJoin('greenfield_conversation_messages as msg', 'msg.message_id', 'ma.message_id')
      .innerJoin('greenfield_conversations as c', 'c.conversation_id', 'msg.conversation_id')
      .innerJoin('greenfield_conversation_members as m', join => join.onRef('m.conversation_id', '=', 'msg.conversation_id').on('m.actor_id', '=', actorId))
      .select(['msg.sender_actor_id', 'msg.deleted_at', 'c.kind', 'm.state'])
      .where('ma.attachment_id', '=', attachmentId)
      .executeTakeFirst()
    if (!binding || binding.deleted_at || binding.state !== 'active') return false
    if (binding.sender_actor_id === actorId) return true
    if (binding.kind === 'group' && (await this.blockedSet(actorId)).has(binding.sender_actor_id)) return false
    return true
  }

  /** Lightweight membership probe used by the realtime socket. */
  async isActiveMember(conversationId: string, actorId: string): Promise<boolean> {
    try {
      const member = await this.membership(conversationId, actorId, 'chat')
      return member.state === 'active'
    } catch {
      return false
    }
  }

  /** Push copy for one recipient after applying their notification preview preference. */
  async pushPlan(conversationId: string, senderActorId: string, message: MessageDto, mentionedActorIds: string[] = []): Promise<PushPlanItem[]> {
    const convo = await this.db.selectFrom('greenfield_conversations').select(['kind', 'title']).where('conversation_id', '=', conversationId).executeTakeFirst()
    if (!convo) return []
    const members = await this.db
      .selectFrom('greenfield_conversation_members')
      .select(['actor_id', 'state', 'muted_until'])
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '<>', senderActorId)
      .where('state', 'in', ['active', 'pending'])
      .execute()
    const blocked = await this.blockedSet(senderActorId)
    const eligible = members.filter(m => !blocked.has(m.actor_id))
    if (eligible.length === 0) return []
    const [privacy, sender] = await Promise.all([
      this.privacyFor(eligible.map(m => m.actor_id)),
      this.db.selectFrom('profiles').select(['handle', 'display_name']).where('actor_id', '=', senderActorId).executeTakeFirst(),
    ])
    const name = (sender as any)?.display_name || (sender?.handle ? `@${sender.handle}` : 'Someone')
    const mentioned = new Set(mentionedActorIds)
    const isGroup = convo.kind === 'group'
    const groupTitle = convo.title ?? 'Group'
    const text = message.kind === 'voice'
      ? 'Voice message'
      : message.kind === 'media' ? 'Photo or video' : message.body.trim().replace(/\s+/g, ' ').slice(0, 160) || 'sent you a message'
    const plan: PushPlanItem[] = []
    for (const m of eligible) {
      const isMention = mentioned.has(m.actor_id) && m.state === 'active'
      const muted = Boolean(m.muted_until && m.muted_until > new Date())
      // Muted chats stay quiet until the mute ends; a direct @mention still notifies.
      if (muted && !isMention) continue
      if (isGroup && m.state === 'pending') continue
      const preference = privacy.get(m.actor_id)!.notificationPreview
      let title: string
      let body: string
      if (preference === 'none') {
        title = 'Modula'
        body = isMention ? 'You were mentioned' : 'New message'
      } else if (preference === 'name_only') {
        title = isGroup ? groupTitle : m.state === 'pending' ? `Message request from ${name}` : name
        body = isMention ? `${name} mentioned you` : isGroup ? `New message from ${name}` : 'New message'
      } else {
        title = isGroup ? groupTitle : m.state === 'pending' ? `Message request from ${name}` : name
        body = isMention ? `${name} mentioned you: ${text}` : isGroup ? `${name}: ${text}` : text
      }
      plan.push({recipientActorId: m.actor_id, title, body, mention: isMention, preview: preference})
    }
    return plan
  }


  // ---- requests --------------------------------------------------------

  async listRequests(viewer: string): Promise<{items: MessageRequestDto[]}> {
    const {page} = await this.listForViewer(viewer, 'chat', 'pending', null, 50)
    const ids = page.map(row => row.conversation_id)
    const [others, latest, inviters, counts] = await Promise.all([
      this.otherMembers(ids, viewer),
      this.latestMessages(ids),
      this.db.selectFrom('greenfield_conversation_members').select(['conversation_id', 'added_by_actor_id'])
        .where('conversation_id', 'in', ids.length > 0 ? ids : ['-']).where('actor_id', '=', viewer).execute(),
      this.activeMemberCounts(page.filter(row => row.kind === 'group').map(row => row.conversation_id)),
    ])
    const inviterOf = new Map(inviters.map(row => [row.conversation_id, row.added_by_actor_id]))
    const people = await this.participants([...[...others.values()].flat(), ...inviters.map(r => r.added_by_actor_id).filter((id): id is string => Boolean(id))])
    const items = page.map(row => {
      const isGroup = row.kind === 'group'
      const senderId = (isGroup ? inviterOf.get(row.conversation_id) : null) ?? latest.get(row.conversation_id)?.sender_actor_id ?? others.get(row.conversation_id)?.[0] ?? ''
      return {
        id: row.conversation_id,
        conversationId: row.conversation_id,
        kind: isGroup ? 'group' as const : 'direct' as const,
        group: isGroup ? {title: row.title ?? 'Group', description: row.description ?? null, memberCount: counts.get(row.conversation_id) ?? 1, myRole: row.role} : null,
        sender: people.get(senderId) ?? {id: senderId, handle: '', displayName: 'Member', avatarUrl: null},
        preview: isGroup ? `Invited you to ${row.title ?? 'a group'}` : latest.get(row.conversation_id)?.body ?? 'Wants to send you a message.',
        createdAt: row.created_at.toISOString(),
      }
    })
    return {items}
  }

  private async pendingRequest(viewer: string, requestId: string) {
    const member = await this.membership(requestId, viewer, 'chat')
    if (member.state !== 'pending') fail('NOT_FOUND', 'Request not found')
    return member
  }

  async acceptRequest(viewer: string, requestId: string): Promise<ConversationDto> {
    await this.pendingRequest(viewer, requestId)
    await this.db
      .updateTable('greenfield_conversation_members')
      .set({state: 'active', updated_at: new Date()})
      .where('conversation_id', '=', requestId)
      .where('actor_id', '=', viewer)
      .execute()
    return this.conversationFor(viewer, requestId)
  }

  async declineRequest(viewer: string, requestId: string): Promise<void> {
    await this.pendingRequest(viewer, requestId)
    await this.db
      .updateTable('greenfield_conversation_members')
      .set({state: 'declined', updated_at: new Date()})
      .where('conversation_id', '=', requestId)
      .where('actor_id', '=', viewer)
      .execute()
  }

  // ---- In-Mail ---------------------------------------------------------

  async listInMail(viewer: string, cursor: unknown, limit: unknown): Promise<Page<InMailThreadDto>> {
    const {page, hasMore, nextCursor} = await this.listForViewer(viewer, 'inmail', 'active', cursor, limit)
    const ids = page.map(row => row.conversation_id)
    const [others, latest, unread] = await Promise.all([
      this.otherMembers(ids, viewer),
      this.latestMessages(ids),
      this.unreadCounts(page, viewer),
    ])
    const people = await this.participants([...others.values()].flat())
    const items = page.map(row => ({
      id: row.conversation_id,
      subject: row.subject ?? '(No subject)',
      participants: (others.get(row.conversation_id) ?? []).map(id => people.get(id)!),
      preview: (latest.get(row.conversation_id)?.body ?? '').slice(0, 280),
      unread: (unread.get(row.conversation_id) ?? 0) > 0,
      updatedAt: row.last_message_at.toISOString(),
    }))
    return {items, nextCursor, hasMore}
  }

  private async threadDto(viewer: string, threadId: string, unread: boolean): Promise<InMailThreadDto> {
    const member = await this.membership(threadId, viewer, 'inmail')
    const others = await this.otherMembers([threadId], viewer)
    const latest = await this.latestMessages([threadId])
    const people = await this.participants(others.get(threadId) ?? [])
    return {
      id: threadId,
      subject: member.subject ?? '(No subject)',
      participants: (others.get(threadId) ?? []).map(id => people.get(id)!),
      preview: (latest.get(threadId)?.body ?? '').slice(0, 280),
      unread,
      updatedAt: member.last_message_at.toISOString(),
    }
  }

  async composeInMail(viewer: string, input: {to?: unknown; subject?: unknown; body?: unknown}): Promise<InMailThreadDto> {
    const recipient = await this.resolveHandle(input.to)
    if (recipient === viewer) fail('VALIDATION_FAILED', 'You cannot send In-Mail to yourself')
    if (await this.isBlockedEitherWay(viewer, recipient)) fail('FORBIDDEN', 'You cannot message this account')
    const subject = cleanText(input.subject, SUBJECT_MAX, 'Subject')
    const body = cleanText(input.body, INMAIL_BODY_MAX, 'Message')
    const threadId = randomUUID()
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_conversations')
        .values({conversation_id: threadId, kind: 'inmail', subject, direct_key: null, created_by_actor_id: viewer, created_at: now, updated_at: now, last_message_at: now})
        .execute()
      await trx
        .insertInto('greenfield_conversation_members')
        .values([
          {conversation_id: threadId, actor_id: viewer, state: 'active', last_read_at: now, joined_at: now, updated_at: now},
          {conversation_id: threadId, actor_id: recipient, state: 'active', last_read_at: null, joined_at: now, updated_at: now},
        ])
        .execute()
      await trx
        .insertInto('greenfield_conversation_messages')
        .values({message_id: randomUUID(), conversation_id: threadId, sender_actor_id: viewer, subject, body, created_at: now})
        .execute()
    })
    return this.threadDto(viewer, threadId, false)
  }

  async getInMail(viewer: string, threadId: string): Promise<{thread: InMailThreadDto; messages: MessageDto[]}> {
    await this.membership(threadId, viewer, 'inmail')
    const rows = await this.db
      .selectFrom('greenfield_conversation_messages')
      .selectAll()
      .where('conversation_id', '=', threadId)
      .orderBy('created_at', 'asc')
      .orderBy('message_id', 'asc')
      .limit(200)
      .execute()
    const people = await this.participants(rows.map(r => r.sender_actor_id))
    const now = new Date()
    await this.db
      .updateTable('greenfield_conversation_members')
      .set({last_read_at: now, updated_at: now})
      .where('conversation_id', '=', threadId)
      .where('actor_id', '=', viewer)
      .execute()
    return {
      thread: await this.threadDto(viewer, threadId, false),
      messages: rows.map(row => this.messageDto(row, viewer, people)),
    }
  }

  async replyInMail(viewer: string, threadId: string, input: {body?: unknown}): Promise<MessageDto> {
    const member = await this.membership(threadId, viewer, 'inmail')
    const body = cleanText(input.body, INMAIL_BODY_MAX, 'Message')
    const others = await this.otherMembers([threadId], viewer)
    for (const other of others.get(threadId) ?? []) {
      if (await this.isBlockedEitherWay(viewer, other)) fail('FORBIDDEN', 'You cannot message this account')
    }
    const subject = member.subject ? `Re: ${member.subject}`.slice(0, SUBJECT_MAX) : null
    const {messageId, now} = await this.insertMessage(threadId, viewer, body, subject)
    const people = await this.participants([viewer])
    return this.messageDto(
      {message_id: messageId, conversation_id: threadId, sender_actor_id: viewer, subject, body, created_at: now},
      viewer,
      people,
    )
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function storyMessageContext(value: unknown): StoryMessageContext | null {
  const context = asRecord(value)
  if (
    context.type !== 'story' ||
    typeof context.storyId !== 'string' ||
    typeof context.groupId !== 'string' ||
    typeof context.ownerActorId !== 'string' ||
    (context.mediaKind !== 'image' && context.mediaKind !== 'video') ||
    typeof context.createdAt !== 'string' ||
    typeof context.expiresAt !== 'string'
  ) return null
  return {
    type: 'story',
    storyId: context.storyId,
    groupId: context.groupId,
    ownerActorId: context.ownerActorId,
    mediaKind: context.mediaKind,
    createdAt: context.createdAt,
    expiresAt: context.expiresAt,
  }
}

export type MessagingPrivacyDto = {
  readReceipts: boolean
  typingIndicators: boolean
  presenceVisibility: 'contacts' | 'nobody'
  notificationPreview: 'full' | 'name_only' | 'none'
  version: number
  updatedAt: string | null
}
export type GroupMemberDto = {participant: ParticipantDto; role: GroupRole; state: 'active' | 'pending'; joinedAt: string; isMe: boolean; blocked: boolean}
export type GroupDetailDto = {
  id: string
  title: string
  description: string | null
  createdBy: string
  myRole: GroupRole
  myState: 'active' | 'pending'
  maxMembers: number
  members: GroupMemberDto[]
}
export type MessageReceiptsDto = {
  readBy: Array<{participant: ParticipantDto; readAt: string}>
  notYet: ParticipantDto[]
  hiddenCount: number
  receiptsDisabled: boolean
}
export type SearchHitDto = {
  messageId: string
  conversationId: string
  conversationKind: 'direct' | 'group'
  groupTitle: string | null
  sender: ParticipantDto
  isOwn: boolean
  snippet: string
  kind: MessageKind
  sentAt: string
}
export type PresenceDto = {actorId: string; status: 'online' | 'offline' | 'hidden'; lastActiveAt: string | null}
export type PushPlanItem = {recipientActorId: string; title: string; body: string; mention: boolean; preview: 'full' | 'name_only' | 'none'}

/** A heartbeat (or an open socket) within this window counts as online. */
export const PRESENCE_ONLINE_MS = 70_000

const DEFAULT_PRIVACY: MessagingPrivacyDto = {
  readReceipts: true,
  typingIndicators: true,
  presenceVisibility: 'contacts',
  notificationPreview: 'full',
  version: 0,
  updatedAt: null,
}

function privacyDto(row: Database['greenfield_messaging_privacy']): MessagingPrivacyDto {
  return {
    readReceipts: row.read_receipts_enabled,
    typingIndicators: row.typing_indicators_enabled,
    presenceVisibility: row.presence_visibility,
    notificationPreview: row.notification_preview,
    version: row.version,
    updatedAt: row.updated_at.toISOString(),
  }
}

function parseClientMessageId(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw !== 'string' || !/^[A-Za-z0-9._:-]{8,64}$/.test(raw)) fail('VALIDATION_FAILED', 'clientMessageId must be 8-64 URL-safe characters')
  return raw as string
}

function snippetFor(body: string, q: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  const index = flat.toLowerCase().indexOf(q.toLowerCase().split(/\s+/)[0] ?? '')
  if (flat.length <= 160) return flat
  const start = Math.max(0, (index < 0 ? 0 : index) - 60)
  return `${start > 0 ? '…' : ''}${flat.slice(start, start + 160)}${start + 160 < flat.length ? '…' : ''}`
}
