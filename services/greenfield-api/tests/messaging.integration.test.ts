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
    expect(again.statusCode).toBe(200)
    expect(again.json().data.created).toBe(false)
    expect(again.json().data.conversation.id).toBe(conversationId)
  })

  it('creates one direct conversation and one initial message under concurrent retries', async () => {
    const suffix = `${runSuffix}${Math.random().toString(36).slice(2, 7)}`
    const sender = await createVerifiedUser(`racea${suffix}`.slice(0, 20), 'Race Sender')
    const recipient = await createVerifiedUser(`raceb${suffix}`.slice(0, 20), 'Race Recipient')

    const responses = await Promise.all(
      Array.from({length: 12}, () => authed(sender.accessToken, 'POST', '/v1/conversations', {handle: recipient.handle, text: 'Initial message'})),
    )
    expect(responses.map(response => response.statusCode).sort()).toEqual([200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 201])
    expect(responses.filter(response => response.json().data.created)).toHaveLength(1)
    const ids = new Set(responses.map(response => response.json().data.conversation.id))
    expect(ids.size).toBe(1)
    const [conversationId] = ids

    const conversations = await db
      .selectFrom('greenfield_conversations')
      .select('conversation_id')
      .where('direct_key', '=', [sender.actorId, recipient.actorId].sort().join(':'))
      .execute()
    expect(conversations).toEqual([{conversation_id: conversationId}])
    expect(await db.selectFrom('greenfield_conversation_members').selectAll().where('conversation_id', '=', conversationId).execute()).toHaveLength(2)
    expect(await db.selectFrom('greenfield_conversation_messages').selectAll().where('conversation_id', '=', conversationId).execute()).toHaveLength(1)

    const retryWithText = await authed(sender.accessToken, 'POST', '/v1/conversations', {handle: recipient.handle, text: 'Initial message'})
    expect(retryWithText.statusCode).toBe(200)
    expect(retryWithText.json().data).toMatchObject({created: false, conversation: {id: conversationId}})
    expect(await db.selectFrom('greenfield_conversation_messages').selectAll().where('conversation_id', '=', conversationId).execute()).toHaveLength(1)
  })

  it('rejects blocked, inactive and malformed conversation targets without trusting client identity fields', async () => {
    const {alpha: sender, gamma: recipient} = await users()
    const suffix = `${runSuffix}${Math.random().toString(36).slice(2, 7)}`
    const now = new Date()
    await db.insertInto('blocks').values({
      id: `block-${suffix}`,
      blocker_actor_id: recipient.actorId,
      blocked_actor_id: sender.actorId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    }).execute()

    const blocked = await authed(sender.accessToken, 'POST', '/v1/conversations', {handle: recipient.handle})
    expect(blocked.statusCode).toBe(403)
    expect(blocked.json().error.code).toBe('FORBIDDEN')

    await db.updateTable('blocks').set({deleted_at: new Date(), updated_at: new Date()}).where('id', '=', `block-${suffix}`).execute()
    await db.updateTable('greenfield_accounts').set({status: 'suspended', updated_at: new Date()}).where('account_id', '=', recipient.accountId).execute()
    const inactive = await authed(sender.accessToken, 'POST', '/v1/conversations', {handle: recipient.handle})
    const unknown = await authed(sender.accessToken, 'POST', '/v1/conversations', {handle: `missing${suffix}`.slice(0, 20)})
    const forged = await authed(sender.accessToken, 'POST', '/v1/conversations', {handle: recipient.handle, actorId: recipient.actorId})
    await db.updateTable('greenfield_accounts').set({status: 'active', updated_at: new Date()}).where('account_id', '=', recipient.accountId).execute()

    expect(inactive.statusCode).toBe(404)
    expect(inactive.json().error).toMatchObject({code: 'NOT_FOUND', message: 'Recipient not found'})
    expect(unknown.json().error).toMatchObject({code: 'NOT_FOUND', message: 'Recipient not found'})
    expect(forged.statusCode).toBe(400)
    expect(forged.json().error).toMatchObject({code: 'VALIDATION_FAILED', message: 'Invalid conversation request'})
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
