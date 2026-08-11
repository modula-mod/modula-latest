import {generate, generateSecret, generateURI, verify} from 'otplib'
import {toDataURL} from 'qrcode'
import {sql, type Kysely, type Transaction} from 'kysely'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {ConnectorCredentialEncryptionService, type ConnectorCredentialEnvelope} from '../../security/encryption/connector-credentials.js'
import {uuidv7} from '../../lib/uuidv7.js'
import {authError} from '../errors.js'
import {ChallengeService} from '../challenges/service.js'
import {CredentialRegistryService} from '../credentials/service.js'
import {SecurityEventService} from '../security-events/service.js'
import {RecoveryCodeService, type GeneratedRecoveryCodes} from './recovery-codes.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>

const ISSUER = 'Modula'
const TOTP_ALGORITHM = 'SHA1'
const TOTP_LIBRARY_ALGORITHM = 'sha1'
const TOTP_DIGITS = 6
const TOTP_PERIOD_SECONDS = 30
const TOTP_SECRET_BYTES = 20
const TOTP_ENROLLMENT_TTL_SECONDS = 10 * 60

const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export type TotpEnrollment = {
  totpId: string
  methodId: string
  challengeId: string
  provisioningUri: string
  qrCodeDataUrl: string
  secretPreview: string
  expiresAt: string
}

export type TotpVerificationResult = {
  enabled: true
  methodId: string
  recoveryCodes: GeneratedRecoveryCodes
}

type TotpEnrollmentFailureCode = 'CHALLENGE_EXPIRED' | 'CHALLENGE_INVALID' | 'CHALLENGE_REPLAYED' | 'AUTH_METHOD_UNAVAILABLE'
type TotpEnrollmentOutcome =
  | {ok: true; result: TotpVerificationResult}
  | {ok: false; code: TotpEnrollmentFailureCode}

export class TotpService {
  private readonly encryption: ConnectorCredentialEncryptionService
  private readonly challenges: ChallengeService
  private readonly credentials: CredentialRegistryService
  private readonly securityEvents: SecurityEventService
  private readonly recoveryCodes: RecoveryCodeService

  constructor(
    private readonly db: Db,
    private readonly config: Pick<
      AppConfig,
      | 'connectorCredentialEncryptionKey'
      | 'connectorCredentialEncryptionKeysByVersion'
      | 'publicWebUrl'
      | 'sessionPepper'
    >,
    services: {
      encryption?: ConnectorCredentialEncryptionService
      challenges?: ChallengeService
      credentials?: CredentialRegistryService
      securityEvents?: SecurityEventService
      recoveryCodes?: RecoveryCodeService
    } = {},
  ) {
    this.encryption = services.encryption ?? new ConnectorCredentialEncryptionService(config)
    this.challenges = services.challenges ?? new ChallengeService(db, config)
    this.credentials = services.credentials ?? new CredentialRegistryService(db)
    this.securityEvents = services.securityEvents ?? new SecurityEventService(db)
    this.recoveryCodes = services.recoveryCodes ?? new RecoveryCodeService(db, config)
  }

  forDb(db: Db): TotpService {
    return new TotpService(db, this.config, {
      encryption: this.encryption,
      challenges: this.challenges.forDb(db),
      credentials: this.credentials.forDb(db),
      securityEvents: this.securityEvents.forDb(db),
      recoveryCodes: this.recoveryCodes.forDb(db),
    })
  }

  async beginEnrollment(accountId: string, input: {label?: string | null; handle?: string | null} = {}): Promise<TotpEnrollment> {
    const account = await this.getActiveAccount(accountId)
    if (!account) throw authError('UNAUTHENTICATED')

    return this.executeWrite(async db => {
      const service = this.forDb(db)
      const now = new Date()
      await db
        .updateTable('greenfield_totp_credentials')
        .set({state: 'revoked', revoked_at: now, updated_at: now})
        .where('account_id', '=', accountId)
        .where('state', '=', 'pending')
        .execute()
      await db
        .updateTable('greenfield_authentication_methods')
        .set({state: 'revoked', revoked_at: now, updated_at: now})
        .where('account_id', '=', accountId)
        .where('method_type', '=', 'totp')
        .where('state', '=', 'pending')
        .execute()
      const methodId = await service.credentials.createTotpMethod({
        accountId,
        state: 'pending',
        verifiedAt: null,
        createdAt: now,
        metadata: {algorithm: TOTP_ALGORITHM, digits: TOTP_DIGITS, periodSeconds: TOTP_PERIOD_SECONDS},
      })

      const totpId = uuidv7()
      const secret = generateSecret({length: TOTP_SECRET_BYTES})
      const label = totpLabel(input.label, input.handle, account.primary_handle)
      const envelope = service.encryptSecret(accountId, totpId, secret)
      const provisioningUri = generateURI({
        issuer: ISSUER,
        label,
        secret,
        algorithm: TOTP_LIBRARY_ALGORITHM,
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD_SECONDS,
      })
      const qrCodeDataUrl = await toDataURL(provisioningUri, {
        errorCorrectionLevel: 'M',
        margin: 2,
        scale: 6,
        type: 'image/png',
      })
      await db
        .insertInto('greenfield_totp_credentials')
        .values({
          totp_id: totpId,
          method_id: methodId,
          account_id: accountId,
          secret_ciphertext: serializeEnvelope(envelope),
          secret_key_id: envelope.keyVersion,
          algorithm: TOTP_ALGORITHM,
          digits: TOTP_DIGITS,
          period_seconds: TOTP_PERIOD_SECONDS,
          state: 'pending',
          confirmed_at: null,
          last_used_at: null,
          created_at: now,
          updated_at: now,
          revoked_at: null,
          metadata: jsonb({label}),
        })
        .execute()
      const challenge = await service.challenges.create({
        purpose: 'totp_enrollment',
        accountId,
        methodId,
        deliveryChannel: 'authenticator',
        ttlSeconds: TOTP_ENROLLMENT_TTL_SECONDS,
        attemptLimit: 5,
        supersedeExisting: true,
        metadata: {totpId, algorithm: TOTP_ALGORITHM, digits: TOTP_DIGITS, periodSeconds: TOTP_PERIOD_SECONDS},
      })
      return {
        totpId,
        methodId,
        challengeId: challenge.challengeId,
        provisioningUri,
        qrCodeDataUrl,
        secretPreview: secretPreview(secret),
        expiresAt: challenge.expiresAt.toISOString(),
      }
    })
  }

  async verifyEnrollment(input: {
    accountId: string
    challengeId: string
    code: string
    sessionId?: string | null
    ipHash?: string | null
    userAgent?: string | null
  }): Promise<TotpVerificationResult> {
    const now = new Date()
    const outcome = await this.executeWrite<TotpEnrollmentOutcome>(async db => {
      const service = this.forDb(db)
      const challenge = await db
        .selectFrom('greenfield_auth_challenges')
        .selectAll()
        .where('challenge_id', '=', input.challengeId)
        .where('purpose', '=', 'totp_enrollment')
        .forUpdate()
        .executeTakeFirst()
      if (!challenge || challenge.account_id !== input.accountId || !challenge.method_id) {
        return {ok: false, code: 'CHALLENGE_INVALID'}
      }
      if (challenge.state === 'consumed') {
        await service.recordEnrollmentAttempt(db, challenge, 'replayed', 'CHALLENGE_REPLAYED', now)
        return {ok: false, code: 'CHALLENGE_REPLAYED'}
      }
      if (challenge.state !== 'pending') return {ok: false, code: 'CHALLENGE_INVALID'}
      if (challenge.expires_at <= now) {
        await service.recordEnrollmentAttempt(db, challenge, 'expired', 'CHALLENGE_EXPIRED', now)
        await db
          .updateTable('greenfield_auth_challenges')
          .set({state: 'expired', last_attempt_at: now})
          .where('challenge_id', '=', challenge.challenge_id)
          .execute()
        return {ok: false, code: 'CHALLENGE_EXPIRED'}
      }
      const totp = await db
        .selectFrom('greenfield_totp_credentials')
        .selectAll()
        .where('account_id', '=', input.accountId)
        .where('method_id', '=', challenge.method_id)
        .where('state', '=', 'pending')
        .executeTakeFirst()
      if (!totp) return {ok: false, code: 'AUTH_METHOD_UNAVAILABLE'}
      const secret = service.decryptSecret(totp)
      const result = await verify({
        secret,
        token: normalizeCode(input.code),
        algorithm: TOTP_LIBRARY_ALGORITHM,
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD_SECONDS,
        epochTolerance: TOTP_PERIOD_SECONDS,
      })
      if (!result.valid) {
        const nextAttemptCount = await service.incrementEnrollmentAttempt(db, challenge, now)
        const locked = nextAttemptCount >= challenge.attempt_limit
        await service.recordEnrollmentAttempt(db, challenge, locked ? 'locked' : 'failed', 'CHALLENGE_INVALID', now)
        return {ok: false, code: 'CHALLENGE_INVALID'}
      }
      await db
        .updateTable('greenfield_totp_credentials')
        .set({state: 'revoked', revoked_at: now, updated_at: now})
        .where('account_id', '=', input.accountId)
        .where('state', '=', 'active')
        .where('method_id', '!=', challenge.method_id)
        .execute()
      await db
        .updateTable('greenfield_authentication_methods')
        .set({state: 'revoked', revoked_at: now, updated_at: now})
        .where('account_id', '=', input.accountId)
        .where('method_type', '=', 'totp')
        .where('state', '=', 'active')
        .where('method_id', '!=', challenge.method_id)
        .execute()
      await db
        .updateTable('greenfield_auth_challenges')
        .set({
          state: 'consumed',
          verified_at: now,
          consumed_at: now,
          last_attempt_at: now,
        })
        .where('challenge_id', '=', challenge.challenge_id)
        .execute()
      await service.recordEnrollmentAttempt(db, challenge, 'succeeded', null, now)
      await db
        .updateTable('greenfield_totp_credentials')
        .set({state: 'active', confirmed_at: now, updated_at: now})
        .where('totp_id', '=', totp.totp_id)
        .execute()
      await db
        .updateTable('greenfield_authentication_methods')
        .set({
          state: 'active',
          strength: 'strong',
          verified_at: now,
          updated_at: now,
          metadata: jsonb({algorithm: TOTP_ALGORITHM, digits: TOTP_DIGITS, periodSeconds: TOTP_PERIOD_SECONDS}),
        })
        .where('method_id', '=', challenge.method_id)
        .execute()
      await service.securityEvents.record({
        accountId: input.accountId,
        sessionId: input.sessionId ?? null,
        eventType: 'totp.enabled',
        methodType: 'totp',
        methodId: challenge.method_id,
        severity: 'notice',
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null,
        metadata: {algorithm: TOTP_ALGORITHM, digits: TOTP_DIGITS, periodSeconds: TOTP_PERIOD_SECONDS},
        createdAt: now,
      })
      const recoveryCodes = await service.recoveryCodes.regenerate(input.accountId, {
        sessionId: input.sessionId ?? null,
        reason: 'totp_enabled',
        createdAt: now,
      })
      return {ok: true, result: {enabled: true, methodId: challenge.method_id, recoveryCodes}}
    })
    if (!outcome.ok) throw authError(outcome.code)
    return outcome.result
  }

  async verifyActiveTotp(input: {
    accountId: string
    code: string
    sessionId?: string | null
    ipHash?: string | null
    userAgent?: string | null
  }): Promise<{verified: true; methodId: string}> {
    const totp = await this.db
      .selectFrom('greenfield_totp_credentials')
      .selectAll()
      .where('account_id', '=', input.accountId)
      .where('state', '=', 'active')
      .where('revoked_at', 'is', null)
      .executeTakeFirst()
    if (!totp) throw authError('AUTH_METHOD_UNAVAILABLE')
    const result = await verify({
      secret: this.decryptSecret(totp),
      token: normalizeCode(input.code),
      algorithm: TOTP_LIBRARY_ALGORITHM,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
      epochTolerance: TOTP_PERIOD_SECONDS,
    })
    if (!result.valid) throw authError('INVALID_CREDENTIALS')
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_totp_credentials')
        .set({last_used_at: now, updated_at: now})
        .where('totp_id', '=', totp.totp_id)
        .execute()
      await this.credentials.forDb(trx).markMethodUsed(totp.method_id, now)
      await this.securityEvents.forDb(trx).record({
        accountId: input.accountId,
        sessionId: input.sessionId ?? null,
        eventType: 'totp.verified',
        methodType: 'totp',
        methodId: totp.method_id,
        severity: 'notice',
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null,
        metadata: {},
        createdAt: now,
      })
    })
    return {verified: true, methodId: totp.method_id}
  }

  async disable(input: {
    accountId: string
    sessionId?: string | null
    ipHash?: string | null
    userAgent?: string | null
  }): Promise<{disabled: true}> {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      const active = await trx
        .selectFrom('greenfield_totp_credentials')
        .selectAll()
        .where('account_id', '=', input.accountId)
        .where('state', '=', 'active')
        .where('revoked_at', 'is', null)
        .forUpdate()
        .executeTakeFirst()
      if (!active) throw authError('AUTH_METHOD_UNAVAILABLE')
      await trx
        .updateTable('greenfield_totp_credentials')
        .set({state: 'disabled', updated_at: now, revoked_at: now})
        .where('totp_id', '=', active.totp_id)
        .execute()
      await trx
        .updateTable('greenfield_authentication_methods')
        .set({state: 'disabled', updated_at: now, revoked_at: now})
        .where('method_id', '=', active.method_id)
        .execute()
      await this.recoveryCodes.forDb(trx).invalidateActive(input.accountId, now)
      await this.securityEvents.forDb(trx).record({
        accountId: input.accountId,
        sessionId: input.sessionId ?? null,
        eventType: 'totp.disabled',
        methodType: 'totp',
        methodId: active.method_id,
        severity: 'warning',
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null,
        metadata: {},
        createdAt: now,
      })
    })
    return {disabled: true}
  }

  async generateCodeForTest(accountId: string, epoch = Date.now()): Promise<string> {
    const totp = await this.db
      .selectFrom('greenfield_totp_credentials')
      .selectAll()
      .where('account_id', '=', accountId)
      .orderBy('created_at', 'desc')
      .executeTakeFirstOrThrow()
    return generate({
      secret: this.decryptSecret(totp),
      algorithm: TOTP_LIBRARY_ALGORITHM,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
      epoch,
    })
  }

  private encryptSecret(accountId: string, totpId: string, secret: string): ConnectorCredentialEnvelope {
    return this.encryption.encryptString(
      {accountId, providerId: 'modula-auth', connectionId: totpId, purpose: 'connector-credentials'},
      secret,
    )
  }

  private decryptSecret(row: Pick<Database['greenfield_totp_credentials'], 'account_id' | 'totp_id' | 'secret_ciphertext'>): string {
    const envelope = deserializeEnvelope(row.secret_ciphertext)
    return this.encryption.decryptString(
      {accountId: row.account_id, providerId: 'modula-auth', connectionId: row.totp_id, purpose: 'connector-credentials'},
      envelope,
    )
  }

  private async getActiveAccount(accountId: string): Promise<{account_id: string; primary_handle: string; status: string} | null> {
    const account = await this.db
      .selectFrom('greenfield_accounts')
      .select(['account_id', 'primary_handle', 'status'])
      .where('account_id', '=', accountId)
      .executeTakeFirst()
    if (!account || account.status !== 'active') return null
    return account
  }

  private executeWrite<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    const candidate = this.db as Db & {isTransaction?: boolean}
    if (!candidate.isTransaction && 'transaction' in candidate && typeof candidate.transaction === 'function') {
      return candidate.transaction().execute(fn)
    }
    return fn(this.db)
  }

  private async incrementEnrollmentAttempt(
    db: Db,
    challenge: Pick<Database['greenfield_auth_challenges'], 'challenge_id' | 'attempt_count' | 'attempt_limit' | 'state'>,
    now: Date,
  ): Promise<number> {
    const nextAttemptCount = challenge.attempt_count + 1
    await db
      .updateTable('greenfield_auth_challenges')
      .set({
        attempt_count: nextAttemptCount,
        last_attempt_at: now,
        state: nextAttemptCount >= challenge.attempt_limit ? 'locked' : challenge.state,
      })
      .where('challenge_id', '=', challenge.challenge_id)
      .execute()
    return nextAttemptCount
  }

  private async recordEnrollmentAttempt(
    db: Db,
    challenge: Pick<Database['greenfield_auth_challenges'], 'challenge_id' | 'account_id' | 'purpose' | 'delivery_channel'>,
    result: Database['greenfield_auth_challenge_attempts']['result'],
    failureCode: string | null,
    now: Date,
  ): Promise<void> {
    await db
      .insertInto('greenfield_auth_challenge_attempts')
      .values({
        attempt_id: uuidv7(),
        challenge_id: challenge.challenge_id,
        account_id: challenge.account_id,
        purpose: challenge.purpose,
        result,
        failure_code: failureCode,
        created_at: now,
        metadata: jsonb({deliveryChannel: challenge.delivery_channel}),
      })
      .execute()
  }
}

function serializeEnvelope(envelope: ConnectorCredentialEnvelope): string {
  return Buffer.from(
    JSON.stringify({
      algorithm: envelope.algorithm,
      keyVersion: envelope.keyVersion,
      nonce: envelope.nonce.toString('base64url'),
      ciphertext: envelope.ciphertext.toString('base64url'),
      authTag: envelope.authTag.toString('base64url'),
    }),
    'utf8',
  ).toString('base64url')
}

function deserializeEnvelope(value: string): ConnectorCredentialEnvelope {
  const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
    algorithm: ConnectorCredentialEnvelope['algorithm']
    keyVersion: string
    nonce: string
    ciphertext: string
    authTag: string
  }
  return {
    algorithm: parsed.algorithm,
    keyVersion: parsed.keyVersion,
    nonce: Buffer.from(parsed.nonce, 'base64url'),
    ciphertext: Buffer.from(parsed.ciphertext, 'base64url'),
    authTag: Buffer.from(parsed.authTag, 'base64url'),
  }
}

function normalizeCode(code: string): string {
  return code.trim().replace(/\s+/g, '')
}

function secretPreview(secret: string): string {
  return `${secret.slice(0, 4)} ${secret.slice(4, 8)} ... ${secret.slice(-4)}`
}

function totpLabel(label: string | null | undefined, handle: string | null | undefined, primaryHandle: string): string {
  const base = (label ?? '').trim() || (handle ? `@${handle}` : `@${primaryHandle}`)
  return `Modula ${base}`
}
