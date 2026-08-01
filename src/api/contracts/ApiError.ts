export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'INVALID_RESPONSE'
  | 'CANCELLED'
  | 'UNKNOWN'
  | 'AUTHENTICATION_NOT_AVAILABLE'
  | 'CAPABILITY_DISABLED'

export class ModulaApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly requestId?: string
  readonly retryable: boolean
  readonly fieldErrors?: Record<string, string>
  readonly details?: Record<string, unknown>

  constructor(input: {
    message: string
    code: ApiErrorCode
    status: number
    requestId?: string
    retryable?: boolean
    fieldErrors?: Record<string, string>
    details?: Record<string, unknown>
  }) {
    super(input.message)
    this.name = 'ModulaApiError'
    this.code = input.code
    this.status = input.status
    this.requestId = input.requestId
    this.retryable = input.retryable ?? false
    this.fieldErrors = input.fieldErrors
    this.details = input.details
  }
}

export function isModulaApiError(error: unknown): error is ModulaApiError {
  return error instanceof ModulaApiError
}

export function isAuthenticationError(error: unknown): boolean {
  return (
    isModulaApiError(error) &&
    (error.code === 'UNAUTHENTICATED' || error.code === 'SESSION_EXPIRED')
  )
}

export function isRetryableError(error: unknown): boolean {
  return isModulaApiError(error) && error.retryable
}

export function getUserFacingErrorMessage(error: unknown): string {
  if (!isModulaApiError(error)) {
    return 'Something went wrong. Please try again.'
  }
  if (error.code === 'OFFLINE') return 'You appear to be offline.'
  if (error.code === 'TIMEOUT') return 'The request took too long. Please retry.'
  if (error.code === 'UNAUTHENTICATED' || error.code === 'SESSION_EXPIRED') {
    return 'Sign in to continue.'
  }
  if (error.code === 'FORBIDDEN') return 'This action is not available for this session.'
  if (
    error.code === 'AUTHENTICATION_NOT_AVAILABLE' ||
    error.code === 'CAPABILITY_DISABLED'
  ) {
    return 'This action is not available in preview yet.'
  }
  if (error.code === 'NOT_FOUND') return 'That content is no longer available.'
  if (error.code === 'VALIDATION_FAILED') return error.message
  if (error.retryable) return 'Modula could not load this yet. Please retry.'
  return 'Modula could not complete that action.'
}
