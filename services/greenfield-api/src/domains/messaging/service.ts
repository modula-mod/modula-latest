import {randomUUID} from 'node:crypto'
import {sql, type Transaction} from 'kysely'
import {badgesForActors, NO_BADGES, type PublicBadgeFields} from '../../premium/badges.js'

import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'

export type ParticipantDto = {id: string; handle: string; displayName: string; avatarUrl: string | null} & Partial<PublicBadgeFields>
export type MessagePreviewDto = {id: string; body: string; sentAt: string; senderId: string}
export type ConversationDto = {
  id: string
  kind: 'direct' | 'request'
  participants: ParticipantDto[]
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
type MessageExtras = {reactions: Map<string, ReactionDto[]>; replies: Map<string, ReplyPreviewDto>}
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
  constructor(private readonly db: ModulaDb) {}

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

  private async membership(conversationId: string, actorId: string, kind: 'direct' | 'inmail') {
    const row = await this.db
      .selectFrom('greenfield_conversation_members as m')
      .innerJoin('greenfield_conversations as c', 'c.conversation_id', 'm.conversation_id')
      .select(['m.state', 'm.last_read_at', 'c.kind', 'c.subject', 'c.last_message_at', 'c.created_by_actor_id'])
      .where('m.conversation_id', '=', conversationId)
      .where('m.actor_id', '=', actorId)
      .executeTakeFirst()
    if (!row || row.kind !== kind || row.state === 'declined') fail('NOT_FOUND', 'Conversation not found')
    return row!
  }

  private async otherMembers(conversationIds: string[], viewer: string): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>()
    if (conversationIds.length === 0) return map
    const rows = await this.db
      .selectFrom('greenfield_conversation_members')
      .select(['conversation_id', 'actor_id'])
      .where('conversation_id', 'in', conversationIds)
      .where('actor_id', '!=', viewer)
      .execute()
    for (const row of rows) {
      const list = map.get(row.conversation_id) ?? []
      list.push(row.actor_id)
      map.set(row.conversation_id, list)
    }
    return map
  }

  private async latestMessages(conversationIds: string[]) {
    const map = new Map<string, {message_id: string; body: string; created_at: Date; sender_actor_id: string; deleted_at: Date | null}>()
    if (conversationIds.length === 0) return map
    const rows = await this.db
      .selectFrom('greenfield_conversation_messages')
      .select(['conversation_id', 'message_id', 'body', 'created_at', 'sender_actor_id', 'deleted_at'])
      .distinctOn('conversation_id')
      .where('conversation_id', 'in', conversationIds)
      .orderBy('conversation_id')
      .orderBy('created_at', 'desc')
      .orderBy('message_id', 'desc')
      .execute()
    for (const row of rows) map.set(row.conversation_id, row)
    return map
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

  private async unreadCounts(rows: {conversation_id: string; last_read_at: Date | null}[], viewer: string) {
    const map = new Map<string, number>()
    for (const row of rows) {
      let query = this.db
        .selectFrom('greenfield_conversation_messages')
        .select(eb => eb.fn.countAll<number>().as('count'))
        .where('conversation_id', '=', row.conversation_id)
        .where('sender_actor_id', '!=', viewer)
      if (row.last_read_at) query = query.where('created_at', '>', row.last_read_at)
      const result = await query.executeTakeFirst()
      map.set(row.conversation_id, Number(result?.count ?? 0))
    }
    return map
  }

  private async insertMessage(conversationId: string, sender: string, body: string, subject: string | null = null, replyTo: string | null = null) {
    const now = new Date()
    const messageId = randomUUID()
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_conversation_messages')
        .values({message_id: messageId, conversation_id: conversationId, sender_actor_id: sender, subject, body, created_at: now, reply_to_message_id: replyTo})
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

  private async listForViewer(viewer: string, kind: 'direct' | 'inmail', state: 'active' | 'pending', cursorRaw: unknown, limitRaw: unknown, archived: boolean | null = null) {
    const limit = clampLimit(limitRaw, 30, 50)
    const cursor = decodeCursor(typeof cursorRaw === 'string' ? cursorRaw : null)
    let query = this.db
      .selectFrom('greenfield_conversation_members as m')
      .innerJoin('greenfield_conversations as c', 'c.conversation_id', 'm.conversation_id')
      .select(['c.conversation_id', 'c.subject', 'c.last_message_at', 'c.created_at', 'm.last_read_at', 'm.muted_until', 'm.archived_at'])
      .where('m.actor_id', '=', viewer)
      .where('m.state', '=', state)
      .where('c.kind', '=', kind)
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
    const {page, hasMore, nextCursor} = await this.listForViewer(viewer, 'direct', 'active', cursor, limit, archived === 'true' || archived === true)
    const ids = page.map(row => row.conversation_id)
    const [others, latest, unread] = await Promise.all([
      this.otherMembers(ids, viewer),
      this.latestMessages(ids),
      this.unreadCounts(page, viewer),
    ])
    const people = await this.participants([...others.values()].flat())
    const items = page.map(row => {
      const lastRow = latest.get(row.conversation_id)
      return {
        id: row.conversation_id,
        kind: 'direct' as const,
        participants: (others.get(row.conversation_id) ?? []).map(id => people.get(id)!),
        lastMessage: lastRow
          ? {id: lastRow.message_id, body: lastRow.deleted_at ? '' : lastRow.body, sentAt: lastRow.created_at.toISOString(), senderId: lastRow.sender_actor_id}
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
      .where('c.kind', '=', 'direct')
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
    return {conversationId: existing.conversation_id, created: false, recipientState: recipientMember.state}
  }

  async conversationFor(viewer: string, conversationId: string): Promise<ConversationDto> {
    const member = await this.membership(conversationId, viewer, 'direct')
    const others = await this.otherMembers([conversationId], viewer)
    const latest = await this.latestMessages([conversationId])
    const unread = await this.unreadCounts([{conversation_id: conversationId, last_read_at: member.last_read_at}], viewer)
    const people = await this.participants(others.get(conversationId) ?? [])
    const lastRow = latest.get(conversationId)
    return {
      id: conversationId,
      kind: member.state === 'pending' ? 'request' : 'direct',
      participants: (others.get(conversationId) ?? []).map(id => people.get(id)!),
      lastMessage: lastRow
        ? {id: lastRow.message_id, body: lastRow.body, sentAt: lastRow.created_at.toISOString(), senderId: lastRow.sender_actor_id}
        : null,
      unreadCount: unread.get(conversationId) ?? 0,
      updatedAt: member.last_message_at.toISOString(),
    }
  }

  async listMessages(viewer: string, conversationId: string, cursorRaw: unknown, limitRaw: unknown): Promise<Page<MessageDto>> {
    const member = await this.membership(conversationId, viewer, 'direct')
    const limit = clampLimit(limitRaw, 40, 100)
    const cursor = decodeCursor(typeof cursorRaw === 'string' ? cursorRaw : null)
    let query = this.db
      .selectFrom('greenfield_conversation_messages')
      .selectAll()
      .where('conversation_id', '=', conversationId)
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
    const otherReads = await this.db
      .selectFrom('greenfield_conversation_members')
      .select('last_read_at')
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '!=', viewer)
      .execute()
    const othersReadAt = otherReads.map(r => r.last_read_at?.getTime() ?? 0)
    const [people, contexts, extras] = await Promise.all([
      this.participants([viewer, ...(others.get(conversationId) ?? []), ...page.map(r => r.sender_actor_id)]),
      this.storyContexts(page.map(row => row.message_id)),
      this.messageExtras(page, viewer),
    ])
    void member
    const items = page.reverse().map(row => this.messageDto(row, viewer, people, othersReadAt, extras, contexts.get(row.message_id)))
    return {items, nextCursor: hasMore && oldest ? encodeCursor(oldest.created_at, oldest.message_id) : null, hasMore}
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
    return {
      id: row.message_id,
      conversationId: row.conversation_id,
      sender: people.get(row.sender_actor_id) ?? {id: row.sender_actor_id, handle: '', displayName: 'Member', avatarUrl: null},
      body: row.deleted_at ? '' : row.body,
      subject: row.subject,
      sentAt: row.created_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      isOwn,
      delivery: read ? 'read' : 'sent',
      replyTo: row.reply_to_message_id ? (extras?.replies.get(row.reply_to_message_id) ?? null) : null,
      reactions: extras?.reactions.get(row.message_id) ?? [],
      editedAt: row.edited_at ? row.edited_at.toISOString() : null,
      deleted: Boolean(row.deleted_at),
      ...(storyContext ? {storyContext} : {}),
    }
  }

  async send(viewer: string, conversationId: string, input: {text?: unknown; replyToMessageId?: unknown}): Promise<MessageDto> {
    const member = await this.membership(conversationId, viewer, 'direct')
    if (member.state !== 'active') fail('FORBIDDEN', 'Accept this request before replying')
    const text = cleanText(input.text, MESSAGE_MAX, 'Message')
    const others = await this.otherMembers([conversationId], viewer)
    for (const other of others.get(conversationId) ?? []) {
      if (await this.isBlockedEitherWay(viewer, other)) fail('FORBIDDEN', 'You cannot message this account')
    }
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
    const {messageId, now} = await this.insertMessage(conversationId, viewer, text, null, replyTo)
    const people = await this.participants([viewer])
    const row = {message_id: messageId, conversation_id: conversationId, sender_actor_id: viewer, subject: null, body: text, created_at: now, reply_to_message_id: replyTo}
    return this.messageDto(row, viewer, people, [], await this.messageExtras([row], viewer))
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
    return {reactions, replies}
  }

  private async liveMessage(viewer: string, conversationId: string, messageId: string) {
    const member = await this.membership(conversationId, viewer, 'direct')
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

  async setTyping(viewer: string, conversationId: string): Promise<void> {
    const member = await this.membership(conversationId, viewer, 'direct')
    if (member.state !== 'active') return
    await this.db
      .updateTable('greenfield_conversation_members')
      .set({typing_at: new Date()})
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '=', viewer)
      .execute()
  }

  async typing(viewer: string, conversationId: string): Promise<{typing: ParticipantDto[]}> {
    await this.membership(conversationId, viewer, 'direct')
    const rows = await this.db
      .selectFrom('greenfield_conversation_members')
      .select('actor_id')
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '!=', viewer)
      .where('state', '=', 'active')
      .where('typing_at', '>', new Date(Date.now() - TYPING_TTL_MS))
      .execute()
    const people = await this.participants(rows.map(r => r.actor_id))
    return {typing: rows.map(r => people.get(r.actor_id)!)}
  }

  async setMuted(viewer: string, conversationId: string, input: {muted?: unknown; until?: unknown}): Promise<{muted: boolean; mutedUntil: string | null}> {
    await this.membership(conversationId, viewer, 'direct')
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
    await this.membership(conversationId, viewer, 'direct')
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
    await this.membership(conversationId, viewer, 'direct')
    const now = new Date()
    await this.db
      .updateTable('greenfield_conversation_members')
      .set({last_read_at: now, updated_at: now})
      .where('conversation_id', '=', conversationId)
      .where('actor_id', '=', viewer)
      .execute()
  }

  // ---- requests --------------------------------------------------------

  async listRequests(viewer: string): Promise<{items: MessageRequestDto[]}> {
    const {page} = await this.listForViewer(viewer, 'direct', 'pending', null, 50)
    const ids = page.map(row => row.conversation_id)
    const [others, latest] = await Promise.all([this.otherMembers(ids, viewer), this.latestMessages(ids)])
    const people = await this.participants([...others.values()].flat())
    const items = page.map(row => {
      const senderId = latest.get(row.conversation_id)?.sender_actor_id ?? others.get(row.conversation_id)?.[0] ?? ''
      return {
        id: row.conversation_id,
        conversationId: row.conversation_id,
        sender: people.get(senderId) ?? {id: senderId, handle: '', displayName: 'Member', avatarUrl: null},
        preview: latest.get(row.conversation_id)?.body ?? 'Wants to send you a message.',
        createdAt: row.created_at.toISOString(),
      }
    })
    return {items}
  }

  private async pendingRequest(viewer: string, requestId: string) {
    const member = await this.membership(requestId, viewer, 'direct')
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
