import {createHash, randomBytes, randomInt} from 'node:crypto'
import {sql, type Kysely, type Transaction} from 'kysely'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import type {AuthenticationChallengePurpose, AuthenticationDeliveryChannel, Database} from '../../database/types.js'
import {timingSafeEqualString} from '../../lib/timing-safe.js'
import {uuidv7} from '../../lib/uuidv7.js'
import {authError} from '../errors.js'

type RootDb = ModulaDb | Kysely<Database>
type Db = RootDb | Transaction<Database>
const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export type ChallengeCreateInput = {
  purpose: AuthenticationChallengePurpose
  accountId?: string | null
  methodId?: string | null
  subjectIdentifier?: string | null
  deliveryChannel?: AuthenticationDeliveryChannel
  ttlSeconds: number
  attemptLimit?: number
  codeDigits?: number
  rateLimitKey?: string | null
  rateLimitKeys?: string[]
  supersedeExisting?: boolean
  metadata?: Record<string, unknown>
}

export type CreatedChallenge = {
  challengeId: string
  challenge: string
  code: string
  expiresAt: Date
}

export type VerifiedChallenge = {
  challengeId: string
  accountId: string | null
  methodId: string | null
  purpose: AuthenticationChallengePurpose
  consumedAt: Date
}

export type ChallengeVerifyInput = {
  challengeId: string
  code: string
  purpose?: AuthenticationChallengePurpose
  accountId?: string | null
  methodId?: string | null
  subjectIdentifier?: string | null
}

export type OpaqueChallengeInput = {
  challengeId: string
  challenge: string
  purpose?: AuthenticationChallengePurpose
  accountId?: string | null
  methodId?: string | null
  subjectIdentifier?: string | null
}

type ChallengeFailureCode = 'CHALLENGE_EXPIRED' | 'CHALLENGE_INVALID' | 'CHALLENGE_REPLAYED'
type ChallengeVerificationOutcome =
  | {ok: true; challenge: VerifiedChallenge}
  | {ok: false; code: ChallengeFailureCode}

export class ChallengeService {
  constructor(
    private readonly db: Db,
    private readonly config?: Pick<AppConfig, 'sessionPepper'>,
  ) {}

  forDb(db: Db): ChallengeService {
    return new ChallengeService(db, this.config)
  }

  async create(input: ChallengeCreateInput): Promise<CreatedChallenge> {
    return this.executeWrite(db => this.createWithDb(db, input))
  }

  private async createWithDb(db: Db, input: ChallengeCreateInput): Promise<CreatedChallenge> {
    const now = new Date()
    const ttlSeconds = Math.max(30, Math.min(input.ttlSeconds, 24 * 60 * 60))
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)
    const challengeId = uuidv7()
    const challenge = randomBytes(32).toString('base64url')
    const code = generateNumericCode(input.codeDigits ?? 6)
    const subjectIdentifier = input.subjectIdentifier?.trim().toLowerCase() || null
    const targetHash = subjectIdentifier ? this.hashTarget(subjectIdentifier) : null
    const rateLimitKeys = Array.from(
      new Set(
        [input.rateLimitKey, ...(input.rateLimitKeys ?? [])]
          .map(key => key?.trim().toLowerCase())
          .filter((key): key is string => Boolean(key)),
      ),
    ).map(key => this.hashRateLimitKey(input.purpose, key))

    for (const rateLimitKey of rateLimitKeys) {
      await this.consumeRateLimit(db, rateLimitKey, input.purpose, now)
    }
    if (input.supersedeExisting) {
      await this.supersedePending(db, input.purpose, input.accountId ?? null, targetHash, now)
    }
    await db
      .insertInto('greenfield_auth_challenges')
      .values({
        challenge_id: challengeId,
        purpose: input.purpose,
        account_id: input.accountId ?? null,
        method_id: input.methodId ?? null,
        subject_identifier: targetHash ? `sha256:${targetHash.slice(0, 24)}` : null,
        target_hash: targetHash,
        challenge_hash: this.hashOpaque(challenge),
        verifier_hash: this.hashVerifier(challengeId, code),
        verifier_hint: `${code.length} digits`,
        delivery_channel: input.deliveryChannel ?? 'internal',
        state: 'pending',
        attempt_limit: Math.max(1, Math.min(input.attemptLimit ?? 5, 10)),
        attempt_count: 0,
        rate_limit_key: rateLimitKeys[0] ?? null,
        expires_at: expiresAt,
        verified_at: null,
        consumed_at: null,
        superseded_at: null,
        last_attempt_at: null,
        created_at: now,
        metadata: jsonb(input.metadata ?? {}),
      })
      .execute()

    return {challengeId, challenge, code, expiresAt}
  }

  async verifyCode(input: ChallengeVerifyInput): Promise<VerifiedChallenge>
  async verifyCode(challengeId: string, code: string): Promise<VerifiedChallenge>
  async verifyCode(inputOrChallengeId: ChallengeVerifyInput | string, code?: string): Promise<VerifiedChallenge> {
    const input =
      typeof inputOrChallengeId === 'string'
        ? {challengeId: inputOrChallengeId, code: code ?? ''}
        : inputOrChallengeId
    const now = new Date()

    const outcome = await this.executeWrite<ChallengeVerificationOutcome>(async db => {
      const challenge = await db
        .selectFrom('greenfield_auth_challenges')
        .selectAll()
        .where('challenge_id', '=', input.challengeId)
        .forUpdate()
        .executeTakeFirst()

      if (!challenge) return {ok: false, code: 'CHALLENGE_INVALID'}

      const reject = async (
        result: Database['greenfield_auth_challenge_attempts']['result'],
        failureCode: string,
        state?: Database['greenfield_auth_challenges']['state'],
        incrementAttempt = false,
      ): Promise<ChallengeVerificationOutcome> => {
        const nextAttemptCount = incrementAttempt ? challenge.attempt_count + 1 : challenge.attempt_count
        const locked = incrementAttempt && nextAttemptCount >= challenge.attempt_limit
        await db
          .updateTable('greenfield_auth_challenges')
          .set({
            attempt_count: nextAttemptCount,
            last_attempt_at: now,
            state: locked ? 'locked' : (state ?? challenge.state),
          })
          .where('challenge_id', '=', challenge.challenge_id)
          .execute()
        await this.recordAttemptWithDb(db, challenge, locked ? 'locked' : result, failureCode, now)
        const code =
          failureCode === 'CHALLENGE_EXPIRED'
            ? 'CHALLENGE_EXPIRED'
            : failureCode === 'CHALLENGE_REPLAYED'
              ? 'CHALLENGE_REPLAYED'
              : 'CHALLENGE_INVALID'
        return {ok: false, code}
      }

      if (challenge.state === 'consumed' || challenge.consumed_at) {
        return reject('replayed', 'CHALLENGE_REPLAYED')
      }
      if (challenge.state === 'superseded') {
        return reject('failed', 'CHALLENGE_INVALID')
      }
      if (challenge.state === 'locked') {
        return reject('locked', 'CHALLENGE_INVALID')
      }
      if (challenge.state !== 'pending') {
        return reject('failed', 'CHALLENGE_INVALID')
      }
      if (input.purpose && challenge.purpose !== input.purpose) {
        return reject('failed', 'CHALLENGE_INVALID', undefined, true)
      }
      if (input.accountId !== undefined && challenge.account_id !== (input.accountId ?? null)) {
        return reject('failed', 'CHALLENGE_INVALID', undefined, true)
      }
      if (input.methodId !== undefined && challenge.method_id !== (input.methodId ?? null)) {
        return reject('failed', 'CHALLENGE_INVALID', undefined, true)
      }
      if (input.subjectIdentifier) {
        const expectedTargetHash = this.hashTarget(input.subjectIdentifier.trim().toLowerCase())
        if (challenge.target_hash !== expectedTargetHash) {
          return reject('failed', 'CHALLENGE_INVALID', undefined, true)
        }
      }
      if (challenge.expires_at <= now) {
        return reject('expired', 'CHALLENGE_EXPIRED', 'expired')
      }
      const verifierHash = this.hashVerifier(challenge.challenge_id, input.code.trim().replace(/\s+/g, ''))
      const valid = Boolean(challenge.verifier_hash) && timingSafeEqualString(verifierHash, challenge.verifier_hash ?? '')
      if (!valid) {
        return reject('failed', 'CHALLENGE_INVALID', undefined, true)
      }

      await db
        .updateTable('greenfield_auth_challenges')
        .set({
          state: 'consumed',
          verified_at: now,
          consumed_at: now,
          last_attempt_at: now,
        })
        .where('challenge_id', '=', challenge.challenge_id)
        .where('state', '=', 'pending')
        .execute()
      await this.recordAttemptWithDb(db, challenge, 'succeeded', null, now)

      return {
        ok: true,
        challenge: {
          challengeId: challenge.challenge_id,
          accountId: challenge.account_id,
          methodId: challenge.method_id,
          purpose: challenge.purpose,
          consumedAt: now,
        },
      }
    })
    if (!outcome.ok) throw authError(outcome.code)
    return outcome.challenge
  }

  async matchesOpaque(input: OpaqueChallengeInput): Promise<boolean> {
    const challenge = await this.db
      .selectFrom('greenfield_auth_challenges')
      .selectAll()
      .where('challenge_id', '=', input.challengeId)
      .executeTakeFirst()
    if (!challenge) return false
    if (challenge.state !== 'pending' || challenge.expires_at <= new Date()) return false
    if (input.purpose && challenge.purpose !== input.purpose) return false
    if (input.accountId !== undefined && challenge.account_id !== (input.accountId ?? null)) return false
    if (input.methodId !== undefined && challenge.method_id !== (input.methodId ?? null)) return false
    if (input.subjectIdentifier) {
      const expectedTargetHash = this.hashTarget(input.subjectIdentifier.trim().toLowerCase())
      if (challenge.target_hash !== expectedTargetHash) return false
    }
    return timingSafeEqualString(this.hashOpaque(input.challenge), challenge.challenge_hash)
  }

  async consumeOpaque(input: OpaqueChallengeInput): Promise<VerifiedChallenge> {
    const now = new Date()
    const outcome = await this.executeWrite<ChallengeVerificationOutcome>(async db => {
      const challenge = await db
        .selectFrom('greenfield_auth_challenges')
        .selectAll()
        .where('challenge_id', '=', input.challengeId)
        .forUpdate()
        .executeTakeFirst()
      if (!challenge) return {ok: false, code: 'CHALLENGE_INVALID'}
      const reject = async (
        result: Database['greenfield_auth_challenge_attempts']['result'],
        failureCode: string,
        state?: Database['greenfield_auth_challenges']['state'],
        incrementAttempt = false,
      ): Promise<ChallengeVerificationOutcome> => {
        const nextAttemptCount = incrementAttempt ? challenge.attempt_count + 1 : challenge.attempt_count
        const locked = incrementAttempt && nextAttemptCount >= challenge.attempt_limit
        await db
          .updateTable('greenfield_auth_challenges')
          .set({
            attempt_count: nextAttemptCount,
            last_attempt_at: now,
            state: locked ? 'locked' : (state ?? challenge.state),
          })
          .where('challenge_id', '=', challenge.challenge_id)
          .execute()
        await this.recordAttemptWithDb(db, challenge, locked ? 'locked' : result, failureCode, now)
        const code =
          failureCode === 'CHALLENGE_EXPIRED'
            ? 'CHALLENGE_EXPIRED'
            : failureCode === 'CHALLENGE_REPLAYED'
              ? 'CHALLENGE_REPLAYED'
              : 'CHALLENGE_INVALID'
        return {ok: false, code}
      }
      if (challenge.state === 'consumed' || challenge.consumed_at) {
        return reject('replayed', 'CHALLENGE_REPLAYED')
      }
      if (challenge.state !== 'pending') return reject('failed', 'CHALLENGE_INVALID')
      if (input.purpose && challenge.purpose !== input.purpose) return reject('failed', 'CHALLENGE_INVALID', undefined, true)
      if (input.accountId !== undefined && challenge.account_id !== (input.accountId ?? null)) return reject('failed', 'CHALLENGE_INVALID', undefined, true)
      if (input.methodId !== undefined && challenge.method_id !== (input.methodId ?? null)) return reject('failed', 'CHALLENGE_INVALID', undefined, true)
      if (input.subjectIdentifier) {
        const expectedTargetHash = this.hashTarget(input.subjectIdentifier.trim().toLowerCase())
        if (challenge.target_hash !== expectedTargetHash) return reject('failed', 'CHALLENGE_INVALID', undefined, true)
      }
      if (challenge.expires_at <= now) return reject('expired', 'CHALLENGE_EXPIRED', 'expired')
      if (!timingSafeEqualString(this.hashOpaque(input.challenge), challenge.challenge_hash)) {
        return reject('failed', 'CHALLENGE_INVALID', undefined, true)
      }
      await db
        .updateTable('greenfield_auth_challenges')
        .set({state: 'consumed', verified_at: now, consumed_at: now, last_attempt_at: now})
        .where('challenge_id', '=', challenge.challenge_id)
        .where('state', '=', 'pending')
        .execute()
      await this.recordAttemptWithDb(db, challenge, 'succeeded', null, now)
      return {
        ok: true,
        challenge: {
          challengeId: challenge.challenge_id,
          accountId: challenge.account_id,
          methodId: challenge.method_id,
          purpose: challenge.purpose,
          consumedAt: now,
        },
      }
    })
    if (!outcome.ok) throw authError(outcome.code)
    return outcome.challenge
  }

  private async consumeRateLimit(
    db: Db,
    rateLimitKey: string,
    purpose: AuthenticationChallengePurpose,
    now: Date,
  ): Promise<void> {
    const windowSeconds = 10 * 60
    const maximum = 5
    const existing = await db
      .selectFrom('greenfield_auth_rate_limits')
      .selectAll()
      .where('rate_limit_key', '=', rateLimitKey)
      .where('purpose', '=', purpose)
      .executeTakeFirst()

    if (existing?.blocked_until && existing.blocked_until > now) {
      throw authError('RATE_LIMITED')
    }
    if (!existing || now.getTime() - existing.window_started_at.getTime() > windowSeconds * 1000) {
      await db
        .insertInto('greenfield_auth_rate_limits')
        .values({
          rate_limit_key: rateLimitKey,
          purpose,
          window_started_at: now,
          attempt_count: 1,
          blocked_until: null,
          updated_at: now,
        })
        .onConflict(oc =>
          oc.columns(['rate_limit_key', 'purpose']).doUpdateSet({
            window_started_at: now,
            attempt_count: 1,
            blocked_until: null,
            updated_at: now,
          }),
        )
        .execute()
      return
    }

    const nextCount = existing.attempt_count + 1
    const blockedUntil = nextCount > maximum ? new Date(now.getTime() + windowSeconds * 1000) : null
    await db
      .updateTable('greenfield_auth_rate_limits')
      .set({attempt_count: nextCount, blocked_until: blockedUntil, updated_at: now})
      .where('rate_limit_key', '=', rateLimitKey)
      .where('purpose', '=', purpose)
      .execute()
    if (blockedUntil) throw authError('RATE_LIMITED')
  }

  private async supersedePending(
    db: Db,
    purpose: AuthenticationChallengePurpose,
    accountId: string | null,
    targetHash: string | null,
    now: Date,
  ): Promise<void> {
    let query = db
      .updateTable('greenfield_auth_challenges')
      .set({state: 'superseded', superseded_at: now})
      .where('purpose', '=', purpose)
      .where('state', '=', 'pending')

    if (accountId) {
      query = query.where('account_id', '=', accountId)
    } else if (targetHash) {
      query = query.where('target_hash', '=', targetHash)
    } else {
      return
    }
    await query.execute()
  }

  private async recordAttemptWithDb(
    db: Db,
    challenge: Database['greenfield_auth_challenges'],
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

  private hashOpaque(value: string): string {
    return createHash('sha256').update(`${this.config?.sessionPepper ?? ''}:challenge:${value}`).digest('hex')
  }

  private hashVerifier(challengeId: string, verifier: string): string {
    return createHash('sha256')
      .update(`${this.config?.sessionPepper ?? ''}:verifier:${challengeId}:${verifier}`)
      .digest('hex')
  }

  private hashTarget(value: string): string {
    return createHash('sha256').update(`${this.config?.sessionPepper ?? ''}:target:${value}`).digest('hex')
  }

  private hashRateLimitKey(purpose: AuthenticationChallengePurpose, value: string): string {
    return createHash('sha256').update(`${this.config?.sessionPepper ?? ''}:rate:${purpose}:${value}`).digest('hex')
  }

  private executeWrite<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    const candidate = this.db as Db & {isTransaction?: boolean}
    if (!candidate.isTransaction && 'transaction' in candidate && typeof candidate.transaction === 'function') {
      return candidate.transaction().execute(fn)
    }
    return fn(this.db)
  }
}

function generateNumericCode(digits: number): string {
  const normalizedDigits = Math.max(6, Math.min(digits, 8))
  const ceiling = 10 ** normalizedDigits
  return randomInt(0, ceiling).toString().padStart(normalizedDigits, '0')
}
