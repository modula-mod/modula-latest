import type {ActivityItemDto, DiscoverResultDto, ReelItemDto} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'
import {ProfileRepository} from '../profiles/repository.js'

export class DiscoveryRepository {
  private readonly profiles: ProfileRepository
  constructor(private readonly db: ModulaDb) {
    this.profiles = new ProfileRepository(db)
  }

  async getDiscover(): Promise<DiscoverResultDto> {
    const suggestedProfiles = await this.profiles.listPublic()
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
    const reels = await this.listReels()
    return {
      suggestedProfiles,
      trendingTopics: trendingTopics.map(t => ({
        id: t.id,
        label: t.label,
        postCount: t.post_count,
      })),
      featuredModules: featuredModules.map(m => m.payload as Record<string, unknown>),
      media: reels.map(reel => ({
        id: `media-${reel.id}`,
        kind: 'image' as const,
        url: `https://modula.digital/media/reel/${reel.id}.jpg`,
        altText: reel.caption,
        colour: reel.colour,
        aspectRatio: 9 / 16,
        title: reel.source,
      })),
      reels,
    }
  }

  async listReels(): Promise<ReelItemDto[]> {
    const rows = await this.db
      .selectFrom('reels')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .execute()
    const out: ReelItemDto[] = []
    for (const row of rows) {
      const author = await this.profiles.getByActorId(row.author_actor_id)
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

  async listActivity(): Promise<ActivityItemDto[]> {
    const rows = await this.db
      .selectFrom('activity_items')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('occurred_at', 'desc')
      .execute()
    const out: ActivityItemDto[] = []
    for (const row of rows) {
      const actor = row.actor_id ? await this.profiles.getByActorId(row.actor_id) : undefined
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
}
