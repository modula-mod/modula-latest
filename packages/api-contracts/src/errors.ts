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

export type ApiErrorBody = {
  code: ApiErrorCode
  message: string
  fieldErrors?: Record<string, string>
  retryable: boolean
}
