/**
 * In-process realtime fan-out for messaging. Events carry ids and small
 * state only; clients refetch content through the authenticated REST routes,
 * so a socket never widens what a member can read.
 *
 * Single-instance: sockets connected to another API process do not receive
 * events. Clients must keep their REST poll as the source of truth.
 */
export type MessagingRealtimeEvent =
  | {type: 'hello'; actorId: string; heartbeatMs: number}
  | {type: 'pong'}
  | {type: 'error'; reason: string}
  | {type: 'message.created'; conversationId: string; messageId: string; senderId: string; kind: 'text' | 'voice' | 'media'; sentAt: string}
  | {type: 'message.updated'; conversationId: string; messageId: string}
  | {type: 'message.deleted'; conversationId: string; messageId: string}
  | {type: 'reaction.changed'; conversationId: string; messageId: string}
  | {type: 'typing'; conversationId: string; actorId: string; expiresAt: string}
  | {type: 'read'; conversationId: string; actorId: string; readAt: string}
  | {type: 'conversation.updated'; conversationId: string; reason: 'group-info' | 'members' | 'membership' | 'mute' | 'archive' | 'pin' | 'notifications' | 'theme' | 'disappearing'}
  | {type: 'message.pinned'; conversationId: string; messageId: string; pinned: boolean; actorId: string; at: string}
  | {type: 'message.saved'; conversationId: string; messageId: string; saved: boolean; at: string}
  | {type: 'message.expired'; conversationId: string; messageIds: string[]}
  | {type: 'scheduled.updated'; conversationId: string; scheduledId: string; state: string; messageId: string | null}
  | {type: 'messaging.folders.updated'; at: string}
  | {type: 'messaging.quick-replies.updated'; at: string}
  | {type: 'presence'; actorId: string; status: 'online' | 'offline'; lastActiveAt: string}
  | {type: 'conversation.unread'; conversationId: string; actorId: string; markedUnread: boolean; at: string}
  | {type: 'story.reaction'; itemId: string; groupId: string; actorId: string; emoji: string | null; at: string}
  | {type: 'post.subscribed'; postId: string}
  | {type: 'post.unsubscribed'; postId: string}
  | {type: 'post.comment.created'; postId: string; commentId: string; parentCommentId: string | null; at: string}
  | {type: 'post.comment.updated'; postId: string; commentId: string; at: string}
  | {type: 'post.comment.deleted'; postId: string; commentId: string; at: string}
  | {type: 'post.comment.reactions'; postId: string; commentId: string; at: string}
  | {type: 'post.engagement'; postId: string; likeCount?: number; reactionCount?: number; replyCount?: number; at: string}
  | {
    type: 'call.updated'; callId: string; conversationId: string; state: string; revision: number
    mediaKind: 'audio' | 'video'; initiatorActorId: string; event: string; terminalReason: string | null
  }

export type MessagingSubscriber = {actorId: string; send: (event: MessagingRealtimeEvent) => void}

export const MESSAGING_SOCKET_MAX_PER_ACTOR = 5
/** Live comment topics a single socket may follow at once. */
export const POST_TOPICS_MAX_PER_SOCKET = 20

export type PostTopicEvent = Extract<MessagingRealtimeEvent, {type: `post.${string}`}>

export class MessagingRealtimeHub {
  private readonly byActor = new Map<string, Set<MessagingSubscriber>>()
  private readonly byPost = new Map<string, Set<MessagingSubscriber>>()
  private readonly postsBySubscriber = new Map<MessagingSubscriber, Set<string>>()

  /** Returns null when the actor already has too many open sockets. */
  subscribe(subscriber: MessagingSubscriber): (() => void) | null {
    const set = this.byActor.get(subscriber.actorId) ?? new Set<MessagingSubscriber>()
    if (set.size >= MESSAGING_SOCKET_MAX_PER_ACTOR) return null
    set.add(subscriber)
    this.byActor.set(subscriber.actorId, set)
    return () => {
      const current = this.byActor.get(subscriber.actorId)
      if (!current) return
      current.delete(subscriber)
      if (current.size === 0) this.byActor.delete(subscriber.actorId)
    }
  }

  isOnline(actorId: string): boolean {
    return (this.byActor.get(actorId)?.size ?? 0) > 0
  }

  connectionCount(actorId: string): number {
    return this.byActor.get(actorId)?.size ?? 0
  }

  publish(actorIds: Iterable<string>, event: MessagingRealtimeEvent): number {
    let delivered = 0
    for (const actorId of new Set(actorIds)) {
      for (const subscriber of this.byActor.get(actorId) ?? []) {
        try {
          subscriber.send(event)
          delivered += 1
        } catch {
          // A broken socket is cleaned up by its close handler.
        }
      }
    }
    return delivered
  }

  // ---- live comment topics ------------------------------------------------
  // Authorization happens before followPost is called (the socket handler
  // runs the same policy check as GET /v1/posts/:postId/comments). Topic
  // events carry ids and counts only; clients refetch through REST.

  /** Returns false when the subscriber already follows the per-socket maximum. */
  followPost(subscriber: MessagingSubscriber, postId: string): boolean {
    const topics = this.postsBySubscriber.get(subscriber) ?? new Set<string>()
    if (topics.has(postId)) return true
    if (topics.size >= POST_TOPICS_MAX_PER_SOCKET) return false
    topics.add(postId)
    this.postsBySubscriber.set(subscriber, topics)
    const set = this.byPost.get(postId) ?? new Set<MessagingSubscriber>()
    set.add(subscriber)
    this.byPost.set(postId, set)
    return true
  }

  unfollowPost(subscriber: MessagingSubscriber, postId: string): void {
    this.postsBySubscriber.get(subscriber)?.delete(postId)
    const set = this.byPost.get(postId)
    if (!set) return
    set.delete(subscriber)
    if (set.size === 0) this.byPost.delete(postId)
  }

  unfollowAllPosts(subscriber: MessagingSubscriber): void {
    for (const postId of this.postsBySubscriber.get(subscriber) ?? []) {
      const set = this.byPost.get(postId)
      set?.delete(subscriber)
      if (set && set.size === 0) this.byPost.delete(postId)
    }
    this.postsBySubscriber.delete(subscriber)
  }

  postFollowerCount(postId: string): number {
    return this.byPost.get(postId)?.size ?? 0
  }

  /** Actor ids currently following a post (used to filter blocked pairs). */
  postFollowerActors(postId: string): string[] {
    return [...new Set([...(this.byPost.get(postId) ?? [])].map(s => s.actorId))]
  }

  publishPost(postId: string, event: PostTopicEvent, options: {excludeActorIds?: Iterable<string>} = {}): number {
    const excluded = new Set(options.excludeActorIds ?? [])
    let delivered = 0
    for (const subscriber of this.byPost.get(postId) ?? []) {
      if (excluded.has(subscriber.actorId)) continue
      try {
        subscriber.send(event)
        delivered += 1
      } catch {
        // A broken socket is cleaned up by its close handler.
      }
    }
    return delivered
  }
}
