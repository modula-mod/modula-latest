import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {isCredentialRoute} from '../src/app/credential-routes.js'
import {
  DEFAULT_PASSWORD_LOGIN_THROTTLE,
  PASSWORD_LOGIN_THROTTLE_PURPOSE,
  passwordLoginBackoffSeconds,
} from '../src/auth/password-login-throttle.js'

// GF-AUTH-FLOWS-01a (Sentinel FLOWS-01 §39): #195, #197, #198 and the two INFO items.
const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip

describe('GF-AUTH-FLOWS-01a pure units', () => {
  it('password backoff: free failures, then 30s doubling, capped at 300s', () => {
    const p = DEFAULT_PASSWORD_LOGIN_THROTTLE
    expect([1, 2, 3, 4].map(n => passwordLoginBackoffSeconds(n, p))).toEqual([0, 0, 0, 0])
    expect([5, 6, 7, 8, 9, 10, 50, 10_000].map(n => passwordLoginBackoffSeconds(n, p))).toEqual([30, 60, 120, 240, 300, 300, 300, 300])
    expect(p).toEqual({windowSeconds: 900, freeFailures: 5, baseBackoffSeconds: 30, maxBackoffSeconds: 300})
  })

  it('classifies credential routes for no-store', () => {
    for (const url of ['/v1/sessions', '/v1/sessions/refresh', '/v1/sessions/apple', '/v1/sessions/:sessionId', '/v1/auth/totp/enroll', '/v1/accounts/register', '/v1/accounts/verify-email', '/v1/accounts/forgot-password']) {
      expect(isCredentialRoute(url), url).toBe(true)
    }
    for (const url of [undefined, '/v1/health/live', '/v1/sessionsx', '/v1/accounts/me', '/v1/feed']) {
      expect(isCredentialRoute(url), String(url)).toBe(false)
    }
  })
})

describeIf('GF-AUTH-FLOWS-01a integration', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let ipCounter = 0
  const freshIp = () => `203.0.113.${(++ipCounter % 250) + 1}`
  const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20)
  const password = 'secure-pass-word-1'

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4022'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4022'
    process.env.MODULA_PUBLIC_WEB_URL = 'https://modula.digital'
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

  beforeEach(async () => {
    await db.deleteFrom('greenfield_auth_rate_limits').execute()
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  async function latestMailCode(accountId: string, templateId: string): Promise<string> {
    const row = await db
      .selectFrom('greenfield_mail_jobs')
      .select(['text_body'])
      .where('recipient_account_id', '=', accountId)
      .where('template_id', '=', templateId)
      .orderBy('created_at', 'desc')
      .executeTakeFirstOrThrow()
    const match = String(row.text_body).match(/\b\d{6,8}\b/)
    if (!match) throw new Error(`No OTP code found for ${templateId}`)
    return match[0]
  }

  async function register(prefix: string) {
    const handle = unique(prefix).replace(/[^a-z0-9-]/g, '')
    const email = `${handle}@example.com`
    const response = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      remoteAddress: freshIp(),
      payload: {email, password, handle, displayName: `${prefix} User`, acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(response.statusCode).toBe(201)
    return {email, handle, response, accountId: response.json().data.accountId as string, challengeId: response.json().data.verificationChallengeId as string}
  }

  async function verifiedAccount(prefix: string) {
    const registered = await register(prefix)
    const code = await latestMailCode(registered.accountId, 'verification-code')
    const verify = await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {challengeId: registered.challengeId, code}})
    expect(verify.statusCode).toBe(200)
    return {...registered, verify}
  }

  async function login(email: string, pw = password) {
    return app.inject({method: 'POST', url: '/v1/sessions', remoteAddress: freshIp(), payload: {email, password: pw}})
  }

  async function signedIn(prefix: string) {
    const account = await verifiedAccount(prefix)
    const response = await login(account.email)
    expect(response.statusCode).toBe(200)
    return {...account, login: response, session: response.json().data as {accessToken: string; refreshToken: string; sessionId: string}}
  }

  const refresh = (refreshToken: string) => app.inject({method: 'POST', url: '/v1/sessions/refresh', payload: {refreshToken}})
  const me = (accessToken: string) => app.inject({method: 'GET', url: '/v1/accounts/me', headers: {authorization: `Bearer ${accessToken}`}})

  async function liveRefreshTokens(sessionId: string): Promise<number> {
    const row = await db
      .selectFrom('greenfield_session_tokens')
      .select(db.fn.countAll().as('n'))
      .where('session_id', '=', sessionId)
      .where('kind', '=', 'refresh')
      .where('rotated_at', 'is', null)
      .where('revoked_at', 'is', null)
      .executeTakeFirstOrThrow()
    return Number(row.n)
  }

  describe('#195 atomic refresh rotation with reuse detection', () => {
    it('two concurrent refreshes of one token: exactly one 200, and never two live refresh tokens', async () => {
      for (let round = 0; round < 5; round += 1) {
        const account = await signedIn('race')
        const [a, b] = await Promise.all([refresh(account.session.refreshToken), refresh(account.session.refreshToken)])
        const statuses = [a.statusCode, b.statusCode].sort()
        expect(statuses, `round ${round}`).toEqual([200, 401])
        const loser = a.statusCode === 401 ? a : b
        expect(loser.json().error.code).toBe('UNAUTHENTICATED')
        // The loser took the reuse path, which revokes the family: no live refresh token remains.
        expect(await liveRefreshTokens(account.session.sessionId)).toBe(0)
        const session = await db.selectFrom('greenfield_sessions').select(['status']).where('session_id', '=', account.session.sessionId).executeTakeFirstOrThrow()
        expect(session.status).toBe('revoked')
      }
    })

    it('presenting an already-rotated refresh token revokes the whole session family', async () => {
      const account = await signedIn('reuse')
      const first = await refresh(account.session.refreshToken)
      expect(first.statusCode).toBe(200)
      const rotated = first.json().data
      expect(await liveRefreshTokens(account.session.sessionId)).toBe(1)

      const replay = await refresh(account.session.refreshToken)
      expect(replay.statusCode).toBe(401)
      expect(replay.json()).toMatchObject({ok: false, error: {code: 'UNAUTHENTICATED'}})

      // The legitimately rotated token and its access token are revoked too.
      expect((await refresh(rotated.refreshToken)).statusCode).toBe(401)
      expect((await me(rotated.accessToken)).statusCode).toBe(401)
      expect(await liveRefreshTokens(account.session.sessionId)).toBe(0)
      const events = await db
        .selectFrom('greenfield_session_events')
        .select(['event_type'])
        .where('session_id', '=', account.session.sessionId)
        .execute()
      expect(events.map(e => e.event_type)).toContain('session.refreshReuseDetected')
    })

    it('sequential rotation still works and keeps exactly one live refresh token', async () => {
      const account = await signedIn('seq')
      let token = account.session.refreshToken
      for (let i = 0; i < 3; i += 1) {
        const next = await refresh(token)
        expect(next.statusCode).toBe(200)
        token = next.json().data.refreshToken
        expect(await liveRefreshTokens(account.session.sessionId)).toBe(1)
      }
    })
  })

  describe('#197 no-store on credential responses', () => {
    const expectNoStore = (response: {headers: Record<string, unknown>}, label: string) => {
      expect(response.headers['cache-control'], label).toBe('no-store')
      expect(response.headers['pragma'], label).toBe('no-cache')
    }

    it('login, refresh, register, verify, email-code, passkey and Apple responses are no-store', async () => {
      const account = await signedIn('nost')
      expectNoStore(account.response, 'register')
      expectNoStore(account.verify, 'verify-email')
      expectNoStore(account.login, 'login')
      const refreshed = await refresh(account.session.refreshToken)
      expect(refreshed.statusCode).toBe(200)
      expectNoStore(refreshed, 'refresh')
      expectNoStore(await app.inject({method: 'POST', url: '/v1/sessions/email-code/request', remoteAddress: freshIp(), payload: {email: account.email}}), 'email-code request')
      expectNoStore(await app.inject({method: 'POST', url: '/v1/sessions/passkey/options', payload: {}}), 'passkey options')
      expectNoStore(await app.inject({method: 'POST', url: '/v1/sessions/apple/options', payload: {}}), 'apple options')
      expectNoStore(await app.inject({method: 'POST', url: '/v1/sessions/apple', payload: {challengeId: 'x', nonce: 'y', idToken: 'z'}}), 'apple sign-in')
      expectNoStore(await app.inject({method: 'POST', url: '/v1/accounts/forgot-password', payload: {email: account.email}}), 'forgot-password')
      expectNoStore(await login(account.email, 'wrong-pass-word-9'), 'login failure')
    })

    it('non-credential routes are not changed', async () => {
      const health = await app.inject({method: 'GET', url: '/v1/health/live'})
      expect(health.headers['pragma']).toBeUndefined()
    })
  })

  describe('#198 missing or empty body is 400 VALIDATION_FAILED', () => {
    const routes = [
      '/v1/accounts/resend-verification',
      '/v1/accounts/forgot-password',
      '/v1/sessions/refresh',
      '/v1/accounts/register',
      '/v1/accounts/verify-email',
      '/v1/sessions',
      '/v1/sessions/email-code/request',
      '/v1/sessions/email-code',
      '/v1/sessions/recovery-code',
      '/v1/sessions/passkey',
      '/v1/sessions/apple',
    ]
    const expectValidation = (response: any, label: string) => {
      expect(response.statusCode, label).toBe(400)
      const body = response.json()
      expect(body.ok, label).toBe(false)
      expect(body.error.code, label).toBe('VALIDATION_FAILED')
      expect(body.error.requestId, label).toBeTruthy()
    }

    for (const url of routes) {
      it(`${url}: no body, empty JSON body, null body and array body`, async () => {
        expectValidation(await app.inject({method: 'POST', url, remoteAddress: freshIp()}), `${url} no body`)
        expectValidation(
          await app.inject({method: 'POST', url, remoteAddress: freshIp(), headers: {'content-type': 'application/json'}, payload: ''}),
          `${url} empty json`,
        )
        expectValidation(
          await app.inject({method: 'POST', url, remoteAddress: freshIp(), headers: {'content-type': 'application/json'}, payload: 'null'}),
          `${url} null`,
        )
        expectValidation(
          await app.inject({method: 'POST', url, remoteAddress: freshIp(), headers: {'content-type': 'application/json'}, payload: '[]'}),
          `${url} array`,
        )
      })
    }

    it('blank email or refresh token in an object body is 400 too', async () => {
      expectValidation(await app.inject({method: 'POST', url: '/v1/accounts/resend-verification', payload: {}}), 'resend {}')
      expectValidation(await app.inject({method: 'POST', url: '/v1/accounts/forgot-password', payload: {email: '  '}}), 'forgot blank')
      expectValidation(await app.inject({method: 'POST', url: '/v1/sessions/refresh', payload: {refreshToken: ''}}), 'refresh blank')
      expectValidation(await app.inject({method: 'POST', url: '/v1/sessions/refresh', payload: {refreshToken: 42}}), 'refresh number')
    })
  })

  describe('INFO: per-account wrong-password throttle', () => {
    async function throttleRow(email: string) {
      const {createHash} = await import('node:crypto')
      const key = createHash('sha256').update(`${process.env.MODULA_SESSION_PEPPER ?? ''}:password-login:${email.trim().toLowerCase()}`).digest('hex')
      return {
        key,
        row: await db
          .selectFrom('greenfield_auth_rate_limits')
          .selectAll()
          .where('rate_limit_key', '=', key)
          .where('purpose', '=', PASSWORD_LOGIN_THROTTLE_PURPOSE)
          .executeTakeFirst(),
      }
    }

    async function failFive(email: string) {
      const results = []
      for (let i = 0; i < 5; i += 1) results.push(await login(email, 'wrong-pass-word-9'))
      return results
    }

    it('5 consecutive failures trigger 429 + Retry-After even for the right password; success after backoff resets', async () => {
      const account = await verifiedAccount('thr')
      const failures = await failFive(account.email)
      expect(failures.map(r => r.statusCode)).toEqual([401, 401, 401, 401, 401])
      expect(failures.every(r => r.json().error.code === 'INVALID_CREDENTIALS')).toBe(true)

      const blocked = await login(account.email)
      expect(blocked.statusCode).toBe(429)
      expect(blocked.headers['retry-after']).toBe('30')
      expect(blocked.json()).toMatchObject({
        ok: false,
        error: {code: 'RATE_LIMITED', retryable: true, details: {retryAfterSeconds: 30}},
      })
      expect(JSON.stringify(blocked.json())).not.toMatch(/accessToken|refreshToken/)
      // Blocked attempts are not counted, so they cannot extend the block.
      for (let i = 0; i < 3; i += 1) expect((await login(account.email, 'wrong-pass-word-9')).statusCode).toBe(429)
      expect((await throttleRow(account.email)).row?.attempt_count).toBe(5)

      // Backoff elapses: the next failure steps up to 60s.
      const {key} = await throttleRow(account.email)
      await db.updateTable('greenfield_auth_rate_limits').set({blocked_until: new Date(Date.now() - 1000)}).where('rate_limit_key', '=', key).execute()
      expect((await login(account.email, 'wrong-pass-word-9')).statusCode).toBe(401)
      const stepped = await login(account.email)
      expect(stepped.statusCode).toBe(429)
      expect(stepped.headers['retry-after']).toBe('60')

      // Backoff elapses again: the right password signs in and clears the count.
      await db.updateTable('greenfield_auth_rate_limits').set({blocked_until: new Date(Date.now() - 1000)}).where('rate_limit_key', '=', key).execute()
      expect((await login(account.email)).statusCode).toBe(200)
      expect((await throttleRow(account.email)).row).toBeUndefined()
      expect((await login(account.email, 'wrong-pass-word-9')).statusCode).toBe(401)
      expect((await throttleRow(account.email)).row?.attempt_count).toBe(1)
    })

    it('success before the threshold resets the count; failures older than the window restart it', async () => {
      const account = await verifiedAccount('thrr')
      for (let i = 0; i < 4; i += 1) expect((await login(account.email, 'wrong-pass-word-9')).statusCode).toBe(401)
      expect((await login(account.email)).statusCode).toBe(200)
      for (let i = 0; i < 4; i += 1) expect((await login(account.email, 'wrong-pass-word-9')).statusCode).toBe(401)
      const {key} = await throttleRow(account.email)
      await db.updateTable('greenfield_auth_rate_limits').set({updated_at: new Date(Date.now() - 16 * 60_000)}).where('rate_limit_key', '=', key).execute()
      expect((await login(account.email, 'wrong-pass-word-9')).statusCode).toBe(401)
      expect((await throttleRow(account.email)).row?.attempt_count).toBe(1)
      expect((await login(account.email)).statusCode).toBe(200)
    })

    it('unknown emails are throttled identically, so the throttle does not reveal which emails exist', async () => {
      const known = await verifiedAccount('thrk')
      const unknownEmail = `${unique('nobody')}@example.com`
      const shape = (r: any) => ({status: r.statusCode, code: r.json().error?.code, retryAfter: r.headers['retry-after'] ?? null, keys: Object.keys(r.json().error ?? {}).sort()})
      const knownSeq = [...(await failFive(known.email)), await login(known.email, 'wrong-pass-word-9')].map(shape)
      const unknownSeq = [...(await failFive(unknownEmail)), await login(unknownEmail, 'wrong-pass-word-9')].map(shape)
      expect(unknownSeq).toEqual(knownSeq)
      expect(knownSeq.at(-1)).toMatchObject({status: 429, code: 'RATE_LIMITED', retryAfter: '30'})
    })

    it('a correct password on an unverified account resets the count (EMAIL_VERIFICATION_REQUIRED)', async () => {
      const pending = await register('thrp')
      for (let i = 0; i < 3; i += 1) expect((await login(pending.email, 'wrong-pass-word-9')).statusCode).toBe(401)
      const ok = await login(pending.email)
      expect(ok.statusCode).toBe(403)
      expect((await throttleRow(pending.email)).row).toBeUndefined()
    })
  })

  describe('INFO: revoking a session you do not own is 404', () => {
    it('foreign session is 404 like a missing one and stays live; own session revokes', async () => {
      const alice = await signedIn('alice')
      const bob = await signedIn('bob')
      const foreign = await app.inject({method: 'DELETE', url: `/v1/sessions/${bob.session.sessionId}`, headers: {authorization: `Bearer ${alice.session.accessToken}`}})
      const missing = await app.inject({method: 'DELETE', url: '/v1/sessions/00000000-0000-7000-8000-000000000000', headers: {authorization: `Bearer ${alice.session.accessToken}`}})
      expect(foreign.statusCode).toBe(404)
      expect(missing.statusCode).toBe(404)
      const strip = (body: any) => ({...body, error: {...body.error, requestId: undefined}, meta: undefined})
      expect(strip(foreign.json())).toEqual(strip(missing.json()))
      expect(foreign.json()).toMatchObject({ok: false, error: {code: 'NOT_FOUND', message: 'Session not found'}})
      expect((await me(bob.session.accessToken)).statusCode).toBe(200)

      const second = await login(alice.email)
      const own = await app.inject({method: 'DELETE', url: `/v1/sessions/${second.json().data.sessionId}`, headers: {authorization: `Bearer ${alice.session.accessToken}`}})
      expect(own.statusCode).toBe(200)
      expect(own.json().data).toEqual({revoked: true})
      expect((await me(second.json().data.accessToken)).statusCode).toBe(401)
    })
  })
})
