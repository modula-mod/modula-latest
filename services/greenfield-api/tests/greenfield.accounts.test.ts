import {describe, expect, it, vi} from 'vitest'
import {afterAll, beforeAll, beforeEach} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {validateHandle} from '../src/accounts/handle.js'
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  passwordHashForVerification,
  PASSWORD_OPTIONS,
  verifyPassword,
} from '../src/lib/password.js'
import * as passwordLib from '../src/lib/password.js'
import {createCheckpointSigner} from '../src/checkpoints/service.js'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {generate} from 'otplib'
import WebAuthnEmulator from 'nid-webauthn-emulator'
import {ChallengeService} from '../src/auth/challenges/service.js'
import {evaluateStepUpRequirement} from '../src/auth/step-up/policy.js'
import {processOneJob} from '../../greenfield-worker/src/jobs/runner.js'
import type {WorkerConfig} from '../../greenfield-worker/src/config.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip

function configEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    MODULA_ENVIRONMENT: 'development',
    MODULA_API_HOST: '127.0.0.1',
    MODULA_API_PORT: '4022',
    MODULA_PUBLIC_API_URL: 'http://127.0.0.1:4022',
    MODULA_DATABASE_URL: 'postgres://modula:modula@127.0.0.1:5432/modula_test',
    MODULA_ALLOWED_ORIGINS: 'http://localhost:8081',
    MODULA_PREVIEW_WRITES_ENABLED: 'true',
    MODULA_ATPROTO_ENABLED: 'false',
    MODULA_RATE_LIMIT_ENABLED: 'false',
    ...overrides,
  }
}

async function latestMailCode(db: any, accountId: string, templateId: string): Promise<string> {
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

async function generateTotpFromProvisioningUri(provisioningUri: string): Promise<string> {
  const uri = new URL(provisioningUri)
  const secret = uri.searchParams.get('secret')
  if (!secret) throw new Error('Provisioning URI did not include a secret')
  return generate({secret, algorithm: 'sha1', digits: 6, period: 30})
}

async function createVerifiedAccountWithSession(app: any, db: any, input: {prefix: string; password?: string}) {
  const suffix = `${input.prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.slice(0, 20)
  const email = `${suffix}@example.com`
  const handle = suffix.replace(/[^a-z0-9-]/g, '').slice(0, 20)
  const password = input.password ?? 'secure-pass-word-1'
  const register = await app.inject({
    method: 'POST',
    url: '/v1/accounts/register',
    payload: {email, password, handle, displayName: `${input.prefix} User`, acceptedTerms: true, inviteCode: 'test-invite'},
  })
  expect(register.statusCode).toBe(201)
  const accountId = register.json().data.accountId
  const verificationCode = await latestMailCode(db, accountId, 'verification-code')
  const verify = await app.inject({
    method: 'POST',
    url: '/v1/accounts/verify-email',
    payload: {challengeId: register.json().data.verificationChallengeId, code: verificationCode},
  })
  expect(verify.statusCode).toBe(200)
  const login = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
  expect(login.statusCode).toBe(200)
  return {accountId, email, handle, password, session: login.json().data}
}

async function registerPasskeyForAccount(app: any, account: {session: {accessToken: string}}, emulator: WebAuthnEmulator, label: string) {
  const headers = {authorization: `Bearer ${account.session.accessToken}`}
  const options = await app.inject({
    method: 'POST',
    url: '/v1/auth/passkeys/registration/options',
    headers,
    payload: {label},
  })
  expect(options.statusCode).toBe(200)
  const response = emulator.createJSON('https://modula.digital', options.json().data.options)
  const verify = await app.inject({
    method: 'POST',
    url: '/v1/auth/passkeys/registration/verify',
    headers,
    payload: {challengeId: options.json().data.challengeId, response, label},
  })
  expect(verify.statusCode).toBe(200)
  return {options: options.json().data, response, result: verify.json().data}
}

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

  it('unknown-email verification uses a dummy Argon2id hash with the same parameters as real accounts', async () => {
    expect(passwordHashForVerification(undefined)).toBe(DUMMY_PASSWORD_HASH)
    expect(passwordHashForVerification(null)).toBe(DUMMY_PASSWORD_HASH)
    const real = await hashPassword('correct-horse-battery')
    expect(passwordHashForVerification(real)).toBe(real)
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    expect(PASSWORD_OPTIONS).toMatchObject({memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32})
    const spy = vi.spyOn(passwordLib, 'verifyPassword')
    try {
      expect(await passwordLib.verifyPassword('not-the-dummy-secret', passwordHashForVerification(undefined))).toBe(false)
      expect(spy).toHaveBeenCalledWith('not-the-dummy-secret', DUMMY_PASSWORD_HASH)
    } finally {
      spy.mockRestore()
    }
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

  it('derives explicit registration modes from server policy', () => {
    expect(loadConfig(configEnv()).registrationMode).toBe('open')
    expect(loadConfig(configEnv()).inviteOnly).toBe(false)
    expect(loadConfig(configEnv({MODULA_INVITE_ONLY: 'true'})).registrationMode).toBe('invite-only')
    expect(loadConfig(configEnv({MODULA_INVITE_ONLY: 'false'})).registrationMode).toBe('open')
    expect(
      loadConfig({
        ...configEnv({MODULA_INVITE_ONLY: 'false'}),
        MODULA_REGISTRATION_MODE: 'closed',
      }).registrationMode,
    ).toBe('closed')
    expect(
      loadConfig(
        configEnv({
          MODULA_ENVIRONMENT: 'production',
          MODULA_PUBLIC_API_URL: 'https://api.modula.digital',
          MODULA_PREVIEW_WRITES_ENABLED: 'false',
        }),
      ).registrationMode,
    ).toBe('invite-only')
  })

  it('requires an explicit production write gate for open registration', () => {
    expect(() =>
      loadConfig(
        configEnv({
          MODULA_ENVIRONMENT: 'production',
          MODULA_PUBLIC_API_URL: 'https://api.modula.digital',
          MODULA_PUBLIC_WEB_URL: 'https://modula.digital',
          MODULA_PREVIEW_WRITES_ENABLED: 'false',
          MODULA_REGISTRATION_MODE: 'open',
        }),
      ),
    ).toThrow(/MODULA_PRODUCTION_WRITES_ENABLED/)

    const config = loadConfig(
      configEnv({
        MODULA_ENVIRONMENT: 'production',
        MODULA_PUBLIC_API_URL: 'https://api.modula.digital',
        MODULA_PUBLIC_WEB_URL: 'https://modula.digital',
        MODULA_PREVIEW_WRITES_ENABLED: 'false',
        MODULA_PRODUCTION_WRITES_ENABLED: 'true',
        MODULA_REGISTRATION_MODE: 'open',
      }),
    )
    expect(config.registrationMode).toBe('open')
    expect(config.inviteOnly).toBe(false)
    expect(config.previewWritesEnabled).toBe(false)
    expect(config.productionWritesEnabled).toBe(true)
    expect(config.mutationsEnabled).toBe(true)
  })

  it('evaluates sensitive-action step-up policy on the server', () => {
    const now = new Date('2026-08-11T12:00:00.000Z')
    expect(
      evaluateStepUpRequirement(
        'change_mail_forwarding',
        {recentAuthenticationAt: new Date(now.getTime() - 60_000), authenticationStrength: 'medium'},
        now,
      ),
    ).toMatchObject({allowed: false, code: 'STEP_UP_REQUIRED', reason: 'authentication_strength_insufficient'})
    expect(
      evaluateStepUpRequirement(
        'change_mail_forwarding',
        {recentAuthenticationAt: new Date(now.getTime() - 60_000), authenticationStrength: 'strong'},
        now,
      ),
    ).toMatchObject({allowed: true, code: 'ALLOWED'})
    expect(
      evaluateStepUpRequirement(
        'dimon_operation',
        {recentAuthenticationAt: new Date(now.getTime() - 60_000), authenticationStrength: 'strong'},
        now,
      ),
    ).toMatchObject({allowed: false, requiredStrength: 'phishing_resistant'})
  })
})

function mailWorkerConfig(): WorkerConfig {
  return {
    nodeEnv: 'test',
    environment: 'development',
    workerId: `mail-identity-worker-${process.pid}`,
    logLevel: 'silent',
    databaseUrl: databaseUrl!,
    pollIntervalMs: 1,
    emptyPollBackoffMs: 1,
    leaseDurationMs: 60_000,
    leaseReapIntervalMs: 60_000,
    outboxDrainIntervalMs: 60_000,
    outboxBatchSize: 10,
    eventSubscriberTimeoutMs: 10_000,
    ingestIntervalMs: 60_000,
    ingestEnabled: false,
    mailTransport: 'log',
    mailProvisionerMode: 'dry-run',
    mailDomain: 'modula.digital',
    mailHestiaUser: undefined,
    mailProvisionerCommandTimeoutMs: 10_000,
    mailDefaultQuotaBytes: 1_073_741_824,
    mailRequired: false,
    mailFrom: 'Modula <no-reply@modula.digital>',
    smtpPort: 587,
    smtpSecure: false,
    smtpRequireTls: true,
    smtpTlsRejectUnauthorized: true,
    encryptionKeysByVersion: new Map([[1, Buffer.alloc(32, 7)]]),
    encryptionKeyIsEphemeral: true,
    ssrfAllowPrivateNetworks: false,
    moduleRemoteFunctionsEnabled: false,
    moduleCommunityExecutionEnabled: false,
    moduleGithubSyncEnabled: false,
  }
}

async function mailJobIdsForAccount(db: any, accountId: string): Promise<string[]> {
  const requests = await db
    .selectFrom('greenfield_mail_identity_requests')
    .select('request_id')
    .where('account_id', '=', accountId)
    .execute()
  return requests.flatMap((request: {request_id: string}) => [
    `job-mail-identity-${request.request_id}`,
    `job-mail-forward-${request.request_id}`,
  ])
}

async function processMailIdentityUntil(db: any, accountId: string, state: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    await processOneJob(db as any, mailWorkerConfig(), {jobIds: await mailJobIdsForAccount(db, accountId)})
    const identity = await db
      .selectFrom('greenfield_mail_identities')
      .select(['state'])
      .where('account_id', '=', accountId)
      .where('released_at', 'is', null)
      .executeTakeFirst()
    if (identity?.state === state) return
  }
  throw new Error(`Mail identity did not reach ${state}`)
}

async function processMailEventUntil(db: any, accountId: string, eventType: string): Promise<void> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    await processOneJob(db as any, mailWorkerConfig(), {jobIds: await mailJobIdsForAccount(db, accountId)})
    const event = await db
      .selectFrom('greenfield_mail_identity_events')
      .select(['event_id'])
      .where('account_id', '=', accountId)
      .where('event_type', '=', eventType)
      .executeTakeFirst()
    if (event) return
  }
  throw new Error(`Mail identity event ${eventType} was not recorded`)
}

describeIf('Greenfield native accounts integration', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']

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
    await app.close()
    await db.destroy()
  })

  it('registers, verifies, signs in, refreshes, and rejects refresh reuse without AT', async () => {
    const suffix = Date.now().toString(36)
    const email = `user-${suffix}@example.com`
    const handle = `user${suffix}`.slice(0, 20)
    const password = 'secure-pass-word-1'

    const meta = await app.inject({method: 'GET', url: '/v1/meta'})
    expect(meta.statusCode).toBe(200)
    expect(meta.json().data.registration).toEqual({
      mode: 'invite-only',
      emailVerificationRequired: true,
    })
    expect(meta.json().data.capabilities.inviteOnly).toBe(true)

    const reserved = await app.inject({method: 'GET', url: '/v1/accounts/handles/admin/availability'})
    expect(reserved.json().data.available).toBe(false)

    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, displayName: 'Test User', acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    const registered = register.json().data
    expect(registered.accountId).toBeTruthy()
    expect(registered.verificationChallengeId).toBeTruthy()
    expect(registered.verificationToken).toBeTruthy()
    expect(registered.verificationDelivery.recipient).toContain('@example.com')

    const dupEmail = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle: `${handle}x`, displayName: 'Duplicate User', acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(dupEmail.statusCode).toBe(409)

    const firstVerificationCode = await latestMailCode(db, registered.accountId, 'verification-code')
    const resend = await app.inject({
      method: 'POST',
      url: '/v1/accounts/resend-verification',
      payload: {email},
    })
    expect(resend.statusCode).toBe(200)
    const secondVerificationChallenge = await db
      .selectFrom('greenfield_auth_challenges')
      .select(['challenge_id'])
      .where('account_id', '=', registered.accountId)
      .where('purpose', '=', 'email_verification')
      .where('state', '=', 'pending')
      .orderBy('created_at', 'desc')
      .executeTakeFirstOrThrow()
    const secondVerificationCode = await latestMailCode(db, registered.accountId, 'verification-code')

    const oldVerification = await app.inject({
      method: 'POST',
      url: '/v1/accounts/verify-email',
      payload: {challengeId: registered.verificationChallengeId, code: firstVerificationCode},
    })
    expect(oldVerification.statusCode).toBe(401)
    expect(oldVerification.json().error.code).toBe('CHALLENGE_INVALID')

    const wrongVerification = await app.inject({
      method: 'POST',
      url: '/v1/accounts/verify-email',
      payload: {
        challengeId: secondVerificationChallenge.challenge_id,
        code: secondVerificationCode === '000000' ? '000001' : '000000',
      },
    })
    expect(wrongVerification.statusCode).toBe(401)
    expect(wrongVerification.json().error.code).toBe('CHALLENGE_INVALID')

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/accounts/verify-email',
      payload: {challengeId: secondVerificationChallenge.challenge_id, code: secondVerificationCode},
    })
    expect(verify.statusCode).toBe(200)
    expect(verify.json().data.verified).toBe(true)

    const replayVerification = await app.inject({
      method: 'POST',
      url: '/v1/accounts/verify-email',
      payload: {challengeId: secondVerificationChallenge.challenge_id, code: secondVerificationCode},
    })
    expect(replayVerification.statusCode).toBe(401)
    expect(replayVerification.json().error.code).toBe('CHALLENGE_REPLAYED')

    const login = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {email, password},
    })
    expect(login.statusCode).toBe(200)
    const session = login.json().data
    expect(session.accessToken).toBeTruthy()
    expect(session.refreshToken).toBeTruthy()

    const methods = await db
      .selectFrom('greenfield_authentication_methods')
      .select(['method_type', 'state', 'strength', 'verified_at'])
      .where('account_id', '=', registered.accountId)
      .orderBy('method_type', 'asc')
      .execute()
    expect(methods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({method_type: 'email_otp', state: 'active', strength: 'low'}),
        expect.objectContaining({method_type: 'password', state: 'active', strength: 'medium'}),
      ]),
    )

    const storedSession = await db
      .selectFrom('greenfield_sessions')
      .select(['authentication_method_id', 'authentication_strength', 'recent_authentication_at'])
      .where('session_id', '=', session.sessionId)
      .executeTakeFirstOrThrow()
    expect(storedSession.authentication_method_id).toBe(`password-${registered.accountId}`)
    expect(storedSession.authentication_strength).toBe('medium')
    expect(storedSession.recent_authentication_at).toBeTruthy()

    const signInEvent = await db
      .selectFrom('greenfield_security_events')
      .select(['event_type', 'method_type', 'method_id', 'severity'])
      .where('account_id', '=', registered.accountId)
      .where('event_type', '=', 'sign_in')
      .executeTakeFirstOrThrow()
    expect(signInEvent).toMatchObject({
      event_type: 'sign_in',
      method_type: 'password',
      method_id: `password-${registered.accountId}`,
      severity: 'notice',
    })

    const challenges = new ChallengeService(db, loadConfig())
    const firstChallenge = await challenges.create({
      purpose: 'email_login',
      subjectIdentifier: email,
      deliveryChannel: 'email',
      ttlSeconds: 600,
      supersedeExisting: true,
    })
    const secondChallenge = await challenges.create({
      purpose: 'email_login',
      subjectIdentifier: email,
      deliveryChannel: 'email',
      ttlSeconds: 600,
      supersedeExisting: true,
    })
    await expect(challenges.verifyCode(firstChallenge.challengeId, firstChallenge.code)).rejects.toMatchObject({
      code: 'CHALLENGE_INVALID',
    })
    await expect(challenges.verifyCode(secondChallenge.challengeId, secondChallenge.code === '000000' ? '000001' : '000000')).rejects.toMatchObject({
      code: 'CHALLENGE_INVALID',
    })
    await expect(challenges.verifyCode(secondChallenge.challengeId, secondChallenge.code)).resolves.toMatchObject({
      challengeId: secondChallenge.challengeId,
      purpose: 'email_login',
    })
    await expect(challenges.verifyCode(secondChallenge.challengeId, secondChallenge.code)).rejects.toMatchObject({
      code: 'CHALLENGE_REPLAYED',
    })

    const expiredChallenge = await challenges.create({
      purpose: 'email_login',
      subjectIdentifier: `expired-${email}`,
      deliveryChannel: 'email',
      ttlSeconds: 600,
      supersedeExisting: true,
    })
    await db
      .updateTable('greenfield_auth_challenges')
      .set({expires_at: new Date(Date.now() - 1_000)})
      .where('challenge_id', '=', expiredChallenge.challengeId)
      .execute()
    await expect(
      challenges.verifyCode({
        challengeId: expiredChallenge.challengeId,
        code: expiredChallenge.code,
        purpose: 'email_login',
        subjectIdentifier: `expired-${email}`,
      }),
    ).rejects.toMatchObject({code: 'CHALLENGE_EXPIRED'})

    const limitedChallenge = await challenges.create({
      purpose: 'email_login',
      subjectIdentifier: `limited-${email}`,
      deliveryChannel: 'email',
      ttlSeconds: 600,
      attemptLimit: 2,
      supersedeExisting: true,
    })
    await expect(challenges.verifyCode(limitedChallenge.challengeId, '111111')).rejects.toMatchObject({
      code: 'CHALLENGE_INVALID',
    })
    await expect(challenges.verifyCode(limitedChallenge.challengeId, '222222')).rejects.toMatchObject({
      code: 'CHALLENGE_INVALID',
    })
    await expect(challenges.verifyCode(limitedChallenge.challengeId, limitedChallenge.code)).rejects.toMatchObject({
      code: 'CHALLENGE_INVALID',
    })

    for (let index = 0; index < 5; index += 1) {
      await challenges.create({
        purpose: 'email_login',
        subjectIdentifier: `rate-${suffix}@example.com`,
        deliveryChannel: 'email',
        ttlSeconds: 600,
        rateLimitKeys: [`email:rate-${suffix}@example.com`, `ip:rate-${suffix}`],
        metadata: {index},
      })
    }
    await expect(
      challenges.create({
        purpose: 'email_login',
        subjectIdentifier: `rate-${suffix}@example.com`,
        deliveryChannel: 'email',
        ttlSeconds: 600,
        rateLimitKeys: [`email:rate-${suffix}@example.com`, `ip:rate-${suffix}`],
      }),
    ).rejects.toMatchObject({code: 'RATE_LIMITED'})

    const secondAccountEmail = `other-${suffix}@example.com`
    const secondAccountRegister = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {
        email: secondAccountEmail,
        password,
        handle: `other${suffix}`.slice(0, 20),
        displayName: 'Other User',
        acceptedTerms: true,
        inviteCode: 'test-invite',
      },
    })
    expect(secondAccountRegister.statusCode).toBe(201)
    const secondAccountVerificationCode = await latestMailCode(
      db,
      secondAccountRegister.json().data.accountId,
      'verification-code',
    )
    const secondAccountVerify = await app.inject({
      method: 'POST',
      url: '/v1/accounts/verify-email',
      payload: {
        challengeId: secondAccountRegister.json().data.verificationChallengeId,
        code: secondAccountVerificationCode,
      },
    })
    expect(secondAccountVerify.statusCode).toBe(200)

    const emailCodeRequest = await app.inject({
      method: 'POST',
      url: '/v1/sessions/email-code/request',
      payload: {email},
    })
    expect(emailCodeRequest.statusCode).toBe(200)
    const emailLoginChallengeId = emailCodeRequest.json().data.challengeId
    const emailLoginCode = await latestMailCode(db, registered.accountId, 'passwordless-login')

    const crossAccountEmailCode = await app.inject({
      method: 'POST',
      url: '/v1/sessions/email-code',
      payload: {email: secondAccountEmail, challengeId: emailLoginChallengeId, code: emailLoginCode},
    })
    expect(crossAccountEmailCode.statusCode).toBe(401)
    expect(crossAccountEmailCode.json().error.code).toBe('CHALLENGE_INVALID')

    const emailCodeWrong = await app.inject({
      method: 'POST',
      url: '/v1/sessions/email-code',
      payload: {email, challengeId: emailLoginChallengeId, code: emailLoginCode === '000000' ? '000001' : '000000'},
    })
    expect(emailCodeWrong.statusCode).toBe(401)
    expect(emailCodeWrong.json().error.code).toBe('CHALLENGE_INVALID')

    const emailCodeLogin = await app.inject({
      method: 'POST',
      url: '/v1/sessions/email-code',
      payload: {email, challengeId: emailLoginChallengeId, code: emailLoginCode},
    })
    expect(emailCodeLogin.statusCode).toBe(200)
    expect(emailCodeLogin.json().data.accessToken).toBeTruthy()

    const emailCodeReplay = await app.inject({
      method: 'POST',
      url: '/v1/sessions/email-code',
      payload: {email, challengeId: emailLoginChallengeId, code: emailLoginCode},
    })
    expect(emailCodeReplay.statusCode).toBe(401)
    expect(emailCodeReplay.json().error.code).toBe('CHALLENGE_REPLAYED')

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
    expect(profile.json().data.displayName).toBe('Test User')

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

  it('requests recovery, resets password, and revokes active sessions', async () => {
    const suffix = `recover${Date.now().toString(36)}`.slice(0, 18)
    const email = `${suffix}@example.com`
    const handle = suffix
    const password = 'secure-pass-word-1'
    const nextPassword = 'secure-pass-word-2'

    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, displayName: 'Recovery User', acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    await app.inject({
      method: 'POST',
      url: '/v1/accounts/verify-email',
      payload: {token: register.json().data.verificationToken},
    })

    const login = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(login.statusCode).toBe(200)
    const accessToken = login.json().data.accessToken

    const recovery = await app.inject({
      method: 'POST',
      url: '/v1/accounts/forgot-password',
      payload: {email},
    })
    expect(recovery.statusCode).toBe(200)
    expect(recovery.json().data.requested).toBe(true)
    expect(recovery.json().data.recoveryToken).toBeTruthy()

    const reset = await app.inject({
      method: 'POST',
      url: '/v1/accounts/reset-password',
      payload: {token: recovery.json().data.recoveryToken, newPassword: nextPassword},
    })
    expect(reset.statusCode).toBe(200)
    expect(reset.json().data.reset).toBe(true)

    const revoked = await app.inject({
      method: 'GET',
      url: '/v1/accounts/me',
      headers: {authorization: `Bearer ${accessToken}`},
    })
    expect(revoked.statusCode).toBe(401)

    const oldLogin = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(oldLogin.statusCode).toBe(401)

    const newLogin = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password: nextPassword}})
    expect(newLogin.statusCode).toBe(200)
  })

  it('enrolls authenticator MFA, generates recovery codes, steps up, and disables safely', async () => {
    const suffix = `mfa${Date.now().toString(36)}`.slice(0, 18)
    const email = `${suffix}@example.com`
    const handle = suffix
    const password = 'secure-pass-word-1'

    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, displayName: 'MFA User', acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    const verificationCode = await latestMailCode(db, register.json().data.accountId, 'verification-code')
    const verifyEmail = await app.inject({
      method: 'POST',
      url: '/v1/accounts/verify-email',
      payload: {challengeId: register.json().data.verificationChallengeId, code: verificationCode},
    })
    expect(verifyEmail.statusCode).toBe(200)

    const login = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(login.statusCode).toBe(200)
    const session = login.json().data
    const authHeaders = {authorization: `Bearer ${session.accessToken}`}

    const enroll = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/enroll',
      headers: authHeaders,
      payload: {label: 'iPhone'},
    })
    expect(enroll.statusCode).toBe(200)
    const enrollment = enroll.json().data
    expect(enrollment.challengeId).toBeTruthy()
    expect(enrollment.provisioningUri).toMatch(/^otpauth:\/\/totp\//)
    expect(enrollment.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(enrollment.secretPreview).not.toContain(new URL(enrollment.provisioningUri).searchParams.get('secret'))

    const wrongVerify = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/verify',
      headers: authHeaders,
      payload: {challengeId: enrollment.challengeId, code: '000000'},
    })
    expect(wrongVerify.statusCode).toBe(401)
    expect(wrongVerify.json().error.code).toBe('CHALLENGE_INVALID')

    const totpCode = await generateTotpFromProvisioningUri(enrollment.provisioningUri)
    const enable = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/verify',
      headers: authHeaders,
      payload: {challengeId: enrollment.challengeId, code: totpCode},
    })
    expect(enable.statusCode).toBe(200)
    expect(enable.json().data.enabled).toBe(true)
    expect(enable.json().data.recoveryCodes.codes).toHaveLength(10)
    expect(enable.json().data.recoveryCodes.remaining).toBe(10)
    expect(JSON.stringify(enable.json().data)).not.toContain(new URL(enrollment.provisioningUri).searchParams.get('secret'))

    const storedTotp = await db
      .selectFrom('greenfield_totp_credentials')
      .select(['state', 'secret_ciphertext', 'confirmed_at'])
      .where('account_id', '=', register.json().data.accountId)
      .executeTakeFirstOrThrow()
    expect(storedTotp.state).toBe('active')
    expect(storedTotp.confirmed_at).toBeTruthy()
    expect(storedTotp.secret_ciphertext).not.toContain(new URL(enrollment.provisioningUri).searchParams.get('secret'))

    const replayEnable = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/verify',
      headers: authHeaders,
      payload: {challengeId: enrollment.challengeId, code: totpCode},
    })
    expect(replayEnable.statusCode).toBe(401)
    expect(replayEnable.json().error.code).toBe('CHALLENGE_REPLAYED')

    const remaining = await app.inject({
      method: 'GET',
      url: '/v1/auth/recovery-codes',
      headers: authHeaders,
    })
    expect(remaining.statusCode).toBe(200)
    expect(remaining.json().data.remaining).toBe(10)

    const firstRecoveryCode = enable.json().data.recoveryCodes.codes[0]
    const recoveryLogin = await app.inject({
      method: 'POST',
      url: '/v1/sessions/recovery-code',
      payload: {email, code: firstRecoveryCode},
    })
    expect(recoveryLogin.statusCode).toBe(200)
    expect(recoveryLogin.json().data.recoveryCodesRemaining).toBe(9)
    const recoverySession = await db
      .selectFrom('greenfield_sessions')
      .select(['authentication_strength', 'authentication_method_id'])
      .where('session_id', '=', recoveryLogin.json().data.sessionId)
      .executeTakeFirstOrThrow()
    expect(recoverySession.authentication_strength).toBe('recovery')
    expect(recoverySession.authentication_method_id).toBe(`recovery-code-${register.json().data.accountId}`)

    const recoveryReplay = await app.inject({
      method: 'POST',
      url: '/v1/sessions/recovery-code',
      payload: {email, code: firstRecoveryCode},
    })
    expect(recoveryReplay.statusCode).toBe(401)
    expect(recoveryReplay.json().error.code).toBe('INVALID_CREDENTIALS')

    const stepUp = await app.inject({
      method: 'POST',
      url: '/v1/auth/step-up/totp',
      headers: authHeaders,
      payload: {code: await generateTotpFromProvisioningUri(enrollment.provisioningUri)},
    })
    expect(stepUp.statusCode).toBe(200)
    expect(stepUp.json().data).toMatchObject({stepUp: true, authenticationStrength: 'strong'})

    const regenerated = await app.inject({
      method: 'POST',
      url: '/v1/auth/recovery-codes/regenerate',
      headers: authHeaders,
    })
    expect(regenerated.statusCode).toBe(200)
    expect(regenerated.json().data.codes).toHaveLength(10)
    expect(regenerated.json().data.codes).not.toContain(firstRecoveryCode)

    const oldUnusedCodeRejected = await app.inject({
      method: 'POST',
      url: '/v1/sessions/recovery-code',
      payload: {email, code: enable.json().data.recoveryCodes.codes[1]},
    })
    expect(oldUnusedCodeRejected.statusCode).toBe(401)
    expect(oldUnusedCodeRejected.json().error.code).toBe('INVALID_CREDENTIALS')

    const disabled = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/disable',
      headers: authHeaders,
    })
    expect(disabled.statusCode).toBe(200)
    expect(disabled.json().data.disabled).toBe(true)

    const disabledStepUp = await app.inject({
      method: 'POST',
      url: '/v1/auth/step-up/totp',
      headers: authHeaders,
      payload: {code: await generateTotpFromProvisioningUri(enrollment.provisioningUri)},
    })
    expect(disabledStepUp.statusCode).toBe(401)
    expect(disabledStepUp.json().error.code).toBe('AUTH_METHOD_UNAVAILABLE')

    const mailTemplates = await db
      .selectFrom('greenfield_mail_jobs')
      .select(['template_id'])
      .where('recipient_account_id', '=', register.json().data.accountId)
      .execute()
    expect(mailTemplates.map((row: any) => row.template_id)).toEqual(
      expect.arrayContaining(['authenticator-enabled', 'authenticator-disabled', 'recovery-code-used']),
    )
  })

  it('queues and provisions Modula Mail identity only after verified contact email', async () => {
    const account = await createVerifiedAccountWithSession(app, db, {prefix: 'mailid'})
    const headers = {authorization: `Bearer ${account.session.accessToken}`}

    const guardedAvailability = await app.inject({
      method: 'GET',
      url: '/v1/accounts/mail-local-parts/andrei/availability',
    })
    expect(guardedAvailability.statusCode).toBe(200)
    expect(guardedAvailability.json().data).toMatchObject({
      available: false,
      address: 'andrei@modula.digital',
      reason: 'operator_adoption_required',
    })

    const reservedAvailability = await app.inject({
      method: 'GET',
      url: '/v1/accounts/mail-local-parts/support/availability',
    })
    expect(reservedAvailability.statusCode).toBe(200)
    expect(reservedAvailability.json().data).toMatchObject({available: false, reason: 'reserved'})

    const pendingMail = await app.inject({method: 'GET', url: '/v1/accounts/me/modula-mail', headers})
    expect(pendingMail.statusCode).toBe(200)
    expect(pendingMail.json().data).toMatchObject({
      address: `${account.handle}@modula.digital`,
      status: 'queued',
      forwarding: {enabled: false, destination: null, keepLocalCopy: true},
    })

    const queuedRequests = await db
      .selectFrom('greenfield_mail_identity_requests')
      .select(['request_id', 'state', 'request_type'])
      .where('account_id', '=', account.accountId)
      .where('request_type', '=', 'provision')
      .execute()
    expect(queuedRequests).toHaveLength(1)
    expect(queuedRequests[0].state).toBe('queued')

    await processMailIdentityUntil(db, account.accountId, 'active')

    const activeMail = await app.inject({method: 'GET', url: '/v1/accounts/me/modula-mail', headers})
    expect(activeMail.statusCode).toBe(200)
    expect(activeMail.json().data).toMatchObject({
      address: `${account.handle}@modula.digital`,
      status: 'active',
      provider: 'dry-run-hestia',
      forwarding: {enabled: false, destination: null, keepLocalCopy: true},
    })
    expect(activeMail.json().data.providerReference).not.toContain(account.password)

    const credentials = await db
      .selectFrom('greenfield_mailbox_credentials')
      .select(['secret_hash', 'encrypted_secret'])
      .where('account_id', '=', account.accountId)
      .execute()
    expect(credentials).toHaveLength(1)
    expect(credentials[0].secret_hash).toHaveLength(64)
    expect(credentials[0].encrypted_secret).toBeNull()

    const secondProvision = await app.inject({method: 'POST', url: '/v1/accounts/me/modula-mail/provision', headers})
    expect(secondProvision.statusCode).toBe(202)
    const requestCount = await db
      .selectFrom('greenfield_mail_identity_requests')
      .select(({fn}: any) => fn.countAll<number>().as('count'))
      .where('account_id', '=', account.accountId)
      .where('request_type', '=', 'provision')
      .executeTakeFirstOrThrow()
    expect(Number((requestCount as any).count)).toBe(1)

    const forwardingWithoutStepUp = await app.inject({
      method: 'POST',
      url: '/v1/accounts/me/modula-mail/forwarding',
      headers,
      payload: {enabled: true, destination: 'msjoy.andre@gmail.com', keepLocalCopy: true},
    })
    expect(forwardingWithoutStepUp.statusCode).toBe(401)
    expect(forwardingWithoutStepUp.json().error.code).toBe('STEP_UP_REQUIRED')

    await db
      .updateTable('greenfield_sessions')
      .set({authentication_strength: 'strong', recent_authentication_at: new Date()})
      .where('session_id', '=', account.session.sessionId)
      .execute()

    const forwarding = await app.inject({
      method: 'POST',
      url: '/v1/accounts/me/modula-mail/forwarding',
      headers,
      payload: {enabled: true, destination: 'msjoy.andre@gmail.com', keepLocalCopy: true},
    })
    expect(forwarding.statusCode).toBe(200)
    expect(forwarding.json().data.forwarding).toEqual({
      enabled: true,
      destination: 'msjoy.andre@gmail.com',
      keepLocalCopy: true,
    })
    await processMailEventUntil(db, account.accountId, 'mail_identity.forwarding_applied')

    const events = await db
      .selectFrom('greenfield_mail_identity_events')
      .select(['event_type'])
      .where('account_id', '=', account.accountId)
      .execute()
    expect(events.map((event: any) => event.event_type)).toEqual(
      expect.arrayContaining([
        'mail_identity.pending',
        'mail_identity.provisioning_queued',
        'mail_identity.provisioned',
        'mail_identity.forwarding_changed',
        'mail_identity.forwarding_applied',
      ]),
    )
  })

  it('registers and authenticates passkeys with origin, RP, replay, cross-account, and revocation guards', async () => {
    const emulator = new WebAuthnEmulator()
    const account = await createVerifiedAccountWithSession(app, db, {prefix: 'passkeya'})
    const secondEmulator = new WebAuthnEmulator()
    const secondAccount = await createVerifiedAccountWithSession(app, db, {prefix: 'passkeyb'})
    const headers = {authorization: `Bearer ${account.session.accessToken}`}
    const secondHeaders = {authorization: `Bearer ${secondAccount.session.accessToken}`}

    const invalidOriginOptions = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkeys/registration/options',
      headers,
      payload: {label: 'Invalid origin'},
    })
    expect(invalidOriginOptions.statusCode).toBe(200)
    const invalidOriginResponse = emulator.createJSON('https://login.modula.digital', invalidOriginOptions.json().data.options)
    const invalidOrigin = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkeys/registration/verify',
      headers,
      payload: {challengeId: invalidOriginOptions.json().data.challengeId, response: invalidOriginResponse, label: 'Invalid origin'},
    })
    expect(invalidOrigin.statusCode).toBe(401)
    expect(invalidOrigin.json().error.code).toBe('CHALLENGE_INVALID')

    const invalidRpOptions = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkeys/registration/options',
      headers,
      payload: {label: 'Invalid RP'},
    })
    expect(invalidRpOptions.statusCode).toBe(200)
    const invalidRpResponse = emulator.createJSON('https://evil.example', {
      ...invalidRpOptions.json().data.options,
      rp: {...invalidRpOptions.json().data.options.rp, id: 'evil.example'},
    })
    const invalidRp = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkeys/registration/verify',
      headers,
      payload: {challengeId: invalidRpOptions.json().data.challengeId, response: invalidRpResponse, label: 'Invalid RP'},
    })
    expect(invalidRp.statusCode).toBe(401)
    expect(invalidRp.json().error.code).toBe('CHALLENGE_INVALID')

    const expiredRegistrationOptions = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkeys/registration/options',
      headers,
      payload: {label: 'Expired'},
    })
    expect(expiredRegistrationOptions.statusCode).toBe(200)
    const expiredRegistrationResponse = emulator.createJSON('https://modula.digital', expiredRegistrationOptions.json().data.options)
    await db
      .updateTable('greenfield_auth_challenges')
      .set({expires_at: new Date(Date.now() - 1_000)})
      .where('challenge_id', '=', expiredRegistrationOptions.json().data.challengeId)
      .execute()
    const expiredRegistration = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkeys/registration/verify',
      headers,
      payload: {challengeId: expiredRegistrationOptions.json().data.challengeId, response: expiredRegistrationResponse, label: 'Expired'},
    })
    expect(expiredRegistration.statusCode).toBe(401)
    expect(expiredRegistration.json().error.code).toBe('CHALLENGE_EXPIRED')

    const registered = await registerPasskeyForAccount(app, account, emulator, 'MacBook')
    expect(registered.result.registered).toBe(true)
    const secondRegistered = await registerPasskeyForAccount(app, secondAccount, secondEmulator, 'Second MacBook')
    expect(secondRegistered.result.registered).toBe(true)

    const passkeyList = await app.inject({method: 'GET', url: '/v1/auth/passkeys', headers})
    expect(passkeyList.statusCode).toBe(200)
    expect(passkeyList.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({passkeyId: registered.result.passkeyId, label: 'MacBook', revokedAt: null}),
      ]),
    )

    const authOptions = await app.inject({
      method: 'POST',
      url: '/v1/sessions/passkey/options',
      payload: {email: account.email},
    })
    expect(authOptions.statusCode).toBe(200)
    expect(authOptions.json().data.options.allowCredentials).toHaveLength(1)
    const authResponse = emulator.getJSON('https://modula.digital', authOptions.json().data.options)
    const passkeyLogin = await app.inject({
      method: 'POST',
      url: '/v1/sessions/passkey',
      payload: {challengeId: authOptions.json().data.challengeId, response: authResponse},
    })
    expect(passkeyLogin.statusCode).toBe(200)
    expect(passkeyLogin.json().data.accessToken).toBeTruthy()
    const passkeySession = await db
      .selectFrom('greenfield_sessions')
      .select(['authentication_strength', 'authentication_method_id'])
      .where('session_id', '=', passkeyLogin.json().data.sessionId)
      .executeTakeFirstOrThrow()
    expect(passkeySession.authentication_strength).toBe('phishing_resistant')
    expect(passkeySession.authentication_method_id).toBe(registered.result.methodId)

    const replay = await app.inject({
      method: 'POST',
      url: '/v1/sessions/passkey',
      payload: {challengeId: authOptions.json().data.challengeId, response: authResponse},
    })
    expect(replay.statusCode).toBe(401)
    expect(replay.json().error.code).toBe('CHALLENGE_REPLAYED')

    const invalidAssertionOptions = await app.inject({
      method: 'POST',
      url: '/v1/sessions/passkey/options',
      payload: {email: account.email},
    })
    expect(invalidAssertionOptions.statusCode).toBe(200)
    const invalidAssertion = emulator.getJSON('https://modula.digital', invalidAssertionOptions.json().data.options)
    invalidAssertion.response.signature = `${invalidAssertion.response.signature.slice(0, -2)}AA`
    const invalidAssertionResult = await app.inject({
      method: 'POST',
      url: '/v1/sessions/passkey',
      payload: {challengeId: invalidAssertionOptions.json().data.challengeId, response: invalidAssertion},
    })
    expect(invalidAssertionResult.statusCode).toBe(401)
    expect(invalidAssertionResult.json().error.code).toBe('INVALID_CREDENTIALS')

    const expiredAuthOptions = await app.inject({
      method: 'POST',
      url: '/v1/sessions/passkey/options',
      payload: {email: account.email},
    })
    expect(expiredAuthOptions.statusCode).toBe(200)
    const expiredAuthResponse = emulator.getJSON('https://modula.digital', expiredAuthOptions.json().data.options)
    await db
      .updateTable('greenfield_auth_challenges')
      .set({expires_at: new Date(Date.now() - 1_000)})
      .where('challenge_id', '=', expiredAuthOptions.json().data.challengeId)
      .execute()
    const expiredAuth = await app.inject({
      method: 'POST',
      url: '/v1/sessions/passkey',
      payload: {challengeId: expiredAuthOptions.json().data.challengeId, response: expiredAuthResponse},
    })
    expect(expiredAuth.statusCode).toBe(401)
    expect(expiredAuth.json().error.code).toBe('CHALLENGE_EXPIRED')

    const crossAccountOptions = await app.inject({
      method: 'POST',
      url: '/v1/sessions/passkey/options',
      payload: {email: account.email},
    })
    expect(crossAccountOptions.statusCode).toBe(200)
    const crossAccountResponse = secondEmulator.getJSON('https://modula.digital', {
      ...crossAccountOptions.json().data.options,
      allowCredentials: [{id: secondRegistered.response.id, type: 'public-key'}],
    })
    const crossAccount = await app.inject({
      method: 'POST',
      url: '/v1/sessions/passkey',
      payload: {challengeId: crossAccountOptions.json().data.challengeId, response: crossAccountResponse},
    })
    expect(crossAccount.statusCode).toBe(401)
    expect(crossAccount.json().error.code).toBe('CHALLENGE_INVALID')

    const passkeySessionHeaders = {authorization: `Bearer ${passkeyLogin.json().data.accessToken}`}
    const revoked = await app.inject({
      method: 'DELETE',
      url: `/v1/auth/passkeys/${registered.result.passkeyId}`,
      headers: passkeySessionHeaders,
    })
    expect(revoked.statusCode).toBe(200)
    expect(revoked.json().data.revoked).toBe(true)

    const revokedAuthOptions = await app.inject({
      method: 'POST',
      url: '/v1/sessions/passkey/options',
      payload: {},
    })
    expect(revokedAuthOptions.statusCode).toBe(200)
    const revokedResponse = emulator.getJSON('https://modula.digital', {
      ...revokedAuthOptions.json().data.options,
      allowCredentials: [{id: registered.response.id, type: 'public-key'}],
    })
    const revokedAuth = await app.inject({
      method: 'POST',
      url: '/v1/sessions/passkey',
      payload: {challengeId: revokedAuthOptions.json().data.challengeId, response: revokedResponse},
    })
    expect(revokedAuth.statusCode).toBe(401)
    expect(revokedAuth.json().error.code).toBe('PASSKEY_NOT_FOUND')

    const mailTemplates = await db
      .selectFrom('greenfield_mail_jobs')
      .select(['template_id'])
      .where('recipient_account_id', '=', account.accountId)
      .execute()
    expect(mailTemplates.map((row: any) => row.template_id)).toEqual(
      expect.arrayContaining(['passkey-added', 'passkey-removed']),
    )
  })

  describe('resumable email verification (resend challenge id + pending login)', () => {
    let ipCounter = 0
    const freshIp = () => {
      const n = ++ipCounter
      return `198.51.${100 + Math.floor((n - 1) / 200)}.${1 + ((n - 1) % 200)}`
    }
    const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20)
    const password = 'secure-pass-word-1'

    async function registerPending(prefix: string, remoteAddress: string) {
      const handle = unique(prefix).replace(/[^a-z0-9-]/g, '')
      const email = `${handle}@example.com`
      const register = await app.inject({
        method: 'POST',
        url: '/v1/accounts/register',
        remoteAddress,
        payload: {email, password, handle, displayName: `${prefix} User`, acceptedTerms: true, inviteCode: 'test-invite'},
      })
      expect(register.statusCode).toBe(201)
      const data = register.json().data
      return {email, handle, accountId: data.accountId as string, challengeId: data.verificationChallengeId as string}
    }
    async function mailCount(accountId: string | null) {
      let query = db.selectFrom('greenfield_mail_jobs').select(db.fn.countAll().as('n'))
      if (accountId) query = query.where('recipient_account_id', '=', accountId)
      return Number((await query.executeTakeFirstOrThrow()).n)
    }
    async function challengeState(challengeId: string) {
      return db
        .selectFrom('greenfield_auth_challenges')
        .select(['state', 'account_id', 'method_id', 'purpose'])
        .where('challenge_id', '=', challengeId)
        .executeTakeFirstOrThrow()
    }
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

    it('resend returns the new challenge id; the new id + new code verifies and the old id fails', async () => {
      const ip = freshIp()
      const pending = await registerPending('rsnd', ip)
      const firstCode = await latestMailCode(db, pending.accountId, 'verification-code')
      const resend = await app.inject({method: 'POST', url: '/v1/accounts/resend-verification', remoteAddress: ip, payload: {email: pending.email}})
      expect(resend.statusCode).toBe(200)
      const data = resend.json().data
      expect(Object.keys(data).sort()).toEqual(['challengeId', 'delivery', 'expiresAt', 'resent'])
      expect(data.resent).toBe(true)
      expect(data.challengeId).toMatch(uuidPattern)
      expect(data.challengeId).not.toBe(pending.challengeId)
      expect(Number.isNaN(Date.parse(data.expiresAt))).toBe(false)
      expect(Date.parse(data.expiresAt)).toBeGreaterThan(Date.now() + 10 * 60_000 - 5_000)
      expect(data.delivery).toEqual({channel: 'email', recipient: expect.stringMatching(/^[^@]+@example\.com$/)})
      expect(data.delivery.recipient).not.toContain(pending.handle)
      expect(await challengeState(pending.challengeId)).toMatchObject({state: 'superseded'})
      expect(await challengeState(data.challengeId)).toMatchObject({state: 'pending', account_id: pending.accountId, purpose: 'email_verification'})
      const secondCode = await latestMailCode(db, pending.accountId, 'verification-code')

      const oldWithOldCode = await app.inject({method: 'POST', url: '/v1/accounts/verify-email', remoteAddress: ip, payload: {challengeId: pending.challengeId, code: firstCode}})
      expect(oldWithOldCode.statusCode).toBe(401)
      expect(oldWithOldCode.json().error.code).toBe('CHALLENGE_INVALID')
      const oldWithNewCode = await app.inject({method: 'POST', url: '/v1/accounts/verify-email', remoteAddress: ip, payload: {challengeId: pending.challengeId, code: secondCode}})
      expect(oldWithNewCode.statusCode).toBe(401)
      expect(oldWithNewCode.json().error.code).toBe('CHALLENGE_INVALID')

      const verify = await app.inject({method: 'POST', url: '/v1/accounts/verify-email', remoteAddress: ip, payload: {challengeId: data.challengeId, code: secondCode}})
      expect(verify.statusCode).toBe(200)
      expect(verify.json().data.verified).toBe(true)
      const login = await app.inject({method: 'POST', url: '/v1/sessions', remoteAddress: ip, payload: {email: pending.email, password}})
      expect(login.statusCode).toBe(200)
    })

    it('resend for unknown or non-pending emails returns a same-shape decoy that sends nothing and can never verify', async () => {
      const ip = freshIp()
      const pending = await registerPending('dcyr', ip)
      const real = (await app.inject({method: 'POST', url: '/v1/accounts/resend-verification', remoteAddress: ip, payload: {email: pending.email}})).json()

      const mailBefore = await mailCount(null)
      const unknownEmail = `${unique('nobody')}@example.com`
      const decoyResponse = await app.inject({method: 'POST', url: '/v1/accounts/resend-verification', remoteAddress: ip, payload: {email: unknownEmail}})
      expect(decoyResponse.statusCode).toBe(200)
      const decoy = decoyResponse.json()
      expect(Object.keys(decoy).sort()).toEqual(Object.keys(real).sort())
      expect(Object.keys(decoy.data).sort()).toEqual(Object.keys(real.data).sort())
      expect(Object.keys(decoy.data.delivery).sort()).toEqual(Object.keys(real.data.delivery).sort())
      expect(decoy.data.resent).toBe(true)
      expect(decoy.data.challengeId).toMatch(uuidPattern)
      expect(decoy.data.delivery).toEqual({channel: 'email', recipient: expect.stringMatching(/^n•+@example\.com$/)})
      const ttl = (iso: string) => Date.parse(iso) - Date.now()
      expect(Math.abs(ttl(decoy.data.expiresAt) - ttl(real.data.expiresAt))).toBeLessThan(60_000)
      expect(await mailCount(null)).toBe(mailBefore)
      expect(await challengeState(decoy.data.challengeId)).toMatchObject({state: 'pending', account_id: null, method_id: null, purpose: 'email_verification'})

      // Even the exact decoy code (recovered offline from the verifier digest) cannot verify anything.
      const challengeHasher = new ChallengeService(db, loadConfig()) as any
      const row = await db.selectFrom('greenfield_auth_challenges').select(['verifier_hash']).where('challenge_id', '=', decoy.data.challengeId).executeTakeFirstOrThrow()
      let decoyCode = ''
      for (let candidate = 0; candidate < 1_000_000; candidate += 1) {
        const code = candidate.toString().padStart(6, '0')
        if (challengeHasher.hashVerifier(decoy.data.challengeId, code) === row.verifier_hash) {
          decoyCode = code
          break
        }
      }
      expect(decoyCode).toMatch(/^\d{6}$/)
      const decoyVerify = await app.inject({method: 'POST', url: '/v1/accounts/verify-email', remoteAddress: ip, payload: {challengeId: decoy.data.challengeId, code: decoyCode}})
      expect(decoyVerify.statusCode).toBe(401)
      expect(decoyVerify.json().error.code).toBe('CHALLENGE_INVALID')
      const unknownAccount = await db.selectFrom('greenfield_auth_identities').select('identity_id').where('identifier', '=', unknownEmail).executeTakeFirst()
      expect(unknownAccount).toBeUndefined()

      // A verified (non-pending) account also gets a decoy: no mail, no account-bound challenge.
      const verified = await createVerifiedAccountWithSession(app, db, {prefix: 'dcyv'})
      const verifiedMailBefore = await mailCount(verified.accountId)
      const verifiedDecoy = await app.inject({method: 'POST', url: '/v1/accounts/resend-verification', remoteAddress: ip, payload: {email: verified.email}})
      expect(verifiedDecoy.statusCode).toBe(200)
      expect(Object.keys(verifiedDecoy.json().data).sort()).toEqual(Object.keys(real.data).sort())
      expect(await challengeState(verifiedDecoy.json().data.challengeId)).toMatchObject({account_id: null})
      expect(await mailCount(verified.accountId)).toBe(verifiedMailBefore)
    })

    it('pending login with the correct password returns 403 with a fresh challenge that resumes verification', async () => {
      const ip = freshIp()
      const pending = await registerPending('pndl', ip)
      const registrationCode = await latestMailCode(db, pending.accountId, 'verification-code')
      expect(await mailCount(pending.accountId)).toBe(1)

      const wrong = await app.inject({method: 'POST', url: '/v1/sessions', remoteAddress: ip, payload: {email: pending.email, password: 'wrong-pass-word-9'}})
      expect(wrong.statusCode).toBe(401)
      expect(wrong.json().error.code).toBe('INVALID_CREDENTIALS')
      expect(wrong.json().error.details).toBeUndefined()
      expect(await mailCount(pending.accountId)).toBe(1)
      expect(await challengeState(pending.challengeId)).toMatchObject({state: 'pending'})
      const unknown = await app.inject({method: 'POST', url: '/v1/sessions', remoteAddress: ip, payload: {email: `${unique('ghost')}@example.com`, password}})
      expect(unknown.statusCode).toBe(401)
      expect(unknown.json().error.code).toBe('INVALID_CREDENTIALS')

      const pendingLogin = await app.inject({method: 'POST', url: '/v1/sessions', remoteAddress: ip, payload: {email: pending.email, password}})
      expect(pendingLogin.statusCode).toBe(403)
      const body = pendingLogin.json()
      expect(body.ok).toBe(false)
      expect(body.data).toBeUndefined()
      expect(body.error).toMatchObject({code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Email verification required', retryable: false})
      expect(Object.keys(body.error.details).sort()).toEqual(['challengeId', 'delivery', 'expiresAt'])
      expect(body.error.details.challengeId).toMatch(uuidPattern)
      expect(body.error.details.challengeId).not.toBe(pending.challengeId)
      expect(body.error.details.delivery).toEqual({channel: 'email', recipient: expect.stringMatching(/^p•+@example\.com$/)})
      expect(JSON.stringify(body)).not.toMatch(/accessToken|refreshToken|sessionId/)
      expect(await mailCount(pending.accountId)).toBe(2)
      expect(await challengeState(pending.challengeId)).toMatchObject({state: 'superseded'})
      const sessions = await db.selectFrom('greenfield_sessions').select('session_id').where('account_id', '=', pending.accountId).execute()
      expect(sessions).toHaveLength(0)

      const oldVerify = await app.inject({method: 'POST', url: '/v1/accounts/verify-email', remoteAddress: ip, payload: {challengeId: pending.challengeId, code: registrationCode}})
      expect(oldVerify.statusCode).toBe(401)
      expect(oldVerify.json().error.code).toBe('CHALLENGE_INVALID')
      const freshCode = await latestMailCode(db, pending.accountId, 'verification-code')
      const verify = await app.inject({method: 'POST', url: '/v1/accounts/verify-email', remoteAddress: ip, payload: {challengeId: body.error.details.challengeId, code: freshCode}})
      expect(verify.statusCode).toBe(200)
      const login = await app.inject({method: 'POST', url: '/v1/sessions', remoteAddress: ip, payload: {email: pending.email, password}})
      expect(login.statusCode).toBe(200)
      expect(login.json().data.accessToken).toBeTruthy()
    })

    it('register, resend and pending login share one verification-send budget per IP with no bypass', async () => {
      const verified = await createVerifiedAccountWithSession(app, db, {prefix: 'rlok'})
      const ip = freshIp()
      const pending = await registerPending('rlsh', ip) // send 1 (account, email, ip)
      const resend = await app.inject({method: 'POST', url: '/v1/accounts/resend-verification', remoteAddress: ip, payload: {email: pending.email}}) // 2
      expect(resend.statusCode).toBe(200)
      const pendingLogin = await app.inject({method: 'POST', url: '/v1/sessions', remoteAddress: ip, payload: {email: pending.email, password}}) // 3
      expect(pendingLogin.statusCode).toBe(403)
      const decoy = await app.inject({method: 'POST', url: '/v1/accounts/resend-verification', remoteAddress: ip, payload: {email: `${unique('rlnb')}@example.com`}}) // 4 (ip)
      expect(decoy.statusCode).toBe(200)
      const other = await registerPending('rlot', ip) // 5 (ip)
      const lastChallenge = pendingLogin.json().error.details.challengeId
      const mailBefore = await mailCount(pending.accountId)

      const limitedLogin = await app.inject({method: 'POST', url: '/v1/sessions', remoteAddress: ip, payload: {email: pending.email, password}})
      expect(limitedLogin.statusCode).toBe(429)
      expect(limitedLogin.json().error.code).toBe('RATE_LIMITED')
      expect(limitedLogin.json().error.details).toBeUndefined()
      expect(await mailCount(pending.accountId)).toBe(mailBefore)
      expect(await challengeState(lastChallenge)).toMatchObject({state: 'pending'})

      const limitedOtherLogin = await app.inject({method: 'POST', url: '/v1/sessions', remoteAddress: ip, payload: {email: other.email, password}})
      expect(limitedOtherLogin.statusCode).toBe(429)
      const limitedResend = await app.inject({method: 'POST', url: '/v1/accounts/resend-verification', remoteAddress: ip, payload: {email: other.email}})
      expect(limitedResend.statusCode).toBe(429)
      const limitedDecoy = await app.inject({method: 'POST', url: '/v1/accounts/resend-verification', remoteAddress: ip, payload: {email: `${unique('rlnc')}@example.com`}})
      expect(limitedDecoy.statusCode).toBe(429)
      const limitedRegister = await app.inject({
        method: 'POST',
        url: '/v1/accounts/register',
        remoteAddress: ip,
        payload: {email: `${unique('rlrg')}@example.com`, password, handle: unique('rlrg'), displayName: 'Limited User', acceptedTerms: true, inviteCode: 'test-invite'},
      })
      expect(limitedRegister.statusCode).toBe(429)

      // The limiter never blocks wrong passwords' 401 or a verified account's sign-in.
      const wrong = await app.inject({method: 'POST', url: '/v1/sessions', remoteAddress: ip, payload: {email: pending.email, password: 'wrong-pass-word-9'}})
      expect(wrong.statusCode).toBe(401)
      expect(wrong.json().error.code).toBe('INVALID_CREDENTIALS')
      const verifiedLogin = await app.inject({method: 'POST', url: '/v1/sessions', remoteAddress: ip, payload: {email: verified.email, password: verified.password}})
      expect(verifiedLogin.statusCode).toBe(200)

      // A fresh IP still hits the per-account budget for the pending account.
      const otherIpLogin = await app.inject({method: 'POST', url: '/v1/sessions', remoteAddress: freshIp(), payload: {email: pending.email, password}})
      expect(otherIpLogin.statusCode).toBe(403) // account key: register, resend, login = 3; this is 4
    })

    function expectVerificationSendLimited(response: Awaited<ReturnType<typeof app.inject>>) {
      expect(response.statusCode).toBe(429)
      expect(response.json().error.code).toBe('RATE_LIMITED')
      expect(response.json().error.message).toBe('Too many attempts')
      expect(response.json().error.details).toBeUndefined()
      expect(response.headers['retry-after']).toMatch(/^[1-9][0-9]*$/)
      const seconds = Number(response.headers['retry-after'])
      expect(seconds).toBeGreaterThan(0)
      expect(seconds).toBeLessThanOrEqual(10 * 60)
    }

    it('per-email verification-send limit is enforced with a fresh IP per request on the real and decoy paths', async () => {
      // Decoy path: a new IP every time, so only the email key can accumulate.
      const decoyEmail = `${unique('emdc')}@example.com`
      for (let i = 0; i < 5; i += 1) {
        const resend = await app.inject({
          method: 'POST',
          url: '/v1/accounts/resend-verification',
          remoteAddress: freshIp(),
          payload: {email: decoyEmail},
        })
        expect(resend.statusCode).toBe(200)
      }
      const limitedDecoy = await app.inject({
        method: 'POST',
        url: '/v1/accounts/resend-verification',
        remoteAddress: freshIp(),
        payload: {email: decoyEmail},
      })
      expectVerificationSendLimited(limitedDecoy)
      // Registering the same address is also stopped by the email key alone.
      const decoyHandle = unique('emrg').replace(/[^a-z0-9-]/g, '')
      const limitedRegister = await app.inject({
        method: 'POST',
        url: '/v1/accounts/register',
        remoteAddress: freshIp(),
        payload: {
          email: decoyEmail,
          password,
          handle: decoyHandle,
          displayName: 'Limited User',
          acceptedTerms: true,
          inviteCode: 'test-invite',
        },
      })
      expectVerificationSendLimited(limitedRegister)

      // Real resend path: four decoys plus register exhaust the email key
      // (count 5) while the new account key is only 1. The next resend from a
      // fresh IP must 429; dropping the email key on the real resend path
      // would let it through.
      const realHandle = unique('emrl').replace(/[^a-z0-9-]/g, '')
      const realEmail = `${realHandle}@example.com`
      for (let i = 0; i < 4; i += 1) {
        const resend = await app.inject({
          method: 'POST',
          url: '/v1/accounts/resend-verification',
          remoteAddress: freshIp(),
          payload: {email: realEmail},
        })
        expect(resend.statusCode).toBe(200)
      }
      const register = await app.inject({
        method: 'POST',
        url: '/v1/accounts/register',
        remoteAddress: freshIp(),
        payload: {
          email: realEmail,
          password,
          handle: realHandle,
          displayName: 'Real User',
          acceptedTerms: true,
          inviteCode: 'test-invite',
        },
      })
      expect(register.statusCode).toBe(201)
      const limitedResend = await app.inject({
        method: 'POST',
        url: '/v1/accounts/resend-verification',
        remoteAddress: freshIp(),
        payload: {email: realEmail},
      })
      expectVerificationSendLimited(limitedResend)
    })

    it('unknown-email login verifies a dummy password hash and still returns 401 INVALID_CREDENTIALS', async () => {
      const spy = vi.spyOn(passwordLib, 'verifyPassword')
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/sessions',
          remoteAddress: freshIp(),
          payload: {email: `${unique('ghost')}@example.com`, password},
        })
        expect(response.statusCode).toBe(401)
        expect(response.json().error.code).toBe('INVALID_CREDENTIALS')
        const dummyCalls = spy.mock.calls.filter(call => call[0] === password && call[1] === DUMMY_PASSWORD_HASH)
        expect(dummyCalls.length).toBeGreaterThanOrEqual(1)
      } finally {
        spy.mockRestore()
      }
    })
  })

  it('Greenfield meta works with AT disabled', async () => {
    const res = await app.inject({method: 'GET', url: '/v1/meta'})
    expect(res.statusCode).toBe(200)
    expect(res.json().data.backend).toBe('greenfield')
    expect(res.json().data.capabilities.atproto).toBe(false)
  })
})
