import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import {badgesForActors, NO_BADGES, type PublicBadgeFields} from '../../premium/badges.js'

import type {ModulaDb} from '../../database/client.js'

export type ParticipantDto = {id: string; handle: string; displayName: string; avatarUrl: string | null} & Partial<PublicBadgeFields>
export type MessagePreviewDto = {id: string; body: string; sentAt: string; senderId: string}
export type ConversationDto = {
  id: string
  kind: 'direct' | 'request'
  participants: ParticipantDto[]
  lastMessage: MessagePreviewDto | null
  unreadCount: number
  updatedAt: string
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
export type Page<T> = {items: T[]; nextCursor: string | null; hasMore: boolean}

export const MESSAGE_MAX = 5_000
export const INMAIL_BODY_MAX = 20_000
export const SUBJECT_MAX = 180

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
    const row = await this.db
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

  private async follows(follower: string, followed: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('follows')
      .select('id')
      .where('follower_actor_id', '=', follower)
      .where('followed_actor_id', '=', followed)
      .where('deleted_at', 'is', null)
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
    const map = new Map<string, {message_id: string; body: string; created_at: Date; sender_actor_id: string}>()
    if (conversationIds.length === 0) return map
    const rows = await this.db
      .selectFrom('greenfield_conversation_messages')
      .select(['conversation_id', 'message_id', 'body', 'created_at', 'sender_actor_id'])
      .distinctOn('conversation_id')
      .where('conversation_id', 'in', conversationIds)
      .orderBy('conversation_id')
      .orderBy('created_at', 'desc')
      .orderBy('message_id', 'desc')
      .execute()
    for (const row of rows) map.set(row.conversation_id, row)
    return map
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

  private async insertMessage(conversationId: string, sender: string, body: string, subject: string | null = null) {
    const now = new Date()
    const messageId = randomUUID()
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_conversation_messages')
        .values({message_id: messageId, conversation_id: conversationId, sender_actor_id: sender, subject, body, created_at: now})
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

  private async listForViewer(viewer: string, kind: 'direct' | 'inmail', state: 'active' | 'pending', cursorRaw: unknown, limitRaw: unknown) {
    const limit = clampLimit(limitRaw, 30, 50)
    const cursor = decodeCursor(typeof cursorRaw === 'string' ? cursorRaw : null)
    let query = this.db
      .selectFrom('greenfield_conversation_members as m')
      .innerJoin('greenfield_conversations as c', 'c.conversation_id', 'm.conversation_id')
      .select(['c.conversation_id', 'c.subject', 'c.last_message_at', 'c.created_at', 'm.last_read_at'])
      .where('m.actor_id', '=', viewer)
      .where('m.state', '=', state)
      .where('c.kind', '=', kind)
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

  async listConversations(viewer: string, cursor: unknown, limit: unknown): Promise<Page<ConversationDto>> {
    const {page, hasMore, nextCursor} = await this.listForViewer(viewer, 'direct', 'active', cursor, limit)
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
          ? {id: lastRow.message_id, body: lastRow.body, sentAt: lastRow.created_at.toISOString(), senderId: lastRow.sender_actor_id}
          : null,
        unreadCount: unread.get(row.conversation_id) ?? 0,
        updatedAt: row.last_message_at.toISOString(),
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
    const directKey = [viewer, recipient].sort().join(':')
    const recipientState = (await this.follows(recipient, viewer)) ? 'active' : 'pending'
    const result = await this.db.transaction().execute(async trx => {
      // Moderation block/unblock uses this same actor-pair lock. Whichever
      // operation commits first becomes authoritative for this creation.
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
      const blocked = await trx
        .selectFrom('blocks')
        .select('id')
        .where('deleted_at', 'is', null)
        .where(eb =>
          eb.or([
            eb.and([eb('blocker_actor_id', '=', viewer), eb('blocked_actor_id', '=', recipient)]),
            eb.and([eb('blocker_actor_id', '=', recipient), eb('blocked_actor_id', '=', viewer)]),
          ]),
        )
        .executeTakeFirst()
      if (blocked) fail('FORBIDDEN', 'You cannot message this account')

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
            {conversation_id: conversationId, actor_id: recipient, state: recipientState, last_read_at: null, joined_at: now, updated_at: now},
          ])
          .execute()

        if (text) {
          await trx
            .insertInto('greenfield_conversation_messages')
            .values({message_id: randomUUID(), conversation_id: conversationId, sender_actor_id: viewer, subject: null, body: text, created_at: now})
            .execute()
        }
        return {conversationId, created: true}
      }

      // PostgreSQL waits for the winning unique-key transaction before the
      // conflict is resolved, so this statement sees its committed row and
      // members without an advisory lock or retry loop.
      const existing = await trx
        .selectFrom('greenfield_conversations')
        .select('conversation_id')
        .where('direct_key', '=', directKey)
        .executeTakeFirstOrThrow()
      // Re-opening by the viewer reactivates their side if they had declined.
      await trx
        .updateTable('greenfield_conversation_members')
        .set({state: 'active', updated_at: new Date()})
        .where('conversation_id', '=', existing.conversation_id)
        .where('actor_id', '=', viewer)
        .execute()
      return {conversationId: existing.conversation_id, created: false}
    })
    return {conversation: await this.conversationFor(viewer, result.conversationId), created: result.created}
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
    const people = await this.participants([viewer, ...(others.get(conversationId) ?? []), ...page.map(r => r.sender_actor_id)])
    void member
    const items = page.reverse().map(row => this.messageDto(row, viewer, people, othersReadAt))
    return {items, nextCursor: hasMore && oldest ? encodeCursor(oldest.created_at, oldest.message_id) : null, hasMore}
  }

  private messageDto(
    row: {message_id: string; conversation_id: string; sender_actor_id: string; subject: string | null; body: string; created_at: Date},
    viewer: string,
    people: Map<string, ParticipantDto>,
    othersReadAt: number[] = [],
  ): MessageDto {
    const isOwn = row.sender_actor_id === viewer
    const read = isOwn && othersReadAt.length > 0 && othersReadAt.every(t => t >= row.created_at.getTime())
    return {
      id: row.message_id,
      conversationId: row.conversation_id,
      sender: people.get(row.sender_actor_id) ?? {id: row.sender_actor_id, handle: '', displayName: 'Member', avatarUrl: null},
      body: row.body,
      subject: row.subject,
      sentAt: row.created_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      isOwn,
      delivery: read ? 'read' : 'sent',
    }
  }

  async send(viewer: string, conversationId: string, input: {text?: unknown}): Promise<MessageDto> {
    const member = await this.membership(conversationId, viewer, 'direct')
    if (member.state !== 'active') fail('FORBIDDEN', 'Accept this request before replying')
    const text = cleanText(input.text, MESSAGE_MAX, 'Message')
    const others = await this.otherMembers([conversationId], viewer)
    for (const other of others.get(conversationId) ?? []) {
      if (await this.isBlockedEitherWay(viewer, other)) fail('FORBIDDEN', 'You cannot message this account')
    }
    const {messageId, now} = await this.insertMessage(conversationId, viewer, text)
    const people = await this.participants([viewer])
    return this.messageDto(
      {message_id: messageId, conversation_id: conversationId, sender_actor_id: viewer, subject: null, body: text, created_at: now},
      viewer,
      people,
    )
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
