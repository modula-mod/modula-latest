import {randomUUID} from 'node:crypto'
import type {ModulaDb} from '../../database/client.js'
import {AuditRepository} from '../audit/repository.js'

export class SaveService {
  constructor(private readonly db: ModulaDb) {}
  async save(actorId: string, postId: string) {
    const post = await this.db.selectFrom('posts').select('id').where('id', '=', postId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!post) throw Object.assign(new Error('Post not found'), {code: 'NOT_FOUND'})
    const existing = await this.db.selectFrom('post_saves').selectAll().where('actor_id', '=', actorId).where('post_id', '=', postId).executeTakeFirst()
    if (existing?.deleted_at) await this.db.updateTable('post_saves').set({deleted_at: null, updated_at: new Date(), version: existing.version + 1}).where('id', '=', existing.id).execute()
    else if (!existing) await this.db.insertInto('post_saves').values({id: randomUUID(), actor_id: actorId, post_id: postId, created_at: new Date(), updated_at: new Date(), deleted_at: null, version: 1}).execute()
    await new AuditRepository(this.db).append('post.saved', {}, {type: 'post', id: postId, actorId})
  }
  async unsave(actorId: string, postId: string) {
    await this.db.updateTable('post_saves').set({deleted_at: new Date(), updated_at: new Date()}).where('actor_id', '=', actorId).where('post_id', '=', postId).where('deleted_at', 'is', null).execute()
  }
  async listSaves(actorId: string, requestedActorId = actorId) {
    if (requestedActorId !== actorId) throw Object.assign(new Error('Saves are private'), {code: 'FORBIDDEN'})
    return this.db.selectFrom('post_saves').innerJoin('posts', 'posts.id', 'post_saves.post_id').selectAll('posts').where('post_saves.actor_id', '=', actorId).where('post_saves.deleted_at', 'is', null).where('posts.deleted_at', 'is', null).orderBy('post_saves.created_at', 'desc').execute()
  }
}
