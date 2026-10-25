import {randomUUID} from 'node:crypto'
import {badgesForActors, NO_BADGES} from '../../premium/badges.js'
import {GREENFIELD_REACTION_TYPES} from '@modula/greenfield-contracts'
import {sql, type Selectable} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {AuditRepository} from '../audit/repository.js'
import {OutboxRepository} from '../outbox/repository.js'
import {GreenfieldPolicyEngine} from '../policy/index.js'
import type {ReactionType} from '../reactions/service.js'
import {normalizeCommentMedia, presentCommentMedia, type CommentMediaItem} from './media.js'

const validateText = (text: string, allowEmpty = false) => {
  const value = text.trim()
  if ((!value && !allowEmpty) || value.length > 5000) throw Object.assign(new Error('Invalid comment text'), {code: 'VALIDATION_FAILED'})
  return value
}

export class CommentService {
  private readonly policies: GreenfieldPolicyEngine

  constructor(private readonly db: ModulaDb, private readonly publicApiUrl?: string) {
    this.policies = new GreenfieldPolicyEngine(db)
  }

  async listComments(viewerActorId: string | null, postId: string) {
    await this.policies.assertAllowed({
      actorId: viewerActorId,
      action: 'comment.list',
      resource: {type: 'post', id: postId},
    })
    const excluded = viewerActorId ? await this.excludedActors(viewerActorId) : []
    let query = this.db.selectFrom('greenfield_comments').selectAll().where('post_id', '=', postId).where('parent_comment_id', 'is', null)
      .orderBy(sql`pinned_at IS NULL`).orderBy('created_at', 'asc')
    if (excluded.length) query = query.where('author_actor_id', 'not in', excluded)
    return this.withAuthors(await query.execute(), viewerActorId)
  }

  async listReplies(viewerActorId: string | null, commentId: string) {
    await this.policies.assertAllowed({
      actorId: viewerActorId,
      action: 'comment.list',
      resource: {type: 'comment', id: commentId},
    })
    const excluded = viewerActorId ? await this.excludedActors(viewerActorId) : []
    let query = this.db.selectFrom('greenfield_comments').selectAll().where('root_comment_id', '=', commentId).orderBy('created_at', 'asc')
    if (excluded.length) query = query.where('author_actor_id', 'not in', excluded)
    return this.withAuthors(await query.execute(), viewerActorId)
  }

  async createComment(actorId: string, postId: string, text: string, media?: {accountId: string; raw: unknown}, quotedCommentId?: unknown) {
    const items = media ? await normalizeCommentMedia(this.db, media.accountId, media.raw) : []
    const quoted = await this.resolveQuote(postId, quotedCommentId)
    return this.create(actorId, postId, null, validateText(text, items.length > 0 || Boolean(quoted)), undefined, items, quoted)
  }

  /** Quotes must point at a live comment on the same post. */
  private async resolveQuote(postId: string, raw: unknown): Promise<string | null> {
    if (raw === undefined || raw === null || raw === '') return null
    if (typeof raw !== 'string' || raw.length > 64) throw Object.assign(new Error('Invalid quote'), {code: 'VALIDATION_FAILED'})
    const row = await this.db.selectFrom('greenfield_comments').select(['comment_id', 'post_id']).where('comment_id', '=', raw).where('deleted_at', 'is', null).executeTakeFirst()
    if (!row || row.post_id !== postId) throw Object.assign(new Error('Quoted comment not found'), {code: 'VALIDATION_FAILED'})
    return row.comment_id
  }

  async votePoll(actorId: string, commentId: string, optionIndex: number | null) {
    const comment = await this.db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', commentId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!comment) throw Object.assign(new Error('Comment not found'), {code: 'NOT_FOUND'})
    await this.policies.assertAllowed({actorId, action: 'comment.react', resource: {type: 'comment', id: commentId}})
    const poll = (Array.isArray(comment.media) ? comment.media : []).find((item: any) => item?.type === 'poll') as {options: string[]; closesAt: string | null} | undefined
    if (!poll) throw Object.assign(new Error('This comment has no poll'), {code: 'VALIDATION_FAILED'})
    if (poll.closesAt && Date.parse(poll.closesAt) < Date.now()) throw Object.assign(new Error('Poll closed'), {code: 'VALIDATION_FAILED'})
    if (optionIndex === null) {
      await this.db.deleteFrom('greenfield_comment_poll_votes').where('comment_id', '=', commentId).where('actor_id', '=', actorId).execute()
    } else {
      if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) throw Object.assign(new Error('Invalid option'), {code: 'VALIDATION_FAILED'})
      await this.db.insertInto('greenfield_comment_poll_votes').values({comment_id: commentId, actor_id: actorId, option_index: optionIndex, created_at: new Date()})
        .onConflict(oc => oc.columns(['comment_id', 'actor_id']).doUpdateSet({option_index: optionIndex, created_at: new Date()})).execute()
    }
    return (await this.withAuthors([comment], actorId))[0]!
  }

  /** Post authors can pin one top-level comment. */
  async setPinned(actorId: string, commentId: string, pinned: boolean) {
    const comment = await this.db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', commentId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!comment) throw Object.assign(new Error('Comment not found'), {code: 'NOT_FOUND'})
    const post = await this.db.selectFrom('posts').select(['author_actor_id']).where('id', '=', comment.post_id).where('deleted_at', 'is', null).executeTakeFirst()
    if (!post || post.author_actor_id !== actorId) throw Object.assign(new Error('Only the post author can pin comments'), {code: 'FORBIDDEN'})
    if (comment.parent_comment_id) throw Object.assign(new Error('Only top-level comments can be pinned'), {code: 'VALIDATION_FAILED'})
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      if (pinned) await trx.updateTable('greenfield_comments').set({pinned_at: null}).where('post_id', '=', comment.post_id).where('pinned_at', 'is not', null).execute()
      await trx.updateTable('greenfield_comments').set({pinned_at: pinned ? now : null}).where('comment_id', '=', commentId).execute()
      await new AuditRepository(trx).append(pinned ? 'comment.pinned' : 'comment.unpinned', {postId: comment.post_id}, {type: 'comment', id: commentId, actorId})
    })
    const updated = await this.db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', commentId).executeTakeFirstOrThrow()
    return (await this.withAuthors([updated], actorId))[0]!
  }

  async createReply(actorId: string, parentCommentId: string, text: string, media?: {accountId: string; raw: unknown}) {
    const items = media ? await normalizeCommentMedia(this.db, media.accountId, media.raw) : []
    let parent = await this.db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', parentCommentId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!parent) throw Object.assign(new Error('Comment not found'), {code: 'NOT_FOUND'})
    await this.policies.assertAllowed({
      actorId,
      action: 'comment.reply',
      resource: {type: 'comment', id: parentCommentId, ownerActorId: parent.author_actor_id},
    })
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
    return this.create(actorId, parent.post_id, {...parent, depth: parent.depth}, validateText(text, items.length > 0), depth, items)
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
    if (type !== null && !GREENFIELD_REACTION_TYPES.includes(type)) {
      throw Object.assign(new Error('Invalid reaction'), {code: 'VALIDATION_FAILED'})
    }
    const comment = await this.db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', commentId).executeTakeFirst()
    if (!comment) throw Object.assign(new Error('Comment not found'), {code: 'NOT_FOUND'})
    await this.policies.assertAllowed({
      actorId,
      action: 'comment.react',
      resource: {type: 'comment', id: commentId},
    })
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
    media: CommentMediaItem[] = [],
    quotedCommentId: string | null = null,
  ) {
    const post = await this.db.selectFrom('posts').selectAll().where('id', '=', postId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!post) throw Object.assign(new Error('Post not found'), {code: 'NOT_FOUND'})
    await this.policies.assertAllowed({
      actorId,
      action: 'comment.create',
      capability: 'post:engage',
      resource: {type: 'post', id: postId, ownerActorId: post.author_actor_id, visibility: post.audience},
    })
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
          media: JSON.stringify(media),
          quoted_comment_id: quotedCommentId,
        })
        .execute()
      const attachmentIds = media.flatMap(item => item.type === 'attachment' ? [item.attachmentId] : [])
      if (attachmentIds.length) {
        await trx.updateTable('attachments').set({attached_at: now, updated_at: now})
          .where('attachment_id', 'in', attachmentIds).where('attached_at', 'is', null).execute()
      }
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
    const created = await this.db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', id).executeTakeFirstOrThrow()
    return (await this.withAuthors([created], actorId))[0]!
  }

  // Attribution for already-authorized comments, not a full profile disclosure.
  // One batched query avoids an extra profile request for every visible row.
  private async withAuthors(rows: Selectable<Database['greenfield_comments']>[], viewerActorId: string | null = null) {
    if (!rows.length) return []
    const ids = rows.map(row => row.comment_id)
    const quotedIds = [...new Set(rows.flatMap(row => row.quoted_comment_id ? [row.quoted_comment_id] : []))]
    const [quotedRows, reactionRows, voteRows] = await Promise.all([
      quotedIds.length ? this.db.selectFrom('greenfield_comments').select(['comment_id', 'author_actor_id', 'text', 'deleted_at']).where('comment_id', 'in', quotedIds).execute() : Promise.resolve([]),
      this.db.selectFrom('greenfield_comment_reactions').select(['comment_id', 'reaction_type', 'actor_id']).where('comment_id', 'in', ids).execute(),
      this.db.selectFrom('greenfield_comment_poll_votes').select(['comment_id', 'option_index', 'actor_id']).where('comment_id', 'in', ids).execute(),
    ])
    const profiles = await this.db.selectFrom('profiles')
      .select(['actor_id', 'id', 'handle', 'display_name', 'avatar_url'])
      .where('actor_id', 'in', [...new Set([...rows.map(row => row.author_actor_id), ...quotedRows.map(row => row.author_actor_id)])])
      .where('deleted_at', 'is', null)
      .execute()
    const byActor = new Map(profiles.map(profile => [profile.actor_id, profile]))
    const badges = await badgesForActors(this.db, profiles.map(profile => profile.actor_id))
    const present = (actorId: string) => {
      const profile = byActor.get(actorId)
      return profile ? {id: profile.id, handle: profile.handle, displayName: profile.display_name, avatarUri: profile.avatar_url ?? undefined, ...(badges.get(actorId) ?? NO_BADGES)} : null
    }
    const quotedById = new Map(quotedRows.map(row => [row.comment_id, row]))
    return rows.map(row => {
      const counts = new Map<string, number>()
      let viewerReaction: string | null = null
      for (const reaction of reactionRows) {
        if (reaction.comment_id !== row.comment_id) continue
        counts.set(reaction.reaction_type, (counts.get(reaction.reaction_type) ?? 0) + 1)
        if (viewerActorId && reaction.actor_id === viewerActorId) viewerReaction = reaction.reaction_type
      }
      const media = row.deleted_at ? [] : presentCommentMedia(this.publicApiUrl, row.media).map((item: any) => {
        if (item?.type !== 'poll') return item
        const votes = voteRows.filter(vote => vote.comment_id === row.comment_id)
        return {
          ...item,
          counts: item.options.map((_: string, index: number) => votes.filter(vote => vote.option_index === index).length),
          totalVotes: votes.length,
          viewerVote: viewerActorId ? votes.find(vote => vote.actor_id === viewerActorId)?.option_index ?? null : null,
          closed: Boolean(item.closesAt && Date.parse(item.closesAt) < Date.now()),
        }
      })
      const quoted = row.quoted_comment_id ? quotedById.get(row.quoted_comment_id) : undefined
      return {
        ...row,
        media,
        pinned: Boolean(row.pinned_at),
        reactions: [...counts.entries()].map(([type, count]) => ({type, count})).sort((a, b) => b.count - a.count),
        viewerReaction,
        quotedComment: quoted ? {id: quoted.comment_id, text: quoted.deleted_at ? '' : quoted.text.slice(0, 280), deleted: Boolean(quoted.deleted_at), author: present(quoted.author_actor_id)} : null,
        author: present(row.author_actor_id),
      }
    })
  }

  private async excludedActors(viewerActorId: string) {
    const [blocks, mutes] = await Promise.all([
      this.db.selectFrom('blocks').select(['blocker_actor_id', 'blocked_actor_id']).where('deleted_at', 'is', null).where(({eb, or}) => or([eb('blocker_actor_id', '=', viewerActorId), eb('blocked_actor_id', '=', viewerActorId)])).execute(),
      this.db.selectFrom('mutes').select('muted_actor_id').where('muter_actor_id', '=', viewerActorId).where('deleted_at', 'is', null).execute(),
    ])
    return [...new Set([...blocks.map(row => row.blocker_actor_id === viewerActorId ? row.blocked_actor_id : row.blocker_actor_id), ...mutes.map(row => row.muted_actor_id)])]
  }
}
