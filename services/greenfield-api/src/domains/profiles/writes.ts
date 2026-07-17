import {randomUUID} from 'node:crypto'
import type {ModulaDb} from '../../database/client.js'
import {AuditRepository} from '../audit/repository.js'
import {OutboxRepository} from '../outbox/repository.js'
import {ProfileRepository} from './repository.js'
import type {ModulaProfileDto} from '@modula/api-contracts'

export class ProfileWriteService {
  private readonly profiles: ProfileRepository

  constructor(private readonly db: ModulaDb) {
    this.profiles = new ProfileRepository(db)
  }

  async follow(followerActorId: string, profileId: string): Promise<void> {
    const target = await this.db
      .selectFrom('profiles')
      .selectAll()
      .where('id', '=', profileId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!target) throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
    if (target.actor_id === followerActorId) {
      throw Object.assign(new Error('Cannot follow yourself'), {code: 'VALIDATION_FAILED'})
    }
    await this.db.transaction().execute(async trx => {
      const existing = await trx
        .selectFrom('follows')
        .selectAll()
        .where('follower_actor_id', '=', followerActorId)
        .where('followed_actor_id', '=', target.actor_id)
        .executeTakeFirst()
      const now = new Date()
      if (!existing) {
        await trx
          .insertInto('follows')
          .values({
            id: randomUUID(),
            follower_actor_id: followerActorId,
            followed_actor_id: target.actor_id,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            version: 1,
          })
          .execute()
      } else if (existing.deleted_at) {
        await trx
          .updateTable('follows')
          .set({deleted_at: null, updated_at: now, version: existing.version + 1})
          .where('id', '=', existing.id)
          .execute()
      }
      await new OutboxRepository(this.db).enqueue(trx, {
        eventType: 'notification.create',
        aggregateType: 'follow',
        aggregateId: `${followerActorId}:${target.actor_id}`,
        payload: {
          type: 'follow',
          actorId: followerActorId,
          recipientActorId: target.actor_id,
          resourceType: 'profile',
          resourceId: target.id,
        },
      })
      await new AuditRepository(trx).append('follow.created', {}, {
        type: 'profile',
        id: target.id,
        actorId: followerActorId,
      })
    })
  }

  async unfollow(followerActorId: string, profileId: string): Promise<void> {
    const target = await this.db
      .selectFrom('profiles')
      .select('actor_id')
      .where('id', '=', profileId)
      .executeTakeFirst()
    if (!target) throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
    await this.db
      .updateTable('follows')
      .set({deleted_at: new Date(), updated_at: new Date()})
      .where('follower_actor_id', '=', followerActorId)
      .where('followed_actor_id', '=', target.actor_id)
      .where('deleted_at', 'is', null)
      .execute()
  }

  async updateMe(
    actorId: string,
    patch: {displayName?: string; bio?: string; expectedVersion?: number},
  ): Promise<ModulaProfileDto> {
    const row = await this.db
      .selectFrom('profiles')
      .selectAll()
      .where('actor_id', '=', actorId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!row) throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
    if (patch.expectedVersion != null && patch.expectedVersion !== row.version) {
      throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    }
    const displayName = patch.displayName?.trim()
    const bio = patch.bio
    if (displayName !== undefined && !displayName) {
      throw Object.assign(new Error('displayName required'), {code: 'VALIDATION_FAILED'})
    }
    await this.db.transaction().execute(async trx => {
      let query = trx
        .updateTable('profiles')
        .set({
          display_name: displayName ?? row.display_name,
          bio: bio ?? row.bio,
          updated_at: new Date(),
          version: row.version + 1,
        })
        .where('id', '=', row.id)
      if (patch.expectedVersion != null) query = query.where('version', '=', patch.expectedVersion)
      const result = await query.executeTakeFirst()
      if (Number(result.numUpdatedRows ?? 0) === 0) {
        throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
      }
      await new OutboxRepository(this.db).enqueue(trx, {
        eventType: 'search.index.profile',
        aggregateType: 'profile',
        aggregateId: row.id,
        payload: {profileId: row.id, actorId},
      })
      await new AuditRepository(trx).append('profile.updated', {}, {
        type: 'profile',
        id: row.id,
        actorId,
      })
    })
    const updated = await this.profiles.getByActorId(actorId)
    if (!updated) throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
    return updated
  }

  async actorIdForProfileId(profileId: string): Promise<string | null> {
    const row = await this.db
      .selectFrom('profiles')
      .select('actor_id')
      .where('id', '=', profileId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row?.actor_id ?? null
  }
}
