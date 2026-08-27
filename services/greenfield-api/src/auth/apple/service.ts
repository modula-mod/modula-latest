import {createRemoteJWKSet, jwtVerify} from 'jose'
import {sql} from 'kysely'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import {uuidv7} from '../../lib/uuidv7.js'
import {GreenfieldSessionService, type IssuedSessionTokens} from '../../sessions/service.js'
import {ChallengeService} from '../challenges/service.js'
import {CredentialRegistryService} from '../credentials/service.js'
import {authError} from '../errors.js'
import {SecurityEventService} from '../security-events/service.js'

const APPLE_ISSUER = 'https://appleid.apple.com'
const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys')
const MAX_ID_TOKEN_LENGTH = 16_384
const MAX_NONCE_LENGTH = 512
const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export type AppleVerifiedIdentity = {
  subject: string
  issuer: typeof APPLE_ISSUER
  audience: string
  email: string | null
  emailVerified: boolean | null
  privateEmail: boolean | null
  realUserStatus: number | null
}

export interface AppleIdentityVerifier {
  verify(idToken: string, expectedNonce: string): Promise<AppleVerifiedIdentity>
}

export class RemoteAppleIdentityVerifier implements AppleIdentityVerifier {
  private readonly jwks = createRemoteJWKSet(APPLE_JWKS_URL)

  constructor(private readonly clientIds: string[]) {}

  async verify(idToken: string, expectedNonce: string): Promise<AppleVerifiedIdentity> {
    validateCompletionInput(idToken, expectedNonce)
    try {
      const {payload} = await jwtVerify(idToken, this.jwks, {
        issuer: APPLE_ISSUER,
        audience: this.clientIds,
        algorithms: ['RS256'],
      })
      if (typeof payload.sub !== 'string' || payload.sub.length < 1 || payload.sub.length > 255) {
        throw new Error('Apple subject missing')
      }
      if (typeof payload.nonce !== 'string' || payload.nonce !== expectedNonce) {
        throw new Error('Apple nonce mismatch')
      }
      const audience = Array.isArray(payload.aud) ? payload.aud.find(value => this.clientIds.includes(value)) : payload.aud
      if (typeof audience !== 'string' || !this.clientIds.includes(audience)) {
        throw new Error('Apple audience mismatch')
      }
      return {
        subject: payload.sub,
        issuer: APPLE_ISSUER,
        audience,
        email: normalizeOptionalEmail(payload.email),
        emailVerified: parseOptionalBoolean(payload.email_verified),
        privateEmail: parseOptionalBoolean(payload.is_private_email),
        realUserStatus: typeof payload.real_user_status === 'number' ? payload.real_user_status : null,
      }
    } catch {
      throw authError('INVALID_CREDENTIALS')
    }
  }
}

export type AppleChallenge = {
  challengeId: string
  nonce: string
  expiresAt: string
  clientIds: string[]
}

export type AppleSession = IssuedSessionTokens & {accountId: string}

export class AppleAuthenticationService {
  private readonly challenges: ChallengeService
  private readonly credentials: CredentialRegistryService
  private readonly securityEvents: SecurityEventService
  private readonly verifier: AppleIdentityVerifier

  constructor(
    private readonly db: ModulaDb,
    private readonly config: Pick<AppConfig, 'appleAuthEnabled' | 'appleClientIds' | 'sessionPepper'>,
    private readonly sessions: GreenfieldSessionService,
    verifier?: AppleIdentityVerifier,
  ) {
    this.challenges = new ChallengeService(db, config)
    this.credentials = new CredentialRegistryService(db)
    this.securityEvents = new SecurityEventService(db)
    this.verifier = verifier ?? new RemoteAppleIdentityVerifier(config.appleClientIds)
  }

  status(): {configured: boolean; mode: 'identity-token'; clientIds: string[]} {
    return {
      configured: this.config.appleAuthEnabled && this.config.appleClientIds.length > 0,
      mode: 'identity-token',
      clientIds: [...this.config.appleClientIds],
    }
  }

  async beginAuthentication(context: {ipHash?: string | null} = {}): Promise<AppleChallenge> {
    this.assertConfigured()
    const created = await this.challenges.create({
      purpose: 'apple_authentication',
      deliveryChannel: 'external',
      ttlSeconds: 10 * 60,
      attemptLimit: 5,
      rateLimitKeys: context.ipHash ? [`ip:${context.ipHash}`] : [],
      metadata: {provider: 'apple', mode: 'identity-token'},
    })
    return this.serializeChallenge(created)
  }

  async beginLink(accountId: string): Promise<AppleChallenge> {
    this.assertConfigured()
    const created = await this.challenges.create({
      purpose: 'apple_linking',
      accountId,
      deliveryChannel: 'external',
      ttlSeconds: 10 * 60,
      attemptLimit: 5,
      rateLimitKeys: [`account:${accountId}`],
      supersedeExisting: true,
      metadata: {provider: 'apple', mode: 'identity-token'},
    })
    return this.serializeChallenge(created)
  }

  async completeLink(input: {
    accountId: string
    challengeId: string
    nonce: string
    idToken: string
    sessionId?: string | null
    ipHash?: string | null
    userAgent?: string
  }): Promise<{linked: true; methodId: string; provider: 'apple'; email: string | null}> {
    this.assertConfigured()
    validateCompletionInput(input.idToken, input.nonce)
    const challengeMatches = await this.challenges.matchesOpaque({
      challengeId: input.challengeId,
      challenge: input.nonce,
      purpose: 'apple_linking',
      accountId: input.accountId,
    })
    if (!challengeMatches) {
      await this.challenges.consumeOpaque({
        challengeId: input.challengeId,
        challenge: input.nonce,
        purpose: 'apple_linking',
        accountId: input.accountId,
      })
      throw authError('CHALLENGE_INVALID')
    }
    const identity = await this.verifier.verify(input.idToken, input.nonce)
    await this.challenges.consumeOpaque({
      challengeId: input.challengeId,
      challenge: input.nonce,
      purpose: 'apple_linking',
      accountId: input.accountId,
    })

    try {
      return await this.db.transaction().execute(async trx => {
        const subjectIdentity = await trx
          .selectFrom('greenfield_external_identities')
          .selectAll()
          .where('provider', '=', 'apple')
          .where('provider_subject', '=', identity.subject)
          .where('revoked_at', 'is', null)
          .forUpdate()
          .executeTakeFirst()
        if (subjectIdentity && subjectIdentity.account_id !== input.accountId) {
          throw conflict('Apple identity is already linked to another account')
        }

        const accountMethod = await trx
          .selectFrom('greenfield_authentication_methods')
          .selectAll()
          .where('account_id', '=', input.accountId)
          .where('method_type', '=', 'apple')
          .where('revoked_at', 'is', null)
          .forUpdate()
          .executeTakeFirst()

        let methodId = subjectIdentity?.method_id ?? accountMethod?.method_id ?? null
        if (subjectIdentity && accountMethod && subjectIdentity.method_id !== accountMethod.method_id) {
          throw conflict('Account Apple identity state is inconsistent')
        }
        if (accountMethod && !subjectIdentity) {
          const existingBinding = await trx
            .selectFrom('greenfield_external_identities')
            .select('provider_subject')
            .where('method_id', '=', accountMethod.method_id)
            .where('provider', '=', 'apple')
            .where('revoked_at', 'is', null)
            .executeTakeFirst()
          if (existingBinding && existingBinding.provider_subject !== identity.subject) {
            throw conflict('Account already has a different Apple identity')
          }
        }

        const now = new Date()
        if (!methodId) {
          methodId = `apple-${uuidv7()}`
          await trx
            .insertInto('greenfield_authentication_methods')
            .values({
              method_id: methodId,
              account_id: input.accountId,
              method_type: 'apple',
              display_label: 'Sign in with Apple',
              state: 'active',
              strength: 'strong',
              verified_at: now,
              last_used_at: null,
              created_at: now,
              updated_at: now,
              revoked_at: null,
              metadata: jsonb({issuer: APPLE_ISSUER, audience: identity.audience}),
            })
            .execute()
        } else {
          await trx
            .updateTable('greenfield_authentication_methods')
            .set({state: 'active', strength: 'strong', verified_at: now, updated_at: now})
            .where('method_id', '=', methodId)
            .execute()
        }

        if (subjectIdentity) {
          await trx
            .updateTable('greenfield_external_identities')
            .set({
              email: identity.email ?? subjectIdentity.email,
              email_verified: identity.emailVerified ?? subjectIdentity.email_verified,
              last_used_at: now,
              metadata: jsonb(identityMetadata(identity)),
            })
            .where('external_identity_id', '=', subjectIdentity.external_identity_id)
            .execute()
        } else {
          await trx
            .insertInto('greenfield_external_identities')
            .values({
              external_identity_id: `apple-${uuidv7()}`,
              method_id: methodId,
              account_id: input.accountId,
              provider: 'apple',
              provider_subject: identity.subject,
              provider_issuer: identity.issuer,
              email: identity.email,
              email_verified: identity.emailVerified,
              linked_at: now,
              last_used_at: now,
              revoked_at: null,
              metadata: jsonb(identityMetadata(identity)),
            })
            .execute()
        }

        await this.securityEvents.forDb(trx).record({
          accountId: input.accountId,
          sessionId: input.sessionId ?? null,
          eventType: 'external_identity.linked',
          methodType: 'apple',
          methodId,
          ipHash: input.ipHash ?? null,
          userAgent: input.userAgent,
          metadata: {provider: 'apple', issuer: APPLE_ISSUER, audience: identity.audience},
        })
        return {linked: true as const, methodId, provider: 'apple' as const, email: identity.email}
      })
    } catch (error: any) {
      if (error?.code === '23505') throw conflict('Apple identity is already linked')
      throw error
    }
  }

  async completeAuthentication(input: {
    challengeId: string
    nonce: string
    idToken: string
    userAgent?: string
    ipHash?: string | null
    clientName?: string | null
    platform?: string | null
  }): Promise<AppleSession> {
    this.assertConfigured()
    validateCompletionInput(input.idToken, input.nonce)
    const challengeMatches = await this.challenges.matchesOpaque({
      challengeId: input.challengeId,
      challenge: input.nonce,
      purpose: 'apple_authentication',
      accountId: null,
    })
    if (!challengeMatches) {
      await this.challenges.consumeOpaque({
        challengeId: input.challengeId,
        challenge: input.nonce,
        purpose: 'apple_authentication',
        accountId: null,
      })
      throw authError('CHALLENGE_INVALID')
    }
    const identity = await this.verifier.verify(input.idToken, input.nonce)

    const linked = await this.db.transaction().execute(async trx => {
      await this.challenges.forDb(trx).consumeOpaque({
        challengeId: input.challengeId,
        challenge: input.nonce,
        purpose: 'apple_authentication',
        accountId: null,
      })
      const row = await trx
        .selectFrom('greenfield_external_identities')
        .innerJoin('greenfield_authentication_methods', 'greenfield_authentication_methods.method_id', 'greenfield_external_identities.method_id')
        .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_external_identities.account_id')
        .select([
          'greenfield_external_identities.account_id as accountId',
          'greenfield_external_identities.external_identity_id as externalIdentityId',
          'greenfield_authentication_methods.method_id as methodId',
        ])
        .where('greenfield_external_identities.provider', '=', 'apple')
        .where('greenfield_external_identities.provider_subject', '=', identity.subject)
        .where('greenfield_external_identities.revoked_at', 'is', null)
        .where('greenfield_authentication_methods.state', '=', 'active')
        .where('greenfield_authentication_methods.revoked_at', 'is', null)
        .where('greenfield_accounts.status', '=', 'active')
        .executeTakeFirst()
      if (!row) return null
      const now = new Date()
      await trx
        .updateTable('greenfield_external_identities')
        .set({last_used_at: now})
        .where('external_identity_id', '=', row.externalIdentityId)
        .execute()
      await this.credentials.forDb(trx).markMethodUsed(row.methodId, now)
      return row
    })
    if (!linked) throw authError('INVALID_CREDENTIALS')

    const issued = await this.sessions.issue(linked.accountId, {
      userAgent: input.userAgent,
      ipHash: input.ipHash ?? undefined,
      authenticationMethodId: linked.methodId,
      authenticationStrength: 'strong',
      recentAuthenticationAt: new Date(),
      clientName: input.clientName,
      platform: input.platform,
    })
    await this.securityEvents.record({
      accountId: linked.accountId,
      sessionId: issued.sessionId,
      eventType: 'sign_in.succeeded',
      methodType: 'apple',
      methodId: linked.methodId,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent,
      metadata: {provider: 'apple', issuer: APPLE_ISSUER, audience: identity.audience},
    })
    return {...issued, accountId: linked.accountId}
  }

  private assertConfigured(): void {
    if (!this.status().configured) throw authError('AUTH_METHOD_UNAVAILABLE')
  }

  private serializeChallenge(created: {challengeId: string; challenge: string; expiresAt: Date}): AppleChallenge {
    return {
      challengeId: created.challengeId,
      nonce: created.challenge,
      expiresAt: created.expiresAt.toISOString(),
      clientIds: [...this.config.appleClientIds],
    }
  }
}

function validateCompletionInput(idToken: string, nonce: string): void {
  if (!idToken || idToken.length > MAX_ID_TOKEN_LENGTH || !nonce || nonce.length > MAX_NONCE_LENGTH) {
    throw authError('INVALID_CREDENTIALS')
  }
}

function normalizeOptionalEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
}

function parseOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function identityMetadata(identity: AppleVerifiedIdentity): Record<string, unknown> {
  return {
    audience: identity.audience,
    privateEmail: identity.privateEmail,
    realUserStatus: identity.realUserStatus,
  }
}

function conflict(message: string): Error & {code: 'CONFLICT'} {
  return Object.assign(new Error(message), {code: 'CONFLICT' as const})
}
