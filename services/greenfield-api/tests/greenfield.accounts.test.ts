import {describe, expect, it} from 'vitest'
import {afterAll, beforeAll} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {validateHandle} from '../src/accounts/handle.js'
import {hashPassword, verifyPassword} from '../src/lib/password.js'
import {createCheckpointSigner} from '../src/checkpoints/service.js'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip

describe('Greenfield unit primitives', () => {
  it('validates handles and rejects reserved patterns', () => {
    expect(validateHandle('andrei')).toBe('andrei')
    expect(() => validateHandle('ab')).toThrow(/3/)
    expect(() => validateHandle('-bad')).toThrow()
    expect(() => validateHandle('bad--name')).toThrow()
  })

  it('hashes passwords with Argon2id', async () => {
    const encoded = await hashPassword('correct-horse-battery')
    expect(encoded.toLowerCase()).toContain('argon2id')
    expect(await verifyPassword('correct-horse-battery', encoded)).toBe(true)
    expect(await verifyPassword('wrong-password-value', encoded)).toBe(false)
  })

  it('signs and verifies checkpoints with Ed25519', () => {
    const signer = createCheckpointSigner()
    const payload = canonicalJsonStringify({repositoryId: 'r1', revision: 1, rootHash: 'abc'})
    const signature = signer.sign(payload)
    expect(signer.verify(payload, signature)).toBe(true)
    expect(signer.verify(payload + 'x', signature)).toBe(false)
  })

  it('uses deterministic canonical JSON', () => {
    expect(canonicalJsonStringify({b: 2, a: 1})).toBe('{"a":1,"b":2}')
  })
})

describeIf('Greenfield native accounts integration', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4022'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4022'
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
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it('registers, verifies, signs in, refreshes, and rejects refresh reuse without AT', async () => {
    const suffix = Date.now().toString(36)
    const email = `user-${suffix}@example.com`
    const handle = `user${suffix}`.slice(0, 20)
    const password = 'secure-pass-word-1'

    const reserved = await app.inject({method: 'GET', url: '/v1/accounts/handles/admin/availability'})
    expect(reserved.json().data.available).toBe(false)

    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    const registered = register.json().data
    expect(registered.accountId).toBeTruthy()
    expect(registered.verificationToken).toBeTruthy()

    const dupEmail = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle: `${handle}x`, inviteCode: 'test-invite'},
    })
    expect(dupEmail.statusCode).toBe(409)

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/accounts/verify-email',
      payload: {token: registered.verificationToken},
    })
    expect(verify.statusCode).toBe(200)
    expect(verify.json().data.verified).toBe(true)

    const login = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {email, password},
    })
    expect(login.statusCode).toBe(200)
    const session = login.json().data
    expect(session.accessToken).toBeTruthy()
    expect(session.refreshToken).toBeTruthy()

    const me = await app.inject({
      method: 'GET',
      url: '/v1/accounts/me',
      headers: {authorization: `Bearer ${session.accessToken}`},
    })
    expect(me.statusCode).toBe(200)
    expect(me.json().data.primaryHandle).toBe(handle)

    const profile = await app.inject({method: 'GET', url: `/v1/profiles/${handle}`})
    expect(profile.statusCode).toBe(200)
    expect(profile.json().data.handle).toBe(handle)

    const notificationPreferences = await app.inject({
      method: 'GET',
      url: '/v1/accounts/me/notification-preferences',
      headers: {authorization: `Bearer ${session.accessToken}`},
    })
    expect(notificationPreferences.statusCode).toBe(200)
    expect(notificationPreferences.json().data.bundleStyle).toBe('focus')

    const patchedNotificationPreferences = await app.inject({
      method: 'PATCH',
      url: '/v1/accounts/me/notification-preferences',
      headers: {authorization: `Bearer ${session.accessToken}`},
      payload: {
        bundleStyle: 'digest',
        reactionEnabled: false,
        expectedVersion: notificationPreferences.json().data.version,
      },
    })
    expect(patchedNotificationPreferences.statusCode).toBe(200)
    expect(patchedNotificationPreferences.json().data.bundleStyle).toBe('digest')
    expect(patchedNotificationPreferences.json().data.reactionEnabled).toBe(false)

    const boardLayout = await app.inject({
      method: 'GET',
      url: '/v1/board/layout',
      headers: {authorization: `Bearer ${session.accessToken}`},
    })
    expect(boardLayout.statusCode).toBe(200)
    expect(boardLayout.json().data.boardWidgetIds).toContain('vault-notes')

    const boardWidgetIds = [...boardLayout.json().data.boardWidgetIds].reverse()
    const patchedBoardLayout = await app.inject({
      method: 'PATCH',
      url: '/v1/board/layout',
      headers: {authorization: `Bearer ${session.accessToken}`},
      payload: {
        boardWidgetIds,
        expectedVersion: boardLayout.json().data.version,
      },
    })
    expect(patchedBoardLayout.statusCode).toBe(200)
    expect(patchedBoardLayout.json().data.boardWidgetIds).toEqual(boardWidgetIds)

    const staleBoardLayout = await app.inject({
      method: 'PATCH',
      url: '/v1/board/layout',
      headers: {authorization: `Bearer ${session.accessToken}`},
      payload: {
        boardWidgetIds: boardLayout.json().data.boardWidgetIds,
        expectedVersion: boardLayout.json().data.version,
      },
    })
    expect(staleBoardLayout.statusCode).toBe(409)

    const repo = await app.inject({
      method: 'GET',
      url: '/v1/repositories/me',
      headers: {authorization: `Bearer ${session.accessToken}`},
    })
    expect(repo.statusCode).toBe(200)
    expect(repo.json().data.repositoryId).toBeTruthy()

    const createRecord = await app.inject({
      method: 'POST',
      url: '/v1/repositories/me/records',
      headers: {authorization: `Bearer ${session.accessToken}`},
      payload: {
        collection: 'modula.social.post',
        schemaId: 'modula.social.post',
        visibility: 'public',
        data: {text: 'Hello Greenfield'},
      },
    })
    expect(createRecord.statusCode).toBe(201)

    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/sessions/refresh',
      payload: {refreshToken: session.refreshToken},
    })
    expect(refresh.statusCode).toBe(200)
    const refreshed = refresh.json().data

    const reuse = await app.inject({
      method: 'POST',
      url: '/v1/sessions/refresh',
      payload: {refreshToken: session.refreshToken},
    })
    expect(reuse.statusCode).toBe(401)

    const tools = await app.inject({method: 'GET', url: '/v1/tools'})
    expect(tools.statusCode).toBe(200)
    expect(tools.json().data.some((t: any) => t.slug === 'modula.tool.photo')).toBe(true)

    const atproto = await app.inject({method: 'GET', url: '/v1/atproto/connection'})
    expect([404, 405, 501, 403].includes(atproto.statusCode) || atproto.json()?.error?.code === 'CAPABILITY_DISABLED').toBe(true)

    // New refresh token from successful rotation should also work once.
    expect(refreshed.refreshToken).toBeTruthy()
  })

  it('Greenfield meta works with AT disabled', async () => {
    const res = await app.inject({method: 'GET', url: '/v1/meta'})
    expect(res.statusCode).toBe(200)
    expect(res.json().data.backend).toBe('greenfield')
    expect(res.json().data.capabilities.atproto).toBe(false)
  })
})
