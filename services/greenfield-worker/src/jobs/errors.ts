/**
 * Error codes that classify why a job handler failed. Permanent codes must
 * never be retried — they go straight to job_failures + status dead_letter.
 * Anything else is treated as transient and follows the retry schedule.
 */
export const PERMANENT_ERROR_CODES = [
  'INVALID_LEXICON',
  'VALIDATION_FAILED',
  'PERMISSION_REVIEW_REQUIRED',
  'UNTRUSTED_RELEASE',
  'INSUFFICIENT_OAUTH_SCOPE',
  'CONNECTION_REVOKED',
  'UNSUPPORTED_RECORD_TYPE',
  'UNKNOWN_JOB_TYPE',
  'SMTP_AUTHENTICATION_FAILED',
  'SMTP_INVALID_RECIPIENT',
  'SMTP_PERMANENT_FAILURE',
  'MAIL_PROVISIONER_DISABLED',
  'MAIL_IDENTITY_NOT_FOUND',
  'MAIL_ADOPTION_API_ONLY',
  'MAIL_IDENTITY_NOT_ACTIVE',
  'MAIL_REQUEST_NOT_FOUND',
] as const

export type PermanentErrorCode = (typeof PERMANENT_ERROR_CODES)[number]

export function isPermanentErrorCode(code: string): code is PermanentErrorCode {
  return (PERMANENT_ERROR_CODES as readonly string[]).includes(code)
}

/**
 * Thrown by a job handler when the failure is definitively non-retryable
 * (e.g. the record fails lexicon validation, the OAuth connection was
 * revoked, or the job type is unrecognised). The runner sends these
 * straight to the dead letter without consuming a retry attempt.
 */
export class PermanentJobError extends Error {
  readonly code: PermanentErrorCode

  constructor(code: PermanentErrorCode, message: string) {
    super(message)
    this.name = 'PermanentJobError'
    this.code = code
  }
}

/**
 * Thrown (or left as a plain Error) for failures that are expected to be
 * transient — network errors, PDS unavailability, database contention, etc.
 * The runner schedules a retry using the bounded jitter schedule until
 * maximum_attempts is exhausted, then dead-letters.
 */
export class TransientJobError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'TransientJobError'
    this.code = code
  }
}

export function errorCodeFor(error: unknown): string {
  if (error instanceof PermanentJobError) return error.code
  if (error instanceof TransientJobError) return error.code
  if (error && typeof error === 'object' && 'code' in error && typeof (error as {code: unknown}).code === 'string') {
    return (error as {code: string}).code
  }
  return 'UNKNOWN_ERROR'
}

export function isPermanentFailure(error: unknown): boolean {
  if (error instanceof PermanentJobError) return true
  return isPermanentErrorCode(errorCodeFor(error))
}

export function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
