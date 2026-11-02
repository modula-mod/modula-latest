/**
 * In-process fan-out for GUBIC lobby events. Postgres stays the source of
 * truth; sockets only receive change notifications plus relayed game
 * messages. A multi-node deployment needs a shared bus (Postgres
 * LISTEN/NOTIFY or Redis) behind the same interface; see docs/gubic.
 */
export type GubicLobbyEvent =
  | {type: 'lobby.updated'; lobbyId: string; revision: number}
  | {type: 'lobby.closed'; lobbyId: string}
  | {type: 'lobby.started'; lobbyId: string; revision: number}
  | {type: 'relay'; lobbyId: string; from: string; payload: unknown}

export type GubicLobbySubscriber = {accountId: string; send: (event: GubicLobbyEvent) => void}

export const GUBIC_RELAY_MAX_BYTES = 4096
export const GUBIC_RELAY_MAX_PER_SECOND = 30

export class GubicLobbyHub {
  private readonly subscribers = new Map<string, Set<GubicLobbySubscriber>>()
  private readonly rate = new Map<GubicLobbySubscriber, {windowStart: number; count: number}>()

  subscribe(lobbyId: string, subscriber: GubicLobbySubscriber): () => void {
    let set = this.subscribers.get(lobbyId)
    if (!set) { set = new Set(); this.subscribers.set(lobbyId, set) }
    set.add(subscriber)
    return () => {
      set!.delete(subscriber)
      this.rate.delete(subscriber)
      if (!set!.size) this.subscribers.delete(lobbyId)
    }
  }

  count(lobbyId: string): number {
    return this.subscribers.get(lobbyId)?.size ?? 0
  }

  publish(event: GubicLobbyEvent): number {
    const set = this.subscribers.get(event.lobbyId)
    if (!set) return 0
    let delivered = 0
    for (const subscriber of set) {
      try { subscriber.send(event); delivered += 1 } catch { /* a dead socket is removed on close */ }
    }
    return delivered
  }

  /**
   * Relays an opaque game message to the other members of the lobby. The
   * payload is size- and rate-limited and never interpreted by the server.
   */
  relay(lobbyId: string, from: GubicLobbySubscriber, payload: unknown, now = Date.now()): {ok: true; delivered: number} | {ok: false; reason: 'too-large' | 'rate-limited' | 'not-subscribed'} {
    const set = this.subscribers.get(lobbyId)
    if (!set?.has(from)) return {ok: false, reason: 'not-subscribed'}
    let size = 0
    try { size = Buffer.byteLength(JSON.stringify(payload ?? null)) } catch { return {ok: false, reason: 'too-large'} }
    if (size > GUBIC_RELAY_MAX_BYTES) return {ok: false, reason: 'too-large'}
    const window = this.rate.get(from)
    if (!window || now - window.windowStart >= 1000) this.rate.set(from, {windowStart: now, count: 1})
    else if (++window.count > GUBIC_RELAY_MAX_PER_SECOND) return {ok: false, reason: 'rate-limited'}
    let delivered = 0
    for (const subscriber of set) {
      if (subscriber === from) continue
      try { subscriber.send({type: 'relay', lobbyId, from: from.accountId, payload}); delivered += 1 } catch { /* ignore */ }
    }
    return {ok: true, delivered}
  }
}
