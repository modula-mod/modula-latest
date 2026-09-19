export const INTELLIGENCE_ERROR_CODES = [
  'NO_ELIGIBLE_PROVIDER',
  'LOCAL_PROVIDER_UNAVAILABLE',
  'REMOTE_EXECUTION_FORBIDDEN',
  'CAPABILITY_UNSUPPORTED',
  'TOOL_NOT_FOUND',
  'TOOL_ARGUMENTS_INVALID',
  'TOOL_PERMISSION_DENIED',
  'REQUEST_CANCELLED',
  'PROVIDER_FAILURE',
  'INVALID_REQUEST',
  'DUPLICATE_PROVIDER',
  'PROVIDER_NOT_FOUND',
  'DUPLICATE_TOOL',
] as const

export type IntelligenceErrorCode = (typeof INTELLIGENCE_ERROR_CODES)[number]

export class IntelligenceError extends Error {
  readonly code: IntelligenceErrorCode
  readonly details?: Readonly<Record<string, unknown>>

  constructor(
    code: IntelligenceErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message)
    this.name = 'IntelligenceError'
    this.code = code
    this.details = details
  }
}

export function isIntelligenceError(value: unknown): value is IntelligenceError {
  return value instanceof IntelligenceError
}
