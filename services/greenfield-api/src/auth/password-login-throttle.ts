import {createHash} from 'node:crypto'
import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'

/**
 * Per-account wrong-password throttle with stepped exponential backoff
 * (Sentinel FLOWS-01 INFO, PR GF-AUTH-FLOWS-01a).
 *
 * - Keyed on a peppered SHA-256 of the normalised email, stored in the existing
 *   greenfield_auth_rate_limits table (purpose `password_login_failure`), so
 *   unknown emails are counted and throttled exactly like real accounts and the
 *   throttle never reveals whether an email exists. No migration is needed.
 * - Consecutive failures are counted in a sliding window: the count restarts
 *   when the previous failure is older than `windowSeconds`, and a successful
 *   password check deletes it.
 * - The first `freeFailures - 1` failures are free. The `freeFailures`th and later
 *   failures block further password attempts for
 *   min(baseBackoffSeconds * 2^(failures - freeFailures), maxBackoffSeconds).
 *   Defaults: 5 failures in 15 minutes, then 30 s, 60 s, 120 s, 240 s, capped at 300 s.
 * - There is no hard lockout. A blocked request is answered 429 RATE_LIMITED with
 *   Retry-After and is not counted, so an attacker cannot extend the block beyond
 *   the 5-minute cap, and the block covers password sign-in only: passkey, Apple,
 *   email-code and recovery-code sign-in and password reset stay available.
 */
export type PasswordLoginThrottleParameters = {
  windowSeconds: number
  freeFailures: number
  baseBackoffSeconds: number
  maxBackoffSeconds: number
}

export const PASSWORD_LOGIN_THROTTLE_PURPOSE = 'password_login_failure'

export const DEFAULT_PASSWORD_LOGIN_THROTTLE: PasswordLoginThrottleParameters = Object.freeze({
  windowSeconds: 15 * 60,
  freeFailures: 5,
  baseBackoffSeconds: 30,
  maxBackoffSeconds: 5 * 60,
})

export class PasswordLoginThrottledError extends Error {
  readonly code = 'RATE_LIMITED' as const
  constructor(readonly retryAfterSeconds: number) {
    super('Too many sign-in attempts. Try again later.')
    this.name = 'PasswordLoginThrottledError'
  }
}

export function passwordLoginBackoffSeconds(failures: number, parameters: PasswordLoginThrottleParameters): number {
  if (failures < parameters.freeFailures) return 0
  const exponent = Math.min(failures - parameters.freeFailures, 30)
  return Math.min(parameters.baseBackoffSeconds * 2 ** exponent, parameters.maxBackoffSeconds)
}

export class PasswordLoginThrottle {
  constructor(
    private readonly db: ModulaDb,
    private readonly pepper: string | undefined,
    readonly parameters: PasswordLoginThrottleParameters = DEFAULT_PASSWORD_LOGIN_THROTTLE,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private key(email: string): string | null {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return null
    return createHash('sha256').update(`${this.pepper ?? ''}:password-login:${normalized}`).digest('hex')
  }

  /** Throws PasswordLoginThrottledError while the email is in a backoff period. */
  async assertAllowed(email: string): Promise<void> {
    const key = this.key(email)
    if (!key) return
    const now = this.clock()
    const row = await this.db
      .selectFrom('greenfield_auth_rate_limits')
      .select(['blocked_until'])
      .where('rate_limit_key', '=', key)
      .where('purpose', '=', PASSWORD_LOGIN_THROTTLE_PURPOSE)
      .executeTakeFirst()
    if (row?.blocked_until && row.blocked_until > now) {
      throw new PasswordLoginThrottledError(Math.max(1, Math.ceil((row.blocked_until.getTime() - now.getTime()) / 1000)))
    }
  }

  /** Atomically counts one wrong-password failure and applies backoff once the free failures are used. */
  async recordFailure(email: string): Promise<{failures: number; blockedUntil: Date | null}> {
    const key = this.key(email)
    if (!key) return {failures: 0, blockedUntil: null}
    const now = this.clock()
    const windowStart = new Date(now.getTime() - this.parameters.windowSeconds * 1000)
    const result = await sql<{attempt_count: number}>`
      INSERT INTO greenfield_auth_rate_limits AS l (rate_limit_key, purpose, window_started_at, attempt_count, blocked_until, updated_at)
      VALUES (${key}, ${PASSWORD_LOGIN_THROTTLE_PURPOSE}, ${now}, 1, NULL, ${now})
      ON CONFLICT (rate_limit_key, purpose) DO UPDATE SET
        attempt_count = CASE WHEN l.updated_at <= ${windowStart} THEN 1 ELSE l.attempt_count + 1 END,
        window_started_at = CASE WHEN l.updated_at <= ${windowStart} THEN EXCLUDED.window_started_at ELSE l.window_started_at END,
        blocked_until = CASE WHEN l.updated_at <= ${windowStart} THEN NULL ELSE l.blocked_until END,
        updated_at = EXCLUDED.updated_at
      RETURNING attempt_count
    `.execute(this.db)
    const failures = Number(result.rows[0]?.attempt_count ?? 0)
    const backoff = passwordLoginBackoffSeconds(failures, this.parameters)
    if (backoff <= 0) return {failures, blockedUntil: null}
    const blockedUntil = new Date(now.getTime() + backoff * 1000)
    await this.db
      .updateTable('greenfield_auth_rate_limits')
      // GREATEST keeps a longer block set by a concurrent failure.
      .set({blocked_until: sql<Date>`GREATEST(COALESCE(blocked_until, ${blockedUntil}), ${blockedUntil})`})
      .where('rate_limit_key', '=', key)
      .where('purpose', '=', PASSWORD_LOGIN_THROTTLE_PURPOSE)
      .execute()
    return {failures, blockedUntil}
  }

  /** A correct password clears the failure count. */
  async reset(email: string): Promise<void> {
    const key = this.key(email)
    if (!key) return
    await this.db
      .deleteFrom('greenfield_auth_rate_limits')
      .where('rate_limit_key', '=', key)
      .where('purpose', '=', PASSWORD_LOGIN_THROTTLE_PURPOSE)
      .execute()
  }
}
