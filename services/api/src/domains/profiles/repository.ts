import {sql} from 'kysely'
import type {ModulaProfileDto} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {mapProfile} from './mapper.js'

type ProfileRow = Database['profiles']

export class ProfileRepository {
  constructor(private readonly db: ModulaDb) {}

  async getByHandle(handle: string): Promise<ModulaProfileDto | null> {
    const row = await this.db
      .selectFrom('profiles')
      .selectAll()
      .where(sql`lower(handle)`, '=', handle.toLowerCase())
      .where('deleted_at', 'is', null)
      .where('visibility', '=', 'public')
      .executeTakeFirst()
    if (!row) return null
    return this.hydrate(row)
  }

  async getByActorId(actorId: string): Promise<ModulaProfileDto | null> {
    const row = await this.db
      .selectFrom('profiles')
      .selectAll()
      .where('actor_id', '=', actorId)
      .where('deleted_at', 'is', null)
      .where('visibility', '=', 'public')
      .executeTakeFirst()
    if (!row) return null
    return this.hydrate(row)
  }

  async listPublic(): Promise<ModulaProfileDto[]> {
    const rows = await this.db
      .selectFrom('profiles')
      .selectAll()
      .where('deleted_at', 'is', null)
      .where('visibility', '=', 'public')
      .orderBy('joined_at', 'asc')
      .execute()
    return Promise.all(rows.map(row => this.hydrate(row)))
  }

  async listFollowers(handle: string, limit: number, cursor: string | null) {
    const profile = await this.getByHandle(handle)
    if (!profile) return null
    const actor = await this.actorIdForProfile(profile.id)
    let query = this.db
      .selectFrom('follows')
      .innerJoin('profiles', 'profiles.actor_id', 'follows.follower_actor_id')
      .selectAll('profiles')
      .where('follows.followed_actor_id', '=', actor)
      .where('follows.deleted_at', 'is', null)
      .where('profiles.deleted_at', 'is', null)
      .where('profiles.visibility', '=', 'public')
      .orderBy('profiles.id', 'desc')
      .limit(limit + 1)
    if (cursor) query = query.where('profiles.id', '<', cursor)
    const rows = await query.execute()
    const items = await Promise.all(rows.map(row => this.hydrate(row)))
    return {items}
  }

  async listFollowing(handle: string, limit: number, cursor: string | null) {
    const profile = await this.getByHandle(handle)
    if (!profile) return null
    const actor = await this.actorIdForProfile(profile.id)
    let query = this.db
      .selectFrom('follows')
      .innerJoin('profiles', 'profiles.actor_id', 'follows.followed_actor_id')
      .selectAll('profiles')
      .where('follows.follower_actor_id', '=', actor)
      .where('follows.deleted_at', 'is', null)
      .where('profiles.deleted_at', 'is', null)
      .where('profiles.visibility', '=', 'public')
      .orderBy('profiles.id', 'desc')
      .limit(limit + 1)
    if (cursor) query = query.where('profiles.id', '<', cursor)
    const rows = await query.execute()
    const items = await Promise.all(rows.map(row => this.hydrate(row)))
    return {items}
  }

  private async actorIdForProfile(profileId: string): Promise<string> {
    const row = await this.db
      .selectFrom('profiles')
      .select('actor_id')
      .where('id', '=', profileId)
      .executeTakeFirstOrThrow()
    return row.actor_id
  }

  private async hydrate(row: ProfileRow): Promise<ModulaProfileDto> {
    const links = await this.db
      .selectFrom('profile_links')
      .selectAll()
      .where('profile_id', '=', row.id)
      .where('deleted_at', 'is', null)
      .where('visibility', '=', 'public')
      .orderBy('sort_order', 'asc')
      .execute()
    const [followers, following, posts] = await Promise.all([
      this.db
        .selectFrom('follows')
        .select(sql<number>`count(*)::int`.as('count'))
        .where('followed_actor_id', '=', row.actor_id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst(),
      this.db
        .selectFrom('follows')
        .select(sql<number>`count(*)::int`.as('count'))
        .where('follower_actor_id', '=', row.actor_id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst(),
      this.db
        .selectFrom('posts')
        .select(sql<number>`count(*)::int`.as('count'))
        .where('author_actor_id', '=', row.actor_id)
        .where('deleted_at', 'is', null)
        .where('audience', '=', 'public')
        .executeTakeFirst(),
    ])
    return mapProfile(row, links, {
      followers: followers?.count ?? 0,
      following: following?.count ?? 0,
      posts: posts?.count ?? 0,
    })
  }
}
