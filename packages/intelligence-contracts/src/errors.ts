export type IntelligenceErrorCode =
  | 'MISSION_NOT_FOUND'
  | 'MISSION_ACCESS_DENIED'
  | 'INVALID_MISSION_STATE'
  | 'INVALID_ACTION_SCHEMA'
  | 'CAPABILITY_UNKNOWN'
  | 'CAPABILITY_DENIED'
  | 'PERMISSION_DENIED'
  | 'AKI_DENIED'
  | 'AKI_ABSTAINED'
  | 'GOVERNOR_BLOCKED'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_REJECTED'
  | 'EXECUTION_ALREADY_COMPLETED'
  | 'EXECUTION_FAILED'

export class IntelligenceError extends Error {
  readonly name = 'IntelligenceError'

  constructor(
    readonly code: IntelligenceErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message)
  }
}
