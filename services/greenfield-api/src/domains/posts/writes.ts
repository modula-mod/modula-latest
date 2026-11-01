import {randomUUID} from 'node:crypto'
import type {CreatePostInput, SocialPostDto, UpdatePostInput} from '@modula/api-contracts'
import {sql, type Transaction} from 'kysely'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {GreenfieldEventBus} from '../../events/index.js'
import {AuditRepository} from '../audit/repository.js'
import {PostMediaStorage} from '../media/post-media-storage.js'
import {OutboxRepository} from '../outbox/repository.js'
import {GreenfieldPolicyEngine} from '../policy/index.js'
import {PostRepository} from './repository.js'

export type PostWriteContext = {
  requestId?: string | null
  correlationId?: string | null
  /** Trusted server-side association. Never populated from the generic post body. */
  communityId?: string | null
  /** Trusted reservation identity used only by the draft publication service. */
  draftId?: string | null
  /** Trusted same-transaction finalizer for server-owned workflows such as draft publication. */
  transactionalFinalize?: (trx: Transaction<Database>, postId: string, now: Date) => Promise<void>
}

export class PostWriteService {
  private readonly posts: PostRepository
  private readonly audit: AuditRepository
  private readonly outbox: OutboxRepository
  private readonly mediaStorage: PostMediaStorage
  private readonly policies: GreenfieldPolicyEngine

  constructor(private readonly db: ModulaDb, config: AppConfig) {
    this.posts = new PostRepository(db, config.publicApiUrl)
    this.audit = new AuditRepository(db)
    this.outbox = new OutboxRepository(db)
    this.mediaStorage = new PostMediaStorage(config)
    this.policies = new GreenfieldPolicyEngine(db)
  }

  async create(actorId: string, input: CreatePostInput, context: PostWriteContext = {}): Promise<SocialPostDto> {
    const text = typeof input?.text === 'string' ? input.text.trim() : ''
    const mediaInput = Array.isArray(input?.media) ? input.media : []
    const contentInput = normalizeContentInput(input?.content)
    if ((!text && mediaInput.length === 0 && contentInput.length === 0) || text.length > 5000) {
      throw Object.assign(new Error('Invalid post text'), {code: 'VALIDATION_FAILED'})
    }
    if (mediaInput.length > 0 && contentInput.length > 0) {
      throw Object.assign(new Error('Use attachment content or legacy media, not both'), {code: 'VALIDATION_FAILED'})
    }
    if (contentInput.length > 10) {
      throw Object.assign(new Error('A post supports at most 10 attachments'), {code: 'VALIDATION_FAILED'})
    }
    if (input.publishToAtproto && (mediaInput.length > 0 || contentInput.length > 0)) {
      throw Object.assign(new Error('AT Protocol media publishing is not supported'), {
        code: 'VALIDATION_FAILED',
      })
    }
    const requestedAudience = input.audience ?? 'public'
    const feed = input.feed ?? 'following'
    const idempotencyKey = input.idempotencyKey ?? null
    if (idempotencyKey) {
      const existing = await this.db
        .selectFrom('posts')
        .select(['id', 'community_id', 'text'])
        .where('author_actor_id', '=', actorId)
        .where('idempotency_key', '=', idempotencyKey)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
      if (existing) {
        if ((existing.community_id ?? null) !== (context.communityId ?? null)) {
          throw Object.assign(new Error('Idempotency key is already bound to another post context'), {code: 'CONFLICT'})
        }
        if ((existing.text ?? '') !== text) {
          throw Object.assign(new Error('Idempotency key was reused with a different post payload'), {code: 'CONFLICT'})
        }
        const post = await this.posts.getById(existing.id, actorId)
        if (post) return post
      }
    }

    const id = randomUUID()
    const now = new Date()
    const actor = await this.db.selectFrom('actors').select('account_id').where('id', '=', actorId).executeTakeFirst()
    const persistedMedia = await this.mediaStorage.persistPostMedia({postId: id, media: mediaInput})
    const kind = persistedMedia.length > 0 || contentInput.length > 0 ? 'media' : 'text'
    let replayedPostId: string | null = null
    try {
      await this.db.transaction().execute(async trx => {
        if (idempotencyKey) {
          await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`post-create:${actorId}:${idempotencyKey}`}, 0))`.execute(trx)
          const existing = await trx.selectFrom('posts').select(['id', 'community_id', 'text'])
            .where('author_actor_id', '=', actorId).where('idempotency_key', '=', idempotencyKey)
            .where('deleted_at', 'is', null).executeTakeFirst()
          if (existing) {
            if ((existing.community_id ?? null) !== (context.communityId ?? null) || (existing.text ?? '') !== text) {
              throw Object.assign(new Error('Idempotency key was reused with a different post payload or context'), {code: 'CONFLICT'})
            }
            replayedPostId = existing.id
            return
          }
        }
        let audience = requestedAudience
        let communityId: string | null = null
        if (context.communityId) {
          const association = await trx
            .selectFrom('greenfield_communities as community')
            .innerJoin('greenfield_community_settings as settings', 'settings.community_id', 'community.community_id')
            .innerJoin('greenfield_community_memberships as membership', join => join
              .onRef('membership.community_id', '=', 'community.community_id')
              .on('membership.actor_id', '=', actorId))
            .select([
              'community.community_id', 'community.visibility', 'community.posting_policy',
              'settings.allow_attachments', 'settings.blocked_words',
              'membership.role', 'membership.status',
            ])
            .where('community.community_id', '=', context.communityId)
            .where('community.deleted_at', 'is', null)
            .forUpdate('community')
            .executeTakeFirst()
          if (!association) throw Object.assign(new Error('Community not found'), {code: 'NOT_FOUND'})
          if (association.status !== 'active' || association.role === 'restricted') {
            throw Object.assign(new Error('Active community membership is required'), {code: 'FORBIDDEN'})
          }
          if (association.posting_policy === 'moderators' && !['owner', 'admin', 'moderator'].includes(association.role)) {
            throw Object.assign(new Error('Community posting is restricted to moderators'), {code: 'FORBIDDEN'})
          }
          if (!association.allow_attachments && (mediaInput.length > 0 || contentInput.length > 0)) {
            throw Object.assign(new Error('Attachments are disabled for this community'), {code: 'VALIDATION_FAILED'})
          }
          if (containsBlockedCommunityWord(text, association.blocked_words)) {
            throw Object.assign(new Error('Post text violates community content settings'), {code: 'VALIDATION_FAILED'})
          }
          audience = association.visibility === 'public' ? 'public' : 'private'
          communityId = association.community_id
        }
        const attachments = contentInput.length === 0 ? [] : await trx
          .selectFrom('attachments')
          .selectAll()
          .where('attachment_id', 'in', contentInput.map(item => item.attachmentId))
          .forUpdate()
          .execute()
        if (!actor?.account_id || attachments.length !== contentInput.length) {
          throw Object.assign(new Error('One or more attachments are unavailable'), {code: 'VALIDATION_FAILED'})
        }
        const byId = new Map(attachments.map(item => [item.attachment_id, item]))
        const draftReservations = contentInput.length === 0 ? [] : await trx
          .selectFrom('greenfield_post_draft_content')
          .select(['attachment_id', 'draft_id'])
          .where('attachment_id', 'in', contentInput.map(item => item.attachmentId))
          .execute()
        const reservationsByAttachment = new Map(draftReservations.map(item => [item.attachment_id, item.draft_id]))
        for (const item of contentInput) {
          const attachment = byId.get(item.attachmentId)
          if (!attachment || attachment.owner_account_id !== actor.account_id) {
            throw Object.assign(new Error('Cross-account attachment binding denied'), {code: 'FORBIDDEN'})
          }
          if (attachment.status !== 'ready' || attachment.attached_at) {
            throw Object.assign(new Error('Attachment is not ready for publication'), {code: 'CONFLICT'})
          }
          if (attachment.kind !== item.type) {
            throw Object.assign(new Error('Attachment content type mismatch'), {code: 'VALIDATION_FAILED'})
          }
          const reservedByDraft = reservationsByAttachment.get(item.attachmentId)
          if (reservedByDraft && reservedByDraft !== context.draftId) {
            throw Object.assign(new Error('Attachment is reserved by a draft'), {code: 'CONFLICT'})
          }
        }
        await trx
          .insertInto('posts')
          .values({
            id,
            author_actor_id: actorId,
            kind,
            text,
            feed,
            audience,
            reply_permission: input.replyPermission ?? 'everyone',
            idempotency_key: idempotencyKey,
            link_domain: null,
            link_title: null,
            link_description: null,
            link_image: null,
            module_name: null,
            module_action_label: null,
            module_status: null,
            glow_colour: kind === 'media' ? '#369CAA' : null,
            like_count: 0,
            reaction_count: 0,
            quote_count: 0,
            reply_count: 0,
            repost_count: 0,
            community_id: communityId,
            community_moderation_state: communityId ? 'visible' : null,
            community_featured_at: null,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            version: 1,
          })
          .execute()
        for (const [index, media] of persistedMedia.entries()) {
          await trx
            .insertInto('post_media')
            .values({
              id: media.id,
              post_id: id,
              kind: 'image',
              url: media.url,
              title: media.title,
              colour: media.colour,
              aspect_ratio: media.aspectRatio,
              alt_text: media.altText,
              sort_order: index,
              created_at: now,
              updated_at: now,
              deleted_at: null,
              version: 1,
            })
            .execute()
        }
        for (const [index, item] of contentInput.entries()) {
          await trx.insertInto('post_content').values({
            content_id: randomUUID(), post_id: id, content_type: item.type,
            attachment_id: item.attachmentId, sort_order: index,
            caption: boundedCaption(item.caption), created_at: now,
          }).execute()
          await trx.updateTable('attachments').set({attached_at: now, updated_at: now})
            .where('attachment_id', '=', item.attachmentId)
            .where('owner_account_id', '=', actor.account_id)
            .where('status', '=', 'ready')
            .execute()
        }
        const outbox = new OutboxRepository(this.db)
        await outbox.enqueue(trx, {
          eventType: 'search.index.post',
          aggregateType: 'post',
          aggregateId: id,
          payload: {postId: id},
        })
        if (!communityId && audience === 'public' && input.publishToAtproto) {
          await outbox.enqueue(trx, {
            eventType: 'atproto.publish.create',
            aggregateType: 'post',
            aggregateId: id,
            payload: {
              actorId,
              localRecordType: 'post',
              localRecordId: id,
              collection: 'app.bsky.feed.post',
              record: {
                text,
                createdAt: now.toISOString(),
              },
            },
          })
        }
        await new AuditRepository(trx).append('post.created', {audience, feed, communityId, mediaCount: persistedMedia.length + contentInput.length}, {
          type: 'post',
          id,
          actorId,
        })
        await new GreenfieldEventBus(trx).publish({
          eventType: 'post.created',
          aggregateType: 'post',
          aggregateId: id,
          aggregateVersion: 1,
          accountId: actor?.account_id ?? null,
          actorId,
          requestId: context.requestId ?? null,
          correlationId: context.correlationId ?? context.requestId ?? null,
          idempotencyKey: idempotencyKey ? `post.create:${actorId}:${idempotencyKey}` : null,
          visibility: audience === 'public' ? 'public' : 'actor',
          classification: 'internal',
          payload: {
            postId: id,
            actorId,
            audience,
            feed,
            kind,
            mediaCount: persistedMedia.length + contentInput.length,
          },
          metadata: {
            source: 'greenfield.posts',
            activeSideEffects: ['search.index.post', input.publishToAtproto ? 'atproto.publish.create' : null].filter(Boolean),
          },
          occurredAt: now,
        })
        if (communityId) {
          await new GreenfieldEventBus(trx).publish({
            eventType: 'community.post-created',
            aggregateType: 'communityPost',
            aggregateId: id,
            aggregateVersion: 1,
            accountId: actor?.account_id ?? null,
            actorId,
            requestId: context.requestId ?? null,
            correlationId: context.correlationId ?? context.requestId ?? null,
            idempotencyKey: idempotencyKey ? `community.post.create:${communityId}:${actorId}:${idempotencyKey}` : null,
            visibility: audience === 'public' ? 'public' : 'internal',
            classification: 'internal',
            payload: {communityId, postId: id, actorId},
            metadata: {source: 'greenfield.communities'},
            occurredAt: now,
          })
        }
        await context.transactionalFinalize?.(trx, id, now)
      })
      if (replayedPostId) {
        await this.mediaStorage.removePersistedMedia(persistedMedia)
        const replayed = await this.posts.getById(replayedPostId, actorId)
        if (replayed) return replayed
        throw new Error('Failed to load idempotent post replay')
      }
    } catch (error) {
      await this.mediaStorage.removePersistedMedia(persistedMedia)
      if (idempotencyKey && (error as {code?: string})?.code === '23505') {
        const existing = await this.db.selectFrom('posts').select(['id', 'community_id', 'text'])
          .where('author_actor_id', '=', actorId).where('idempotency_key', '=', idempotencyKey)
          .where('deleted_at', 'is', null).executeTakeFirst()
        if (existing && (existing.community_id ?? null) === (context.communityId ?? null) && (existing.text ?? '') === text) {
          const post = await this.posts.getById(existing.id, actorId)
          if (post) return post
        }
      }
      throw error
    }
    const created = await this.posts.getByIdForAuthor(id, actorId)
    if (!created) throw new Error('Failed to load created post')
    return created
  }

  async update(actorId: string, postId: string, input: UpdatePostInput, context: PostWriteContext = {}): Promise<SocialPostDto> {
    const text = (input.text ?? '').trim()
    if (!text || text.length > 5000) {
      throw Object.assign(new Error('Invalid post text'), {code: 'VALIDATION_FAILED'})
    }
    const row = await this.db
      .selectFrom('posts')
      .selectAll()
      .where('id', '=', postId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!row) throw Object.assign(new Error('Post not found'), {code: 'NOT_FOUND'})
    if (row.author_actor_id !== actorId) {
      throw Object.assign(new Error('Cannot edit another actor post'), {code: 'FORBIDDEN'})
    }
    if (row.version !== input.expectedVersion) {
      throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    }
    if (row.community_id) {
      const community = await this.db
        .selectFrom('greenfield_community_memberships as membership')
        .innerJoin('greenfield_community_settings as settings', 'settings.community_id', 'membership.community_id')
        .select(['membership.role', 'membership.status', 'settings.blocked_words'])
        .where('membership.community_id', '=', row.community_id)
        .where('membership.actor_id', '=', actorId)
        .executeTakeFirst()
      if (!community || community.status !== 'active' || community.role === 'restricted') {
        throw Object.assign(new Error('Active community membership is required'), {code: 'FORBIDDEN'})
      }
      if (containsBlockedCommunityWord(text, community.blocked_words)) {
        throw Object.assign(new Error('Post text violates community content settings'), {code: 'VALIDATION_FAILED'})
      }
    }
    const actor = await this.db.selectFrom('actors').select('account_id').where('id', '=', actorId).executeTakeFirst()
    const nextVersion = row.version + 1
    await this.db.transaction().execute(async trx => {
      const now = new Date()
      const updated = await trx
        .updateTable('posts')
        .set({text, updated_at: now, version: nextVersion})
        .where('id', '=', postId)
        .where('version', '=', input.expectedVersion)
        .executeTakeFirst()
      if (Number(updated.numUpdatedRows ?? 0) === 0) {
        throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
      }
      if (!row.community_id && row.audience === 'public') {
        await new OutboxRepository(this.db).enqueue(trx, {
          eventType: 'atproto.publish.update',
          aggregateType: 'post',
          aggregateId: postId,
          payload: {
            actorId,
            localRecordType: 'post',
            localRecordId: postId,
            collection: 'app.bsky.feed.post',
            record: {
              text,
              createdAt: row.created_at.toISOString(),
            },
          },
        })
      }
      await new AuditRepository(trx).append(
        'post.updated',
        {expectedVersion: input.expectedVersion},
        {type: 'post', id: postId, actorId},
      )
      await new GreenfieldEventBus(trx).publish({
        eventType: 'post.updated',
        aggregateType: 'post',
        aggregateId: postId,
        aggregateVersion: nextVersion,
        accountId: actor?.account_id ?? null,
        actorId,
        requestId: context.requestId ?? null,
        correlationId: context.correlationId ?? context.requestId ?? null,
        visibility: row.audience === 'public' ? 'public' : 'actor',
        classification: 'internal',
        payload: {
          postId,
          actorId,
          audience: row.audience,
          sourceVersion: nextVersion,
        },
        metadata: {source: 'greenfield.posts'},
        occurredAt: now,
      })
    })
    const post = await this.posts.getByIdForAuthor(postId, actorId)
    if (!post) throw Object.assign(new Error('Post not found'), {code: 'NOT_FOUND'})
    return post
  }

  async delete(actorId: string, postId: string, context: PostWriteContext = {}): Promise<void> {
    const row = await this.db
      .selectFrom('posts')
      .selectAll()
      .where('id', '=', postId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!row) throw Object.assign(new Error('Post not found'), {code: 'NOT_FOUND'})
    if (row.author_actor_id !== actorId) {
      throw Object.assign(new Error('Cannot delete another actor post'), {code: 'FORBIDDEN'})
    }
    const actor = await this.db.selectFrom('actors').select('account_id').where('id', '=', actorId).executeTakeFirst()
    const nextVersion = row.version + 1
    await this.db.transaction().execute(async trx => {
      const now = new Date()
      await trx
        .updateTable('posts')
        .set({deleted_at: now, updated_at: now, version: nextVersion})
        .where('id', '=', postId)
        .execute()
      if (!row.community_id && row.audience === 'public') {
        await new OutboxRepository(this.db).enqueue(trx, {
          eventType: 'atproto.publish.delete',
          aggregateType: 'post',
          aggregateId: postId,
          payload: {
            actorId,
            localRecordType: 'post',
            localRecordId: postId,
            collection: 'app.bsky.feed.post',
          },
        })
      }
      await new AuditRepository(trx).append('post.deleted', {}, {type: 'post', id: postId, actorId})
      await new GreenfieldEventBus(trx).publish({
        eventType: 'post.deleted',
        aggregateType: 'post',
        aggregateId: postId,
        aggregateVersion: nextVersion,
        accountId: actor?.account_id ?? null,
        actorId,
        requestId: context.requestId ?? null,
        correlationId: context.correlationId ?? context.requestId ?? null,
        visibility: row.audience === 'public' ? 'public' : 'actor',
        classification: 'internal',
        payload: {
          postId,
          actorId,
          audience: row.audience,
          sourceVersion: nextVersion,
        },
        metadata: {source: 'greenfield.posts', tombstone: true},
        occurredAt: now,
      })
    })
  }

  async setEngagement(
    actorId: string,
    postId: string,
    kind: 'like' | 'save' | 'repost',
    enabled: boolean,
  ): Promise<void> {
    const post = await this.db
      .selectFrom('posts')
      .selectAll()
      .where('id', '=', postId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!post) throw Object.assign(new Error('Post not found'), {code: 'NOT_FOUND'})
    await this.policies.assertAllowed({
      actorId,
      action: `post.${kind}`,
      resource: {type: 'post', id: postId, ownerActorId: post.author_actor_id, visibility: post.audience},
    })

    const table = kind === 'like' ? 'post_likes' : kind === 'save' ? 'post_saves' : 'post_reposts'
    const countColumn = kind === 'like' ? 'like_count' : kind === 'repost' ? 'repost_count' : null

    await this.db.transaction().execute(async trx => {
      const existing = await trx
        .selectFrom(table)
        .selectAll()
        .where('actor_id', '=', actorId)
        .where('post_id', '=', postId)
        .executeTakeFirst()

      if (enabled) {
        if (!existing) {
          await trx
            .insertInto(table)
            .values({
              id: randomUUID(),
              actor_id: actorId,
              post_id: postId,
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
              version: 1,
            } as any)
            .execute()
          if (countColumn) {
            await trx
              .updateTable('posts')
              .set({[countColumn]: post[countColumn] + 1, updated_at: new Date()} as any)
              .where('id', '=', postId)
              .execute()
          }
        } else if (existing.deleted_at) {
          await trx
            .updateTable(table)
            .set({deleted_at: null, updated_at: new Date(), version: existing.version + 1})
            .where('id', '=', existing.id)
            .execute()
          if (countColumn) {
            await trx
              .updateTable('posts')
              .set({[countColumn]: post[countColumn] + 1, updated_at: new Date()} as any)
              .where('id', '=', postId)
              .execute()
          }
        }
        if (kind === 'like' || kind === 'repost') {
          await new OutboxRepository(this.db).enqueue(trx, {
            eventType: kind === 'repost' ? 'notification.repost' : 'notification.create',
            aggregateType: 'post',
            aggregateId: postId,
            payload: {
              type: kind,
              actorId,
              recipientActorId: post.author_actor_id,
              resourceType: 'post',
              resourceId: postId,
            },
          })
        }
      } else if (existing && !existing.deleted_at) {
        await trx
          .updateTable(table)
          .set({deleted_at: new Date(), updated_at: new Date(), version: existing.version + 1})
          .where('id', '=', existing.id)
          .execute()
        if (countColumn && post[countColumn] > 0) {
          await trx
            .updateTable('posts')
            .set({[countColumn]: post[countColumn] - 1, updated_at: new Date()} as any)
            .where('id', '=', postId)
            .execute()
        }
      }
    })
  }
}

function containsBlockedCommunityWord(text: string, blockedWords: string[]): boolean {
  const normalized = text.normalize('NFKC').toLocaleLowerCase()
  return blockedWords.some(value => {
    const word = value.normalize('NFKC').trim().toLocaleLowerCase()
    return word.length > 0 && normalized.includes(word)
  })
}

function boundedCaption(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const caption = value.trim()
  if (!caption) return null
  if (caption.length > 500) throw Object.assign(new Error('Attachment caption is too long'), {code: 'VALIDATION_FAILED'})
  return caption
}

function normalizeContentInput(value: unknown): NonNullable<CreatePostInput['content']> {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw Object.assign(new Error('Post content must be an array'), {code: 'VALIDATION_FAILED'})
  const allowed = new Set(['image', 'video', 'audio', 'pdf', 'document'])
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw Object.assign(new Error('Invalid post content item'), {code: 'VALIDATION_FAILED'})
    }
    const source = item as Record<string, unknown>
    if (typeof source.type !== 'string' || !allowed.has(source.type)) {
      throw Object.assign(new Error('Unsupported post content type'), {code: 'VALIDATION_FAILED'})
    }
    if (typeof source.attachmentId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(source.attachmentId)) {
      throw Object.assign(new Error('Invalid attachment ID'), {code: 'VALIDATION_FAILED'})
    }
    if (source.caption !== undefined && typeof source.caption !== 'string') {
      throw Object.assign(new Error('Invalid attachment caption'), {code: 'VALIDATION_FAILED'})
    }
    return {
      type: source.type as NonNullable<CreatePostInput['content']>[number]['type'],
      attachmentId: source.attachmentId,
      caption: source.caption as string | undefined,
    }
  })
}
