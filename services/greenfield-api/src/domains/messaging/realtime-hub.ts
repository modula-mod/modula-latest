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
  | {type: 'conversation.updated'; conversationId: string; reason: 'group-info' | 'members' | 'membership' | 'mute' | 'archive'}
  | {type: 'presence'; actorId: string; status: 'online' | 'offline'; lastActiveAt: string}
  | {
    type: 'call.updated'; callId: string; conversationId: string; state: string; revision: number
    mediaKind: 'audio' | 'video'; initiatorActorId: string; event: string; terminalReason: string | null
  }

export type MessagingSubscriber = {actorId: string; send: (event: MessagingRealtimeEvent) => void}

export const MESSAGING_SOCKET_MAX_PER_ACTOR = 5

export class MessagingRealtimeHub {
  private readonly byActor = new Map<string, Set<MessagingSubscriber>>()

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
}
