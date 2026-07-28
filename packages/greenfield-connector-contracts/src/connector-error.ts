export type GreenfieldConnectorErrorCode =
  | 'CONNECTOR_NOT_FOUND'
  | 'CONNECTOR_DUPLICATE'
  | 'CONNECTOR_INVALID'
  | 'CONNECTOR_NOT_CONFIGURED'
  | 'CONNECTOR_UNAVAILABLE'
  | 'CAPABILITY_DENIED'
  | 'CAPABILITY_INVALID'
  | 'CONNECTION_INVALID_TRANSITION'

export class GreenfieldConnectorError extends Error {
  readonly code: GreenfieldConnectorErrorCode

  constructor(code: GreenfieldConnectorErrorCode, message: string) {
    super(message)
    this.name = 'GreenfieldConnectorError'
    this.code = code
  }
}
