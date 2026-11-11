import {createHash} from 'node:crypto'
import net from 'node:net'
import type {AddressInfo} from 'node:net'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

// Minimal ISO-BMFF header with an M4A brand: enough for the attachment
// signature check, not a playable file.
const M4A = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypM4A ', 'latin1'), Buffer.from([0, 0, 0, 0]),
  Buffer.from('M4A isom', 'latin1'), Buffer.alloc(64, 1),
])

describeIfDb('Messaging v3: groups, mentions, voice notes, privacy, receipts, search, presence, realtime', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let runSuffix = ''
  let counter = 0

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4032'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4032'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    delete process.env.MODULA_MESSAGING_MEDIA_ENABLED
    process.env.MODULA_MEDIA_ROOT = `/tmp/modula-messaging-v3-${process.pid}`
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    await app.ready()
    runSuffix = Date.now().toString(36).slice(-6)
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it('requires authentication on every v3 route', async () => {
    const routes: Array<[string, string]> = [
      ['GET', '/v1/messaging/capabilities'], ['GET', '/v1/messaging/privacy'], ['PATCH', '/v1/messaging/privacy'],
      ['POST', '/v1/groups'], ['GET', '/v1/groups/g1'], ['PATCH', '/v1/groups/g1'], ['POST', '/v1/groups/g1/members'],
      ['DELETE', '/v1/groups/g1/members/a1'], ['POST', '/v1/groups/g1/members/a1/role'], ['POST', '/v1/groups/g1/leave'],
      ['GET', '/v1/conversations/c1/messages/m1/reactions'], ['GET', '/v1/conversations/c1/messages/m1/receipts'],
      ['GET', '/v1/messages/search?q=hello'], ['POST', '/v1/presence/heartbeat'], ['GET', '/v1/presence?actorIds=a1'],
    ]
    for (const [method, url] of routes) {
      const res = await app.inject({method: method as any, url, payload: method === 'GET' || method === 'DELETE' ? undefined : {}})
      expect(res.statusCode, `${method} ${url}`).toBe(401)
    }
  })

  it('declares capabilities with photo and video off by default', async () => {
    const u = await user('cap')
    const caps = (await authed(u.accessToken, 'GET', '/v1/messaging/capabilities')).json().data
    expect(caps).toMatchObject({version: 3, groups: true, voiceNotes: true, photoVideo: false, historySearch: true, presence: true})
    expect(caps.realtime.socketPath).toBe('/v1/messaging/socket')
  })

  it('rejects unauthenticated socket upgrades before the handshake and delivers member events', async () => {
    const [a, b, outsider] = [await user('wsa'), await user('wsb'), await user('wsc')]
    await follow(b, a)
    const convo = (await authed(a.accessToken, 'POST', '/v1/conversations', {handle: b.handle})).json().data.conversation
    await app.listen({host: '127.0.0.1', port: 0})
    const {port} = app.server.address() as AddressInfo
    const upgrade = (token?: string) => new Promise<number>((resolve, reject) => {
      const socket = net.connect(port, '127.0.0.1', () => socket.write([
        'GET /v1/messaging/socket HTTP/1.1', `Host: 127.0.0.1:${port}`, 'Connection: Upgrade', 'Upgrade: websocket',
        'Sec-WebSocket-Version: 13', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', ...(token ? [`Authorization: Bearer ${token}`] : []), '', '',
      ].join('\r\n')))
      let data = ''
      socket.on('data', chunk => {
        data += chunk.toString('latin1')
        const match = /^HTTP\/1\.1 (\d{3})/.exec(data)
        if (match) { socket.destroy(); resolve(Number(match[1])) }
      })
      socket.on('error', reject)
      socket.on('close', () => reject(new Error(`closed without status: ${JSON.stringify(data)}`)))
    })
    expect(await upgrade()).toBe(401)
    expect(await upgrade('not-a-real-token')).toBe(401)
    expect(await upgrade(b.accessToken)).toBe(101)

    const open = async (token: string) => {
      const events: any[] = []
      const ws = await (app as any).injectWS('/v1/messaging/socket', {headers: {authorization: `Bearer ${token}`}}, {
        onInit: (socket: any) => socket.on('message', (data: Buffer) => events.push(JSON.parse(data.toString()))),
      })
      return {ws, events}
    }
    const bSock = await open(b.accessToken)
    const outsiderSock = await open(outsider.accessToken)
    await waitFor(() => bSock.events.some(e => e.type === 'hello'))
    const sent = await authed(a.accessToken, 'POST', `/v1/conversations/${convo.id}/messages`, {text: 'realtime hello'})
    expect(sent.statusCode).toBe(201)
    await waitFor(() => bSock.events.some(e => e.type === 'message.created'))
    const created = bSock.events.find(e => e.type === 'message.created')
    expect(created).toMatchObject({conversationId: convo.id, messageId: sent.json().data.message.id, senderId: a.actorId})
    expect(created.body).toBeUndefined()
    await sleep(50)
    expect(outsiderSock.events.some(e => e.type === 'message.created')).toBe(false)
    bSock.ws.send(JSON.stringify({type: 'typing', conversationId: 'not-mine'}))
    await waitFor(() => bSock.events.some(e => e.type === 'error' && e.reason === 'not-found'))
    bSock.ws.terminate()
    outsiderSock.ws.terminate()
  })

  it('creates groups with invites, enforces roles and membership, and respects blocks', async () => {
    const [owner, friend, stranger, outsider, blocker] = [await user('gown'), await user('gfri'), await user('gstr'), await user('gout'), await user('gblk')]
    await follow(friend, owner)
    await block(blocker, owner)
    expect((await authed(owner.accessToken, 'POST', '/v1/groups', {title: 'Nope', handles: [blocker.handle]})).statusCode).toBe(403)
    expect((await authed(owner.accessToken, 'POST', '/v1/groups', {title: '', handles: [friend.handle]})).statusCode).toBe(400)

    const createdRes = await authed(owner.accessToken, 'POST', '/v1/groups', {title: 'Weekend', handles: [friend.handle, stranger.handle]})
    expect(createdRes.statusCode, createdRes.body).toBe(201)
    const group = createdRes.json().data.conversation
    expect(group).toMatchObject({kind: 'group', group: {title: 'Weekend', memberCount: 2, myRole: 'owner'}})

    expect((await authed(outsider.accessToken, 'GET', `/v1/groups/${group.id}`)).statusCode).toBe(404)
    expect((await authed(outsider.accessToken, 'GET', `/v1/conversations/${group.id}/messages`)).statusCode).toBe(404)
    expect((await authed(outsider.accessToken, 'POST', `/v1/conversations/${group.id}/messages`, {text: 'hi'})).statusCode).toBe(404)

    const strangerRequests = (await authed(stranger.accessToken, 'GET', '/v1/message-requests')).json().data.items
    expect(strangerRequests.find((r: any) => r.id === group.id)).toMatchObject({kind: 'group', group: {title: 'Weekend'}})
    expect(strangerRequests.find((r: any) => r.id === group.id).sender.handle).toBe(owner.handle)
    expect((await authed(stranger.accessToken, 'POST', `/v1/conversations/${group.id}/messages`, {text: 'early'})).statusCode).toBe(403)
    expect((await authed(stranger.accessToken, 'POST', `/v1/message-requests/${group.id}/accept`, {})).statusCode).toBe(200)

    const friendInbox = (await authed(friend.accessToken, 'GET', '/v1/conversations')).json().data.items
    expect(friendInbox.find((c: any) => c.id === group.id)).toMatchObject({kind: 'group', group: {memberCount: 3, myRole: 'member'}})

    expect((await authed(friend.accessToken, 'PATCH', `/v1/groups/${group.id}`, {title: 'Mine'})).statusCode).toBe(403)
    expect((await authed(friend.accessToken, 'POST', `/v1/groups/${group.id}/members`, {handles: [outsider.handle]})).statusCode).toBe(403)
    expect((await authed(owner.accessToken, 'POST', `/v1/groups/${group.id}/members/${friend.actorId}/role`, {role: 'admin'})).statusCode).toBe(200)
    const renamed = await authed(friend.accessToken, 'PATCH', `/v1/groups/${group.id}`, {title: 'Weekend trip', description: 'Saturday'})
    expect(renamed.statusCode).toBe(200)
    expect(renamed.json().data.group).toMatchObject({title: 'Weekend trip', description: 'Saturday', myRole: 'admin'})
    expect((await authed(friend.accessToken, 'POST', `/v1/groups/${group.id}/members`, {handles: [blocker.handle]})).statusCode).toBe(200)
    expect((await authed(friend.accessToken, 'DELETE', `/v1/groups/${group.id}/members/${owner.actorId}`)).statusCode).toBe(403)

    // Mentions resolve to active members only and are returned on the message.
    const mention = await authed(owner.accessToken, 'POST', `/v1/conversations/${group.id}/messages`, {text: `hey @${stranger.handle} and @${outsider.handle}`})
    expect(mention.statusCode, mention.body).toBe(201)
    expect(mention.json().data.message.mentions).toEqual([{actorId: stranger.actorId, handle: stranger.handle}])

    // Blocks inside a group: the blocked pair never sees each other's messages.
    await authed(stranger.accessToken, 'POST', `/v1/conversations/${group.id}/messages`, {text: 'from stranger'})
    await block(friend, stranger)
    const friendView = (await authed(friend.accessToken, 'GET', `/v1/conversations/${group.id}/messages`)).json().data.items.map((m: any) => m.body)
    expect(friendView).toContain(`hey @${stranger.handle} and @${outsider.handle}`)
    expect(friendView).not.toContain('from stranger')
    const strangerSearch = (await authed(friend.accessToken, 'GET', `/v1/messages/search?q=${encodeURIComponent('from stranger')}`)).json().data.items
    expect(strangerSearch).toEqual([])

    // Removal and leaving.
    expect((await authed(friend.accessToken, 'DELETE', `/v1/groups/${group.id}/members/${stranger.actorId}`)).statusCode).toBe(200)
    expect((await authed(stranger.accessToken, 'GET', `/v1/conversations/${group.id}/messages`)).statusCode).toBe(404)
    expect((await authed(owner.accessToken, 'POST', `/v1/groups/${group.id}/leave`, {})).statusCode).toBe(200)
    expect((await authed(owner.accessToken, 'GET', `/v1/groups/${group.id}`)).statusCode).toBe(404)
    expect((await authed(friend.accessToken, 'GET', `/v1/groups/${group.id}`)).json().data.group.myRole).toBe('owner')
  })

  it('lists who reacted and seen-by with reciprocal read-receipt privacy', async () => {
    const [owner, b, c, outsider] = [await user('rown'), await user('rb'), await user('rc'), await user('rout')]
    await follow(b, owner)
    await follow(c, owner)
    const group = (await authed(owner.accessToken, 'POST', '/v1/groups', {title: 'Reacts', handles: [b.handle, c.handle]})).json().data.conversation
    const msg = (await authed(owner.accessToken, 'POST', `/v1/conversations/${group.id}/messages`, {text: 'react to me'})).json().data.message
    await authed(b.accessToken, 'PUT', `/v1/conversations/${group.id}/messages/${msg.id}/reactions`, {emoji: '👍'})
    await authed(c.accessToken, 'PUT', `/v1/conversations/${group.id}/messages/${msg.id}/reactions`, {emoji: '👍'})
    const details = (await authed(owner.accessToken, 'GET', `/v1/conversations/${group.id}/messages/${msg.id}/reactions`)).json().data.reactions
    expect(details).toHaveLength(1)
    expect(details[0].count).toBe(2)
    expect(details[0].actors.map((p: any) => p.handle).sort()).toEqual([b.handle, c.handle].sort())
    expect((await authed(outsider.accessToken, 'GET', `/v1/conversations/${group.id}/messages/${msg.id}/reactions`)).statusCode).toBe(404)

    expect((await authed(b.accessToken, 'GET', `/v1/conversations/${group.id}/messages/${msg.id}/receipts`)).statusCode).toBe(403)
    await authed(b.accessToken, 'POST', `/v1/conversations/${group.id}/read`, {})
    let receipts = (await authed(owner.accessToken, 'GET', `/v1/conversations/${group.id}/messages/${msg.id}/receipts`)).json().data
    expect(receipts.readBy.map((r: any) => r.participant.handle)).toEqual([b.handle])
    expect(receipts.notYet.map((p: any) => p.handle)).toEqual([c.handle])

    // c turns receipts off: c is no longer listed and `read` can never show.
    expect((await authed(c.accessToken, 'PATCH', '/v1/messaging/privacy', {readReceipts: false})).statusCode).toBe(200)
    await authed(c.accessToken, 'POST', `/v1/conversations/${group.id}/read`, {})
    receipts = (await authed(owner.accessToken, 'GET', `/v1/conversations/${group.id}/messages/${msg.id}/receipts`)).json().data
    expect(receipts.readBy.map((r: any) => r.participant.handle)).toEqual([b.handle])
    expect(receipts.hiddenCount).toBe(1)
    const ownerThread = (await authed(owner.accessToken, 'GET', `/v1/conversations/${group.id}/messages`)).json().data.items
    expect(ownerThread.find((m: any) => m.id === msg.id).delivery).toBe('sent')

    // Reciprocal: c sees no receipts either.
    const cMsg = (await authed(c.accessToken, 'POST', `/v1/conversations/${group.id}/messages`, {text: 'c says'})).json().data.message
    await authed(owner.accessToken, 'POST', `/v1/conversations/${group.id}/read`, {})
    const cReceipts = (await authed(c.accessToken, 'GET', `/v1/conversations/${group.id}/messages/${cMsg.id}/receipts`)).json().data
    expect(cReceipts).toMatchObject({readBy: [], receiptsDisabled: true})
    expect((await authed(c.accessToken, 'PATCH', '/v1/messaging/privacy', {bogus: true})).statusCode).toBe(400)
    expect((await authed(c.accessToken, 'PATCH', '/v1/messaging/privacy', {readReceipts: true, version: 999})).statusCode).toBe(409)
  })

  it('stops publishing typing when typing indicators are off', async () => {
    const [a, b] = [await user('ta'), await user('tb')]
    await follow(b, a)
    const convo = (await authed(a.accessToken, 'POST', '/v1/conversations', {handle: b.handle})).json().data.conversation
    await authed(a.accessToken, 'POST', `/v1/conversations/${convo.id}/typing`, {})
    expect((await authed(b.accessToken, 'GET', `/v1/conversations/${convo.id}/typing`)).json().data.typing).toHaveLength(1)
    await authed(a.accessToken, 'PATCH', '/v1/messaging/privacy', {typingIndicators: false})
    expect((await authed(b.accessToken, 'GET', `/v1/conversations/${convo.id}/typing`)).json().data.typing).toHaveLength(0)
    const typed = await authed(a.accessToken, 'POST', `/v1/conversations/${convo.id}/typing`, {})
    expect(typed.json().data.published).toBe(false)
    expect((await authed(b.accessToken, 'GET', `/v1/conversations/${convo.id}/typing`)).json().data.typing).toHaveLength(0)
  })

  it('searches the full history of the viewer\'s own conversations only', async () => {
    const [a, b, c] = [await user('sa'), await user('sb'), await user('sc')]
    await follow(b, a)
    await follow(c, b)
    const ab = (await authed(a.accessToken, 'POST', '/v1/conversations', {handle: b.handle})).json().data.conversation
    const bc = (await authed(b.accessToken, 'POST', '/v1/conversations', {handle: c.handle})).json().data.conversation
    const token = `zebra${runSuffix}`
    for (let i = 0; i < 3; i++) await authed(a.accessToken, 'POST', `/v1/conversations/${ab.id}/messages`, {text: `${token} number ${i}`})
    await authed(b.accessToken, 'POST', `/v1/conversations/${bc.id}/messages`, {text: `${token} secret for c`})
    const gone = (await authed(a.accessToken, 'POST', `/v1/conversations/${ab.id}/messages`, {text: `${token} unsent`})).json().data.message
    await authed(a.accessToken, 'DELETE', `/v1/conversations/${ab.id}/messages/${gone.id}`)

    const page1 = (await authed(a.accessToken, 'GET', `/v1/messages/search?q=${token}&limit=2`)).json().data
    expect(page1.items).toHaveLength(2)
    expect(page1.hasMore).toBe(true)
    const page2 = (await authed(a.accessToken, 'GET', `/v1/messages/search?q=${token}&limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`)).json().data
    const all = [...page1.items, ...page2.items]
    expect(all).toHaveLength(3)
    expect(all.every((hit: any) => hit.conversationId === ab.id && hit.isOwn)).toBe(true)
    expect(all.some((hit: any) => hit.snippet.includes('unsent'))).toBe(false)
    const bHits = (await authed(b.accessToken, 'GET', `/v1/messages/search?q=${token}&conversationId=${bc.id}`)).json().data.items
    expect(bHits.map((h: any) => h.snippet)).toEqual([`${token} secret for c`])
    expect((await authed(a.accessToken, 'GET', `/v1/messages/search?q=${token}&conversationId=${bc.id}`)).statusCode).toBe(404)
    expect((await authed(a.accessToken, 'GET', '/v1/messages/search?q=z')).statusCode).toBe(400)
    // LIKE wildcards are literal.
    expect((await authed(a.accessToken, 'GET', '/v1/messages/search?q=%25%25')).json().data.items).toEqual([])
  })

  it('answers presence only for contacts and honours nobody both ways', async () => {
    const [a, b, stranger] = [await user('pa'), await user('pb'), await user('pc')]
    await follow(b, a)
    await authed(a.accessToken, 'POST', '/v1/conversations', {handle: b.handle})
    expect((await authed(b.accessToken, 'POST', '/v1/presence/heartbeat', {})).statusCode).toBe(200)
    await authed(stranger.accessToken, 'POST', '/v1/presence/heartbeat', {})
    let items = (await authed(a.accessToken, 'GET', `/v1/presence?actorIds=${b.actorId},${stranger.actorId}`)).json().data.items
    expect(items.find((p: any) => p.actorId === b.actorId)).toMatchObject({status: 'online'})
    expect(items.find((p: any) => p.actorId === stranger.actorId)).toEqual({actorId: stranger.actorId, status: 'hidden', lastActiveAt: null})
    await authed(b.accessToken, 'PATCH', '/v1/messaging/privacy', {presenceVisibility: 'nobody'})
    items = (await authed(a.accessToken, 'GET', `/v1/presence?actorIds=${b.actorId}`)).json().data.items
    expect(items[0].status).toBe('hidden')
    await authed(a.accessToken, 'POST', '/v1/presence/heartbeat', {})
    items = (await authed(b.accessToken, 'GET', `/v1/presence?actorIds=${a.actorId}`)).json().data.items
    expect(items[0].status).toBe('hidden')
    expect((await authed(a.accessToken, 'GET', '/v1/presence')).statusCode).toBe(400)
  })

  it('sends voice notes through the attachment pipeline with member-only playback', async () => {
    const [a, b, outsider] = [await user('va'), await user('vb'), await user('vc')]
    await follow(b, a)
    const convo = (await authed(a.accessToken, 'POST', '/v1/conversations', {handle: b.handle})).json().data.conversation
    const attachmentId = await uploadAudio(a.accessToken)
    const otherAttachment = await uploadAudio(outsider.accessToken)

    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo.id}/messages`, {kind: 'voice', attachments: [{attachmentId}]})).statusCode).toBe(400)
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo.id}/messages`, {kind: 'voice', attachments: [{attachmentId: otherAttachment, durationMs: 900}]})).statusCode).toBe(404)
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo.id}/messages`, {kind: 'media', attachments: [{attachmentId}]})).statusCode).toBe(403)

    const sent = await authed(a.accessToken, 'POST', `/v1/conversations/${convo.id}/messages`, {kind: 'voice', attachments: [{attachmentId, durationMs: 4200, waveform: [0.1, 0.5, 0.9]}]})
    expect(sent.statusCode, sent.body).toBe(201)
    const message = sent.json().data.message
    expect(message).toMatchObject({kind: 'voice', body: ''})
    expect(message.attachments[0]).toMatchObject({id: attachmentId, kind: 'audio', mimeType: 'audio/mp4', durationMs: 4200, waveform: [0.1, 0.5, 0.9]})
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo.id}/messages`, {kind: 'voice', attachments: [{attachmentId, durationMs: 10}]})).statusCode).toBe(409)

    const thread = (await authed(b.accessToken, 'GET', `/v1/conversations/${convo.id}/messages`)).json().data.items
    expect(thread.at(-1)).toMatchObject({kind: 'voice', attachments: [{id: attachmentId}]})
    const inbox = (await authed(b.accessToken, 'GET', '/v1/conversations')).json().data.items
    expect(inbox.find((c: any) => c.id === convo.id).lastMessage.kind).toBe('voice')
    expect((await authed(b.accessToken, 'GET', `/v1/attachments/${attachmentId}/content`)).statusCode).toBe(200)
    expect((await authed(outsider.accessToken, 'GET', `/v1/attachments/${attachmentId}/content`)).statusCode).toBe(403)
    expect((await app.inject({method: 'GET', url: `/v1/attachments/${attachmentId}/content`})).statusCode).toBe(403)

    await authed(a.accessToken, 'DELETE', `/v1/conversations/${convo.id}/messages/${message.id}`)
    expect((await authed(b.accessToken, 'GET', `/v1/attachments/${attachmentId}/content`)).statusCode).toBe(403)
  })

  it('makes sends idempotent with clientMessageId', async () => {
    const [a, b] = [await user('ia'), await user('ib')]
    await follow(b, a)
    const convo = (await authed(a.accessToken, 'POST', '/v1/conversations', {handle: b.handle})).json().data.conversation
    const payload = {text: 'only once', clientMessageId: `notif-${runSuffix}-1`}
    const results = await Promise.all([1, 2, 3].map(() => authed(a.accessToken, 'POST', `/v1/conversations/${convo.id}/messages`, payload)))
    expect(results.map(r => r.statusCode).sort()).toEqual([200, 200, 201])
    expect(new Set(results.map(r => r.json().data.message.id)).size).toBe(1)
    const rows = await db.selectFrom('greenfield_conversation_messages').select('message_id').where('conversation_id', '=', convo.id).execute()
    expect(rows).toHaveLength(1)
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo.id}/messages`, {text: 'x', clientMessageId: 'bad id!'})).statusCode).toBe(400)
  })

  it('applies notification preview preferences, mutes, mentions and blocks to pushes', async () => {
    const [owner, full, hidden, muted] = [await user('nown'), await user('nful'), await user('nhid'), await user('nmut')]
    for (const member of [full, hidden, muted]) {
      await follow(member, owner)
      await registerDevice(member)
    }
    await authed(hidden.accessToken, 'PATCH', '/v1/messaging/privacy', {notificationPreview: 'none'})
    const group = (await authed(owner.accessToken, 'POST', '/v1/groups', {title: 'Pushes', handles: [full.handle, hidden.handle, muted.handle]})).json().data.conversation
    await authed(muted.accessToken, 'POST', `/v1/conversations/${group.id}/mute`, {muted: true})
    await authed(owner.accessToken, 'POST', `/v1/conversations/${group.id}/messages`, {text: 'secret plans'})
    await authed(owner.accessToken, 'POST', `/v1/conversations/${group.id}/messages`, {text: `@${muted.handle} you too`})
    const deliveries = await db.selectFrom('push_deliveries').select(['recipient_actor_id', 'title', 'body', 'data'])
      .where('thread_id', '=', `messages:${group.id}`).orderBy('created_at').execute()
    const forFull = deliveries.filter(d => d.recipient_actor_id === full.actorId)
    expect(forFull[0]).toMatchObject({title: 'Pushes'})
    expect(forFull[0]!.body).toContain('secret plans')
    const forHidden = deliveries.filter(d => d.recipient_actor_id === hidden.actorId)
    expect(forHidden.every(d => d.title === 'Modula' && !d.body.includes('secret'))).toBe(true)
    const forMuted = deliveries.filter(d => d.recipient_actor_id === muted.actorId)
    expect(forMuted).toHaveLength(1)
    expect(forMuted[0]!.data).toMatchObject({type: 'mention', conversationId: group.id})
  })

  // ---- helpers ---------------------------------------------------------

  async function user(prefix: string) {
    counter += 1
    const handle = `${prefix}${runSuffix}${counter}`.slice(0, 20)
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.com`
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
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

  async function registerDevice(member: {accountId: string; actorId: string}) {
    const now = new Date()
    await db.insertInto('push_device_tokens').values({
      id: `dev-${member.actorId}`, account_id: member.accountId, actor_id: member.actorId, token: createHash('sha256').update(member.actorId).digest('hex'),
      platform: 'ios', environment: 'development', bundle_id: 'digital.modula.app.native', app_version: null, device_name: null, locale: null, timezone: null,
      created_at: now, updated_at: now, last_seen_at: now, disabled_at: null, disabled_reason: null,
    } as any).execute()
  }

  async function uploadAudio(accessToken: string): Promise<string> {
    const created = await authed(accessToken, 'POST', '/v1/attachments/uploads', {filename: 'voice.m4a', mimeType: 'audio/mp4', size: M4A.length})
    expect(created.statusCode, created.body).toBe(201)
    const session = created.json().data
    const uploaded = await app.inject({
      method: 'PUT', url: `/v1/attachments/uploads/${session.uploadId}/content`,
      headers: {authorization: `Bearer ${accessToken}`, 'content-type': 'application/octet-stream'}, payload: M4A,
    })
    expect(uploaded.statusCode, uploaded.body).toBe(200)
    return session.attachmentId
  }

  async function authed(accessToken: string, method: string, url: string, payload?: unknown) {
    return app.inject({method: method as any, url, headers: {authorization: `Bearer ${accessToken}`}, ...(payload === undefined ? {} : {payload})})
  }
})

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitFor(check: () => boolean, timeoutMs = 2000) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition')
    await sleep(10)
  }
}
