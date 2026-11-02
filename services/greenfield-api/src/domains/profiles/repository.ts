import {sql} from 'kysely'
import type {ModulaProfileDto} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {mapProfile} from './mapper.js'
import {badgesForActor, publicIdentitiesForActors} from '../../premium/badges.js'

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

  /**
   * Author attribution for a post the viewer is already allowed to read.
   * Public posts may be authored by private profiles; visibility must not
   * erase the author or turn feed/media reads into 500s.
   * Blocks still hide the author (caller should skip/forbid the post).
   */
  async getAuthorForReadablePost(actorId: string, viewerActorId: string | null = null): Promise<ModulaProfileDto | null> {
    const row = await this.db.selectFrom('profiles').selectAll().where('actor_id', '=', actorId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!row) return null
    if (viewerActorId && (await this.isBlockedEitherDirection(viewerActorId, row.actor_id))) return null
    return this.hydrate(row, viewerActorId)
  }

  async getById(profileId: string, viewerActorId: string | null = null): Promise<ModulaProfileDto | null> {
    const row = await this.db
      .selectFrom('profiles')
      .selectAll()
      .where('id', '=', profileId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!row) return null
    if (!(await this.canView(row, viewerActorId))) return null
    return this.hydrate(row, viewerActorId)
  }

  /**
   * Bounded profile projection for directories and other cursor pages. This
   * preserves the single-profile visibility contract without issuing one set
   * of profile/count/link/follow queries per row.
   */
  async getByActorIds(actorIds: string[], viewerActorId: string | null = null): Promise<Map<string, ModulaProfileDto>> {
    const ids = [...new Set(actorIds.filter(Boolean))]
    const result = new Map<string, ModulaProfileDto>()
    if (ids.length === 0) return result

    const rows = await this.db.selectFrom('profiles').selectAll()
      .where('actor_id', 'in', ids).where('deleted_at', 'is', null).execute()
    const blocked = new Set(viewerActorId ? await this.blockedActorIds(viewerActorId) : [])
    const following = new Set<string>()
    if (viewerActorId) {
      const followed = await this.db.selectFrom('follows').select('followed_actor_id')
        .where('follower_actor_id', '=', viewerActorId).where('followed_actor_id', 'in', ids)
        .where('deleted_at', 'is', null).execute()
      for (const row of followed) following.add(row.followed_actor_id)
    }
    const visible = rows.filter(row => {
      if (blocked.has(row.actor_id)) return false
      if (row.visibility === 'public' || row.actor_id === viewerActorId) return true
      return (row.visibility === 'followers' || row.visibility === 'teams') && following.has(row.actor_id)
    })
    if (visible.length === 0) return result

    const visibleActorIds = visible.map(row => row.actor_id)
    const visibleProfileIds = visible.map(row => row.id)
    let linksQuery = this.db.selectFrom('profile_links').selectAll()
      .where('profile_id', 'in', visibleProfileIds).where('deleted_at', 'is', null)
    const selfProfileId = visible.find(row => row.actor_id === viewerActorId)?.id
    linksQuery = selfProfileId
      ? linksQuery.where(eb => eb.or([eb('visibility', '=', 'public'), eb('profile_id', '=', selfProfileId)]))
      : linksQuery.where('visibility', '=', 'public')

    const [links, followerRows, followingRows, postRows, followsViewerRows, identities] = await Promise.all([
      linksQuery.orderBy('profile_id', 'asc').orderBy('sort_order', 'asc').execute(),
      this.db.selectFrom('follows').select([
        'followed_actor_id as actor_id', sql<number>`count(*)::int`.as('count'),
      ]).where('followed_actor_id', 'in', visibleActorIds).where('deleted_at', 'is', null)
        .groupBy('followed_actor_id').execute(),
      this.db.selectFrom('follows').select([
        'follower_actor_id as actor_id', sql<number>`count(*)::int`.as('count'),
      ]).where('follower_actor_id', 'in', visibleActorIds).where('deleted_at', 'is', null)
        .groupBy('follower_actor_id').execute(),
      this.db.selectFrom('posts').select([
        'author_actor_id as actor_id', sql<number>`count(*)::int`.as('count'),
      ]).where('author_actor_id', 'in', visibleActorIds).where('deleted_at', 'is', null)
        .where('audience', '=', 'public').groupBy('author_actor_id').execute(),
      viewerActorId
        ? this.db.selectFrom('follows').select('follower_actor_id')
            .where('follower_actor_id', 'in', visibleActorIds).where('followed_actor_id', '=', viewerActorId)
            .where('deleted_at', 'is', null).execute()
        : Promise.resolve([]),
      publicIdentitiesForActors(this.db, visibleActorIds),
    ])

    const linksByProfile = new Map<string, typeof links>()
    for (const link of links) linksByProfile.set(link.profile_id, [...(linksByProfile.get(link.profile_id) ?? []), link])
    const followerCounts = new Map(followerRows.map(row => [row.actor_id, row.count]))
    const followingCounts = new Map(followingRows.map(row => [row.actor_id, row.count]))
    const postCounts = new Map(postRows.map(row => [row.actor_id, row.count]))
    const followsViewer = new Set(followsViewerRows.map(row => row.follower_actor_id))

    for (const row of visible) {
      const dto = mapProfile(row, linksByProfile.get(row.id) ?? [], {
        followers: followerCounts.get(row.actor_id) ?? 0,
        following: followingCounts.get(row.actor_id) ?? 0,
        posts: postCounts.get(row.actor_id) ?? 0,
      })
      result.set(row.actor_id, {
        ...dto,
        isFollowing: following.has(row.actor_id),
        followsViewer: followsViewer.has(row.actor_id),
        ...identities.get(row.actor_id),
      })
    }
    return result
  }

  async listPublic(viewerActorId: string | null = null, excludedActorIds: string[] = []): Promise<ModulaProfileDto[]> {
    const blocked = viewerActorId ? await this.blockedActorIds(viewerActorId) : []
    const excluded = [...new Set([...blocked, ...excludedActorIds])]
    let query = this.db.selectFrom('profiles').selectAll().where('deleted_at', 'is', null).where('visibility', '=', 'public').orderBy('joined_at', 'asc')
    if (excluded.length) query = query.where('actor_id', 'not in', excluded)
    const rows = await query.execute()
    return Promise.all(rows.map(row => this.hydrate(row, viewerActorId)))
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
    return {...dto, isFollowing, followsViewer, ...(await badgesForActor(this.db, row.actor_id))}
  }
}
