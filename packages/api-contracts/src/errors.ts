export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'NOTE_REVISION_CONFLICT'
  | 'AI_ACTION_NOT_DECLARED'
  | 'AI_ACTION_PERMISSION_REQUIRED'
  | 'AI_CONTEXT_PERMISSION_REQUIRED'
  | 'AI_RESULT_EXPIRED'
  | 'AI_RESULT_ALREADY_APPLIED'
  | 'AI_RESULT_NOT_APPLICABLE'
  | 'AI_RESULT_OWNERSHIP_MISMATCH'
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
  requestId: string
  fieldErrors?: Record<string, string>
  retryable: boolean
  details?: Record<string, unknown>
}
