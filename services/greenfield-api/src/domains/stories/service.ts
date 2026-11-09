import {createHash, randomUUID} from 'node:crypto'
import {mkdir, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {sql, type Transaction} from 'kysely'

import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {GreenfieldDomainEventRepository} from '../../events/domain-events.js'
import {AttachmentPolicy} from '../attachments/policy.js'
import {inspectImageDimensions, verifyAttachmentSignature} from '../attachments/service.js'
import {MessagingService, normalizeMessageText, type StoryMessageContext} from '../messaging/service.js'
import {OutboxRepository} from '../outbox/repository.js'

const STORY_TTL_MS = 24 * 60 * 60 * 1000
const IMAGE_DURATION_MS = 5_000

/** Items expire STORY_TTL_MS after their own created_at, independent of the group's expires_at. */
export function storyItemLiveCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - STORY_TTL_MS)
}

export type StoryRingState =
  | 'unviewed'
  | 'partial'
  | 'viewed'
  | 'owner'
  | 'uploading'
  | 'failed'

export type StoryRailEntry = {
  groupId: string
  ownerActorId: string
  ownerProfileId: string
  displayName: string
  handle: string
  avatarUrl: string | null
  ringState: StoryRingState
  itemCount: number
  unviewedCount: number
  expiresAt: string
  isOwner: boolean
}

export type StoryItemDto = {
  itemId: string
  groupId: string
  mediaKind: 'image' | 'video'
  mediaUrl: string | null
  caption: string | null
  status: 'uploading' | 'ready' | 'failed'
  durationMs: number | null
  viewed: boolean
  createdAt: string
}

export type StoryGroupDto = {
  groupId: string
  ownerActorId: string
  ownerProfileId: string
  displayName: string
  handle: string
  avatarUrl: string | null
  visibility: 'public' | 'followers' | 'close'
  expiresAt: string
  items: StoryItemDto[]
  isOwner: boolean
}

type CreateStoryInput = {
  mediaKind: 'image' | 'video'
  attachmentId?: string
  base64?: string
  contentType?: string
  caption?: string | null
  visibility?: 'public' | 'followers' | 'close'
  width?: number
  height?: number
  durationMs?: number
  idempotencyKey?: string
}

export type StoryReplyResult = {
  conversationId: string
  messageId: string
  created: boolean
  conversationCreated: boolean
}

const SUPPORTED = {
  'image/jpeg': {extension: 'jpg', kind: 'image' as const},
  'image/jpg': {extension: 'jpg', kind: 'image' as const},
  'image/png': {extension: 'png', kind: 'image' as const},
  'image/webp': {extension: 'webp', kind: 'image' as const},
  'video/mp4': {extension: 'mp4', kind: 'video' as const},
} as const

export class StoryService {
  private readonly messaging: MessagingService

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {
    this.messaging = new MessagingService(db)
  }

  async listRail(viewerActorId: string | null): Promise<StoryRailEntry[]> {
    const now = new Date()
    const liveCutoff = storyItemLiveCutoff(now)
    const groups = await this.db
      .selectFrom('greenfield_story_groups as g')
      .innerJoin('actors as a', 'a.id', 'g.owner_actor_id')
      .innerJoin('profiles as p', 'p.actor_id', 'g.owner_actor_id')
      .select([
        'g.group_id',
        'g.owner_actor_id',
        'g.visibility',
        'g.expires_at',
        'p.id as profile_id',
        'p.display_name',
        'p.handle',
        'p.avatar_url',
      ])
      .where('g.deleted_at', 'is', null)
      .where('g.expires_at', '>', now)
      .orderBy('g.updated_at', 'desc')
      .execute()

    const entries: StoryRailEntry[] = []
    for (const group of groups) {
      if (!(await this.canViewGroup(viewerActorId, group.owner_actor_id, group.visibility))) {
        continue
      }
      const items = await this.db
        .selectFrom('greenfield_story_items')
        .select(['item_id', 'status'])
        .where('group_id', '=', group.group_id)
        .where('deleted_at', 'is', null)
        .where('created_at', '>', liveCutoff)
        .execute()
      // Hide groups with no live (unexpired) items.
      if (items.length === 0) continue

      const readyOrPending = items.filter(item => item.status !== 'failed' || group.owner_actor_id === viewerActorId)
      if (readyOrPending.length === 0) continue

      let viewedCount = 0
      if (viewerActorId) {
        const views = await this.db
          .selectFrom('greenfield_story_views')
          .select('item_id')
          .where('viewer_actor_id', '=', viewerActorId)
          .where(
            'item_id',
            'in',
            items.map(item => item.item_id),
          )
          .execute()
        viewedCount = views.length
      }

      const isOwner = viewerActorId === group.owner_actor_id
      const hasUploading = items.some(item => item.status === 'uploading')
      const hasFailed = items.some(item => item.status === 'failed')
      const readyCount = items.filter(item => item.status === 'ready').length
      const readyOrPendingCount = items.filter(
        item => item.status === 'ready' || item.status === 'uploading',
      ).length
      let ringState: StoryRingState = 'unviewed'
      if (isOwner) ringState = hasFailed ? 'failed' : hasUploading ? 'uploading' : 'owner'
      else if (viewedCount === 0) ringState = 'unviewed'
      else if (viewedCount < readyCount) ringState = 'partial'
      else ringState = 'viewed'

      entries.push({
        groupId: group.group_id,
        ownerActorId: group.owner_actor_id,
        ownerProfileId: group.profile_id,
        displayName: group.display_name,
        handle: group.handle,
        avatarUrl: group.avatar_url,
        ringState,
        itemCount: readyOrPendingCount,
        unviewedCount: Math.max(0, readyCount - viewedCount),
        expiresAt: group.expires_at.toISOString(),
        isOwner,
      })
    }

    // Owner Add Story always first when authenticated.
    if (viewerActorId) {
      const owner = await this.db
        .selectFrom('profiles')
        .select(['id', 'display_name', 'handle', 'avatar_url'])
        .where('actor_id', '=', viewerActorId)
        .executeTakeFirst()
      if (owner) {
        const existingOwner = entries.find(entry => entry.ownerActorId === viewerActorId)
        if (existingOwner) {
          entries.splice(entries.indexOf(existingOwner), 1)
          entries.unshift(existingOwner)
        } else {
          entries.unshift({
            groupId: `add:${viewerActorId}`,
            ownerActorId: viewerActorId,
            ownerProfileId: owner.id,
            displayName: owner.display_name,
            handle: owner.handle,
            avatarUrl: owner.avatar_url,
            ringState: 'owner',
            itemCount: 0,
            unviewedCount: 0,
            expiresAt: new Date(Date.now() + STORY_TTL_MS).toISOString(),
            isOwner: true,
          })
        }
      }
    }

    return entries
  }

  async getGroup(groupId: string, viewerActorId: string | null): Promise<StoryGroupDto | null> {
    const group = await this.db
      .selectFrom('greenfield_story_groups as g')
      .innerJoin('profiles as p', 'p.actor_id', 'g.owner_actor_id')
      .select([
        'g.group_id',
        'g.owner_actor_id',
        'g.visibility',
        'g.expires_at',
        'g.deleted_at',
        'p.id as profile_id',
        'p.display_name',
        'p.handle',
        'p.avatar_url',
      ])
      .where('g.group_id', '=', groupId)
      .executeTakeFirst()
    const now = new Date()
    if (!group || group.deleted_at || group.expires_at <= now) return null
    if (!(await this.canViewGroup(viewerActorId, group.owner_actor_id, group.visibility))) {
      return null
    }

    const isOwner = viewerActorId === group.owner_actor_id
    const items = (
      await this.db
        .selectFrom('greenfield_story_items')
        .selectAll()
        .where('group_id', '=', groupId)
        .where('deleted_at', 'is', null)
        .where('created_at', '>', storyItemLiveCutoff(now))
        .orderBy('sort_order', 'asc')
        .execute()
    ).filter(item => item.status === 'ready' || isOwner)
    // A group with no live items visible to this viewer is treated as gone.
    if (items.length === 0) return null

    const viewedIds = new Set<string>()
    if (viewerActorId) {
      const views = await this.db
        .selectFrom('greenfield_story_views')
        .select('item_id')
        .where('viewer_actor_id', '=', viewerActorId)
        .where(
          'item_id',
          'in',
          items.map(item => item.item_id),
        )
        .execute()
      for (const view of views) viewedIds.add(view.item_id)
    }

    return {
      groupId: group.group_id,
      ownerActorId: group.owner_actor_id,
      ownerProfileId: group.profile_id,
      displayName: group.display_name,
      handle: group.handle,
      avatarUrl: group.avatar_url,
      visibility: group.visibility,
      expiresAt: group.expires_at.toISOString(),
      isOwner,
      items: items.map(item => ({
        itemId: item.item_id,
        groupId: item.group_id,
        mediaKind: item.media_kind,
        mediaUrl: item.media_url,
        caption: item.caption,
        status: item.status,
        durationMs: item.duration_ms,
        viewed: viewedIds.has(item.item_id),
        createdAt: item.created_at.toISOString(),
      })),
    }
  }

  async reply(
    actorId: string,
    storyId: string,
    input: {text?: unknown; idempotencyKey?: unknown},
    requestId: string,
  ): Promise<StoryReplyResult> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storyId)) {
      throw domainError('Story item not found', 'NOT_FOUND')
    }
    const text = normalizeMessageText(input.text)
    const suppliedKey = normalizeRequiredIdempotencyKey(input.idempotencyKey)
    const ledgerKey = `story-reply:${suppliedKey}`
    const requestHash = createHash('sha256').update(JSON.stringify({storyId, text})).digest('hex')

    return this.db.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${actorId}:${ledgerKey}`}, 0))`.execute(trx)
      const previous = await trx
        .selectFrom('idempotency_keys')
        .select(['request_hash', 'response_status', 'response_body'])
        .where('actor_id', '=', actorId)
        .where('key', '=', ledgerKey)
        .executeTakeFirst()
      if (previous) {
        if (previous.request_hash !== requestHash) {
          throw domainError('Story reply idempotency key was reused with a different request', 'CONFLICT')
        }
        const replay = parseStoredStoryReply(previous.response_body)
        if (previous.response_status === null || !replay) {
          throw domainError('Story reply retry is still in progress', 'CONFLICT')
        }
        return {...replay, created: false}
      }

      const now = new Date()
      const reservationId = `story-reply-idempotency:${randomUUID()}`
      await trx
        .insertInto('idempotency_keys')
        .values({
          id: reservationId,
          actor_id: actorId,
          key: ledgerKey,
          request_hash: requestHash,
          response_status: null,
          response_body: null,
          created_at: now,
          updated_at: now,
          expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        })
        .execute()

      const story = await trx
        .selectFrom('greenfield_story_items as i')
        .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
        .innerJoin('actors as owner', 'owner.id', 'g.owner_actor_id')
        .select([
          'i.item_id', 'i.group_id', 'i.media_kind', 'i.status', 'i.created_at as item_created_at',
          'i.deleted_at as item_deleted_at', 'g.owner_actor_id', 'g.visibility', 'g.expires_at',
          'g.deleted_at as group_deleted_at', 'owner.account_id as owner_account_id',
        ])
        .where('i.item_id', '=', storyId)
        .forUpdate()
        .executeTakeFirst()
      if (
        !story || story.item_deleted_at || story.group_deleted_at || story.status !== 'ready' ||
        story.expires_at <= now || story.item_created_at <= storyItemLiveCutoff(now)
      ) {
        throw domainError('Story item not found', 'NOT_FOUND')
      }
      if (story.owner_actor_id === actorId) {
        throw domainError('You cannot reply to your own story', 'VALIDATION_FAILED')
      }
      if (!(await this.canViewGroupWith(trx, actorId, story.owner_actor_id, story.visibility))) {
        // Match the story read contract so guessed item identifiers do not
        // disclose whether inaccessible private content exists.
        throw domainError('Story item not found', 'NOT_FOUND')
      }

      const direct = await this.messaging.ensureDirectConversationInTransaction(
        trx,
        actorId,
        story.owner_actor_id,
      )
      if (direct.recipientState === 'declined') {
        throw domainError('You cannot message this account', 'FORBIDDEN')
      }
      const messageId = randomUUID()
      const message = await this.messaging.insertDirectMessageInTransaction(
        trx,
        direct.conversationId,
        actorId,
        text,
        messageId,
        now,
      )
      const storyContext: StoryMessageContext = {
        type: 'story',
        storyId: story.item_id,
        groupId: story.group_id,
        ownerActorId: story.owner_actor_id,
        mediaKind: story.media_kind,
        createdAt: story.item_created_at.toISOString(),
        expiresAt: story.expires_at.toISOString(),
      }
      await new GreenfieldDomainEventRepository(trx).append({
        eventType: 'message.story-replied',
        aggregateType: 'conversation-message',
        aggregateId: message.messageId,
        accountId: story.owner_account_id,
        actorId,
        requestId,
        correlationId: requestId,
        idempotencyKey: ledgerKey,
        visibility: 'actor',
        classification: 'private',
        payload: {
          conversationId: direct.conversationId,
          messageId: message.messageId,
          recipientActorId: story.owner_actor_id,
          storyContext,
        },
      })
      await new OutboxRepository(trx).enqueue(trx, {
        eventType: 'notification.create',
        aggregateType: 'conversation-message',
        aggregateId: message.messageId,
        payload: {
          type: 'reply',
          actorId,
          recipientActorId: story.owner_actor_id,
          resourceType: 'conversation',
          resourceId: direct.conversationId,
          dedupeKey: `story-reply:${message.messageId}`,
          deliveryMode: 'idempotent',
          body: 'replied to your story',
        },
      })

      const stored = {
        conversationId: direct.conversationId,
        messageId: message.messageId,
        conversationCreated: direct.created,
      }
      await trx
        .updateTable('idempotency_keys')
        .set({response_status: 201, response_body: stored, updated_at: now})
        .where('id', '=', reservationId)
        .execute()
      return {...stored, created: true}
    })
  }

  async create(actorId: string, input: CreateStoryInput): Promise<StoryGroupDto> {
    if (input.mediaKind !== 'image' && input.mediaKind !== 'video') {
      throw domainError('Unsupported story media kind', 'VALIDATION_FAILED')
    }
    const attachmentId = normalizeOptionalId(input.attachmentId)
    const hasInlineMedia = typeof input.base64 === 'string' && input.base64.length > 0
    if (Boolean(attachmentId) === hasInlineMedia) {
      throw domainError('Provide exactly one story attachment or inline media payload', 'VALIDATION_FAILED')
    }
    const caption = normalizeCaption(input.caption)
    const visibility = normalizeVisibility(input.visibility)
    const durationMs = normalizeDuration(input.durationMs, input.mediaKind)
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey)
    const requestHash = idempotencyKey ? storyRequestHash({
      attachmentId, base64: input.base64, contentType: input.contentType, mediaKind: input.mediaKind,
      caption, visibility, durationMs,
    }) : null
    if (idempotencyKey) {
      const existing = await this.findIdempotent(actorId, idempotencyKey)
      if (existing) {
        if (existing.request_hash !== requestHash) {
          throw domainError('Story idempotency key was reused with a different request', 'CONFLICT')
        }
        const replay = await this.getGroup(existing.group_id, actorId)
        if (replay) return replay
        throw domainError('Story retry target is no longer available', 'CONFLICT')
      }
    }

    const actor = await this.db.selectFrom('actors').select('account_id').where('id', '=', actorId).executeTakeFirst()
    if (!actor) throw domainError('Story owner not found', 'NOT_FOUND')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + STORY_TTL_MS)
    const itemId = randomUUID()
    const inline = hasInlineMedia ? prepareInlineMedia(input, itemId) : null
    const directory = join(this.config.mediaRoot, 'stories')
    if (inline) {
      await mkdir(directory, {recursive: true})
      await writeFile(join(directory, inline.fileName), inline.bytes, {flag: 'wx', mode: 0o600})
    }
    let groupId = ''
    try {
      groupId = await this.db.transaction().execute(async trx => {
        if (idempotencyKey) {
          const existing = await trx.selectFrom('greenfield_story_items as item')
            .innerJoin('greenfield_story_groups as group', 'group.group_id', 'item.group_id')
            .select(['item.group_id', 'item.request_hash'])
            .where('group.owner_actor_id', '=', actorId)
            .where('item.idempotency_key', '=', idempotencyKey)
            .executeTakeFirst()
          if (existing) {
            if (existing.request_hash !== requestHash) {
              throw domainError('Story idempotency key was reused with a different request', 'CONFLICT')
            }
            return existing.group_id
          }
        }
        const attachment = attachmentId
          ? await trx.selectFrom('attachments').selectAll().where('attachment_id', '=', attachmentId).forUpdate().executeTakeFirst()
          : null
        if (attachmentId) {
          if (!attachment || attachment.owner_account_id !== actor.account_id) {
            throw domainError('Cross-account story attachment binding denied', 'FORBIDDEN')
          }
          if (attachment.status !== 'ready' || attachment.attached_at) {
            throw domainError('Story attachment is not ready for publication', 'CONFLICT')
          }
          if (attachment.kind !== input.mediaKind) {
            throw domainError('Story attachment media kind mismatch', 'VALIDATION_FAILED')
          }
        }

        let group = await trx.selectFrom('greenfield_story_groups').selectAll()
          .where('owner_actor_id', '=', actorId).where('deleted_at', 'is', null).where('expires_at', '>', now)
          .orderBy('created_at', 'desc').executeTakeFirst()
        if (!group) {
          const nextGroupId = randomUUID()
          await trx.insertInto('greenfield_story_groups').values({
            group_id: nextGroupId, owner_actor_id: actorId, visibility, expires_at: expiresAt,
            created_at: now, updated_at: now, deleted_at: null,
          }).execute()
          group = await trx.selectFrom('greenfield_story_groups').selectAll()
            .where('group_id', '=', nextGroupId).executeTakeFirstOrThrow()
        } else {
          await trx.updateTable('greenfield_story_groups').set({updated_at: now, visibility, expires_at: expiresAt})
            .where('group_id', '=', group.group_id).execute()
        }
        const maxOrder = await trx.selectFrom('greenfield_story_items')
          .select(eb => eb.fn.max('sort_order').as('max')).where('group_id', '=', group.group_id).executeTakeFirst()
        const mediaUrl = attachmentId
          ? this.config.publicApiUrl.replace(/\/+$/, '') + '/v1/attachments/' + attachmentId + '/content'
          : this.config.publicApiUrl.replace(/\/+$/, '') + '/v1/media/stories/' + inline!.fileName
        await trx.insertInto('greenfield_story_items').values({
          item_id: itemId, owner_actor_id: actorId, group_id: group.group_id, media_kind: input.mediaKind, media_url: mediaUrl,
          media_file_name: inline?.fileName ?? null, attachment_id: attachmentId, idempotency_key: idempotencyKey,
          request_hash: requestHash, caption, status: 'ready', sort_order: (maxOrder?.max ?? -1) + 1,
          duration_ms: input.mediaKind === 'video' ? durationMs : IMAGE_DURATION_MS,
          created_at: now, deleted_at: null,
        }).execute()
        if (attachmentId) {
          const bound = await trx.updateTable('attachments').set({attached_at: now, updated_at: now})
            .where('attachment_id', '=', attachmentId).where('owner_account_id', '=', actor.account_id)
            .where('status', '=', 'ready').where('attached_at', 'is', null).executeTakeFirst()
          if (bound.numUpdatedRows !== 1n) throw domainError('Story attachment binding conflicted', 'CONFLICT')
        }
        return group.group_id
      })
    } catch (error) {
      if (inline) await rm(join(directory, inline.fileName), {force: true})
      if (idempotencyKey) {
        const existing = await this.findIdempotent(actorId, idempotencyKey)
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw domainError('Story idempotency key was reused with a different request', 'CONFLICT')
          }
          groupId = existing.group_id
        }
      }
      if (!groupId) throw error
    }

    const dto = await this.getGroup(groupId, actorId)
    if (!dto) {
      throw Object.assign(new Error('Story group missing after create'), {code: 'SERVER_ERROR'})
    }
    return dto
  }

  private async findIdempotent(actorId: string, idempotencyKey: string) {
    return this.db.selectFrom('greenfield_story_items as item')
      .select(['item.group_id', 'item.request_hash'])
      .where('item.owner_actor_id', '=', actorId)
      .where('item.idempotency_key', '=', idempotencyKey)
      .executeTakeFirst()
  }

  async markViewed(itemId: string, viewerActorId: string): Promise<void> {
    const item = await this.db
      .selectFrom('greenfield_story_items as i')
      .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
      .select(['i.item_id', 'i.status', 'g.owner_actor_id', 'g.visibility', 'g.expires_at', 'g.deleted_at'])
      .where('i.item_id', '=', itemId)
      .where('i.deleted_at', 'is', null)
      .where('i.created_at', '>', storyItemLiveCutoff())
      .executeTakeFirst()
    if (!item || item.deleted_at || item.expires_at <= new Date() || item.status !== 'ready') {
      throw Object.assign(new Error('Story item not found'), {code: 'NOT_FOUND'})
    }
    if (!(await this.canViewGroup(viewerActorId, item.owner_actor_id, item.visibility))) {
      throw Object.assign(new Error('Story not visible'), {code: 'FORBIDDEN'})
    }
    await this.db
      .insertInto('greenfield_story_views')
      .values({
        view_id: randomUUID(),
        item_id: itemId,
        viewer_actor_id: viewerActorId,
        viewed_at: new Date(),
      })
      .onConflict(oc => oc.columns(['item_id', 'viewer_actor_id']).doNothing())
      .execute()
  }

  async deleteItem(itemId: string, actorId: string): Promise<void> {
    const item = await this.db
      .selectFrom('greenfield_story_items as i')
      .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
      .select(['i.item_id', 'i.group_id', 'i.attachment_id', 'i.media_file_name', 'g.owner_actor_id'])
      .where('i.item_id', '=', itemId)
      .where('i.deleted_at', 'is', null)
      .executeTakeFirst()
    if (!item) {
      throw Object.assign(new Error('Story item not found'), {code: 'NOT_FOUND'})
    }
    if (item.owner_actor_id !== actorId) {
      throw Object.assign(new Error('Only the owner can delete a story'), {code: 'FORBIDDEN'})
    }
    const now = new Date()
    const cleanup = await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_story_items').set({deleted_at: now})
        .where('item_id', '=', itemId).where('deleted_at', 'is', null).execute()
      let storageKey: string | null = null
      if (item.attachment_id) {
        const attachment = await trx.selectFrom('attachments').select('storage_key')
          .where('attachment_id', '=', item.attachment_id).forUpdate().executeTakeFirst()
        storageKey = attachment?.storage_key ?? null
        await trx.updateTable('attachments').set({status: 'expired', attached_at: null, updated_at: now})
          .where('attachment_id', '=', item.attachment_id).execute()
      }
      const remaining = await trx.selectFrom('greenfield_story_items').select('item_id')
        .where('group_id', '=', item.group_id).where('deleted_at', 'is', null).limit(1).executeTakeFirst()
      if (!remaining) {
        await trx.updateTable('greenfield_story_groups').set({deleted_at: now, updated_at: now})
          .where('group_id', '=', item.group_id).execute()
      }
      return {storageKey}
    })

    if (cleanup.storageKey && /^[0-9a-f-]{36}\.[a-z0-9]+$/i.test(cleanup.storageKey)) {
      try {
        await rm(join(this.config.mediaRoot, 'attachments', cleanup.storageKey), {force: true})
        await this.db.updateTable('attachments').set({storage_key: null, updated_at: new Date()})
          .where('attachment_id', '=', item.attachment_id).where('status', '=', 'expired').execute()
      } catch {
        // The expired row keeps the storage key so bounded orphan cleanup can
        // retry without making the bytes accessible through the API.
      }
    }
    if (item.media_file_name && /^[0-9a-f-]{36}\.(jpg|png|webp|mp4)$/i.test(item.media_file_name)) {
      try {
        await rm(join(this.config.mediaRoot, 'stories', item.media_file_name), {force: true})
      } catch {
        // The deleted story is already inaccessible; operations can remove a
        // residual legacy file without weakening authorization.
      }
    }
  }

  async canViewGroup(
    viewerActorId: string | null,
    ownerActorId: string,
    visibility: 'public' | 'followers' | 'close',
  ): Promise<boolean> {
    return this.canViewGroupWith(this.db, viewerActorId, ownerActorId, visibility)
  }

  private async canViewGroupWith(
    db: ModulaDb | Transaction<Database>,
    viewerActorId: string | null,
    ownerActorId: string,
    visibility: 'public' | 'followers' | 'close',
  ): Promise<boolean> {
    if (viewerActorId === ownerActorId) return true
    if (viewerActorId && (await this.isBlockedEitherDirectionWith(db, viewerActorId, ownerActorId))) return false
    if (visibility === 'public') return true
    if (!viewerActorId) return false
    if (visibility === 'close' || visibility === 'followers') {
      const follow = await db
        .selectFrom('follows')
        .select('id')
        .where('follower_actor_id', '=', viewerActorId)
        .where('followed_actor_id', '=', ownerActorId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
      return Boolean(follow)
    }
    return false
  }

  private async isBlockedEitherDirectionWith(
    db: ModulaDb | Transaction<Database>,
    actorA: string,
    actorB: string,
  ): Promise<boolean> {
    const row = await db
      .selectFrom('blocks')
      .select('id')
      .where('deleted_at', 'is', null)
      .where(({eb, or, and}) =>
        or([
          and([eb('blocker_actor_id', '=', actorA), eb('blocked_actor_id', '=', actorB)]),
          and([eb('blocker_actor_id', '=', actorB), eb('blocked_actor_id', '=', actorA)]),
        ]),
      )
      .executeTakeFirst()
    return Boolean(row)
  }
}

function prepareInlineMedia(input: CreateStoryInput, itemId: string): {bytes: Buffer; fileName: string} {
  const declared = typeof input.contentType === 'string'
    ? input.contentType.toLowerCase().split(';', 1)[0]?.trim() ?? ''
    : ''
  const definition = SUPPORTED[declared as keyof typeof SUPPORTED]
  if (!definition || definition.kind !== input.mediaKind) {
    throw domainError('Unsupported story media type', 'VALIDATION_FAILED')
  }
  const encoded = input.base64 ?? ''
  if (encoded.length < 4 || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw domainError('Story media payload is not valid base64', 'VALIDATION_FAILED')
  }
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.toString('base64') !== encoded) {
    throw domainError('Story media payload is not canonical base64', 'VALIDATION_FAILED')
  }
  const canonicalMime = declared === 'image/jpg' ? 'image/jpeg' : declared
  const policy = AttachmentPolicy.definition(canonicalMime)
  AttachmentPolicy.validateSize(policy, bytes.length)
  verifyAttachmentSignature(canonicalMime, bytes)
  if (input.mediaKind === 'image' && !inspectImageDimensions(canonicalMime, bytes)) {
    throw domainError('Story image dimensions are missing or outside policy', 'VALIDATION_FAILED')
  }
  return {bytes, fileName: itemId + '.' + definition.extension}
}

function normalizeOptionalId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw domainError('Valid story attachmentId required', 'VALIDATION_FAILED')
  }
  return value
}

function normalizeIdempotencyKey(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{8,200}$/.test(value)) {
    throw domainError('Invalid story idempotency key', 'VALIDATION_FAILED')
  }
  return value
}

function normalizeRequiredIdempotencyKey(value: unknown): string {
  const key = normalizeIdempotencyKey(value)
  if (!key) throw domainError('Story reply idempotency key is required', 'VALIDATION_FAILED')
  return key
}

function parseStoredStoryReply(value: unknown): Omit<StoryReplyResult, 'created'> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const stored = value as Record<string, unknown>
  if (
    typeof stored.conversationId !== 'string' ||
    typeof stored.messageId !== 'string' ||
    typeof stored.conversationCreated !== 'boolean'
  ) return null
  return {
    conversationId: stored.conversationId,
    messageId: stored.messageId,
    conversationCreated: stored.conversationCreated,
  }
}

function normalizeCaption(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw domainError('Story caption must be text', 'VALIDATION_FAILED')
  const caption = value.trim()
  return caption ? caption.slice(0, 500) : null
}

function normalizeVisibility(value: unknown): 'public' | 'followers' | 'close' {
  if (value === undefined || value === null || value === '') return 'followers'
  if (value === 'public' || value === 'followers' || value === 'close') return value
  throw domainError('Unsupported story visibility', 'VALIDATION_FAILED')
}

function normalizeDuration(value: unknown, mediaKind: 'image' | 'video'): number | undefined {
  if (mediaKind === 'image' || value === undefined || value === null) return mediaKind === 'video' ? 15_000 : undefined
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1_000 || value > 300_000) {
    throw domainError('Story video duration is outside policy', 'VALIDATION_FAILED')
  }
  return value
}

function storyRequestHash(input: {
  attachmentId: string | null
  base64?: string
  contentType?: string
  mediaKind: 'image' | 'video'
  caption: string | null
  visibility: 'public' | 'followers' | 'close'
  durationMs?: number
}): string {
  return createHash('sha256').update(JSON.stringify({
    attachmentId: input.attachmentId,
    inlineSha256: input.base64 ? createHash('sha256').update(input.base64).digest('hex') : null,
    contentType: input.contentType ?? null,
    mediaKind: input.mediaKind,
    caption: input.caption,
    visibility: input.visibility,
    durationMs: input.durationMs ?? null,
  })).digest('hex')
}

function domainError(message: string, code: 'VALIDATION_FAILED' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT') {
  return Object.assign(new Error(message), {code})
}
