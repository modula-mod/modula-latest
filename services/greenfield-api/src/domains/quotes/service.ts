import {randomUUID} from 'node:crypto'
import {AuditRepository} from '../audit/repository.js'
import {OutboxRepository} from '../outbox/repository.js'
import type {ModulaDb} from '../../database/client.js'
import {GreenfieldPolicyEngine} from '../policy/index.js'

export class QuoteService {
  private readonly policies: GreenfieldPolicyEngine

  constructor(private readonly db: ModulaDb) {
    this.policies = new GreenfieldPolicyEngine(db)
  }

  async createQuote(actorId: string, quotedPostId: string, commentary: string, audience: 'public' | 'followers' | 'private' = 'public') {
    const quoted = await this.getQuotedPreview(actorId, quotedPostId)
    if (!quoted) throw Object.assign(new Error('Quoted post unavailable'), {code: 'NOT_FOUND'})
    const text = commentary.trim()
    if (text.length > 5000) throw Object.assign(new Error('Commentary too long'), {code: 'VALIDATION_FAILED'})
    const id = randomUUID(), now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('posts').values({id, author_actor_id: actorId, kind: 'text', text, feed: 'following', audience, reply_permission: 'everyone', idempotency_key: null, link_domain: null, link_title: null, link_description: null, link_image: null, module_name: null, module_action_label: null, module_status: null, glow_colour: null, like_count: 0, reaction_count: 0, quote_count: 0, reply_count: 0, repost_count: 0, created_at: now, updated_at: now, deleted_at: null, version: 1}).execute()
      await trx.insertInto('greenfield_quote_posts').values({post_id: id, quoted_post_id: quotedPostId, commentary: text, created_at: now}).execute()
      await trx.updateTable('posts').set({quote_count: quoted.quote_count + 1, updated_at: now}).where('id', '=', quotedPostId).execute()
      if (quoted.author_actor_id !== actorId) {
        await new OutboxRepository(trx).enqueue(trx, {
          eventType: 'notification.quote',
          aggregateType: 'post',
          aggregateId: id,
          payload: {
            actorId,
            recipientActorId: quoted.author_actor_id,
            resourceType: 'post',
            resourceId: quotedPostId,
          },
        })
      }
      await new AuditRepository(trx).append('quote.created', {quotedPostId}, {type: 'post', id, actorId})
    })
    return {postId: id, quotedPostId}
  }
  async getQuotedPreview(viewerActorId: string | null, postId: string) {
    const post = await this.db.selectFrom('posts').selectAll().where('id', '=', postId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!post) return null
    const decision = await this.policies.evaluateAndAudit({
      actorId: viewerActorId,
      action: 'post.quote',
      resource: {type: 'post', id: postId, ownerActorId: post.author_actor_id, visibility: post.audience},
    })
    if (!decision.allowed) return null
    return post
  }
}
