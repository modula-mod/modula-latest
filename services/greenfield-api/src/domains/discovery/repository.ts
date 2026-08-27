import type {ActivityItemDto, DiscoverResultDto, ReelItemDto} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'
import {ProfileRepository} from '../profiles/repository.js'

export class DiscoveryRepository {
  private readonly profiles: ProfileRepository
  constructor(private readonly db: ModulaDb) {
    this.profiles = new ProfileRepository(db)
  }

  async getDiscover(viewerActorId: string | null = null): Promise<DiscoverResultDto> {
    const excluded = await this.excludedActorIds(viewerActorId)
    const suggestedProfiles = await this.profiles.listPublic(viewerActorId, excluded)
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
      .selectFrom('reels')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
    if (excluded.length) query = query.where('author_actor_id', 'not in', excluded)
    const rows = await query.execute()
    const out: ReelItemDto[] = []
    for (const row of rows) {
      const author = await this.profiles.getByActorId(row.author_actor_id, viewerActorId)
      if (!author) continue
      out.push({
        id: row.id,
        author,
        caption: row.caption,
        source: row.source,
        colour: row.colour,
        liked: false,
        likeCount: row.like_count,
        replyCount: row.reply_count,
      })
    }
    return out
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
