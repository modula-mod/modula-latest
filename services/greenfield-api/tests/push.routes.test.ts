import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {isValidTimeZone, normalizeDeviceToken, PUSH_CATEGORIES} from '../src/domains/push/service.js'

describe('push device + preference validation', () => {
  it('normalizes APNs hex tokens and rejects junk', () => {
    const token = 'AB'.repeat(32)
    expect(normalizeDeviceToken(`<${token.slice(0, 8)} ${token.slice(8)}>`)).toBe(token.toLowerCase())
    expect(() => normalizeDeviceToken('not-a-token')).toThrow(/hex APNs/)
    expect(() => normalizeDeviceToken('ab'.repeat(10))).toThrow()
  })
  it('validates IANA time zones', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
  })
  it('exposes every product push category', () => {
    expect([...PUSH_CATEGORIES]).toEqual(['likes', 'comments', 'replies', 'mentions', 'follows', 'messages', 'stories', 'molibooCare', 'gubicInvites'])
  })
})

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip

describeIf('push routes (live Postgres)', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let alice: Awaited<ReturnType<typeof createVerifiedUser>>
  let bob: Awaited<ReturnType<typeof createVerifiedUser>>
  const token = 'c'.repeat(64)

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4029'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4029'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    const suffix = Date.now().toString(36)
    alice = await createVerifiedUser(`pa${suffix}`.slice(0, 20), 'Push Alice')
    bob = await createVerifiedUser(`pb${suffix}`.slice(0, 20), 'Push Bob')
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('registers, re-registers, lists and unregisters a device', async () => {
    const unauth = await app.inject({method: 'POST', url: '/v1/push/devices', payload: {token}})
    expect(unauth.statusCode).toBe(401)
    const bad = await authed(alice.accessToken, 'POST', '/v1/push/devices', {token: 'z'.repeat(64)})
    expect(bad.statusCode).toBe(400)
    const wrongBundle = await authed(alice.accessToken, 'POST', '/v1/push/devices', {token, bundleId: 'com.evil.app'})
    expect(wrongBundle.statusCode).toBe(400)
    const created = await authed(alice.accessToken, 'POST', '/v1/push/devices', {token, environment: 'development', appVersion: '1.0', timezone: 'Europe/London'})
    expect(created.statusCode).toBe(201)
    expect(created.json().data.device.environment).toBe('development')
    const again = await authed(alice.accessToken, 'POST', '/v1/push/devices', {token, environment: 'development'})
    expect(again.statusCode).toBe(201)
    const list = await authed(alice.accessToken, 'GET', '/v1/push/devices')
    expect(list.json().data.devices).toHaveLength(1)
    const prefs = await authed(alice.accessToken, 'GET', '/v1/push/preferences')
    expect(prefs.json().data.quietHours.timezone).toBe('Europe/London')
    // Same physical device signs into another account: token moves.
    await authed(bob.accessToken, 'POST', '/v1/push/devices', {token, environment: 'development'})
    expect((await authed(alice.accessToken, 'GET', '/v1/push/devices')).json().data.devices).toHaveLength(0)
    const foreignDelete = await authed(alice.accessToken, 'DELETE', `/v1/push/devices/${token}`)
    expect(foreignDelete.json().data.removed).toBe(false)
    const removed = await authed(bob.accessToken, 'DELETE', `/v1/push/devices/${token}`)
    expect(removed.json().data.removed).toBe(true)
  })

  it('reads and patches preferences with optimistic versions and validation', async () => {
    const initial = (await authed(alice.accessToken, 'GET', '/v1/push/preferences')).json().data
    expect(initial.enabled).toBe(true)
    expect(Object.values(initial.categories).every(Boolean)).toBe(true)
    const patched = await authed(alice.accessToken, 'PATCH', '/v1/push/preferences', {
      expectedVersion: initial.version,
      categories: {likes: false, gubicInvites: false},
      quietHours: {enabled: true, start: '23:00', end: '06:30', timezone: 'Europe/London'},
    })
    expect(patched.statusCode).toBe(200)
    expect(patched.json().data.categories).toMatchObject({likes: false, gubicInvites: false, comments: true})
    expect(patched.json().data.quietHours).toEqual({enabled: true, start: '23:00', end: '06:30', timezone: 'Europe/London'})
    const stale = await authed(alice.accessToken, 'PATCH', '/v1/push/preferences', {expectedVersion: initial.version, enabled: false})
    expect(stale.statusCode).toBe(409)
    for (const body of [{categories: {nope: true}}, {quietHours: {start: '25:00'}}, {quietHours: {timezone: 'Nowhere/Land'}}, {enabled: 'yes'}]) {
      expect((await authed(alice.accessToken, 'PATCH', '/v1/push/preferences', body)).statusCode).toBe(400)
    }
  })

  it('enqueues a push when a direct message is sent to a registered device', async () => {
    await authed(bob.accessToken, 'POST', '/v1/push/devices', {token, environment: 'development'})
    const started = await authed(alice.accessToken, 'POST', '/v1/conversations', {handle: bob.handle, text: 'hello bob'})
    expect([200, 201]).toContain(started.statusCode)
    const conversationId = started.json().data.conversation.id ?? started.json().data.conversation.conversationId
    const sent = await authed(alice.accessToken, 'POST', `/v1/conversations/${conversationId}/messages`, {text: 'are you there?'})
    expect(sent.statusCode).toBe(201)
    const queued = await db.selectFrom('push_deliveries').selectAll().where('recipient_actor_id', '=', bob.actorId).where('category', '=', 'messages').execute()
    expect(queued.length).toBeGreaterThanOrEqual(1)
    expect(queued.at(-1)!.deep_link).toBe(`modula://messages/${conversationId}`)
  })

  async function createVerifiedUser(handle: string, displayName: string) {
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.com`
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {email, password, handle, displayName, acceptedTerms: true, inviteCode: 'test-invite'}})
    expect(register.statusCode).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    const accessToken = session.json().data.accessToken as string
    const me = await app.inject({method: 'GET', url: '/v1/accounts/me', headers: {authorization: `Bearer ${accessToken}`}})
    const accountId = me.json().data.accountId
    const actor = await db.selectFrom('actors').select('id').where('account_id', '=', accountId).executeTakeFirstOrThrow()
    return {accountId, actorId: actor.id, handle, accessToken}
  }

  async function authed(accessToken: string, method: string, url: string, payload?: unknown) {
    return app.inject({method: method as any, url, headers: {authorization: `Bearer ${accessToken}`}, ...(payload === undefined ? {} : {payload})})
  }
})
