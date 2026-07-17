import {sql} from 'kysely'
import type {ModulaProfileDto} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {mapProfile} from './mapper.js'

type ProfileRow = Database['profiles']

export class ProfileRepository {
  constructor(private readonly db: ModulaDb) {}

  async getByHandle(handle: string, viewerActorId: string | null = null): Promise<ModulaProfileDto | null> {
    const row = await this.db
      .selectFrom('profiles')
      .selectAll()
      .where(sql`lower(handle)`, '=', handle.toLowerCase())
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!row) return null
    if (!(await this.canView(row, viewerActorId))) return null
    return this.hydrate(row, viewerActorId)
  }

  async getByActorId(actorId: string, viewerActorId: string | null = null): Promise<ModulaProfileDto | null> {
    const row = await this.db.selectFrom('profiles').selectAll().where('actor_id', '=', actorId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!row) return null
    if (!(await this.canView(row, viewerActorId))) return null
    return this.hydrate(row, viewerActorId)
  }

  async listPublic(): Promise<ModulaProfileDto[]> {
    const rows = await this.db.selectFrom('profiles').selectAll().where('deleted_at', 'is', null).where('visibility', '=', 'public').orderBy('joined_at', 'asc').execute()
    return Promise.all(rows.map(row => this.hydrate(row, null)))
  }

  async listFollowers(handle: string, limit: number, cursor: string | null, viewerActorId: string | null = null) {
    const target = await this.getRawByHandle(handle)
    if (!target) return null
    if (!(await this.canView(target, viewerActorId))) return null
    const excluded = viewerActorId ? await this.blockedActorIds(viewerActorId) : []
    let query = this.db
      .selectFrom('follows')
      .innerJoin('profiles', 'profiles.actor_id', 'follows.follower_actor_id')
      .selectAll('profiles')
      .where('follows.followed_actor_id', '=', target.actor_id)
      .where('follows.deleted_at', 'is', null)
      .where('profiles.deleted_at', 'is', null)
      .where('profiles.visibility', '=', 'public')
      .orderBy('profiles.id', 'desc')
      .limit(limit + 1)
    if (excluded.length > 0) query = query.where('profiles.actor_id', 'not in', excluded)
    if (cursor) query = query.where('profiles.id', '<', cursor)
    const rows = await query.execute()
    const items = await Promise.all(rows.map(row => this.hydrate(row, viewerActorId)))
    return {items}
  }

  async listFollowing(handle: string, limit: number, cursor: string | null, viewerActorId: string | null = null) {
    const target = await this.getRawByHandle(handle)
    if (!target) return null
    if (!(await this.canView(target, viewerActorId))) return null
    const excluded = viewerActorId ? await this.blockedActorIds(viewerActorId) : []
    let query = this.db
      .selectFrom('follows')
      .innerJoin('profiles', 'profiles.actor_id', 'follows.followed_actor_id')
      .selectAll('profiles')
      .where('follows.follower_actor_id', '=', target.actor_id)
      .where('follows.deleted_at', 'is', null)
      .where('profiles.deleted_at', 'is', null)
      .where('profiles.visibility', '=', 'public')
      .orderBy('profiles.id', 'desc')
      .limit(limit + 1)
    if (excluded.length > 0) query = query.where('profiles.actor_id', 'not in', excluded)
    if (cursor) query = query.where('profiles.id', '<', cursor)
    const rows = await query.execute()
    const items = await Promise.all(rows.map(row => this.hydrate(row, viewerActorId)))
    return {items}
  }

  /** Filters actor ids blocked in either direction relative to `viewerActorId` — for excluding results from lists. */
  async blockedActorIds(viewerActorId: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('blocks')
      .select(['blocker_actor_id', 'blocked_actor_id'])
      .where('deleted_at', 'is', null)
      .where(({eb, or}) => or([eb('blocker_actor_id', '=', viewerActorId), eb('blocked_actor_id', '=', viewerActorId)]))
      .execute()
    const ids = new Set<string>()
    for (const row of rows) ids.add(row.blocker_actor_id === viewerActorId ? row.blocked_actor_id : row.blocker_actor_id)
    return Array.from(ids)
  }

  private async getRawByHandle(handle: string): Promise<ProfileRow | undefined> {
    return this.db.selectFrom('profiles').selectAll().where(sql`lower(handle)`, '=', handle.toLowerCase()).where('deleted_at', 'is', null).executeTakeFirst()
  }

  private async canView(row: ProfileRow, viewerActorId: string | null): Promise<boolean> {
    if (viewerActorId && (await this.isBlockedEitherDirection(viewerActorId, row.actor_id))) return false
    if (row.visibility === 'public') return true
    if (!viewerActorId) return false
    if (viewerActorId === row.actor_id) return true
    if (row.visibility === 'followers' || row.visibility === 'teams') {
      return this.isFollowing(viewerActorId, row.actor_id)
    }
    return false
  }

  private async isFollowing(followerActorId: string, followedActorId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('follows')
      .select('id')
      .where('follower_actor_id', '=', followerActorId)
      .where('followed_actor_id', '=', followedActorId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return Boolean(row)
  }

  private async isBlockedEitherDirection(actorA: string, actorB: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('blocks')
      .select('id')
      .where('deleted_at', 'is', null)
      .where(({eb, or, and}) =>
        or([
          and([eb('blocker_actor_id', '=', actorA), eb('blocked_actor_id', '=', actorB)]),
          and([eb('blocker_actor_id', '=', actorB), eb('blocked_actor_id', '=', actorA)]),
        ]),
      )
      .executeTakeFirst()
    return Boolean(row)
  }

  private async hydrate(row: ProfileRow, viewerActorId: string | null): Promise<ModulaProfileDto> {
    const isSelf = viewerActorId === row.actor_id
    let linkQuery = this.db.selectFrom('profile_links').selectAll().where('profile_id', '=', row.id).where('deleted_at', 'is', null)
    if (!isSelf) linkQuery = linkQuery.where('visibility', '=', 'public')
    const links = await linkQuery.orderBy('sort_order', 'asc').execute()

    const [followers, following, posts] = await Promise.all([
      this.db.selectFrom('follows').select(sql<number>`count(*)::int`.as('count')).where('followed_actor_id', '=', row.actor_id).where('deleted_at', 'is', null).executeTakeFirst(),
      this.db.selectFrom('follows').select(sql<number>`count(*)::int`.as('count')).where('follower_actor_id', '=', row.actor_id).where('deleted_at', 'is', null).executeTakeFirst(),
      this.db.selectFrom('posts').select(sql<number>`count(*)::int`.as('count')).where('author_actor_id', '=', row.actor_id).where('deleted_at', 'is', null).where('audience', '=', 'public').executeTakeFirst(),
    ])

    let isFollowing = false
    let followsViewer = false
    if (viewerActorId && !isSelf) {
      const [a, b] = await Promise.all([this.isFollowing(viewerActorId, row.actor_id), this.isFollowing(row.actor_id, viewerActorId)])
      isFollowing = a
      followsViewer = b
    }

    const dto = mapProfile(row, links, {followers: followers?.count ?? 0, following: following?.count ?? 0, posts: posts?.count ?? 0})
    return {...dto, isFollowing, followsViewer}
  }
}
