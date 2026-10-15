/**
 * Bounded retry schedule with jitter.
 *
 * Attempt 1 → immediate (available_at = now at enqueue time)
 * Attempt 2 → ~30s
 * Attempt 3 → ~2m
 * Attempt 4 → ~10m
 * Attempt 5 → ~1h
 *
 * Anything beyond the configured `maximum_attempts` (default 5) is dead-lettered
 * rather than retried again, and permanent error codes skip retries entirely.
 */
const BASE_DELAYS_MS = [0, 30_000, 120_000, 600_000, 3_600_000]

/** +/- 20% jitter so many jobs failing at once don't retry in lockstep. */
const JITTER_FRACTION = 0.2

export function baseDelayForAttempt(nextAttemptNumber: number): number {
  const index = Math.min(Math.max(nextAttemptNumber - 1, 0), BASE_DELAYS_MS.length - 1)
  return BASE_DELAYS_MS[index] ?? BASE_DELAYS_MS[BASE_DELAYS_MS.length - 1]!
}

export function computeRetryDelayMs(nextAttemptNumber: number, random: () => number = Math.random): number {
  const base = baseDelayForAttempt(nextAttemptNumber)
  if (base <= 0) return 0
  const jitter = base * JITTER_FRACTION * (random() * 2 - 1)
  return Math.max(0, Math.round(base + jitter))
}

export function computeNextAvailableAt(
  nextAttemptNumber: number,
  now: Date = new Date(),
  random?: () => number,
): Date {
  return new Date(now.getTime() + computeRetryDelayMs(nextAttemptNumber, random))
}

export function shouldDeadLetter(nextAttemptNumber: number, maximumAttempts: number): boolean {
  return nextAttemptNumber > maximumAttempts
}

export const RETRY_DELAYS_MS = BASE_DELAYS_MS

export function nextAvailableAt(attemptCount: number, now = Date.now()): Date {
  return computeNextAvailableAt(attemptCount + 1, new Date(now))
}

/** Exponential, jittered backoff for a database or other worker-loop outage. */
export function infrastructureBackoffMs(
  failureCount: number,
  maximumMs: number,
  random: () => number = Math.random,
): number {
  const boundedFailureCount = Math.max(1, Math.min(16, Math.floor(failureCount)))
  const base = Math.min(maximumMs, 1_000 * 2 ** (boundedFailureCount - 1))
  return Math.min(maximumMs, Math.max(250, Math.round(base * (0.8 + random() * 0.4))))
}

import {isPermanentErrorCode} from './errors.js'

export function isPermanentError(code: string): boolean {
  return (
    isPermanentErrorCode(code) ||
    code === 'INVALID_LEXICON_RECORD' ||
    code === 'INSUFFICIENT_OAUTH_PERMISSION' ||
    code === 'REVOKED_CONNECTION'
  )
}
