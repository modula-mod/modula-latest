import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {MessagingFeaturesService} from '../src/domains/messaging/features4.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

const FLAGS = [
  'MODULA_MESSAGING_PINNED_MESSAGES_ENABLED', 'MODULA_MESSAGING_SAVED_MESSAGES_ENABLED', 'MODULA_MESSAGING_EDIT_HISTORY_ENABLED',
  'MODULA_MESSAGING_SCHEDULED_MESSAGES_ENABLED', 'MODULA_MESSAGING_DISAPPEARING_MESSAGES_ENABLED', 'MODULA_MESSAGING_CHAT_FOLDERS_ENABLED',
  'MODULA_MESSAGING_CHAT_PINS_ENABLED', 'MODULA_MESSAGING_NOTIFICATION_LEVELS_ENABLED', 'MODULA_MESSAGING_QUICK_REPLIES_ENABLED',
  'MODULA_MESSAGING_FORWARDING_ENABLED', 'MODULA_MESSAGING_CHAT_THEMES_ENABLED',
]

function setEnv() {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4034'
  process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4034'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
  process.env.MODULA_INVITE_ONLY = 'true'
  process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
  process.env.MODULA_ATPROTO_ENABLED = 'false'
  process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
  process.env.MODULA_MESSAGING_SCHEDULER_INTERVAL_MS = '0'
  process.env.MODULA_MEDIA_ROOT = `/tmp/modula-features4-${process.pid}`
}

type User = {accountId: string; actorId: string; handle: string; accessToken: string}

describeIfDb('Messaging features 4', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let runSuffix = ''
  let counter = 0
  const hooks = () => (app as any).messagingFeatureHooks as {runScheduledOnce: (id?: string) => Promise<number>; sweepExpiredOnce: () => Promise<number>}

  beforeAll(async () => {
    setEnv()
    // Features are off by default; this suite exercises them switched on (exactly 'true').
    for (const flag of FLAGS) process.env[flag] = 'true'
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
      ['POST', '/v1/conversations/c1/messages/m1/pin'], ['DELETE', '/v1/conversations/c1/messages/m1/pin'], ['GET', '/v1/conversations/c1/pins'],
      ['PUT', '/v1/conversations/c1/messages/m1/saved'], ['DELETE', '/v1/conversations/c1/messages/m1/saved'], ['GET', '/v1/messages/saved'],
      ['GET', '/v1/conversations/c1/messages/m1/edits'],
      ['POST', '/v1/conversations/c1/scheduled'], ['GET', '/v1/conversations/c1/scheduled'], ['GET', '/v1/messages/scheduled'],
      ['PATCH', '/v1/conversations/c1/scheduled/s1'], ['DELETE', '/v1/conversations/c1/scheduled/s1'], ['POST', '/v1/conversations/c1/scheduled/s1/send-now'],
      ['POST', '/v1/conversations/c1/disappearing'], ['POST', '/v1/conversations/c1/theme'],
      ['POST', '/v1/conversations/c1/pin'], ['POST', '/v1/conversations/c1/notifications'],
      ['GET', '/v1/messaging/folders'], ['POST', '/v1/messaging/folders'], ['PATCH', '/v1/messaging/folders/f1'], ['DELETE', '/v1/messaging/folders/f1'],
      ['GET', '/v1/messaging/quick-replies'], ['POST', '/v1/messaging/quick-replies'], ['PATCH', '/v1/messaging/quick-replies/q1'], ['DELETE', '/v1/messaging/quick-replies/q1'],
      ['POST', '/v1/conversations/c1/messages/m1/forward'],
    ]
    for (const [method, url] of routes) {
      const res = await app.inject({method: method as any, url, payload: method === 'GET' || method === 'DELETE' ? undefined : {}})
      expect(res.statusCode, `${method} ${url}`).toBe(401)
    }
  })

  it('advertises every feature in the capabilities', async () => {
    const u = await user('cap')
    const caps = (await authed(u.accessToken, 'GET', '/v1/messaging/capabilities')).json().data
    expect(caps.version).toBe(3)
    expect(caps).toMatchObject({
      pinnedMessages: {enabled: true, max: 10, groupAdminsOnly: true},
      savedMessages: {enabled: true},
      editHistory: {enabled: true},
      scheduledMessages: {enabled: true, minLeadSeconds: 10, maxLeadDays: 365, maxPending: 50},
      disappearingMessages: {enabled: true, ttlOptionsSeconds: [3600, 86400, 604800, 7776000]},
      chatFolders: {enabled: true, maxFolders: 20, maxChatsPerFolder: 200},
      chatPins: {enabled: true, max: 10},
      notificationLevels: {enabled: true, levels: ['all', 'mentions', 'none']},
      quickReplies: {enabled: true, max: 50},
      forwarding: {enabled: true, maxTargets: 5, kinds: ['text']},
      chatThemes: {enabled: true},
    })
    expect(caps.chatThemes.themes).toContain('ocean')
  })

  it('pins messages per chat with limits, roles and events', async () => {
    const {a, b, convo} = await dm('pin')
    const outsider = await user('pino')
    const m1 = await send(a, convo, 'pin me')
    const bSock = await openSocket(b.accessToken)
    await waitFor(() => bSock.events.some(e => e.type === 'hello'))

    const pinned = await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/messages/${m1}/pin`)
    expect(pinned.statusCode, pinned.body).toBe(200)
    expect(pinned.json().data).toEqual({messageId: m1, pinned: true, changed: true})
    expect((await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/messages/${m1}/pin`)).json().data.changed).toBe(false)
    await waitFor(() => bSock.events.some(e => e.type === 'message.pinned'))
    expect(bSock.events.find(e => e.type === 'message.pinned')).toMatchObject({conversationId: convo, messageId: m1, pinned: true, actorId: b.actorId})

    const pins = (await authed(a.accessToken, 'GET', `/v1/conversations/${convo}/pins`)).json().data.items
    expect(pins).toHaveLength(1)
    expect(pins[0]).toMatchObject({messageId: m1, pinnedBy: {id: b.actorId}, message: {id: m1, body: 'pin me'}})

    expect((await authed(outsider.accessToken, 'GET', `/v1/conversations/${convo}/pins`)).statusCode).toBe(404)
    expect((await authed(outsider.accessToken, 'POST', `/v1/conversations/${convo}/messages/${m1}/pin`)).statusCode).toBe(404)
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/messages/nope/pin`)).statusCode).toBe(404)

    for (let i = 0; i < 9; i += 1) {
      const id = await send(a, convo, `extra ${i}`)
      expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/messages/${id}/pin`)).statusCode).toBe(200)
    }
    const overflow = await send(a, convo, 'one too many')
    const limit = await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/messages/${overflow}/pin`)
    expect(limit.statusCode).toBe(409)
    expect(limit.json().error.details?.reason).toBe('pin-limit')

    // Unsend removes the pin.
    expect((await authed(a.accessToken, 'DELETE', `/v1/conversations/${convo}/messages/${m1}`)).statusCode).toBe(200)
    expect((await authed(a.accessToken, 'GET', `/v1/conversations/${convo}/pins`)).json().data.items.map((p: any) => p.messageId)).not.toContain(m1)
    const unpinned = await authed(a.accessToken, 'DELETE', `/v1/conversations/${convo}/messages/${overflow}/pin`)
    expect(unpinned.json().data).toMatchObject({pinned: false, changed: false})
    bSock.ws.terminate()

    // Groups: only owner/admin may pin.
    const [owner, friend] = [await user('gpo'), await user('gpf')]
    await follow(friend, owner)
    const group = (await authed(owner.accessToken, 'POST', '/v1/groups', {title: 'Pins', handles: [friend.handle]})).json().data.conversation
    const gm = await send(owner, group.id, 'group note')
    const denied = await authed(friend.accessToken, 'POST', `/v1/conversations/${group.id}/messages/${gm}/pin`)
    expect(denied.statusCode).toBe(403)
    expect(denied.json().error.details?.reason).toBe('admin-required')
    expect((await authed(owner.accessToken, 'POST', `/v1/conversations/${group.id}/messages/${gm}/pin`)).statusCode).toBe(200)
  })

  it('syncs saved messages and hides ones the viewer can no longer see', async () => {
    const {a, b, convo} = await dm('sav')
    const m1 = await send(a, convo, 'keep this')
    const m2 = await send(b, convo, 'and this')
    const aSock = await openSocket(a.accessToken)
    await waitFor(() => aSock.events.some(e => e.type === 'hello'))
    const saved = await authed(a.accessToken, 'PUT', `/v1/conversations/${convo}/messages/${m1}/saved`)
    expect(saved.statusCode, saved.body).toBe(200)
    expect(saved.json().data).toEqual({messageId: m1, saved: true, changed: true})
    await waitFor(() => aSock.events.some(e => e.type === 'message.saved'))
    expect((await authed(a.accessToken, 'PUT', `/v1/conversations/${convo}/messages/${m1}/saved`)).json().data.changed).toBe(false)
    await authed(a.accessToken, 'PUT', `/v1/conversations/${convo}/messages/${m2}/saved`)

    const page1 = (await authed(a.accessToken, 'GET', '/v1/messages/saved?limit=1')).json().data
    expect(page1.items).toHaveLength(1)
    expect(page1.hasMore).toBe(true)
    const page2 = (await authed(a.accessToken, 'GET', `/v1/messages/saved?limit=1&cursor=${page1.nextCursor}`)).json().data
    expect(new Set([page1.items[0].messageId, page2.items[0].messageId])).toEqual(new Set([m1, m2]))
    // Saves are private to the saver.
    expect((await authed(b.accessToken, 'GET', '/v1/messages/saved')).json().data.items).toHaveLength(0)

    // Blocking the other sender hides their saved message.
    await block(a, b)
    const afterBlock = (await authed(a.accessToken, 'GET', '/v1/messages/saved')).json().data.items.map((i: any) => i.messageId)
    expect(afterBlock).toEqual([m1])
    expect((await authed(a.accessToken, 'DELETE', `/v1/conversations/${convo}/messages/${m1}/saved`)).json().data).toMatchObject({saved: false, changed: true})
    expect((await authed(a.accessToken, 'GET', '/v1/messages/saved')).json().data.items).toHaveLength(0)
    const outsider = await user('savo')
    expect((await authed(outsider.accessToken, 'PUT', `/v1/conversations/${convo}/messages/${m1}/saved`)).statusCode).toBe(404)
    aSock.ws.terminate()
  })

  it('keeps an edit history visible to members only', async () => {
    const {a, b, convo} = await dm('edh')
    const m1 = await send(a, convo, 'first')
    await authed(a.accessToken, 'PATCH', `/v1/conversations/${convo}/messages/${m1}`, {text: 'second'})
    await authed(a.accessToken, 'PATCH', `/v1/conversations/${convo}/messages/${m1}`, {text: 'third'})
    const res = await authed(b.accessToken, 'GET', `/v1/conversations/${convo}/messages/${m1}/edits`)
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().data).toMatchObject({messageId: m1, current: {text: 'third'}, versions: [{text: 'first'}, {text: 'second'}]})
    expect(typeof res.json().data.current.editedAt).toBe('string')
    const outsider = await user('edo')
    expect((await authed(outsider.accessToken, 'GET', `/v1/conversations/${convo}/messages/${m1}/edits`)).statusCode).toBe(404)
    // Unsend wipes the history.
    await authed(a.accessToken, 'DELETE', `/v1/conversations/${convo}/messages/${m1}`)
    expect((await authed(b.accessToken, 'GET', `/v1/conversations/${convo}/messages/${m1}/edits`)).statusCode).toBe(404)
    expect(await db.selectFrom('greenfield_message_edits').select('edit_id').where('message_id', '=', m1).execute()).toHaveLength(0)
  })

  it('schedules, edits, cancels and dispatches messages idempotently', async () => {
    const {a, b, convo} = await dm('sch')
    const soon = () => new Date(Date.now() + 60_000).toISOString()
    for (const sendAt of [new Date(Date.now() + 1000).toISOString(), new Date(Date.now() + 400 * 86_400_000).toISOString(), 'nope']) {
      expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/scheduled`, {text: 'x', sendAt})).statusCode, sendAt).toBe(400)
    }
    const tooSoon = await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/scheduled`, {text: 'x', sendAt: new Date(Date.now() + 1000).toISOString()})
    expect(tooSoon.json().error.details?.reason).toBe('too-soon')

    const created = await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/scheduled`, {text: 'later', sendAt: soon()})
    expect(created.statusCode, created.body).toBe(201)
    const sched = created.json().data.scheduled
    expect(sched).toMatchObject({conversationId: convo, text: 'later', state: 'pending', sentMessageId: null})
    expect((await authed(b.accessToken, 'GET', `/v1/conversations/${convo}/scheduled`)).json().data.items).toHaveLength(0)
    expect((await authed(a.accessToken, 'GET', '/v1/messages/scheduled')).json().data.items.map((s: any) => s.id)).toContain(sched.id)
    expect((await authed(b.accessToken, 'PATCH', `/v1/conversations/${convo}/scheduled/${sched.id}`, {text: 'hijack'})).statusCode).toBe(404)
    const edited = await authed(a.accessToken, 'PATCH', `/v1/conversations/${convo}/scheduled/${sched.id}`, {text: 'later, edited'})
    expect(edited.json().data.scheduled.text).toBe('later, edited')

    // Not yet due: the dispatcher sends nothing; the message is invisible to the recipient.
    await hooks().runScheduledOnce()
    expect((await messages(b, convo)).map(m => m.body)).not.toContain('later, edited')

    const bSock = await openSocket(b.accessToken)
    const aSock = await openSocket(a.accessToken)
    await waitFor(() => bSock.events.some(e => e.type === 'hello') && aSock.events.some(e => e.type === 'hello'))
    const now = await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/scheduled/${sched.id}/send-now`)
    expect(now.statusCode, now.body).toBe(200)
    expect(now.json().data.scheduled).toMatchObject({state: 'sent'})
    const sentId = now.json().data.scheduled.sentMessageId
    expect((await messages(b, convo)).find(m => m.id === sentId)).toMatchObject({body: 'later, edited', sender: {id: a.actorId}})
    await waitFor(() => bSock.events.some(e => e.type === 'message.created' && e.messageId === sentId))
    await waitFor(() => aSock.events.some(e => e.type === 'scheduled.updated' && e.state === 'sent'))
    const cancelSent = await authed(a.accessToken, 'DELETE', `/v1/conversations/${convo}/scheduled/${sched.id}`)
    expect(cancelSent.statusCode).toBe(409)

    // Redelivery after a crash mid-send reuses the same clientMessageId (no duplicate).
    await db.updateTable('greenfield_scheduled_messages').set({state: 'sending', updated_at: new Date(Date.now() - 10 * 60_000)}).where('scheduled_id', '=', sched.id).execute()
    await hooks().runScheduledOnce()
    expect((await messages(b, convo)).filter(m => m.body === 'later, edited')).toHaveLength(1)
    expect((await db.selectFrom('greenfield_scheduled_messages').select(['state', 'sent_message_id']).where('scheduled_id', '=', sched.id).executeTakeFirstOrThrow())).toEqual({state: 'sent', sent_message_id: sentId})

    // Cancel.
    const second = (await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/scheduled`, {text: 'never', sendAt: soon()})).json().data.scheduled
    expect((await authed(a.accessToken, 'DELETE', `/v1/conversations/${convo}/scheduled/${second.id}`)).json().data.scheduled.state).toBe('cancelled')

    // A block between scheduling and sending fails the send.
    const third = (await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/scheduled`, {text: 'blocked later', sendAt: soon()})).json().data.scheduled
    await block(b, a)
    await db.updateTable('greenfield_scheduled_messages').set({send_at: new Date(Date.now() - 1000)}).where('scheduled_id', '=', third.id).execute()
    await hooks().runScheduledOnce()
    const failed = (await authed(a.accessToken, 'GET', '/v1/messages/scheduled')).json().data.items.find((s: any) => s.id === third.id)
    expect(failed).toMatchObject({state: 'failed'})
    expect(failed.failureReason).toBeTruthy()
    const outsider = await user('scho')
    expect((await authed(outsider.accessToken, 'POST', `/v1/conversations/${convo}/scheduled`, {text: 'x', sendAt: soon()})).statusCode).toBe(404)
    aSock.ws.terminate()
    bSock.ws.terminate()
  })

  it('scopes scheduled PATCH, DELETE and send-now to the conversation in the path (404 across conversations)', async () => {
    const {a, convo: ab} = await dm('scx')
    const c = await user('scxc')
    await follow(c, a)
    const opened = await authed(a.accessToken, 'POST', '/v1/conversations', {handle: c.handle, text: 'hello c'})
    expect(opened.statusCode, opened.body).toBeLessThan(300)
    const ac = opened.json().data.conversation.id as string
    expect(ac).not.toBe(ab)
    const sendAt = new Date(Date.now() + 60_000).toISOString()
    const sched = (await authed(a.accessToken, 'POST', `/v1/conversations/${ab}/scheduled`, {text: 'for b only', sendAt})).json().data.scheduled
    expect(sched.conversationId).toBe(ab)

    // Same sender, real scheduled id, but a different conversation of theirs in the path.
    for (const [method, url, payload] of [
      ['PATCH', `/v1/conversations/${ac}/scheduled/${sched.id}`, {text: 'moved?'}],
      ['DELETE', `/v1/conversations/${ac}/scheduled/${sched.id}`, undefined],
      ['POST', `/v1/conversations/${ac}/scheduled/${sched.id}/send-now`, undefined],
      ['PATCH', `/v1/conversations/does-not-exist/scheduled/${sched.id}`, {text: 'moved?'}],
      ['DELETE', `/v1/conversations/does-not-exist/scheduled/${sched.id}`, undefined],
    ] as const) {
      const res = await authed(a.accessToken, method, url, payload)
      expect(res.statusCode, `${method} ${url}`).toBe(404)
      expect(res.json(), `${method} ${url}`).toMatchObject({error: {code: 'NOT_FOUND'}})
    }
    const untouched = await db.selectFrom('greenfield_scheduled_messages').select(['conversation_id', 'body', 'state', 'sent_message_id'])
      .where('scheduled_id', '=', sched.id).executeTakeFirstOrThrow()
    expect(untouched).toEqual({conversation_id: ab, body: 'for b only', state: 'pending', sent_message_id: null})

    // The matching conversation still works.
    const edited = await authed(a.accessToken, 'PATCH', `/v1/conversations/${ab}/scheduled/${sched.id}`, {text: 'for b, edited'})
    expect(edited.statusCode, edited.body).toBe(200)
    expect(edited.json().data.scheduled).toMatchObject({id: sched.id, conversationId: ab, text: 'for b, edited'})
    const cancelled = await authed(a.accessToken, 'DELETE', `/v1/conversations/${ab}/scheduled/${sched.id}`)
    expect(cancelled.statusCode, cancelled.body).toBe(200)
    expect(cancelled.json().data.scheduled.state).toBe('cancelled')
  })

  it('expires disappearing messages and wipes them server-side', async () => {
    const {a, b, convo} = await dm('dis')
    const before = await send(a, convo, 'stays')
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/disappearing`, {ttlSeconds: 42})).statusCode).toBe(400)
    const set = await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/disappearing`, {ttlSeconds: 3600})
    expect(set.statusCode, set.body).toBe(200)
    expect(set.json().data).toEqual({ttlSeconds: 3600})
    const list = (await authed(a.accessToken, 'GET', '/v1/conversations')).json().data.items.find((c: any) => c.id === convo)
    expect(list.disappearingTtlSeconds).toBe(3600)

    const sent = (await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/messages`, {text: 'vanishing'})).json().data.message
    expect(Date.parse(sent.expiresAt) - Date.now()).toBeGreaterThan(3500_000)
    await authed(b.accessToken, 'PUT', `/v1/conversations/${convo}/messages/${sent.id}/saved`)
    await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/messages/${sent.id}/pin`)

    // Force expiry; the message disappears from reads immediately, then the sweeper wipes it.
    await db.updateTable('greenfield_conversation_messages').set({expires_at: new Date(Date.now() - 1000)}).where('message_id', '=', sent.id).execute()
    expect((await messages(b, convo)).map(m => m.id)).not.toContain(sent.id)
    expect((await messages(b, convo)).map(m => m.id)).toContain(before)
    expect((await authed(b.accessToken, 'GET', '/v1/messages/saved')).json().data.items).toHaveLength(0)
    const bSock = await openSocket(b.accessToken)
    await waitFor(() => bSock.events.some(e => e.type === 'hello'))
    expect(await hooks().sweepExpiredOnce()).toBeGreaterThanOrEqual(1)
    await waitFor(() => bSock.events.some(e => e.type === 'message.expired' && e.messageIds.includes(sent.id)))
    const row = await db.selectFrom('greenfield_conversation_messages').select(['body', 'deleted_at']).where('message_id', '=', sent.id).executeTakeFirstOrThrow()
    expect(row.body).not.toContain('vanishing')
    expect(row.deleted_at).not.toBeNull()
    expect(await db.selectFrom('greenfield_saved_messages').select('message_id').where('message_id', '=', sent.id).execute()).toHaveLength(0)
    expect(await db.selectFrom('greenfield_message_pins').select('message_id').where('message_id', '=', sent.id).execute()).toHaveLength(0)

    const off = await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/disappearing`, {ttlSeconds: null})
    expect(off.json().data).toEqual({ttlSeconds: null})
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/messages`, {text: 'permanent'})).json().data.message.expiresAt).toBeUndefined()
    bSock.ws.terminate()
  })

  it('syncs chat pins, notification levels and folders per user', async () => {
    const {a, b, convo} = await dm('per')
    const other = await dm('per2')
    const pinned = await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/pin`, {pinned: true})
    expect(pinned.statusCode, pinned.body).toBe(200)
    expect(pinned.json().data.pinned).toBe(true)
    const mine = (await authed(a.accessToken, 'GET', '/v1/conversations')).json().data.items.find((c: any) => c.id === convo)
    expect(mine).toMatchObject({pinned: true, notificationLevel: 'all', theme: null})
    expect((await authed(b.accessToken, 'GET', '/v1/conversations')).json().data.items.find((c: any) => c.id === convo).pinned).toBe(false)
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/pin`, {pinned: false})).json().data).toEqual({pinned: false, pinnedAt: null})

    expect((await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/notifications`, {level: 'loud'})).statusCode).toBe(400)
    expect((await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/notifications`, {level: 'none'})).json().data).toEqual({level: 'none'})
    const service = new MessagingFeaturesService(db)
    const silent = (await messages(a, convo)).at(0)
    expect(await service.pushPlan(convo, a.actorId, silent, [])).toHaveLength(0)
    expect(await service.pushPlan(convo, a.actorId, silent, [b.actorId])).toHaveLength(0)
    await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/notifications`, {level: 'mentions'})
    expect(await service.pushPlan(convo, a.actorId, silent, [])).toHaveLength(0)
    expect((await service.pushPlan(convo, a.actorId, silent, [b.actorId])).map(p => p.recipientActorId)).toEqual([b.actorId])
    await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/notifications`, {level: 'all'})
    expect((await service.pushPlan(convo, a.actorId, silent, [])).map(p => p.recipientActorId)).toEqual([b.actorId])
    expect((await authed(b.accessToken, 'GET', '/v1/conversations')).json().data.items.find((c: any) => c.id === convo).notificationLevel).toBe('all')

    const outsider = await user('pero')
    expect((await authed(outsider.accessToken, 'POST', `/v1/conversations/${convo}/pin`, {pinned: true})).statusCode).toBe(404)

    // Folders.
    const bad = await authed(a.accessToken, 'POST', '/v1/messaging/folders', {name: 'Work', conversationIds: [other.convo]})
    expect(bad.statusCode).toBe(400)
    expect(bad.json().error.details?.reason).toBe('not-member')
    const folder = await authed(a.accessToken, 'POST', '/v1/messaging/folders', {name: 'Friends', emoji: '🫶', conversationIds: [convo]})
    expect(folder.statusCode, folder.body).toBe(201)
    const f = folder.json().data.folder
    expect(f).toMatchObject({name: 'Friends', emoji: '🫶', conversationIds: [convo], sortOrder: 0})
    const renamed = await authed(a.accessToken, 'PATCH', `/v1/messaging/folders/${f.id}`, {name: 'Besties', conversationIds: []})
    expect(renamed.json().data.folder).toMatchObject({name: 'Besties', conversationIds: []})
    expect((await authed(b.accessToken, 'PATCH', `/v1/messaging/folders/${f.id}`, {name: 'x'})).statusCode).toBe(404)
    expect((await authed(b.accessToken, 'GET', '/v1/messaging/folders')).json().data.items).toHaveLength(0)
    expect((await authed(a.accessToken, 'POST', '/v1/messaging/folders', {name: ''})).statusCode).toBe(400)
    expect((await authed(a.accessToken, 'DELETE', `/v1/messaging/folders/${f.id}`)).json().data).toEqual({deleted: true})
    expect((await authed(a.accessToken, 'GET', '/v1/messaging/folders')).json().data.items).toHaveLength(0)
  })

  it('manages quick replies with unique shortcuts', async () => {
    const u = await user('qr')
    const created = await authed(u.accessToken, 'POST', '/v1/messaging/quick-replies', {shortcut: 'OMW', text: 'On my way!'})
    expect(created.statusCode, created.body).toBe(201)
    const q = created.json().data.quickReply
    expect(q).toMatchObject({shortcut: 'omw', text: 'On my way!'})
    const dup = await authed(u.accessToken, 'POST', '/v1/messaging/quick-replies', {shortcut: 'omw', text: 'again'})
    expect(dup.statusCode).toBe(409)
    expect(dup.json().error.details?.reason).toBe('shortcut-taken')
    expect((await authed(u.accessToken, 'POST', '/v1/messaging/quick-replies', {shortcut: 'has space', text: 'x'})).statusCode).toBe(400)
    expect((await authed(u.accessToken, 'PATCH', `/v1/messaging/quick-replies/${q.id}`, {text: 'Almost there'})).json().data.quickReply.text).toBe('Almost there')
    const other = await user('qr2')
    expect((await authed(other.accessToken, 'GET', '/v1/messaging/quick-replies')).json().data.items).toHaveLength(0)
    expect((await authed(other.accessToken, 'DELETE', `/v1/messaging/quick-replies/${q.id}`)).statusCode).toBe(404)
    expect((await authed(u.accessToken, 'GET', '/v1/messaging/quick-replies')).json().data.items).toHaveLength(1)
    expect((await authed(u.accessToken, 'DELETE', `/v1/messaging/quick-replies/${q.id}`)).json().data).toEqual({deleted: true})
  })

  it('forwards text with attribution and respects blocks', async () => {
    const {a, b, convo} = await dm('fwa')
    const c = await user('fwc')
    await follow(c, b)
    const bc = (await authed(b.accessToken, 'POST', '/v1/conversations', {handle: c.handle, text: 'hey'})).json().data.conversation.id
    await authed(c.accessToken, 'POST', `/v1/conversations/${bc}/read`)
    const original = await send(a, convo, 'worth sharing')

    const res = await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/messages/${original}/forward`, {conversationIds: [bc, 'not-a-chat']})
    expect(res.statusCode, res.body).toBe(200)
    const results = res.json().data.results
    expect(results[0]).toMatchObject({conversationId: bc, ok: true, message: {body: 'worth sharing', forwardedFrom: {sender: {id: a.actorId}}}})
    expect(results[1]).toMatchObject({conversationId: 'not-a-chat', ok: false, error: {code: 'NOT_FOUND'}})
    const seen = (await messages(c, bc)).find(m => m.id === results[0].message.id)
    expect(seen.forwardedFrom.sender.id).toBe(a.actorId)
    expect(typeof seen.forwardedFrom.sentAt).toBe('string')

    // Forwarding a forward keeps the original author.
    const cBack = await authed(c.accessToken, 'POST', `/v1/conversations/${bc}/messages/${seen.id}/forward`, {conversationIds: [bc]})
    expect(cBack.json().data.results[0].message.forwardedFrom.sender.id).toBe(a.actorId)

    // c blocks a: attribution is hidden from c.
    await block(c, a)
    expect((await messages(c, bc)).find(m => m.id === seen.id).forwardedFrom).toMatchObject({sender: null})

    expect((await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/messages/${original}/forward`, {conversationIds: []})).statusCode).toBe(400)
    expect((await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/messages/${original}/forward`, {conversationIds: ['1', '2', '3', '4', '5', '6']})).statusCode).toBe(400)
    expect((await authed(c.accessToken, 'POST', `/v1/conversations/${convo}/messages/${original}/forward`, {conversationIds: [bc]})).statusCode).toBe(404)
    // A forwarder who blocked the original author cannot forward.
    await block(b, a)
    const blocked = await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/messages/${original}/forward`, {conversationIds: [bc]})
    expect(blocked.statusCode).toBe(403)
    expect(blocked.json().error.details?.reason).toBe('blocked')
  })

  it('sets shared chat themes with group admin rules', async () => {
    const {a, b, convo} = await dm('thm')
    const bSock = await openSocket(b.accessToken)
    await waitFor(() => bSock.events.some(e => e.type === 'hello'))
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/theme`, {theme: 'neon-pink-xx'})).statusCode).toBe(400)
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/theme`, {theme: 'ocean'})).json().data).toEqual({theme: 'ocean'})
    await waitFor(() => bSock.events.some(e => e.type === 'conversation.updated' && e.reason === 'theme'))
    expect((await authed(b.accessToken, 'GET', '/v1/conversations')).json().data.items.find((c: any) => c.id === convo).theme).toBe('ocean')
    expect((await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/theme`, {theme: 'default'})).json().data).toEqual({theme: null})
    bSock.ws.terminate()

    const [owner, friend] = [await user('tho'), await user('thf')]
    await follow(friend, owner)
    const group = (await authed(owner.accessToken, 'POST', '/v1/groups', {title: 'Themes', handles: [friend.handle]})).json().data.conversation
    expect((await authed(friend.accessToken, 'POST', `/v1/conversations/${group.id}/theme`, {theme: 'forest'})).statusCode).toBe(403)
    expect((await authed(friend.accessToken, 'POST', `/v1/conversations/${group.id}/disappearing`, {ttlSeconds: 3600})).statusCode).toBe(403)
    expect((await authed(owner.accessToken, 'POST', `/v1/conversations/${group.id}/theme`, {theme: 'forest'})).statusCode).toBe(200)
  })

  it('returns CAPABILITY_DISABLED for every route by default (flags unset)', async () => {
    // No flag set at all: the shipped default must be off.
    for (const flag of FLAGS) delete process.env[flag]
    const off = await createServer(loadConfig())
    await off.app.ready()
    try {
      const u = await user('off')
      const caps = (await off.app.inject({method: 'GET', url: '/v1/messaging/capabilities', headers: {authorization: `Bearer ${u.accessToken}`}})).json().data
      for (const key of ['pinnedMessages', 'savedMessages', 'editHistory', 'scheduledMessages', 'disappearingMessages', 'chatFolders', 'chatPins', 'notificationLevels', 'quickReplies', 'forwarding', 'chatThemes']) {
        expect(caps[key], key).toEqual({enabled: false})
      }
      const routes: [string, string][] = [
        ['POST', '/v1/conversations/c1/messages/m1/pin'], ['GET', '/v1/conversations/c1/pins'], ['PUT', '/v1/conversations/c1/messages/m1/saved'],
        ['GET', '/v1/messages/saved'], ['GET', '/v1/conversations/c1/messages/m1/edits'], ['POST', '/v1/conversations/c1/scheduled'],
        ['POST', '/v1/conversations/c1/disappearing'], ['POST', '/v1/conversations/c1/theme'], ['POST', '/v1/conversations/c1/pin'],
        ['POST', '/v1/conversations/c1/notifications'], ['GET', '/v1/messaging/folders'], ['GET', '/v1/messaging/quick-replies'],
        ['POST', '/v1/conversations/c1/messages/m1/forward'],
      ]
      for (const [method, url] of routes) {
        const res = await off.app.inject({method: method as any, url, headers: {authorization: `Bearer ${u.accessToken}`}, ...(method === 'GET' ? {} : {payload: {}})})
        expect(res.json().error?.code, `${method} ${url}`).toBe('CAPABILITY_DISABLED')
      }
    } finally {
      for (const flag of FLAGS) process.env[flag] = 'true'
      await off.app.close()
      await off.db.destroy()
    }
  })

  // ---- helpers -----------------------------------------------------------------

  async function dm(prefix: string) {
    const [a, b] = [await user(`${prefix}a`), await user(`${prefix}b`)]
    await follow(b, a)
    const res = await authed(a.accessToken, 'POST', '/v1/conversations', {handle: b.handle, text: 'hello'})
    expect(res.statusCode, res.body).toBeLessThan(300)
    const convo = res.json().data.conversation.id as string
    expect((await authed(b.accessToken, 'POST', `/v1/conversations/${convo}/read`)).statusCode).toBe(200)
    return {a, b, convo}
  }

  async function send(u: User, convo: string, text: string) {
    const res = await authed(u.accessToken, 'POST', `/v1/conversations/${convo}/messages`, {text})
    expect(res.statusCode, res.body).toBe(201)
    return res.json().data.message.id as string
  }

  async function messages(u: User, convo: string): Promise<any[]> {
    const res = await authed(u.accessToken, 'GET', `/v1/conversations/${convo}/messages?limit=100`)
    expect(res.statusCode, res.body).toBe(200)
    return res.json().data.items
  }

  async function openSocket(token: string) {
    const events: any[] = []
    const ws = await (app as any).injectWS('/v1/messaging/socket', {headers: {authorization: `Bearer ${token}`}}, {
      onInit: (socket: any) => socket.on('message', (data: Buffer) => events.push(JSON.parse(data.toString()))),
    })
    return {ws, events}
  }

  async function user(prefix: string): Promise<User> {
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
