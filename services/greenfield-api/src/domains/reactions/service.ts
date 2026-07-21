import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import {AuditRepository} from '../audit/repository.js'
import {OutboxRepository} from '../outbox/repository.js'

export type ReactionType = 'like' | 'love' | 'celebrate' | 'insightful' | 'support' | 'funny'
const TYPES: ReadonlySet<string> = new Set(['like', 'love', 'celebrate', 'insightful', 'support', 'funny'])

export class ReactionService {
  constructor(private readonly db: ModulaDb) {}

  async setReaction(actorId: string, postId: string, type: ReactionType | null) {
    if (type !== null && !TYPES.has(type)) throw Object.assign(new Error('Invalid reaction'), {code: 'VALIDATION_FAILED'})
    const post = await this.resolveVisiblePost(actorId, postId)
    const now = new Date()
    let notifiedType: ReactionType | null = null
    await this.db.transaction().execute(async trx => {
      const existing = await trx
        .selectFrom('greenfield_reactions')
        .selectAll()
        .where('actor_id', '=', actorId)
        .where('post_id', '=', postId)
        .executeTakeFirst()

      if (type === null || (type && existing && existing.reaction_type === type)) {
        if (existing) {
          await trx.deleteFrom('greenfield_reactions').where('reaction_id', '=', existing.reaction_id).execute()
          await trx
            .updateTable('posts')
            .set({
              reaction_count: sql`greatest(reaction_count - 1, 0)`,
              like_count: existing.reaction_type === 'like' ? sql`greatest(like_count - 1, 0)` : sql`like_count`,
              updated_at: now,
            })
            .where('id', '=', postId)
            .execute()
        }
      } else if (type && !existing) {
        await trx
          .insertInto('greenfield_reactions')
          .values({
            reaction_id: randomUUID(),
            actor_id: actorId,
            post_id: postId,
            reaction_type: type,
            created_at: now,
            updated_at: now,
          })
          .execute()
        await trx
          .updateTable('posts')
          .set({
            reaction_count: sql`reaction_count + 1`,
            like_count: type === 'like' ? sql`like_count + 1` : sql`like_count`,
            updated_at: now,
          })
          .where('id', '=', postId)
          .execute()
        notifiedType = type
      } else if (type && existing && existing.reaction_type !== type) {
        await trx
          .updateTable('greenfield_reactions')
          .set({reaction_type: type, updated_at: now})
          .where('reaction_id', '=', existing.reaction_id)
          .execute()
        await trx
          .updateTable('posts')
          .set({
            like_count:
              existing.reaction_type === 'like'
                ? sql`greatest(like_count - 1, 0)`
                : type === 'like'
                  ? sql`like_count + 1`
                  : sql`like_count`,
            updated_at: now,
          })
          .where('id', '=', postId)
          .execute()
        notifiedType = type
      }

      if (notifiedType && post.author_actor_id !== actorId) {
        await new OutboxRepository(trx).enqueue(trx, {
          eventType: 'notification.reaction',
          aggregateType: 'post',
          aggregateId: postId,
          payload: {
            actorId,
            recipientActorId: post.author_actor_id,
            type: notifiedType,
            resourceType: 'post',
            resourceId: postId,
          },
        })
      }
      await new AuditRepository(trx).append('reaction.set', {type}, {type: 'post', id: postId, actorId})
    })
    return this.listReactions(actorId, postId)
  }

  async listReactions(viewerActorId: string | null, postId: string) {
    if (viewerActorId) await this.resolveVisiblePost(viewerActorId, postId)
    const rows = await this.db.selectFrom('greenfield_reactions').select(['reaction_type']).where('post_id', '=', postId).execute()
    const byType: Partial<Record<ReactionType, number>> = {}
    for (const row of rows) byType[row.reaction_type] = (byType[row.reaction_type] ?? 0) + 1
    const viewer = viewerActorId ? await this.db.selectFrom('greenfield_reactions').select('reaction_type').where('post_id', '=', postId).where('actor_id', '=', viewerActorId).executeTakeFirst() : undefined
    return {viewerReaction: viewer?.reaction_type ?? null, total: rows.length, byType}
  }

  private async resolveVisiblePost(actorId: string, postId: string) {
    const post = await this.db.selectFrom('posts').selectAll().where('id', '=', postId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!post) throw Object.assign(new Error('Post not found'), {code: 'NOT_FOUND'})
    const blocked = await this.db.selectFrom('blocks').select('id').where('deleted_at', 'is', null).where(({eb, or, and}) => or([and([eb('blocker_actor_id', '=', actorId), eb('blocked_actor_id', '=', post.author_actor_id)]), and([eb('blocker_actor_id', '=', post.author_actor_id), eb('blocked_actor_id', '=', actorId)])])).executeTakeFirst()
    if (blocked) throw Object.assign(new Error('Post unavailable'), {code: 'FORBIDDEN'})
    if (post.audience === 'private' && post.author_actor_id !== actorId) throw Object.assign(new Error('Post unavailable'), {code: 'FORBIDDEN'})
    if (post.audience === 'followers' && post.author_actor_id !== actorId) {
      const following = await this.db.selectFrom('follows').select('id').where('follower_actor_id', '=', actorId).where('followed_actor_id', '=', post.author_actor_id).where('deleted_at', 'is', null).executeTakeFirst()
      if (!following) throw Object.assign(new Error('Post unavailable'), {code: 'FORBIDDEN'})
    }
    return post
  }
}
