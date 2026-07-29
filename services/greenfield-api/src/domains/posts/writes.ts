import {randomUUID} from 'node:crypto'
import type {CreatePostInput, SocialPostDto, UpdatePostInput} from '@modula/api-contracts'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import {GreenfieldEventBus} from '../../events/index.js'
import {AuditRepository} from '../audit/repository.js'
import {PostMediaStorage} from '../media/post-media-storage.js'
import {OutboxRepository} from '../outbox/repository.js'
import {PostRepository} from './repository.js'

export type PostWriteContext = {
  requestId?: string | null
  correlationId?: string | null
}

export class PostWriteService {
  private readonly posts: PostRepository
  private readonly audit: AuditRepository
  private readonly outbox: OutboxRepository
  private readonly mediaStorage: PostMediaStorage

  constructor(private readonly db: ModulaDb, config: AppConfig) {
    this.posts = new PostRepository(db)
    this.audit = new AuditRepository(db)
    this.outbox = new OutboxRepository(db)
    this.mediaStorage = new PostMediaStorage(config)
  }

  async create(actorId: string, input: CreatePostInput, context: PostWriteContext = {}): Promise<SocialPostDto> {
    const text = (input.text ?? '').trim()
    const mediaInput = input.media ?? []
    if ((!text && mediaInput.length === 0) || text.length > 5000) {
      throw Object.assign(new Error('Invalid post text'), {code: 'VALIDATION_FAILED'})
    }
    if (input.publishToAtproto && mediaInput.length > 0) {
      throw Object.assign(new Error('AT Protocol media publishing is not supported'), {
        code: 'VALIDATION_FAILED',
      })
    }
    const audience = input.audience ?? 'public'
    const feed = input.feed ?? 'following'
    const idempotencyKey = input.idempotencyKey ?? null
    if (idempotencyKey) {
      const existing = await this.db
        .selectFrom('posts')
        .select('id')
        .where('author_actor_id', '=', actorId)
        .where('idempotency_key', '=', idempotencyKey)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
      if (existing) {
        const post = await this.posts.getById(existing.id)
        if (post) return post
      }
    }

    const id = randomUUID()
    const now = new Date()
    const actor = await this.db.selectFrom('actors').select('account_id').where('id', '=', actorId).executeTakeFirst()
    const persistedMedia = await this.mediaStorage.persistPostMedia({postId: id, media: mediaInput})
    const kind = persistedMedia.length > 0 ? 'media' : 'text'
    try {
      await this.db.transaction().execute(async trx => {
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
            glow_colour: persistedMedia.length > 0 ? '#369CAA' : null,
            like_count: 0,
            reaction_count: 0,
            quote_count: 0,
            reply_count: 0,
            repost_count: 0,
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
        const outbox = new OutboxRepository(this.db)
        await outbox.enqueue(trx, {
          eventType: 'search.index.post',
          aggregateType: 'post',
          aggregateId: id,
          payload: {postId: id},
        })
        if (audience === 'public' && input.publishToAtproto) {
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
        await new AuditRepository(trx).append('post.created', {audience, feed, mediaCount: persistedMedia.length}, {
          type: 'post',
          id,
          actorId,
        })
        await new GreenfieldEventBus(trx).publish({
          eventType: 'post.created',
          aggregateType: 'post',
          aggregateId: id,
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
            mediaCount: persistedMedia.length,
          },
          metadata: {
            source: 'greenfield.posts',
            activeSideEffects: ['search.index.post', input.publishToAtproto ? 'atproto.publish.create' : null].filter(Boolean),
          },
          occurredAt: now,
        })
      })
    } catch (error) {
      await this.mediaStorage.removePersistedMedia(persistedMedia)
      throw error
    }
    const created = await this.posts.getByIdForAuthor(id, actorId)
    if (!created) throw new Error('Failed to load created post')
    return created
  }

  async update(actorId: string, postId: string, input: UpdatePostInput): Promise<SocialPostDto> {
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
    await this.db.transaction().execute(async trx => {
      const updated = await trx
        .updateTable('posts')
        .set({text, updated_at: new Date(), version: row.version + 1})
        .where('id', '=', postId)
        .where('version', '=', input.expectedVersion)
        .executeTakeFirst()
      if (Number(updated.numUpdatedRows ?? 0) === 0) {
        throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
      }
      if (row.audience === 'public') {
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
    })
    const post = await this.posts.getByIdForAuthor(postId, actorId)
    if (!post) throw Object.assign(new Error('Post not found'), {code: 'NOT_FOUND'})
    return post
  }

  async delete(actorId: string, postId: string): Promise<void> {
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
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('posts')
        .set({deleted_at: new Date(), updated_at: new Date(), version: row.version + 1})
        .where('id', '=', postId)
        .execute()
      if (row.audience === 'public') {
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
