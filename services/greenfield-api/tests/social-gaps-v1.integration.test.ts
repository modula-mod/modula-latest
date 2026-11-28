import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
const SOCIAL_FLAGS = [
  'MODULA_MESSAGING_MARK_UNREAD_ENABLED', 'MODULA_STORY_VIEWERS_ENABLED', 'MODULA_STORY_REACTIONS_ENABLED',
  'MODULA_STORY_HIGHLIGHTS_ENABLED', 'MODULA_LIVE_COMMENTS_ENABLED',
]

function setEnv() {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4033'
  process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4033'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
  process.env.MODULA_INVITE_ONLY = 'true'
  process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
  process.env.MODULA_ATPROTO_ENABLED = 'false'
  process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
  process.env.MODULA_MEDIA_ROOT = `/tmp/modula-social-gaps-${process.pid}`
}

describeIfDb('Social gaps v1: mark unread, story viewers/reactions/highlights, live comments', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let runSuffix = ''
  let counter = 0

  beforeAll(async () => {
    setEnv()
    // Features are off by default; this suite exercises them switched on (exactly 'true').
    for (const flag of SOCIAL_FLAGS) process.env[flag] = 'true'
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    runSuffix = Date.now().toString(36).slice(-6)
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it('requires authentication on every new route', async () => {
    const routes: [string, string][] = [
      ['POST', '/v1/conversations/c1/unread'],
      ['GET', '/v1/stories/archive'],
      ['GET', '/v1/stories/items/i1/viewers'],
      ['GET', '/v1/stories/items/i1/reactions'],
      ['PUT', '/v1/stories/items/i1/reaction'],
      ['DELETE', '/v1/stories/items/i1/reaction'],
      ['POST', '/v1/stories/highlights'],
      ['PATCH', '/v1/stories/highlights/h1'],
      ['DELETE', '/v1/stories/highlights/h1'],
    ]
    for (const [method, url] of routes) {
      const res = await app.inject({method: method as any, url, payload: method === 'GET' || method === 'DELETE' ? undefined : {}})
      expect(res.statusCode, `${method} ${url}`).toBe(401)
    }
    // Optional-auth reads still reject a bad bearer token.
    for (const url of ['/v1/stories/highlights/h1', '/v1/profiles/someone/highlights', '/v1/stories/capabilities']) {
      const res = await app.inject({method: 'GET', url, headers: {authorization: 'Bearer nope'}})
      expect(res.statusCode, url).toBe(401)
    }
  })

  it('advertises every new capability', async () => {
    const u = await user('cap')
    const messaging = (await authed(u.accessToken, 'GET', '/v1/messaging/capabilities')).json().data
    expect(messaging.version).toBe(3)
    expect(messaging.markUnread).toBe(true)
    expect(messaging.liveComments).toMatchObject({enabled: true, subscribeFrame: 'post.subscribe', unsubscribeFrame: 'post.unsubscribe', maxPostsPerSocket: 20})
    const stories = (await authed(u.accessToken, 'GET', '/v1/stories/capabilities')).json().data
    expect(stories).toMatchObject({viewers: true, reactions: {enabled: true}, highlights: {enabled: true, maxItems: 100}, archive: true})
  })

  // ---- mark unread ---------------------------------------------------------

  it('marks a conversation unread for the caller only and clears it on read', async () => {
    const [a, b, outsider] = [await user('mua'), await user('mub'), await user('muc')]
    await follow(b, a)
    const convo = (await authed(a.accessToken, 'POST', '/v1/conversations', {handle: b.handle, text: 'hello'})).json().data.conversation
    expect((await authed(b.accessToken, 'POST', `/v1/conversations/${convo.id}/read`)).statusCode).toBe(200)
    const before = await member(convo.id, b.actorId)

    const aSock = await openSocket(a.accessToken)
    const bSock = await openSocket(b.accessToken)
    await waitFor(() => bSock.events.some(e => e.type === 'hello') && aSock.events.some(e => e.type === 'hello'))

    const marked = await authed(b.accessToken, 'POST', `/v1/conversations/${convo.id}/unread`)
    expect(marked.statusCode, marked.body).toBe(200)
    expect(marked.json().data).toEqual({markedUnread: true})
    await waitFor(() => bSock.events.some(e => e.type === 'conversation.unread'))
    expect(bSock.events.find(e => e.type === 'conversation.unread')).toMatchObject({conversationId: convo.id, actorId: b.actorId, markedUnread: true})
    await sleep(30)
    expect(aSock.events.some(e => e.type === 'conversation.unread')).toBe(false)

    // Read receipts are not revoked: last_read_at does not move.
    const after = await member(convo.id, b.actorId)
    expect(after.last_read_at?.getTime()).toBe(before.last_read_at?.getTime())
    expect(after.marked_unread_at).not.toBeNull()

    const list = (await authed(b.accessToken, 'GET', '/v1/conversations')).json().data.items
    expect(list.find((c: any) => c.id === convo.id)).toMatchObject({markedUnread: true, unreadCount: 0})
    expect((await authed(b.accessToken, 'GET', '/v1/conversations/unread')).json().data).toEqual({unreadCount: 0, markedUnreadCount: 1})
    // The other member's view is unaffected.
    expect((await authed(a.accessToken, 'GET', '/v1/conversations')).json().data.items.find((c: any) => c.id === convo.id).markedUnread).toBe(false)

    expect((await authed(outsider.accessToken, 'POST', `/v1/conversations/${convo.id}/unread`)).statusCode).toBe(404)
    expect((await authed(b.accessToken, 'POST', `/v1/conversations/${convo.id}/unread`, {unread: 'yes'})).statusCode).toBe(400)

    expect((await authed(b.accessToken, 'POST', `/v1/conversations/${convo.id}/read`)).statusCode).toBe(200)
    expect((await member(convo.id, b.actorId)).marked_unread_at).toBeNull()

    await authed(b.accessToken, 'POST', `/v1/conversations/${convo.id}/unread`)
    const cleared = await authed(b.accessToken, 'POST', `/v1/conversations/${convo.id}/unread`, {unread: false})
    expect(cleared.json().data).toEqual({markedUnread: false})
    expect((await member(convo.id, b.actorId)).marked_unread_at).toBeNull()
    aSock.ws.terminate()
    bSock.ws.terminate()
  })

  // ---- story viewers & reactions ------------------------------------------

  it('shows viewers only to the owner, without blocked accounts', async () => {
    const [owner, viewer, blockedViewer, stranger] = [await user('svo'), await user('svv'), await user('svb'), await user('svs')]
    const story = await createStory(owner.accessToken, 'public')
    expect((await authed(viewer.accessToken, 'POST', `/v1/stories/items/${story.itemId}/viewed`)).statusCode).toBe(200)
    expect((await authed(blockedViewer.accessToken, 'POST', `/v1/stories/items/${story.itemId}/viewed`)).statusCode).toBe(200)
    await block(owner, blockedViewer)

    const res = await authed(owner.accessToken, 'GET', `/v1/stories/items/${story.itemId}/viewers`)
    expect(res.statusCode, res.body).toBe(200)
    const data = res.json().data
    expect(data.viewerCount).toBe(1)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({actorId: viewer.actorId, handle: viewer.handle, reaction: null})
    expect(typeof data.items[0].viewedAt).toBe('string')

    // Non-owners never learn the item exists.
    expect((await authed(stranger.accessToken, 'GET', `/v1/stories/items/${story.itemId}/viewers`)).statusCode).toBe(404)
    expect((await authed(viewer.accessToken, 'GET', `/v1/stories/items/${story.itemId}/viewers`)).statusCode).toBe(404)

    // Pagination.
    const page = (await authed(owner.accessToken, 'GET', `/v1/stories/items/${story.itemId}/viewers?limit=1`)).json().data
    expect(page.items).toHaveLength(1)
    expect(page.hasMore).toBe(false)
  })

  it('delivers emoji reactions to the owner with visibility and validation checks', async () => {
    const [owner, fan, stranger] = [await user('sro'), await user('srf'), await user('srs')]
    await follow(fan, owner)
    const story = await createStory(owner.accessToken, 'followers')
    const ownerSock = await openSocket(owner.accessToken)
    await waitFor(() => ownerSock.events.some(e => e.type === 'hello'))

    const reacted = await authed(fan.accessToken, 'PUT', `/v1/stories/items/${story.itemId}/reaction`, {emoji: '🔥'})
    expect(reacted.statusCode, reacted.body).toBe(200)
    expect(reacted.json().data).toMatchObject({itemId: story.itemId, emoji: '🔥', changed: true})
    await waitFor(() => ownerSock.events.some(e => e.type === 'story.reaction'))
    expect(ownerSock.events.find(e => e.type === 'story.reaction')).toMatchObject({itemId: story.itemId, groupId: story.groupId, actorId: fan.actorId, emoji: '🔥'})

    const outbox = await db.selectFrom('outbox_events').selectAll().where('aggregate_id', '=', story.itemId).execute()
    expect(outbox.some(row => (row.payload as any)?.dedupeKey === `story-reaction:${story.itemId}:${fan.actorId}` && (row.payload as any)?.recipientActorId === owner.actorId)).toBe(true)

    // Same emoji again is a no-op; a ZWJ sequence counts as one emoji.
    expect((await authed(fan.accessToken, 'PUT', `/v1/stories/items/${story.itemId}/reaction`, {emoji: '🔥'})).json().data.changed).toBe(false)
    expect((await authed(fan.accessToken, 'PUT', `/v1/stories/items/${story.itemId}/reaction`, {emoji: '👩‍💻'})).statusCode).toBe(200)

    for (const emoji of ['ab', '🔥🔥', '', 5, 'x'.repeat(40)]) {
      expect((await authed(fan.accessToken, 'PUT', `/v1/stories/items/${story.itemId}/reaction`, {emoji})).statusCode, String(emoji)).toBe(400)
    }
    expect((await authed(fan.accessToken, 'PUT', `/v1/stories/items/${story.itemId}/reaction`, {emoji: '🔥', extra: 1})).statusCode).toBe(400)
    // Followers-only story: a non-follower cannot react (and cannot confirm the item).
    expect((await authed(stranger.accessToken, 'PUT', `/v1/stories/items/${story.itemId}/reaction`, {emoji: '🔥'})).statusCode).toBe(404)
    // The owner cannot react to their own story.
    const own = await authed(owner.accessToken, 'PUT', `/v1/stories/items/${story.itemId}/reaction`, {emoji: '🔥'})
    expect(own.statusCode).toBe(400)
    expect(own.json().error.details?.reason).toBe('own-story')

    const reactions = (await authed(owner.accessToken, 'GET', `/v1/stories/items/${story.itemId}/reactions`)).json().data
    expect(reactions.items).toHaveLength(1)
    expect(reactions.items[0]).toMatchObject({actorId: fan.actorId, emoji: '👩‍💻'})
    expect(reactions.summary).toEqual([{emoji: '👩‍💻', count: 1}])
    expect((await authed(fan.accessToken, 'GET', `/v1/stories/items/${story.itemId}/reactions`)).statusCode).toBe(404)
    // A reaction also records the view, and the viewer list shows it.
    const viewers = (await authed(owner.accessToken, 'GET', `/v1/stories/items/${story.itemId}/viewers`)).json().data
    expect(viewers.items[0]).toMatchObject({actorId: fan.actorId, reaction: '👩‍💻'})
    // The reactor sees their own reaction on the group.
    const group = (await authed(fan.accessToken, 'GET', `/v1/stories/${story.groupId}`)).json().data
    expect(group.items[0].viewerReaction).toBe('👩‍💻')

    const removed = await authed(fan.accessToken, 'DELETE', `/v1/stories/items/${story.itemId}/reaction`)
    expect(removed.json().data).toEqual({itemId: story.itemId, removed: true})
    await waitFor(() => ownerSock.events.some(e => e.type === 'story.reaction' && e.emoji === null))
    expect((await authed(fan.accessToken, 'DELETE', `/v1/stories/items/${story.itemId}/reaction`)).json().data.removed).toBe(false)
    ownerSock.ws.terminate()
  })

  // ---- highlights ------------------------------------------------------------

  it('builds highlights from own stories, serves them on the profile and keeps their media past 24h', async () => {
    const [owner, follower, stranger, blocked, other] = [await user('sho'), await user('shf'), await user('shs'), await user('shb'), await user('shx')]
    await follow(follower, owner)
    // Items in one live group share its visibility, so close the first group
    // before posting the second story with a different audience.
    const privateStory = await createStory(owner.accessToken, 'followers')
    await db.updateTable('greenfield_story_groups').set({expires_at: new Date(Date.now() - 1000)}).where('group_id', '=', privateStory.groupId).execute()
    const publicStory = await createStory(owner.accessToken, 'public')
    expect(publicStory.groupId).not.toBe(privateStory.groupId)
    const othersStory = await createStory(other.accessToken, 'public')

    const notMine = await authed(owner.accessToken, 'POST', '/v1/stories/highlights', {title: 'Nope', itemIds: [othersStory.itemId]})
    expect(notMine.statusCode).toBe(400)
    expect(notMine.json().error.details?.reason).toBe('not-own-item')
    expect((await authed(owner.accessToken, 'POST', '/v1/stories/highlights', {title: '', itemIds: [publicStory.itemId]})).statusCode).toBe(400)
    expect((await authed(owner.accessToken, 'POST', '/v1/stories/highlights', {title: 'x'.repeat(41), itemIds: [publicStory.itemId]})).statusCode).toBe(400)
    expect((await authed(owner.accessToken, 'POST', '/v1/stories/highlights', {title: 'Empty', itemIds: []})).statusCode).toBe(400)
    expect((await authed(owner.accessToken, 'POST', '/v1/stories/highlights', {title: 'Cover', itemIds: [publicStory.itemId], coverItemId: privateStory.itemId})).statusCode).toBe(400)
    expect((await authed(owner.accessToken, 'POST', '/v1/stories/highlights', {title: 'Extra', itemIds: [publicStory.itemId], ownerActorId: other.actorId})).statusCode).toBe(400)

    const created = await authed(owner.accessToken, 'POST', '/v1/stories/highlights', {title: '  Summer   trip ', itemIds: [publicStory.itemId, privateStory.itemId], coverItemId: privateStory.itemId})
    expect(created.statusCode, created.body).toBe(201)
    const highlight = created.json().data
    expect(highlight).toMatchObject({title: 'Summer trip', itemCount: 2, coverItemId: privateStory.itemId, isOwner: true})

    // Age both stories past 24h: they leave the rail but stay in the highlight.
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    await db.updateTable('greenfield_story_items').set({created_at: old}).where('item_id', 'in', [publicStory.itemId, privateStory.itemId]).execute()
    await db.updateTable('greenfield_story_groups').set({expires_at: new Date(old.getTime() + 24 * 60 * 60 * 1000)}).where('group_id', 'in', [publicStory.groupId, privateStory.groupId]).execute()
    await block(owner, blocked)

    const forFollower = (await authed(follower.accessToken, 'GET', `/v1/stories/highlights/${highlight.highlightId}`)).json().data
    expect(forFollower.items.map((i: any) => i.itemId)).toEqual([publicStory.itemId, privateStory.itemId])
    const forStranger = (await authed(stranger.accessToken, 'GET', `/v1/stories/highlights/${highlight.highlightId}`)).json().data
    expect(forStranger.items.map((i: any) => i.itemId)).toEqual([publicStory.itemId])
    expect(forStranger.coverItemId).toBe(publicStory.itemId)
    expect((await authed(blocked.accessToken, 'GET', `/v1/stories/highlights/${highlight.highlightId}`)).statusCode).toBe(404)
    expect((await app.inject({method: 'GET', url: `/v1/stories/highlights/${highlight.highlightId}`})).json().data.itemCount).toBe(1)

    const profile = (await authed(stranger.accessToken, 'GET', `/v1/profiles/${owner.handle}/highlights`)).json().data
    expect(profile.items).toHaveLength(1)
    expect(profile.items[0]).toMatchObject({highlightId: highlight.highlightId, itemCount: 1})
    expect((await authed(blocked.accessToken, 'GET', `/v1/profiles/${owner.handle}/highlights`)).statusCode).toBe(404)
    expect((await authed(stranger.accessToken, 'GET', '/v1/profiles/no-such-handle-xyz/highlights')).statusCode).toBe(404)

    // Media of expired-but-highlighted items follows the original visibility.
    const publicFile = mediaFile(forFollower.items[0].mediaUrl)
    const privateFile = mediaFile(forFollower.items[1].mediaUrl)
    expect((await authed(stranger.accessToken, 'GET', `/v1/media/stories/${publicFile}`)).statusCode).toBe(200)
    expect((await authed(follower.accessToken, 'GET', `/v1/media/stories/${privateFile}`)).statusCode).toBe(200)
    // Expired items never confirm existence to viewers who may not see them.
    expect((await authed(stranger.accessToken, 'GET', `/v1/media/stories/${privateFile}`)).statusCode).toBe(404)
    expect((await authed(blocked.accessToken, 'GET', `/v1/media/stories/${publicFile}`)).statusCode).toBe(404)
    expect((await app.inject({method: 'GET', url: `/v1/media/stories/${privateFile}`})).statusCode).toBe(404)

    // Archive lists own items of any age.
    const archive = (await authed(owner.accessToken, 'GET', '/v1/stories/archive')).json().data
    expect(archive.items.map((i: any) => i.itemId)).toEqual(expect.arrayContaining([publicStory.itemId, privateStory.itemId]))
    expect(archive.items.find((i: any) => i.itemId === publicStory.itemId).live).toBe(false)

    // Edit: only the owner; dropping the cover item resets the cover.
    expect((await authed(other.accessToken, 'PATCH', `/v1/stories/highlights/${highlight.highlightId}`, {title: 'Hijack'})).statusCode).toBe(404)
    const edited = await authed(owner.accessToken, 'PATCH', `/v1/stories/highlights/${highlight.highlightId}`, {title: 'Trip', itemIds: [publicStory.itemId]})
    expect(edited.statusCode, edited.body).toBe(200)
    expect(edited.json().data).toMatchObject({title: 'Trip', itemCount: 1, coverItemId: publicStory.itemId})
    expect((await authed(follower.accessToken, 'GET', `/v1/media/stories/${privateFile}`)).statusCode).toBe(404)

    // Deleting the story item removes it from the highlight.
    const fresh = await createStory(owner.accessToken, 'public')
    await authed(owner.accessToken, 'PATCH', `/v1/stories/highlights/${highlight.highlightId}`, {itemIds: [publicStory.itemId, fresh.itemId]})
    expect((await authed(owner.accessToken, 'DELETE', `/v1/stories/items/${fresh.itemId}`)).statusCode).toBe(200)
    expect((await authed(stranger.accessToken, 'GET', `/v1/stories/highlights/${highlight.highlightId}`)).json().data.itemCount).toBe(1)

    // Delete: only the owner, then the media is gone again.
    expect((await authed(other.accessToken, 'DELETE', `/v1/stories/highlights/${highlight.highlightId}`)).statusCode).toBe(404)
    expect((await authed(owner.accessToken, 'DELETE', `/v1/stories/highlights/${highlight.highlightId}`)).statusCode).toBe(200)
    expect((await authed(stranger.accessToken, 'GET', `/v1/stories/highlights/${highlight.highlightId}`)).statusCode).toBe(404)
    expect((await authed(stranger.accessToken, 'GET', `/v1/media/stories/${publicFile}`)).statusCode).toBe(404)
    expect((await authed(owner.accessToken, 'GET', `/v1/profiles/${owner.handle}/highlights`)).json().data.items).toHaveLength(0)
  })

  // ---- live comments ---------------------------------------------------------

  it('pushes comment, like and delete events to authorized post subscribers only', async () => {
    const [author, watcher, commenter, blockedWatcher, outsider] = [await user('lca'), await user('lcw'), await user('lcc'), await user('lcb'), await user('lco')]
    const post = await createPost(author.accessToken, 'public', 'live')
    const privatePost = await createPost(author.accessToken, 'followers', 'live-private')

    const watcherSock = await openSocket(watcher.accessToken)
    const blockedSock = await openSocket(blockedWatcher.accessToken)
    const outsiderSock = await openSocket(outsider.accessToken)
    await waitFor(() => [watcherSock, blockedSock, outsiderSock].every(s => s.events.some(e => e.type === 'hello')))

    watcherSock.ws.send(JSON.stringify({type: 'post.subscribe', postId: post}))
    blockedSock.ws.send(JSON.stringify({type: 'post.subscribe', postId: post}))
    await waitFor(() => watcherSock.events.some(e => e.type === 'post.subscribed') && blockedSock.events.some(e => e.type === 'post.subscribed'))
    // Followers-only post: a non-follower cannot subscribe; neither can an unknown id.
    outsiderSock.ws.send(JSON.stringify({type: 'post.subscribe', postId: privatePost}))
    outsiderSock.ws.send(JSON.stringify({type: 'post.subscribe', postId: 'no-such-post'}))
    outsiderSock.ws.send(JSON.stringify({type: 'post.subscribe', postId: 42}))
    await waitFor(() => outsiderSock.events.filter(e => e.type === 'error').length >= 3)
    expect(outsiderSock.events.filter(e => e.type === 'error').map(e => e.reason).sort()).toEqual(['invalid-post', 'not-found', 'not-found'])

    // The blocked watcher blocks the commenter: they must not get that author's events.
    await block(blockedWatcher, commenter)
    const comment = await authed(commenter.accessToken, 'POST', `/v1/posts/${post}/comments`, {text: 'live comment'})
    expect(comment.statusCode, comment.body).toBe(201)
    const commentId = comment.json().data.comment_id
    await waitFor(() => watcherSock.events.some(e => e.type === 'post.comment.created'))
    const created = watcherSock.events.find(e => e.type === 'post.comment.created')
    expect(created).toMatchObject({postId: post, commentId, parentCommentId: null})
    expect(created.text).toBeUndefined()

    const reply = await authed(author.accessToken, 'POST', `/v1/comments/${commentId}/replies`, {text: 'live reply'})
    expect(reply.statusCode).toBe(201)
    await waitFor(() => watcherSock.events.some(e => e.type === 'post.comment.created' && e.parentCommentId === commentId))

    expect((await authed(outsider.accessToken, 'POST', `/v1/posts/${post}/like`)).statusCode).toBe(200)
    await waitFor(() => watcherSock.events.some(e => e.type === 'post.engagement' && e.likeCount === 1))

    expect((await authed(author.accessToken, 'PUT', `/v1/comments/${commentId}/reaction`, {type: 'like'})).statusCode).toBe(200)
    await waitFor(() => watcherSock.events.some(e => e.type === 'post.comment.reactions' && e.commentId === commentId))

    expect((await authed(commenter.accessToken, 'DELETE', `/v1/comments/${commentId}`)).statusCode).toBe(200)
    await waitFor(() => watcherSock.events.some(e => e.type === 'post.comment.deleted' && e.commentId === commentId))

    await sleep(50)
    const blockedTypes = blockedSock.events.map(e => e.type)
    expect(blockedTypes).not.toContain('post.comment.deleted')
    expect(blockedTypes.filter(t => t === 'post.comment.created')).toHaveLength(1) // the author's reply only
    expect(blockedTypes).toContain('post.engagement')
    expect(outsiderSock.events.some(e => e.type.startsWith('post.comment'))).toBe(false)

    // Unsubscribe stops delivery.
    watcherSock.ws.send(JSON.stringify({type: 'post.unsubscribe', postId: post}))
    await waitFor(() => watcherSock.events.some(e => e.type === 'post.unsubscribed'))
    const count = watcherSock.events.length
    await authed(author.accessToken, 'POST', `/v1/posts/${post}/comments`, {text: 'after unsubscribe'})
    await sleep(60)
    expect(watcherSock.events.slice(count).some(e => e.type === 'post.comment.created')).toBe(false)

    // Per-socket topic cap.
    for (let i = 0; i < 20; i += 1) watcherSock.ws.send(JSON.stringify({type: 'post.subscribe', postId: post}))
    const extra = await Promise.all(Array.from({length: 20}, (_, i) => createPost(author.accessToken, 'public', `cap-${i}`)))
    for (const id of extra) watcherSock.ws.send(JSON.stringify({type: 'post.subscribe', postId: id}))
    await waitFor(() => watcherSock.events.some(e => e.type === 'error' && e.reason === 'too-many-posts'), 5000)
    for (const s of [watcherSock, blockedSock, outsiderSock]) s.ws.terminate()
  })

  it('withdraws every feature and its capability flag by default (flags unset)', async () => {
    // No flag set at all: the shipped default must be off.
    for (const flag of SOCIAL_FLAGS) delete process.env[flag]
    const off = await createServer(loadConfig())
    try {
      await off.app.ready()
      const u = await user('off')
      const call = (method: string, url: string, payload?: unknown) => off.app.inject({method: method as any, url, headers: {authorization: `Bearer ${u.accessToken}`}, ...(payload === undefined ? {} : {payload})})
      const messaging = (await call('GET', '/v1/messaging/capabilities')).json().data
      expect(messaging.markUnread).toBe(false)
      expect(messaging.liveComments).toEqual({enabled: false})
      const stories = (await call('GET', '/v1/stories/capabilities')).json().data
      expect(stories).toMatchObject({viewers: false, reactions: {enabled: false}, highlights: {enabled: false}, archive: false})
      for (const [method, url] of [
        ['POST', '/v1/conversations/c1/unread'], ['GET', '/v1/stories/items/i1/viewers'], ['PUT', '/v1/stories/items/i1/reaction'],
        ['POST', '/v1/stories/highlights'], ['GET', '/v1/stories/archive'], ['GET', `/v1/profiles/${u.handle}/highlights`],
      ] as const) {
        const res = await call(method, url, method === 'GET' ? undefined : {})
        expect(res.json().error?.code, `${method} ${url}`).toBe('CAPABILITY_DISABLED')
      }
    } finally {
      for (const flag of SOCIAL_FLAGS) process.env[flag] = 'true'
      await off.app.close()
      await off.db.destroy()
    }
  })

  // ---- helpers -----------------------------------------------------------------

  async function openSocket(token: string) {
    const events: any[] = []
    const ws = await (app as any).injectWS('/v1/messaging/socket', {headers: {authorization: `Bearer ${token}`}}, {
      onInit: (socket: any) => socket.on('message', (data: Buffer) => events.push(JSON.parse(data.toString()))),
    })
    return {ws, events}
  }

  async function member(conversationId: string, actorId: string) {
    return db.selectFrom('greenfield_conversation_members').selectAll()
      .where('conversation_id', '=', conversationId).where('actor_id', '=', actorId).executeTakeFirstOrThrow()
  }

  async function createStory(accessToken: string, visibility: 'public' | 'followers') {
    const created = await authed(accessToken, 'POST', '/v1/stories', {
      mediaKind: 'image', contentType: 'image/png', base64: PIXEL, caption: `gaps ${runSuffix}`, visibility, width: 1, height: 1,
    })
    expect(created.statusCode, created.body).toBe(201)
    return {groupId: created.json().data.groupId as string, itemId: created.json().data.items.at(-1).itemId as string}
  }

  async function createPost(accessToken: string, audience: 'public' | 'followers', key: string) {
    counter += 1
    const post = await authed(accessToken, 'POST', '/v1/posts', {
      text: `social gaps ${key} ${runSuffix}`, audience, feed: 'following', idempotencyKey: `gaps-${key}-${runSuffix}-${counter}`,
    })
    expect(post.statusCode, post.body).toBe(201)
    return post.json().data.id as string
  }

  function mediaFile(url: string) {
    const file = url.split('/').pop()!
    expect(file).toMatch(/^[0-9a-f-]{36}\.png$/)
    return file
  }

  async function user(prefix: string) {
    counter += 1
    const handle = `${prefix}${runSuffix}${counter}`.slice(0, 20)
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.com`
    await db.deleteFrom('greenfield_auth_rate_limits').execute()
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {email, password, handle, displayName: handle, acceptedTerms: true, inviteCode: 'test-invite'}})
    expect(register.statusCode, register.body).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    const accessToken = session.json().data.accessToken as string
    const accountId = register.json().data.accountId as string
    const actor = await db.selectFrom('actors').select('id').where('account_id', '=', accountId).executeTakeFirstOrThrow()
    return {accountId, actorId: actor.id, handle, accessToken}
  }

  async function follow(follower: {actorId: string}, followed: {actorId: string}) {
    const now = new Date()
    await db.insertInto('follows').values({id: `f-${follower.actorId}-${followed.actorId}`, follower_actor_id: follower.actorId, followed_actor_id: followed.actorId, created_at: now, updated_at: now, deleted_at: null, version: 1} as any).execute()
  }

  async function block(blocker: {actorId: string}, blocked: {actorId: string}) {
    const now = new Date()
    await db.insertInto('blocks').values({id: `b-${blocker.actorId}-${blocked.actorId}`, blocker_actor_id: blocker.actorId, blocked_actor_id: blocked.actorId, created_at: now, updated_at: now, deleted_at: null, version: 1}).execute()
  }

  async function authed(accessToken: string, method: string, url: string, payload?: unknown) {
    return app.inject({method: method as any, url, headers: {authorization: `Bearer ${accessToken}`}, ...(payload === undefined ? {} : {payload})})
  }
})

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitFor(check: () => boolean, timeoutMs = 3000) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition')
    await sleep(10)
  }
}
