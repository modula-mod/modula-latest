export type ModuleDomainErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'NOTE_REVISION_CONFLICT'
  | 'AI_ACTION_NOT_DECLARED'
  | 'AI_ACTION_PERMISSION_REQUIRED'
  | 'AI_CONTEXT_PERMISSION_REQUIRED'
  | 'AI_RESULT_EXPIRED'
  | 'AI_RESULT_ALREADY_APPLIED'
  | 'AI_RESULT_NOT_APPLICABLE'
  | 'AI_RESULT_OWNERSHIP_MISMATCH'
  | 'CAPABILITY_DISABLED'
  | 'UNAUTHENTICATED'

export class ModuleDomainError extends Error {
  readonly code: ModuleDomainErrorCode

  constructor(code: ModuleDomainErrorCode, message: string) {
    super(message)
    this.name = 'ModuleDomainError'
    this.code = code
  }
}

export function moduleError(code: ModuleDomainErrorCode, message: string): ModuleDomainError {
  return new ModuleDomainError(code, message)
}
