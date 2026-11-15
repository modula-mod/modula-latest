import type {ModulaDb} from '../../database/client.js'
import type {MessagingRealtimeHub, PostTopicEvent} from '../messaging/realtime-hub.js'

/**
 * Fans comment and like changes out to sockets following a post (live
 * comments). Events carry ids and counts only. Followers who block, are
 * blocked by, or mute the acting author never receive that author's comment
 * events, matching what GET /v1/posts/:postId/comments would show them.
 *
 * Best effort and single-instance like the rest of the messaging socket:
 * failures are logged by the caller and REST remains the source of truth.
 */
export class LiveCommentPublisher {
  constructor(
    private readonly db: ModulaDb,
    private readonly hub: MessagingRealtimeHub | null,
    private readonly enabled: boolean,
  ) {}

  get active(): boolean {
    return this.enabled && this.hub !== null
  }

  async publish(postId: string, event: PostTopicEvent, authorActorId: string | null = null): Promise<number> {
    const hub = this.hub
    if (!this.enabled || !hub || hub.postFollowerCount(postId) === 0) return 0
    const excluded = authorActorId ? await this.excludedFollowers(hub.postFollowerActors(postId), authorActorId) : []
    return hub.publishPost(postId, event, {excludeActorIds: excluded})
  }

  private async excludedFollowers(followers: string[], authorActorId: string): Promise<string[]> {
    const others = followers.filter(id => id !== authorActorId)
    if (others.length === 0) return []
    const [blocks, mutes] = await Promise.all([
      this.db.selectFrom('blocks').select(['blocker_actor_id', 'blocked_actor_id']).where('deleted_at', 'is', null)
        .where(({eb, or, and}) => or([
          and([eb('blocker_actor_id', '=', authorActorId), eb('blocked_actor_id', 'in', others)]),
          and([eb('blocked_actor_id', '=', authorActorId), eb('blocker_actor_id', 'in', others)]),
        ]))
        .execute(),
      this.db.selectFrom('mutes').select('muter_actor_id').where('deleted_at', 'is', null)
        .where('muted_actor_id', '=', authorActorId).where('muter_actor_id', 'in', others).execute(),
    ])
    return [...new Set([
      ...blocks.map(row => row.blocker_actor_id === authorActorId ? row.blocked_actor_id : row.blocker_actor_id),
      ...mutes.map(row => row.muter_actor_id),
    ])]
  }
}
