import type {ApiErrorCode} from '@modula/api-contracts'

const AUTH_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  INVALID_CREDENTIALS: 'Invalid credentials',
  CHALLENGE_EXPIRED: 'Challenge expired',
  CHALLENGE_INVALID: 'Challenge invalid',
  CHALLENGE_REPLAYED: 'Challenge already used',
  RATE_LIMITED: 'Too many attempts',
  STEP_UP_REQUIRED: 'Recent authentication required',
  PASSKEY_NOT_FOUND: 'Passkey not found',
  AUTH_METHOD_UNAVAILABLE: 'Authentication method unavailable',
  ACCOUNT_SUSPENDED: 'Account suspended',
}

export class AuthDomainError extends Error {
  readonly code: ApiErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: ApiErrorCode, message = AUTH_ERROR_MESSAGES[code] ?? 'Authentication failed', details?: Record<string, unknown>) {
    super(message)
    this.name = 'AuthDomainError'
    this.code = code
    this.details = details
  }
}

export function authError(code: ApiErrorCode, details?: Record<string, unknown>): AuthDomainError {
  return new AuthDomainError(code, AUTH_ERROR_MESSAGES[code], details)
}
