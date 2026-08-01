export type ConnectorDomainErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'CAPABILITY_DISABLED'
  | 'SERVER_ERROR'

export function connectorError(code: ConnectorDomainErrorCode, message: string): Error {
  return Object.assign(new Error(message), {code})
}
