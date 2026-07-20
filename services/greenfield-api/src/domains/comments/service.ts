import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import {AuditRepository} from '../audit/repository.js'
import {OutboxRepository} from '../outbox/repository.js'
import type {ReactionType} from '../reactions/service.js'

const validateText = (text: string) => {
  const value = text.trim()
  if (!value || value.length > 5000) throw Object.assign(new Error('Invalid comment text'), {code: 'VALIDATION_FAILED'})
  return value
}

export class CommentService {
  constructor(private readonly db: ModulaDb) {}

  async listComments(viewerActorId: string | null, postId: string) {
    const excluded = viewerActorId ? await this.excludedActors(viewerActorId) : []
    let query = this.db.selectFrom('greenfield_comments').selectAll().where('post_id', '=', postId).where('parent_comment_id', 'is', null).orderBy('created_at', 'asc')
    if (excluded.length) query = query.where('author_actor_id', 'not in', excluded)
    return query.execute()
  }

  async listReplies(viewerActorId: string | null, commentId: string) {
    const excluded = viewerActorId ? await this.excludedActors(viewerActorId) : []
    let query = this.db.selectFrom('greenfield_comments').selectAll().where('root_comment_id', '=', commentId).orderBy('created_at', 'asc')
    if (excluded.length) query = query.where('author_actor_id', 'not in', excluded)
    return query.execute()
  }

  async createComment(actorId: string, postId: string, text: string) {
    return this.create(actorId, postId, null, validateText(text))
  }

  async createReply(actorId: string, parentCommentId: string, text: string) {
    let parent = await this.db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', parentCommentId).executeTakeFirst()
    if (!parent) throw Object.assign(new Error('Comment not found'), {code: 'NOT_FOUND'})
    // Flatten deeper replies into the nearest supported thread level (max depth 4).
    while (parent.depth >= 4 && parent.parent_comment_id) {
      const ancestor = await this.db
        .selectFrom('greenfield_comments')
        .selectAll()
        .where('comment_id', '=', parent.parent_comment_id)
        .executeTakeFirst()
      if (!ancestor) break
      parent = ancestor
    }
    const depth = Math.min(parent.depth + 1, 4)
    return this.create(actorId, parent.post_id, {...parent, depth: parent.depth}, validateText(text), depth)
  }

  async updateComment(actorId: string, commentId: string, text: string, expectedVersion: number) {
    const row = await this.db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', commentId).executeTakeFirst()
    if (!row) throw Object.assign(new Error('Comment not found'), {code: 'NOT_FOUND'})
    if (row.author_actor_id !== actorId || row.deleted_at) throw Object.assign(new Error('Cannot edit comment'), {code: 'FORBIDDEN'})
    if (row.version !== expectedVersion) throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    const result = await this.db.updateTable('greenfield_comments').set({text: validateText(text), version: row.version + 1, updated_at: new Date()}).where('comment_id', '=', commentId).where('version', '=', expectedVersion).executeTakeFirst()
    if (!Number(result.numUpdatedRows)) throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    return this.db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', commentId).executeTakeFirstOrThrow()
  }

  async deleteComment(actorId: string, commentId: string, deletionKind: 'user' | 'moderation' = 'user') {
    const row = await this.db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', commentId).executeTakeFirst()
    if (!row) throw Object.assign(new Error('Comment not found'), {code: 'NOT_FOUND'})
    if (deletionKind === 'user' && row.author_actor_id !== actorId) throw Object.assign(new Error('Cannot delete comment'), {code: 'FORBIDDEN'})
    if (row.deleted_at) return
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_comments').set({text: row.reply_count ? 'Comment deleted' : '', deleted_at: now, deletion_kind: deletionKind, updated_at: now, version: row.version + 1}).where('comment_id', '=', commentId).execute()
      await trx.updateTable('posts').set({reply_count: sql<number>`greatest(reply_count - 1, 0)`, updated_at: now}).where('id', '=', row.post_id).execute()
      if (row.parent_comment_id) {
        await trx.updateTable('greenfield_comments').set({reply_count: sql<number>`greatest(reply_count - 1, 0)`, updated_at: now}).where('comment_id', '=', row.parent_comment_id).execute()
      }
      await new AuditRepository(trx).append('comment.deleted', {deletionKind}, {type: 'comment', id: commentId, actorId})
    })
  }

  async setCommentReaction(actorId: string, commentId: string, type: ReactionType | null) {
    const comment = await this.db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', commentId).executeTakeFirst()
    if (!comment) throw Object.assign(new Error('Comment not found'), {code: 'NOT_FOUND'})
    const current = await this.db.selectFrom('greenfield_comment_reactions').selectAll().where('actor_id', '=', actorId).where('comment_id', '=', commentId).executeTakeFirst()
    if (type === null) { if (current) await this.db.deleteFrom('greenfield_comment_reactions').where('reaction_id', '=', current.reaction_id).execute(); return }
    if (current) await this.db.updateTable('greenfield_comment_reactions').set({reaction_type: type, updated_at: new Date()}).where('reaction_id', '=', current.reaction_id).execute()
    else await this.db.insertInto('greenfield_comment_reactions').values({reaction_id: randomUUID(), actor_id: actorId, comment_id: commentId, reaction_type: type, created_at: new Date(), updated_at: new Date()}).execute()
  }

  private async create(
    actorId: string,
    postId: string,
    parent: {comment_id: string; root_comment_id: string | null; depth: number; author_actor_id: string} | null,
    text: string,
    forcedDepth?: number,
  ) {
    const post = await this.db.selectFrom('posts').selectAll().where('id', '=', postId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!post) throw Object.assign(new Error('Post not found'), {code: 'NOT_FOUND'})
    if (post.reply_permission === 'none') throw Object.assign(new Error('Replies disabled'), {code: 'FORBIDDEN'})
    const id = randomUUID()
    const now = new Date()
    const rootId = parent ? parent.root_comment_id ?? parent.comment_id : null
    const depth = forcedDepth ?? (parent ? Math.min(parent.depth + 1, 4) : 0)
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_comments')
        .values({
          comment_id: id,
          post_id: postId,
          author_actor_id: actorId,
          parent_comment_id: parent?.comment_id ?? null,
          root_comment_id: rootId,
          text,
          depth,
          reply_count: 0,
          version: 1,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          deletion_kind: null,
        })
        .execute()
      await trx.updateTable('posts').set({reply_count: post.reply_count + 1, updated_at: now}).where('id', '=', postId).execute()
      if (parent) {
        const parentRow = await trx
          .selectFrom('greenfield_comments')
          .select('reply_count')
          .where('comment_id', '=', parent.comment_id)
          .executeTakeFirstOrThrow()
        await trx
          .updateTable('greenfield_comments')
          .set({reply_count: parentRow.reply_count + 1, updated_at: now})
          .where('comment_id', '=', parent.comment_id)
          .execute()
      }
      const recipient = parent?.author_actor_id ?? post.author_actor_id
      if (recipient !== actorId) {
        await new OutboxRepository(trx).enqueue(trx, {
          eventType: parent ? 'notification.reply' : 'notification.comment',
          aggregateType: 'comment',
          aggregateId: id,
          payload: {actorId, recipientActorId: recipient, resourceType: 'post', resourceId: postId},
        })
      }
      await new AuditRepository(trx).append(
        'comment.created',
        {postId, parentCommentId: parent?.comment_id ?? null},
        {type: 'comment', id, actorId},
      )
    })
    return this.db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', id).executeTakeFirstOrThrow()
  }

  private async excludedActors(viewerActorId: string) {
    const [blocks, mutes] = await Promise.all([
      this.db.selectFrom('blocks').select(['blocker_actor_id', 'blocked_actor_id']).where('deleted_at', 'is', null).where(({eb, or}) => or([eb('blocker_actor_id', '=', viewerActorId), eb('blocked_actor_id', '=', viewerActorId)])).execute(),
      this.db.selectFrom('mutes').select('muted_actor_id').where('muter_actor_id', '=', viewerActorId).where('deleted_at', 'is', null).execute(),
    ])
    return [...new Set([...blocks.map(row => row.blocker_actor_id === viewerActorId ? row.blocked_actor_id : row.blocker_actor_id), ...mutes.map(row => row.muted_actor_id)])]
  }
}
