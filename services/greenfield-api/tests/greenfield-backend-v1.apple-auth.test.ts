import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {AppleAuthenticationService, type AppleIdentityVerifier, type AppleVerifiedIdentity} from '../src/auth/apple/service.js'
import {loadConfig, type AppConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldSessionService} from '../src/sessions/service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

function configEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    MODULA_ENVIRONMENT: 'development',
    MODULA_API_HOST: '127.0.0.1',
    MODULA_API_PORT: '4053',
    MODULA_PUBLIC_API_URL: 'https://api.test.modula.digital',
    MODULA_DATABASE_URL: databaseUrl ?? 'postgres://test:test@127.0.0.1:5432/modula_test',
    MODULA_DATABASE_MIGRATOR_URL: databaseUrl ?? 'postgres://test:test@127.0.0.1:5432/modula_test',
    MODULA_ALLOWED_ORIGINS: 'https://modula.digital',
    MODULA_PREVIEW_WRITES_ENABLED: 'true',
    MODULA_RATE_LIMIT_ENABLED: 'false',
    MODULA_APPLE_AUTH_ENABLED: 'false',
    MODULA_APPLE_CLIENT_IDS: '',
    ...overrides,
  }
}

class DeterministicAppleVerifier implements AppleIdentityVerifier {
  readonly calls: Array<{idToken: string; nonce: string}> = []

  async verify(idToken: string, expectedNonce: string): Promise<AppleVerifiedIdentity> {
    this.calls.push({idToken, nonce: expectedNonce})
    return {
      subject: idToken === 'apple-token-primary' ? 'apple-subject-primary' : 'apple-subject-secondary',
      issuer: 'https://appleid.apple.com',
      audience: 'digital.modula.app',
      email: 'apple-user@example.com',
      emailVerified: true,
      privateEmail: false,
      realUserStatus: 2,
    }
  }
}

describe('Greenfield Backend V1 Apple auth configuration', () => {
  it('refuses an enabled provider without a real client identifier', () => {
    expect(() => loadConfig(configEnv({MODULA_APPLE_AUTH_ENABLED: 'true'}))).toThrow(/MODULA_APPLE_CLIENT_IDS/)
    expect(loadConfig(configEnv()).appleAuthEnabled).toBe(false)
  })
})

describeIfDb('Greenfield Backend V1 Apple authentication', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let enabledConfig: AppConfig
  let apple: AppleAuthenticationService
  let verifier: DeterministicAppleVerifier
  let primaryAccountId: string
  let secondaryAccountId: string

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    const disabledConfig = loadConfig(configEnv())
    const created = await createServer(disabledConfig)
    app = created.app
    db = created.db
    await app.ready()

    enabledConfig = loadConfig(
      configEnv({
        MODULA_APPLE_AUTH_ENABLED: 'true',
        MODULA_APPLE_CLIENT_IDS: 'digital.modula.app,digital.modula.web',
      }),
    )
    verifier = new DeterministicAppleVerifier()
    apple = new AppleAuthenticationService(db, enabledConfig, new GreenfieldSessionService(db, enabledConfig), verifier)

    const suffix = `${Date.now().toString(36)}${process.pid}`
    primaryAccountId = `apple-primary-${suffix}`
    secondaryAccountId = `apple-secondary-${suffix}`
    const now = new Date()
    await db
      .insertInto('greenfield_accounts')
      .values([
        {account_id: primaryAccountId, primary_handle: `appleprimary${suffix}`.slice(0, 30), status: 'active', created_at: now, updated_at: now},
        {account_id: secondaryAccountId, primary_handle: `applesecondary${suffix}`.slice(0, 30), status: 'active', created_at: now, updated_at: now},
      ])
      .execute()
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('advertises disabled state and returns AUTH_METHOD_UNAVAILABLE without provider configuration', async () => {
    const meta = await app.inject({method: 'GET', url: '/v1/meta'})
    expect(meta.statusCode, meta.body).toBe(200)
    expect(meta.json().data.authentication.apple).toEqual({configured: false, mode: 'identity-token', clientIds: []})
    expect(meta.json().data.capabilities.appleAuthentication).toBe(false)

    const options = await app.inject({method: 'POST', url: '/v1/sessions/apple/options'})
    expect(options.statusCode).toBe(401)
    expect(options.json().error.code).toBe('AUTH_METHOD_UNAVAILABLE')
  })

  it('links once, signs in with an isolated session, audits safely, and rejects replay or cross-account linking', async () => {
    const linkChallenge = await apple.beginLink(primaryAccountId)
    expect(linkChallenge.clientIds).toEqual(['digital.modula.app', 'digital.modula.web'])
    const linked = await apple.completeLink({
      accountId: primaryAccountId,
      challengeId: linkChallenge.challengeId,
      nonce: linkChallenge.nonce,
      idToken: 'apple-token-primary',
    })
    expect(linked).toMatchObject({linked: true, provider: 'apple', email: 'apple-user@example.com'})

    await expect(
      apple.completeLink({
        accountId: primaryAccountId,
        challengeId: linkChallenge.challengeId,
        nonce: linkChallenge.nonce,
        idToken: 'apple-token-primary',
      }),
    ).rejects.toMatchObject({code: 'CHALLENGE_REPLAYED'})

    const authenticationChallenge = await apple.beginAuthentication({ipHash: 'test-ip-hash'})
    const issued = await apple.completeAuthentication({
      challengeId: authenticationChallenge.challengeId,
      nonce: authenticationChallenge.nonce,
      idToken: 'apple-token-primary',
      userAgent: 'Modula Apple Auth Test',
      platform: 'test',
    })
    expect(issued.accountId).toBe(primaryAccountId)
    const resolved = await new GreenfieldSessionService(db, enabledConfig).resolveAccess(issued.accessToken)
    expect(resolved).toMatchObject({accountId: primaryAccountId, authenticationStrength: 'strong'})

    await expect(
      apple.completeAuthentication({
        challengeId: authenticationChallenge.challengeId,
        nonce: authenticationChallenge.nonce,
        idToken: 'apple-token-primary',
      }),
    ).rejects.toMatchObject({code: 'CHALLENGE_REPLAYED'})

    const collisionChallenge = await apple.beginLink(secondaryAccountId)
    await expect(
      apple.completeLink({
        accountId: secondaryAccountId,
        challengeId: collisionChallenge.challengeId,
        nonce: collisionChallenge.nonce,
        idToken: 'apple-token-primary',
      }),
    ).rejects.toMatchObject({code: 'CONFLICT'})
    await expect(
      apple.completeLink({
        accountId: secondaryAccountId,
        challengeId: collisionChallenge.challengeId,
        nonce: collisionChallenge.nonce,
        idToken: 'apple-token-primary',
      }),
    ).rejects.toMatchObject({code: 'CHALLENGE_REPLAYED'})

    const rows = await db
      .selectFrom('greenfield_security_events')
      .select(['event_type', 'metadata'])
      .where('account_id', '=', primaryAccountId)
      .where('method_type', '=', 'apple')
      .orderBy('created_at', 'asc')
      .execute()
    expect(rows.map(row => row.event_type)).toEqual(['external_identity.linked', 'sign_in.succeeded'])
    const audit = JSON.stringify(rows)
    expect(audit).not.toContain('apple-token-primary')
    expect(audit).not.toContain(linkChallenge.nonce)
    expect(verifier.calls).toHaveLength(3)
  })
})
