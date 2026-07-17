import {randomUUID} from 'node:crypto'
import type {CreatePostInput, SocialPostDto, UpdatePostInput} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'
import {AuditRepository} from '../audit/repository.js'
import {OutboxRepository} from '../outbox/repository.js'
import {PostRepository} from './repository.js'

export class PostWriteService {
  private readonly posts: PostRepository
  private readonly audit: AuditRepository
  private readonly outbox: OutboxRepository

  constructor(private readonly db: ModulaDb) {
    this.posts = new PostRepository(db)
    this.audit = new AuditRepository(db)
    this.outbox = new OutboxRepository(db)
  }

  async create(actorId: string, input: CreatePostInput): Promise<SocialPostDto> {
    const text = (input.text ?? '').trim()
    if (!text || text.length > 5000) {
      throw Object.assign(new Error('Invalid post text'), {code: 'VALIDATION_FAILED'})
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
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('posts')
        .values({
          id,
          author_actor_id: actorId,
          kind: 'text',
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
          glow_colour: null,
          like_count: 0,
          reply_count: 0,
          repost_count: 0,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version: 1,
        })
        .execute()
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
          payload: {postId: id, actorId, collection: 'app.bsky.feed.post'},
        })
      }
      await new AuditRepository(trx).append('post.created', {audience, feed}, {
        type: 'post',
        id,
        actorId,
      })
    })
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
      await new OutboxRepository(this.db).enqueue(trx, {
        eventType: 'atproto.publish.update',
        aggregateType: 'post',
        aggregateId: postId,
        payload: {postId, actorId},
      })
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
      await new OutboxRepository(this.db).enqueue(trx, {
        eventType: 'atproto.publish.delete',
        aggregateType: 'post',
        aggregateId: postId,
        payload: {postId, actorId},
      })
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
            eventType: 'notification.create',
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
