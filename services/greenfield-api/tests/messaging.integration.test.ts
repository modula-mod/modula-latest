import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Messaging: conversations, requests and In-Mail', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let runSuffix = ''

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4031'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4031'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    process.env.MODULA_MEDIA_ROOT = `/tmp/modula-messaging-${process.pid}`
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    await app.ready()
    runSuffix = Date.now().toString(36)
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  let pool: Record<string, Awaited<ReturnType<typeof createVerifiedUser>>> | null = null
  async function users() {
    if (!pool) {
      pool = {
        alpha: await createVerifiedUser(`msga${runSuffix}`.slice(0, 20), 'Messaging Alpha'),
        beta: await createVerifiedUser(`msgb${runSuffix}`.slice(0, 20), 'Messaging Beta'),
        gamma: await createVerifiedUser(`msgc${runSuffix}`.slice(0, 20), 'Messaging Gamma'),
      }
    }
    return pool
  }

  it('requires authentication on every messaging route', async () => {
    for (const url of ['/v1/conversations', '/v1/conversations/unread', '/v1/message-requests', '/v1/in-mail']) {
      const res = await app.inject({method: 'GET', url})
      expect(res.statusCode).toBe(401)
    }
  })

  it('returns empty lists for a new account', async () => {
    const solo = (await users()).gamma
    const conversations = await authed(solo.accessToken, 'GET', '/v1/conversations?limit=30')
    expect(conversations.statusCode).toBe(200)
    expect(conversations.json().data).toEqual({items: [], nextCursor: null, hasMore: false})
    const requests = await authed(solo.accessToken, 'GET', '/v1/message-requests')
    expect(requests.json().data).toEqual({items: []})
    const inMail = await authed(solo.accessToken, 'GET', '/v1/in-mail?limit=30')
    expect(inMail.json().data.items).toEqual([])
    const unread = await authed(solo.accessToken, 'GET', '/v1/conversations/unread')
    expect(unread.json().data).toEqual({unreadCount: 0})
  })

  it('runs a request -> accept -> chat -> read flow', async () => {
    const {alpha, beta, gamma: outsider} = await users()

    const started = await authed(alpha.accessToken, 'POST', '/v1/conversations', {handle: beta.handle, text: 'Hi Beta!'})
    expect(started.statusCode).toBe(201)
    const conversationId = started.json().data.conversation.id
    expect(started.json().data.conversation.participants[0].handle).toBe(beta.handle)

    expect((await authed(beta.accessToken, 'GET', '/v1/conversations')).json().data.items).toEqual([])
    const requests = (await authed(beta.accessToken, 'GET', '/v1/message-requests')).json().data.items
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({id: conversationId, conversationId, preview: 'Hi Beta!'})
    expect(requests[0].sender.handle).toBe(alpha.handle)

    expect((await authed(beta.accessToken, 'POST', `/v1/conversations/${conversationId}/messages`, {text: 'nope'})).statusCode).toBe(403)
    expect((await authed(outsider.accessToken, 'GET', `/v1/conversations/${conversationId}/messages`)).statusCode).toBe(404)
    expect((await authed(outsider.accessToken, 'POST', `/v1/message-requests/${conversationId}/accept`, {})).statusCode).toBe(404)

    const accepted = await authed(beta.accessToken, 'POST', `/v1/message-requests/${conversationId}/accept`, {})
    expect(accepted.statusCode).toBe(200)
    expect(accepted.json().data.conversation.id).toBe(conversationId)

    const inbox = (await authed(beta.accessToken, 'GET', '/v1/conversations')).json().data
    expect(inbox.items).toHaveLength(1)
    expect(inbox.items[0]).toMatchObject({id: conversationId, kind: 'direct', unreadCount: 1})
    expect(inbox.items[0].lastMessage.body).toBe('Hi Beta!')
    expect((await authed(beta.accessToken, 'GET', '/v1/conversations/unread')).json().data.unreadCount).toBe(1)

    const reply = await authed(beta.accessToken, 'POST', `/v1/conversations/${conversationId}/messages`, {text: 'Hey Alpha'})
    expect(reply.statusCode).toBe(201)
    expect(reply.json().data.message).toMatchObject({body: 'Hey Alpha', isOwn: true, conversationId})

    expect((await authed(alpha.accessToken, 'POST', `/v1/conversations/${conversationId}/messages`, {text: '   '})).statusCode).toBe(400)
    expect((await authed(alpha.accessToken, 'POST', `/v1/conversations/${conversationId}/messages`, {text: 'x'.repeat(5001)})).statusCode).toBe(400)

    const thread = (await authed(alpha.accessToken, 'GET', `/v1/conversations/${conversationId}/messages?limit=40`)).json().data
    expect(thread.items.map((m: any) => m.body)).toEqual(['Hi Beta!', 'Hey Alpha'])
    expect(thread.items[0].isOwn).toBe(true)
    expect(thread.items[1].isOwn).toBe(false)

    const page1 = (await authed(alpha.accessToken, 'GET', `/v1/conversations/${conversationId}/messages?limit=1`)).json().data
    expect(page1.items.map((m: any) => m.body)).toEqual(['Hey Alpha'])
    expect(page1.hasMore).toBe(true)
    const page2 = (await authed(alpha.accessToken, 'GET', `/v1/conversations/${conversationId}/messages?limit=1&cursor=${encodeURIComponent(page1.nextCursor)}`)).json().data
    expect(page2.items.map((m: any) => m.body)).toEqual(['Hi Beta!'])

    expect((await authed(alpha.accessToken, 'POST', `/v1/conversations/${conversationId}/read`, {})).statusCode).toBe(200)
    const alphaInbox = (await authed(alpha.accessToken, 'GET', '/v1/conversations')).json().data
    expect(alphaInbox.items[0].unreadCount).toBe(0)

    const again = await authed(alpha.accessToken, 'POST', '/v1/conversations', {handle: `@${beta.handle}`})
    expect(again.json().data.conversation.id).toBe(conversationId)
  })

  it('reacts, replies, edits, unsends, types, mutes and archives (v2)', async () => {
    const {alpha, beta, gamma: outsider} = await users()
    const conversationId = (await authed(alpha.accessToken, 'POST', '/v1/conversations', {handle: beta.handle})).json().data.conversation.id
    const first = (await authed(alpha.accessToken, 'POST', `/v1/conversations/${conversationId}/messages`, {text: 'v2 parent'})).json().data.message

    const reply = await authed(beta.accessToken, 'POST', `/v1/conversations/${conversationId}/messages`, {text: 'v2 child', replyToMessageId: first.id})
    expect(reply.statusCode).toBe(201)
    expect(reply.json().data.message.replyTo).toMatchObject({id: first.id, body: 'v2 parent', deleted: false})
    expect((await authed(beta.accessToken, 'POST', `/v1/conversations/${conversationId}/messages`, {text: 'x', replyToMessageId: 'missing'})).statusCode).toBe(400)

    const base = `/v1/conversations/${conversationId}/messages/${first.id}`
    const reacted = await authed(beta.accessToken, 'PUT', `${base}/reactions`, {emoji: '❤️'})
    expect(reacted.statusCode).toBe(200)
    expect(reacted.json().data.reactions).toEqual([{emoji: '❤️', count: 1, mine: true}])
    await authed(beta.accessToken, 'PUT', `${base}/reactions`, {emoji: '❤️'})
    const seen = (await authed(alpha.accessToken, 'GET', `/v1/conversations/${conversationId}/messages`)).json().data.items
    expect(seen.find((m: any) => m.id === first.id).reactions).toEqual([{emoji: '❤️', count: 1, mine: false}])
    expect((await authed(outsider.accessToken, 'PUT', `${base}/reactions`, {emoji: '👍'})).statusCode).toBe(404)
    const removed = await authed(beta.accessToken, 'DELETE', `${base}/reactions?emoji=${encodeURIComponent('❤️')}`)
    expect(removed.json().data.reactions).toEqual([])

    expect((await authed(beta.accessToken, 'PATCH', base, {text: 'hijack'})).statusCode).toBe(403)
    const edited = await authed(alpha.accessToken, 'PATCH', base, {text: 'v2 parent (edited)'})
    expect(edited.statusCode).toBe(200)
    expect(edited.json().data.message.body).toBe('v2 parent (edited)')
    expect(edited.json().data.message.editedAt).toBeTruthy()

    expect((await authed(beta.accessToken, 'DELETE', base)).statusCode).toBe(403)
    expect((await authed(alpha.accessToken, 'DELETE', base)).statusCode).toBe(200)
    const after = (await authed(beta.accessToken, 'GET', `/v1/conversations/${conversationId}/messages`)).json().data.items
    const gone = after.find((m: any) => m.id === first.id)
    expect(gone).toMatchObject({body: '', deleted: true})
    expect(after.find((m: any) => m.body === 'v2 child').replyTo).toMatchObject({deleted: true, body: ''})
    expect((await authed(alpha.accessToken, 'PATCH', base, {text: 'back'})).statusCode).toBe(404)

    expect((await authed(alpha.accessToken, 'POST', `/v1/conversations/${conversationId}/typing`, {})).statusCode).toBe(200)
    const typing = (await authed(beta.accessToken, 'GET', `/v1/conversations/${conversationId}/typing`)).json().data.typing
    expect(typing.map((p: any) => p.handle)).toEqual([alpha.handle])
    expect((await authed(alpha.accessToken, 'GET', `/v1/conversations/${conversationId}/typing`)).json().data.typing).toEqual([])

    const muted = await authed(beta.accessToken, 'POST', `/v1/conversations/${conversationId}/mute`, {muted: true})
    expect(muted.json().data.muted).toBe(true)
    const archived = await authed(beta.accessToken, 'POST', `/v1/conversations/${conversationId}/archive`, {archived: true})
    expect(archived.json().data.archived).toBe(true)
    const active = (await authed(beta.accessToken, 'GET', '/v1/conversations')).json().data.items
    expect(active.find((c: any) => c.id === conversationId)).toBeUndefined()
    const archivedList = (await authed(beta.accessToken, 'GET', '/v1/conversations?archived=true')).json().data.items
    expect(archivedList.find((c: any) => c.id === conversationId)).toMatchObject({muted: true, archived: true})
    await authed(beta.accessToken, 'POST', `/v1/conversations/${conversationId}/archive`, {archived: false})
    expect((await authed(beta.accessToken, 'GET', '/v1/conversations')).json().data.items.find((c: any) => c.id === conversationId)).toBeTruthy()
  })

  it('declines requests and hides them', async () => {
    const {gamma: alpha, beta} = await users()
    const started = await authed(alpha.accessToken, 'POST', '/v1/conversations', {handle: beta.handle, text: 'Hello'})
    const id = started.json().data.conversation.id
    expect((await authed(beta.accessToken, 'POST', `/v1/message-requests/${id}/decline`, {})).statusCode).toBe(200)
    expect((await authed(beta.accessToken, 'GET', '/v1/message-requests')).json().data.items).toEqual([])
    expect((await authed(beta.accessToken, 'POST', `/v1/message-requests/${id}/accept`, {})).statusCode).toBe(404)
    expect((await authed(alpha.accessToken, 'POST', '/v1/conversations', {handle: alpha.handle})).statusCode).toBe(400)
    expect((await authed(alpha.accessToken, 'POST', '/v1/conversations', {handle: 'no-such-handle-xyz'})).statusCode).toBe(404)
  })

  it('sends, lists, reads and replies to In-Mail', async () => {
    const {alpha, beta, gamma: outsider} = await users()
    expect((await authed(alpha.accessToken, 'POST', '/v1/in-mail', {to: beta.handle, subject: '', body: 'x'})).statusCode).toBe(400)
    const sent = await authed(alpha.accessToken, 'POST', '/v1/in-mail', {to: beta.handle, subject: 'Partnership idea', body: 'Shall we collaborate?'})
    expect(sent.statusCode).toBe(201)
    const thread = sent.json().data.thread
    expect(thread).toMatchObject({subject: 'Partnership idea', unread: false})

    const inbox = (await authed(beta.accessToken, 'GET', '/v1/in-mail?limit=30')).json().data
    expect(inbox.items).toHaveLength(1)
    expect(inbox.items[0]).toMatchObject({id: thread.id, subject: 'Partnership idea', unread: true, preview: 'Shall we collaborate?'})
    expect(inbox.items[0].participants[0].handle).toBe(alpha.handle)

    expect((await authed(outsider.accessToken, 'GET', `/v1/in-mail/${thread.id}`)).statusCode).toBe(404)
    const detail = (await authed(beta.accessToken, 'GET', `/v1/in-mail/${thread.id}`)).json().data
    expect(detail.thread.id).toBe(thread.id)
    expect(detail.messages).toHaveLength(1)
    expect(detail.messages[0]).toMatchObject({body: 'Shall we collaborate?', subject: 'Partnership idea', isOwn: false})
    expect((await authed(beta.accessToken, 'GET', '/v1/in-mail')).json().data.items[0].unread).toBe(false)

    const reply = await authed(beta.accessToken, 'POST', `/v1/in-mail/${thread.id}/replies`, {body: 'Yes, let us.'})
    expect(reply.statusCode).toBe(201)
    expect(reply.json().data.message).toMatchObject({body: 'Yes, let us.', subject: 'Re: Partnership idea', isOwn: true})
    expect((await authed(alpha.accessToken, 'GET', '/v1/in-mail')).json().data.items[0].unread).toBe(true)
    const chats = (await authed(alpha.accessToken, 'GET', '/v1/conversations')).json().data.items
    expect(chats.every((c: any) => c.id !== thread.id)).toBe(true)
  })

  async function createVerifiedUser(handle: string, displayName: string) {
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.com`
    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, displayName, acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    const verified = await app.inject({
      method: 'POST',
      url: '/v1/accounts/verify-email',
      payload: {token: register.json().data.verificationToken},
    })
    expect(verified.statusCode).toBe(200)
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect([200, 201]).toContain(session.statusCode)
    const accessToken = session.json().data.accessToken
    const me = await app.inject({
      method: 'GET',
      url: '/v1/accounts/me',
      headers: {authorization: `Bearer ${accessToken}`},
    })
    expect(me.statusCode).toBe(200)
    const accountId = me.json().data.accountId
    const profile = await db
      .selectFrom('actors')
      .innerJoin('profiles', 'profiles.actor_id', 'actors.id')
      .select(['profiles.id as profile_id', 'actors.id as actor_id'])
      .where('actors.account_id', '=', accountId)
      .executeTakeFirstOrThrow()
    return {accountId, actorId: profile.actor_id, profileId: profile.profile_id, handle, accessToken}
  }

  async function authed(accessToken: string, method: string, url: string, payload?: unknown) {
    return app.inject({
      method: method as any,
      url,
      headers: {authorization: `Bearer ${accessToken}`},
      ...(payload === undefined ? {} : {payload}),
    })
  }
})
