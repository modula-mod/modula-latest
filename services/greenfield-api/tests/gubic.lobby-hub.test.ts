import {describe, expect, it} from 'vitest'
import {GUBIC_RELAY_MAX_PER_SECOND, GubicLobbyHub, type GubicLobbyEvent} from '../src/gubic/lobby-hub.js'

function member(accountId: string) {
  const received: GubicLobbyEvent[] = []
  return {received, subscriber: {accountId, send: (event: GubicLobbyEvent) => { received.push(event) }}}
}

describe('GUBIC lobby hub', () => {
  it('fans out lobby events only to that lobby and cleans up on unsubscribe', () => {
    const hub = new GubicLobbyHub()
    const a = member('a'), b = member('b'), other = member('c')
    const offA = hub.subscribe('L1', a.subscriber)
    hub.subscribe('L1', b.subscriber)
    hub.subscribe('L2', other.subscriber)
    expect(hub.publish({type: 'lobby.updated', lobbyId: 'L1', revision: 2})).toBe(2)
    expect(other.received).toEqual([])
    offA()
    expect(hub.count('L1')).toBe(1)
    expect(hub.publish({type: 'lobby.closed', lobbyId: 'L1'})).toBe(1)
    expect(a.received).toHaveLength(1)
  })

  it('relays opaque payloads to other members with size and rate limits', () => {
    const hub = new GubicLobbyHub()
    const a = member('a'), b = member('b'), outsider = member('x')
    hub.subscribe('L1', a.subscriber)
    hub.subscribe('L1', b.subscriber)
    expect(hub.relay('L1', a.subscriber, {move: 1}, 0)).toEqual({ok: true, delivered: 1})
    expect(b.received[0]).toEqual({type: 'relay', lobbyId: 'L1', from: 'a', payload: {move: 1}})
    expect(a.received).toEqual([])
    expect(hub.relay('L1', outsider.subscriber, {}, 0)).toEqual({ok: false, reason: 'not-subscribed'})
    expect(hub.relay('L1', a.subscriber, {blob: 'x'.repeat(5000)}, 0)).toEqual({ok: false, reason: 'too-large'})
    for (let i = 1; i < GUBIC_RELAY_MAX_PER_SECOND; i += 1) expect(hub.relay('L1', a.subscriber, i, 10).ok).toBe(true)
    expect(hub.relay('L1', a.subscriber, 'over', 20)).toEqual({ok: false, reason: 'rate-limited'})
    expect(hub.relay('L1', a.subscriber, 'later', 1100).ok).toBe(true)
  })
})
