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

export class ChallengeService {
  constructor(
    private readonly db: RootDb,
    private readonly config?: Pick<AppConfig, 'sessionPepper'>,
  ) {}

  async create(input: ChallengeCreateInput): Promise<CreatedChallenge> {
    const now = new Date()
    const ttlSeconds = Math.max(30, Math.min(input.ttlSeconds, 24 * 60 * 60))
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)
    const challengeId = uuidv7()
    const challenge = randomBytes(32).toString('base64url')
    const code = generateNumericCode(input.codeDigits ?? 6)
    const subjectIdentifier = input.subjectIdentifier?.trim().toLowerCase() || null
    const rateLimitKey = input.rateLimitKey?.trim().toLowerCase() || null

    await this.db.transaction().execute(async trx => {
      if (rateLimitKey) {
        await this.consumeRateLimit(trx, rateLimitKey, input.purpose, now)
      }
      if (input.supersedeExisting) {
        await this.supersedePending(trx, input.purpose, input.accountId ?? null, subjectIdentifier, now)
      }
      await trx
        .insertInto('greenfield_auth_challenges')
        .values({
          challenge_id: challengeId,
          purpose: input.purpose,
          account_id: input.accountId ?? null,
          method_id: input.methodId ?? null,
          subject_identifier: subjectIdentifier,
          challenge_hash: this.hashOpaque(challenge),
          verifier_hash: this.hashVerifier(challengeId, code),
          verifier_hint: `${code.length} digits`,
          delivery_channel: input.deliveryChannel ?? 'internal',
          state: 'pending',
          attempt_limit: Math.max(1, Math.min(input.attemptLimit ?? 5, 10)),
          attempt_count: 0,
          rate_limit_key: rateLimitKey,
          expires_at: expiresAt,
          verified_at: null,
          consumed_at: null,
          superseded_at: null,
          last_attempt_at: null,
          created_at: now,
          metadata: jsonb(input.metadata ?? {}),
        })
        .execute()
    })

    return {challengeId, challenge, code, expiresAt}
  }

  async verifyCode(challengeId: string, code: string): Promise<VerifiedChallenge> {
    const now = new Date()
    const challenge = await this.db
      .selectFrom('greenfield_auth_challenges')
      .selectAll()
      .where('challenge_id', '=', challengeId)
      .executeTakeFirst()

    if (!challenge) throw authError('CHALLENGE_INVALID')
    if (challenge.state === 'consumed' || challenge.consumed_at) {
      await this.recordAttempt(challenge, 'replayed', 'CHALLENGE_REPLAYED', now)
      throw authError('CHALLENGE_REPLAYED')
    }
    if (challenge.state === 'superseded') {
      await this.recordAttempt(challenge, 'failed', 'CHALLENGE_INVALID', now)
      throw authError('CHALLENGE_INVALID')
    }
    if (challenge.state === 'locked') {
      await this.recordAttempt(challenge, 'locked', 'CHALLENGE_INVALID', now)
      throw authError('CHALLENGE_INVALID')
    }
    if (challenge.state !== 'pending') {
      await this.recordAttempt(challenge, 'failed', 'CHALLENGE_INVALID', now)
      throw authError('CHALLENGE_INVALID')
    }
    if (challenge.expires_at <= now) {
      await this.expireChallenge(challenge.challenge_id, now)
      await this.recordAttempt(challenge, 'expired', 'CHALLENGE_EXPIRED', now)
      throw authError('CHALLENGE_EXPIRED')
    }
    const verifierHash = this.hashVerifier(challenge.challenge_id, code.trim().replace(/\s+/g, ''))
    const valid = Boolean(challenge.verifier_hash) && timingSafeEqualString(verifierHash, challenge.verifier_hash ?? '')
    if (!valid) {
      await this.recordFailedChallengeAttempt(challenge, now)
      throw authError('CHALLENGE_INVALID')
    }

    await this.db.transaction().execute(async trx => {
      await trx
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
      await this.recordAttemptWithDb(trx, challenge, 'succeeded', null, now)
    })

    return {
      challengeId: challenge.challenge_id,
      accountId: challenge.account_id,
      methodId: challenge.method_id,
      purpose: challenge.purpose,
      consumedAt: now,
    }
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
    subjectIdentifier: string | null,
    now: Date,
  ): Promise<void> {
    let query = db
      .updateTable('greenfield_auth_challenges')
      .set({state: 'superseded', superseded_at: now})
      .where('purpose', '=', purpose)
      .where('state', '=', 'pending')

    if (accountId) {
      query = query.where('account_id', '=', accountId)
    } else if (subjectIdentifier) {
      query = query.where('subject_identifier', '=', subjectIdentifier)
    } else {
      return
    }
    await query.execute()
  }

  private async recordFailedChallengeAttempt(challenge: Database['greenfield_auth_challenges'], now: Date): Promise<void> {
    const nextAttemptCount = challenge.attempt_count + 1
    const locked = nextAttemptCount >= challenge.attempt_limit
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_auth_challenges')
        .set({
          attempt_count: nextAttemptCount,
          last_attempt_at: now,
          state: locked ? 'locked' : 'pending',
        })
        .where('challenge_id', '=', challenge.challenge_id)
        .execute()
      await this.recordAttemptWithDb(trx, challenge, locked ? 'locked' : 'failed', 'CHALLENGE_INVALID', now)
    })
  }

  private async expireChallenge(challengeId: string, now: Date): Promise<void> {
    await this.db
      .updateTable('greenfield_auth_challenges')
      .set({state: 'expired', last_attempt_at: now})
      .where('challenge_id', '=', challengeId)
      .where('state', '=', 'pending')
      .execute()
  }

  private recordAttempt(
    challenge: Database['greenfield_auth_challenges'],
    result: Database['greenfield_auth_challenge_attempts']['result'],
    failureCode: string | null,
    now: Date,
  ): Promise<void> {
    return this.recordAttemptWithDb(this.db, challenge, result, failureCode, now)
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
}

function generateNumericCode(digits: number): string {
  const normalizedDigits = Math.max(6, Math.min(digits, 8))
  const ceiling = 10 ** normalizedDigits
  return randomInt(0, ceiling).toString().padStart(normalizedDigits, '0')
}
