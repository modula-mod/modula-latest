import {describe, expect, it} from 'vitest'
import {MessagingRealtimeHub, POST_TOPICS_MAX_PER_SOCKET, type MessagingRealtimeEvent} from '../src/domains/messaging/realtime-hub.js'
import {normalizeStoryEmoji} from '../src/domains/stories/social.js'
import {socialFeatures} from '../src/config/env.js'

describe('live comment topics on the realtime hub', () => {
  const subscriber = (actorId: string) => {
    const events: MessagingRealtimeEvent[] = []
    return {events, sub: {actorId, send: (event: MessagingRealtimeEvent) => { events.push(event) }}}
  }
  const event = (postId: string) => ({type: 'post.comment.created' as const, postId, commentId: 'c1', parentCommentId: null, at: 'now'})

  it('delivers only to followers of the post and honours exclusions', () => {
    const hub = new MessagingRealtimeHub()
    const a = subscriber('a'), b = subscriber('b'), c = subscriber('c')
    expect(hub.followPost(a.sub, 'p1')).toBe(true)
    expect(hub.followPost(b.sub, 'p1')).toBe(true)
    expect(hub.followPost(c.sub, 'p2')).toBe(true)
    expect(hub.publishPost('p1', event('p1'), {excludeActorIds: ['b']})).toBe(1)
    expect(a.events).toHaveLength(1)
    expect(b.events).toHaveLength(0)
    expect(c.events).toHaveLength(0)
    expect(hub.postFollowerActors('p1').sort()).toEqual(['a', 'b'])
  })

  it('caps topics per socket and cleans up on unfollow', () => {
    const hub = new MessagingRealtimeHub()
    const a = subscriber('a')
    for (let i = 0; i < POST_TOPICS_MAX_PER_SOCKET; i += 1) expect(hub.followPost(a.sub, `p${i}`)).toBe(true)
    expect(hub.followPost(a.sub, 'p0')).toBe(true) // already following is fine
    expect(hub.followPost(a.sub, 'overflow')).toBe(false)
    hub.unfollowPost(a.sub, 'p0')
    expect(hub.postFollowerCount('p0')).toBe(0)
    expect(hub.followPost(a.sub, 'overflow')).toBe(true)
    hub.unfollowAllPosts(a.sub)
    expect(hub.postFollowerCount('overflow')).toBe(0)
    expect(hub.publishPost('p1', event('p1'))).toBe(0)
  })

  it('isolates a throwing socket', () => {
    const hub = new MessagingRealtimeHub()
    const good = subscriber('g')
    hub.followPost({actorId: 'x', send: () => { throw new Error('closed') }}, 'p')
    hub.followPost(good.sub, 'p')
    expect(hub.publishPost('p', event('p'))).toBe(1)
    expect(good.events).toHaveLength(1)
  })
})

describe('story reaction emoji', () => {
  it('accepts exactly one emoji grapheme', () => {
    for (const ok of ['🔥', '❤️', '👍🏽', '👩‍💻', '🇬🇧']) expect(normalizeStoryEmoji(` ${ok} `)).toBe(ok)
  })
  it('rejects text, several emoji and non-strings', () => {
    for (const bad of ['a', 'ab', '🔥🔥', '', '   ', 1, null, undefined, {}, '🔥a']) {
      expect(() => normalizeStoryEmoji(bad), String(bad)).toThrow()
    }
  })
})

describe('social feature flags', () => {
  it('default off and can be enabled per feature', () => {
    expect(socialFeatures({})).toEqual({markUnread: false, storyViewers: false, storyReactions: false, storyHighlights: false, liveComments: false})
    expect(socialFeatures({social: {liveComments: true}})).toEqual({markUnread: false, storyViewers: false, storyReactions: false, storyHighlights: false, liveComments: true})
  })
})
