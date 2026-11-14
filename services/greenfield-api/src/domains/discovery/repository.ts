import type {ActivityItemDto, DiscoverResultDto, ReelItemDto} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'
import {ProfileRepository} from '../profiles/repository.js'
import {PostRepository} from '../posts/repository.js'
import {publicIdentitiesForActors} from '../../premium/badges.js'

export class DiscoveryRepository {
  private readonly profiles: ProfileRepository
  constructor(private readonly db: ModulaDb, private readonly publicApiUrl = '') {
    this.profiles = new ProfileRepository(db)
  }

  async getDiscover(viewerActorId: string | null = null): Promise<DiscoverResultDto> {
    const excluded = await this.excludedActorIds(viewerActorId)
    // Discover intentionally omits raw identity claims. Older Native builds
    // treated the mere presence of a claim as verification; only the
    // server-authoritative publicIdentity/isVerified fields may drive a mark.
    const suggestedProfiles = (await this.profiles.listPublic(viewerActorId, excluded)).map(profile => ({...profile, identityClaims: []}))
    const trendingTopics = await this.db
      .selectFrom('trending_topics')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('post_count', 'desc')
      .execute()
    const featuredModules = await this.db
      .selectFrom('featured_modules')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('sort_order', 'asc')
      .execute()
    const reels = await this.listReels(viewerActorId, excluded)
    let mediaQuery = this.db
      .selectFrom('post_media')
      .innerJoin('posts', 'posts.id', 'post_media.post_id')
      .selectAll('post_media')
      .where('post_media.deleted_at', 'is', null)
      .where('posts.deleted_at', 'is', null)
      .where('posts.audience', '=', 'public')
      .orderBy('posts.created_at', 'desc')
      .limit(24)
    if (excluded.length) mediaQuery = mediaQuery.where('posts.author_actor_id', 'not in', excluded)
    const media = await mediaQuery.execute()
    return {
      suggestedProfiles,
      trendingTopics: trendingTopics.map(t => ({
        id: t.id,
        label: t.label,
        postCount: t.post_count,
      })),
      featuredModules: featuredModules.map(m => m.payload as Record<string, unknown>),
      media: media.map(item => ({
        id: item.id,
        kind: 'image' as const,
        ...(item.url ? {url: item.url} : {}),
        ...(item.alt_text ? {altText: item.alt_text} : {}),
        ...(item.colour ? {colour: item.colour} : {}),
        ...(item.aspect_ratio ? {aspectRatio: Number(item.aspect_ratio)} : {}),
        ...(item.title ? {title: item.title} : {}),
      })),
      reels,
    }
  }

  async listReels(viewerActorId: string | null = null, suppliedExcluded?: string[]): Promise<ReelItemDto[]> {
    const excluded = suppliedExcluded ?? await this.excludedActorIds(viewerActorId)
    let query = this.db
      .selectFrom('posts as p')
      .select(['p.id', 'p.author_actor_id', 'p.created_at'])
      .where('p.deleted_at', 'is', null)
      .where('p.audience', '=', 'public')
      .where(({exists, selectFrom}) => exists(selectFrom('post_content as c')
        .innerJoin('attachments as a', 'a.attachment_id', 'c.attachment_id')
        .select('c.content_id').whereRef('c.post_id', '=', 'p.id')
        .where('c.content_type', '=', 'video').where('a.status', '=', 'ready')))
      .orderBy('p.created_at', 'desc')
      .orderBy('p.id', 'desc')
      .limit(30)
    if (excluded.length) query = query.where('p.author_actor_id', 'not in', excluded)
    const rows = await query.execute()
    await publicIdentitiesForActors(this.db, rows.map(row => row.author_actor_id))
    const posts = new PostRepository(this.db, this.publicApiUrl)
    const out: ReelItemDto[] = []
    for (const row of rows) {
      const post = await posts.getById(row.id, viewerActorId)
      if (!post || !post.content?.some(block => block.type === 'video' && block.attachment.status === 'ready')) continue
      out.push({
        id: post.id,
        author: post.author,
        caption: post.text ?? '',
        source: 'video-post',
        colour: post.glowColour ?? '#111111',
        liked: post.liked,
        likeCount: post.likeCount,
        replyCount: post.replyCount,
        post,
      })
    }
    return out
  }

  /**
   * GF native endpoints: one reel by id. A reel is retrievable here only when it
   * would appear in listReels for the same viewer (public, not deleted, has a
   * ready video attachment, author not blocked/muted by or blocking the viewer,
   * and readable under the post.read policy). Anything else is null (404).
   */
  async getReel(reelId: string, viewerActorId: string | null = null): Promise<ReelItemDto | null> {
    const row = await this.db
      .selectFrom('posts as p')
      .select(['p.id', 'p.author_actor_id'])
      .where('p.id', '=', reelId)
      .where('p.deleted_at', 'is', null)
      .where('p.audience', '=', 'public')
      .where(({exists, selectFrom}) => exists(selectFrom('post_content as c')
        .innerJoin('attachments as a', 'a.attachment_id', 'c.attachment_id')
        .select('c.content_id').whereRef('c.post_id', '=', 'p.id')
        .where('c.content_type', '=', 'video').where('a.status', '=', 'ready')))
      .executeTakeFirst()
    if (!row) return null
    const excluded = await this.excludedActorIds(viewerActorId)
    if (excluded.includes(row.author_actor_id)) return null
    await publicIdentitiesForActors(this.db, [row.author_actor_id])
    const post = await new PostRepository(this.db, this.publicApiUrl).getById(row.id, viewerActorId)
    if (!post || !post.content?.some(block => block.type === 'video' && block.attachment.status === 'ready')) return null
    return {
      id: post.id,
      author: post.author,
      caption: post.text ?? '',
      source: 'video-post',
      colour: post.glowColour ?? '#111111',
      liked: post.liked,
      likeCount: post.likeCount,
      replyCount: post.replyCount,
      post,
    }
  }

  async listActivity(viewerActorId: string | null = null): Promise<ActivityItemDto[]> {
    const excluded = await this.excludedActorIds(viewerActorId)
    let query = this.db
      .selectFrom('activity_items')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('occurred_at', 'desc')
    if (excluded.length) query = query.where(({eb, or}) => or([eb('actor_id', 'is', null), eb('actor_id', 'not in', excluded)]))
    const rows = await query.execute()
    const out: ActivityItemDto[] = []
    for (const row of rows) {
      const actor = row.actor_id ? await this.profiles.getByActorId(row.actor_id, viewerActorId) : undefined
      out.push({
        id: row.id,
        group: row.group_key,
        type: row.type as ActivityItemDto['type'],
        actor: actor ?? undefined,
        icon: row.icon ?? undefined,
        description: row.description,
        timestamp: row.occurred_at.toISOString(),
        preview: row.preview ?? undefined,
        actionLabel: row.action_label ?? undefined,
      })
    }
    return out
  }

  private async excludedActorIds(viewerActorId: string | null): Promise<string[]> {
    if (!viewerActorId) return []
    const [blocked, muted] = await Promise.all([
      this.profiles.blockedActorIds(viewerActorId),
      this.db.selectFrom('mutes').select('muted_actor_id').where('muter_actor_id', '=', viewerActorId).where('deleted_at', 'is', null).execute(),
    ])
    return [...new Set([...blocked, ...muted.map(row => row.muted_actor_id)])]
  }
}
