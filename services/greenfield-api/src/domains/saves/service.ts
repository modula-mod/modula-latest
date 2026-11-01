import {randomUUID} from 'node:crypto'
import type {SocialPostDto} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'
import {AuditRepository} from '../audit/repository.js'
import {GreenfieldPolicyEngine} from '../policy/index.js'
import {PostRepository} from '../posts/repository.js'

export class SaveService {
  private readonly policies: GreenfieldPolicyEngine
  private readonly posts: PostRepository

  constructor(private readonly db: ModulaDb, publicApiUrl = '') {
    this.policies = new GreenfieldPolicyEngine(db)
    this.posts = new PostRepository(db, publicApiUrl)
  }

  async save(actorId: string, postId: string) {
    const post = await this.db.selectFrom('posts').select(['id', 'author_actor_id', 'audience']).where('id', '=', postId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!post) throw Object.assign(new Error('Post not found'), {code: 'NOT_FOUND'})
    await this.policies.assertAllowed({
      actorId,
      action: 'post.save',
      resource: {type: 'post', id: postId, ownerActorId: post.author_actor_id, visibility: post.audience},
    })
    const existing = await this.db.selectFrom('post_saves').selectAll().where('actor_id', '=', actorId).where('post_id', '=', postId).executeTakeFirst()
    if (existing?.deleted_at) await this.db.updateTable('post_saves').set({deleted_at: null, updated_at: new Date(), version: existing.version + 1}).where('id', '=', existing.id).execute()
    else if (!existing) await this.db.insertInto('post_saves').values({id: randomUUID(), actor_id: actorId, post_id: postId, created_at: new Date(), updated_at: new Date(), deleted_at: null, version: 1}).execute()
    await new AuditRepository(this.db).append('post.saved', {}, {type: 'post', id: postId, actorId})
  }
  async unsave(actorId: string, postId: string) {
    await this.db.updateTable('post_saves').set({deleted_at: new Date(), updated_at: new Date()}).where('actor_id', '=', actorId).where('post_id', '=', postId).where('deleted_at', 'is', null).execute()
  }
  async listSaves(actorId: string, limit: number, cursor: string | null, requestedActorId = actorId) {
    if (requestedActorId !== actorId) throw Object.assign(new Error('Saves are private'), {code: 'FORBIDDEN'})
    const decoded = decodeSaveCursor(cursor)
    let query = this.db.selectFrom('post_saves').select(['id', 'post_id', 'created_at'])
      .where('actor_id', '=', actorId).where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc').orderBy('id', 'desc').limit(limit + 1)
    if (decoded) {
      query = query.where(eb => eb.or([
        eb('created_at', '<', decoded.createdAt),
        eb.and([eb('created_at', '=', decoded.createdAt), eb('id', '<', decoded.id)]),
      ]))
    }
    const rows = await query.execute()
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const hydrated = await Promise.all(page.map(row => this.posts.getById(row.post_id, actorId)))
    const items = hydrated.filter((post): post is SocialPostDto => post !== null).map(post => ({...post, saved: true}))
    const last = page[page.length - 1]
    return {items, hasMore, nextCursor: hasMore && last ? `${last.created_at.toISOString()}|${last.id}` : null}
  }
}

function decodeSaveCursor(cursor: string | null): {createdAt: Date; id: string} | null {
  if (!cursor) return null
  const separator = cursor.lastIndexOf('|')
  const createdAt = new Date(cursor.slice(0, separator))
  const id = cursor.slice(separator + 1)
  if (separator < 1 || Number.isNaN(createdAt.valueOf()) || !id) {
    throw Object.assign(new Error('Invalid saves cursor'), {code: 'VALIDATION_FAILED'})
  }
  return {createdAt, id}
}
