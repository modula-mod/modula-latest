import type {ModulaDb} from '../../database/client.js'
import {uuidv7} from '../../lib/uuidv7.js'
import {AuditRepository} from '../audit/repository.js'
import {GreenfieldPolicyEngine} from '../policy/index.js'

export type PostShareChannel = 'copy-link' | 'native' | 'direct' | 'external'

export class PostShareService {
  private readonly policies: GreenfieldPolicyEngine

  constructor(private readonly db: ModulaDb) {
    this.policies = new GreenfieldPolicyEngine(db)
  }

  async record(input: {
    actorId: string
    postId: string
    channel: PostShareChannel
    idempotencyKey?: string | null
  }): Promise<{shareId: string; postId: string; channel: PostShareChannel; createdAt: string}> {
    if (!['copy-link', 'native', 'direct', 'external'].includes(input.channel)) {
      throw Object.assign(new Error('Invalid share channel'), {code: 'VALIDATION_FAILED'})
    }
    const idempotencyKey = input.idempotencyKey?.trim() || null
    if (idempotencyKey && (idempotencyKey.length > 180 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(idempotencyKey))) {
      throw Object.assign(new Error('Invalid share idempotency key'), {code: 'VALIDATION_FAILED'})
    }
    const post = await this.db
      .selectFrom('posts')
      .select(['id', 'author_actor_id', 'audience'])
      .where('id', '=', input.postId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!post) throw Object.assign(new Error('Post not found'), {code: 'NOT_FOUND'})
    await this.policies.assertAllowed({
      actorId: input.actorId,
      action: 'post.share',
      resource: {type: 'post', id: input.postId, ownerActorId: post.author_actor_id, visibility: post.audience},
    })

    if (idempotencyKey) {
      const existing = await this.db
        .selectFrom('greenfield_post_shares')
        .selectAll()
        .where('actor_id', '=', input.actorId)
        .where('post_id', '=', input.postId)
        .where('idempotency_key', '=', idempotencyKey)
        .executeTakeFirst()
      if (existing) return serialize(existing)
    }

    const now = new Date()
    const shareId = uuidv7()
    try {
      await this.db.transaction().execute(async trx => {
        await trx.insertInto('greenfield_post_shares').values({
          share_id: shareId,
          actor_id: input.actorId,
          post_id: input.postId,
          channel: input.channel,
          idempotency_key: idempotencyKey,
          created_at: now,
        }).execute()
        await new AuditRepository(trx).append(
          'post.shared',
          {channel: input.channel},
          {type: 'post', id: input.postId, actorId: input.actorId},
        )
      })
    } catch (error: any) {
      if (error?.code !== '23505' || !idempotencyKey) throw error
      const existing = await this.db
        .selectFrom('greenfield_post_shares')
        .selectAll()
        .where('actor_id', '=', input.actorId)
        .where('post_id', '=', input.postId)
        .where('idempotency_key', '=', idempotencyKey)
        .executeTakeFirstOrThrow()
      return serialize(existing)
    }
    return {shareId, postId: input.postId, channel: input.channel, createdAt: now.toISOString()}
  }
}

function serialize(row: {share_id: string; post_id: string; channel: PostShareChannel; created_at: Date}) {
  return {shareId: row.share_id, postId: row.post_id, channel: row.channel, createdAt: row.created_at.toISOString()}
}
