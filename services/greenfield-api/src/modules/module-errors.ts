export type ModuleDomainErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'NOTE_REVISION_CONFLICT'
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
