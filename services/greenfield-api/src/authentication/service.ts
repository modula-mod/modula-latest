import type {ModulaDb} from '../database/client.js'
import type {AppConfig} from '../config/index.js'
import {verifyPassword} from '../lib/password.js'
import {displayNameFromIdentityMetadata, MailService} from '../mail/service.js'
import {GreenfieldSessionService} from '../sessions/service.js'
import {authError} from '../auth/errors.js'
import {CredentialRegistryService} from '../auth/credentials/service.js'
import {SecurityEventService} from '../auth/security-events/service.js'
import {ChallengeService} from '../auth/challenges/service.js'
import {RecoveryCodeService} from '../auth/mfa/recovery-codes.js'

export class AuthenticationService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: Pick<AppConfig, 'sessionPepper'>,
    private readonly sessions: GreenfieldSessionService,
    private readonly mail?: MailService,
    private readonly credentials = new CredentialRegistryService(db),
    private readonly securityEvents = new SecurityEventService(db),
    private readonly challenges = new ChallengeService(db, config),
    private readonly recoveryCodes = new RecoveryCodeService(db, config),
  ) {}

  async requestEmailLoginCode(
    email: string,
    context?: {ipHash?: string; correlationId?: string},
  ): Promise<{
    requested: true
    challengeId: string
    expiresAt: string
    delivery: {channel: 'email'; recipient: string}
  }> {
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw Object.assign(new Error('Valid email required'), {code: 'VALIDATION_FAILED'})
    }
    const identity = await this.db
      .selectFrom('greenfield_auth_identities')
      .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_auth_identities.account_id')
      .select([
        'greenfield_auth_identities.account_id',
        'greenfield_auth_identities.identifier',
        'greenfield_auth_identities.verified_at',
        'greenfield_auth_identities.metadata',
        'greenfield_accounts.primary_handle',
        'greenfield_accounts.status',
      ])
      .where('greenfield_auth_identities.kind', '=', 'email')
      .where('greenfield_auth_identities.identifier', '=', normalizedEmail)
      .executeTakeFirst()

    const method = identity ? await this.credentials.findActiveEmailOtpMethod(identity.account_id) : null
    const canMail = Boolean(identity && identity.status === 'active' && identity.verified_at && method)
    let challengeId = ''
    let expiresAt = new Date(Date.now() + 10 * 60_000)

    await this.db.transaction().execute(async trx => {
      const challenge = await this.challenges.forDb(trx).create({
        purpose: 'email_login',
        accountId: canMail ? identity!.account_id : null,
        methodId: canMail ? method!.methodId : null,
        subjectIdentifier: normalizedEmail,
        deliveryChannel: 'email',
        ttlSeconds: 10 * 60,
        attemptLimit: 5,
        rateLimitKeys: [
          `email:${normalizedEmail}`,
          ...(canMail ? [`account:${identity!.account_id}`] : []),
          ...(context?.ipHash ? [`ip:${context.ipHash}`] : []),
        ],
        supersedeExisting: true,
        metadata: {
          issuedFor: 'passwordless_login',
          recipient: maskEmail(normalizedEmail),
          deliverable: canMail,
        },
      })
      challengeId = challenge.challengeId
      expiresAt = challenge.expiresAt
      if (canMail) {
        await this.mail?.queuePasswordlessLogin(trx, {
          accountId: identity!.account_id,
          email: normalizedEmail,
          displayName: displayNameFromIdentityMetadata(identity!.metadata, identity!.primary_handle),
          handle: identity!.primary_handle,
          code: challenge.code,
          expiresAt: challenge.expiresAt,
          correlationId: context?.correlationId,
        })
      }
    })

    return {
      requested: true,
      challengeId,
      expiresAt: expiresAt.toISOString(),
      delivery: {channel: 'email', recipient: maskEmail(normalizedEmail)},
    }
  }

  async loginWithEmailCode(
    email: string,
    challengeId: string,
    code: string,
    context?: {userAgent?: string; ipHash?: string; correlationId?: string},
  ) {
    const normalizedEmail = email.trim().toLowerCase()
    const verified = await this.challenges.verifyCode({
      challengeId,
      code,
      purpose: 'email_login',
      subjectIdentifier: normalizedEmail,
    })
    if (!verified.accountId) throw authError('CHALLENGE_INVALID')
    const identity = await this.db
      .selectFrom('greenfield_auth_identities')
      .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_auth_identities.account_id')
      .select([
        'greenfield_auth_identities.account_id',
        'greenfield_auth_identities.identifier',
        'greenfield_auth_identities.verified_at',
        'greenfield_auth_identities.metadata',
        'greenfield_accounts.primary_handle',
        'greenfield_accounts.status',
      ])
      .where('greenfield_auth_identities.account_id', '=', verified.accountId)
      .where('greenfield_auth_identities.kind', '=', 'email')
      .where('greenfield_auth_identities.identifier', '=', normalizedEmail)
      .executeTakeFirst()
    if (!identity || !identity.verified_at || identity.status !== 'active') throw authError('INVALID_CREDENTIALS')
    const method = await this.credentials.findActiveEmailOtpMethod(identity.account_id)
    if (!method || method.methodId !== verified.methodId) throw authError('AUTH_METHOD_UNAVAILABLE')
    const issued = await this.sessions.issue(identity.account_id, {
      ...context,
      authenticationMethodId: method.methodId,
      authenticationStrength: method.strength,
      recentAuthenticationAt: new Date(),
    })
    await this.credentials.markMethodUsed(method.methodId)
    await this.securityEvents.record({
      accountId: identity.account_id,
      sessionId: issued.sessionId,
      eventType: 'sign_in',
      methodType: 'email_otp',
      methodId: method.methodId,
      severity: 'notice',
      ipHash: context?.ipHash ?? null,
      userAgent: context?.userAgent ?? null,
      metadata: {passwordless: true},
    })
    await this.mail?.queueNewSignIn({
      accountId: identity.account_id,
      email: identity.identifier,
      displayName: displayNameFromIdentityMetadata(identity.metadata, identity.primary_handle),
      correlationId: context?.correlationId,
    })
    return issued
  }

  async loginWithRecoveryCode(
    email: string,
    code: string,
    context?: {userAgent?: string; ipHash?: string; correlationId?: string},
  ) {
    const normalizedEmail = email.trim().toLowerCase()
    const identity = await this.db
      .selectFrom('greenfield_auth_identities')
      .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_auth_identities.account_id')
      .select([
        'greenfield_auth_identities.account_id',
        'greenfield_auth_identities.identifier',
        'greenfield_auth_identities.verified_at',
        'greenfield_auth_identities.metadata',
        'greenfield_accounts.primary_handle',
        'greenfield_accounts.status',
      ])
      .where('greenfield_auth_identities.kind', '=', 'email')
      .where('greenfield_auth_identities.identifier', '=', normalizedEmail)
      .executeTakeFirst()
    if (!identity || !identity.verified_at || identity.status !== 'active') throw authError('INVALID_CREDENTIALS')
    const consumed = await this.recoveryCodes.consume(identity.account_id, code, {
      ipHash: context?.ipHash ?? null,
      userAgent: context?.userAgent ?? null,
    })
    const issued = await this.sessions.issue(identity.account_id, {
      ...context,
      authenticationMethodId: consumed.methodId,
      authenticationStrength: 'recovery',
      recentAuthenticationAt: new Date(),
    })
    await this.mail?.queueRecoveryUsed({
      accountId: identity.account_id,
      email: identity.identifier,
      displayName: displayNameFromIdentityMetadata(identity.metadata, identity.primary_handle),
      correlationId: context?.correlationId,
    })
    return {...issued, recoveryCodesRemaining: consumed.remaining}
  }

  async login(email: string, password: string, context?: {userAgent?: string; ipHash?: string; correlationId?: string}) {
    const identity = await this.db
      .selectFrom('greenfield_auth_identities')
      .innerJoin('greenfield_password_credentials', 'greenfield_password_credentials.account_id', 'greenfield_auth_identities.account_id')
      .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_auth_identities.account_id')
      .select([
        'greenfield_auth_identities.account_id',
        'greenfield_auth_identities.identifier',
        'greenfield_auth_identities.metadata',
        'greenfield_password_credentials.password_hash',
        'greenfield_accounts.primary_handle',
        'greenfield_accounts.status',
      ])
      .where('greenfield_auth_identities.kind', '=', 'email')
      .where('greenfield_auth_identities.identifier', '=', email.trim().toLowerCase())
      .executeTakeFirst()
    if (!identity || !(await verifyPassword(password, identity.password_hash))) {
      throw authError('INVALID_CREDENTIALS')
    }
    if (identity.status === 'suspended') throw authError('ACCOUNT_SUSPENDED')
    if (identity.status !== 'active') throw authError('INVALID_CREDENTIALS')
    const passwordMethod = await this.credentials.findActivePasswordMethod(identity.account_id)
    if (!passwordMethod) throw authError('AUTH_METHOD_UNAVAILABLE')
    const issued = await this.sessions.issue(identity.account_id, {
      ...context,
      authenticationMethodId: passwordMethod.methodId,
      authenticationStrength: passwordMethod.strength,
      recentAuthenticationAt: new Date(),
    })
    await this.credentials.markMethodUsed(passwordMethod.methodId)
    await this.securityEvents.record({
      accountId: identity.account_id,
      sessionId: issued.sessionId,
      eventType: 'sign_in',
      methodType: 'password',
      methodId: passwordMethod.methodId,
      severity: 'notice',
      ipHash: context?.ipHash ?? null,
      userAgent: context?.userAgent ?? null,
      metadata: {},
    })
    await this.mail?.queueNewSignIn({
      accountId: identity.account_id,
      email: identity.identifier,
      displayName: displayNameFromIdentityMetadata(identity.metadata, identity.primary_handle),
      correlationId: context?.correlationId,
    })
    return issued
  }
}

function maskEmail(email: string): string {
  const [local = '', domain = 'unknown'] = email.split('@')
  if (local.length <= 1) return `*@${domain}`
  return `${local[0]}${'•'.repeat(Math.min(5, Math.max(1, local.length - 1)))}@${domain}`
}
