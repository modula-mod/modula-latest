import type {GreenfieldConnectionState} from './connection-state.js'

export type GreenfieldConnectorEventType =
  | 'connection.authorisation.started'
  | 'connection.connected'
  | 'connection.refreshed'
  | 'connection.disabled'
  | 'connection.disconnected'
  | 'connection.revoked'
  | 'connection.failed'
  | 'connection.state.transitioned'
  | 'connector.provider.registered'

export type GreenfieldConnectorEvent = {
  eventId: string
  accountId?: string
  providerId: string
  connectionId?: string
  eventType: GreenfieldConnectorEventType
  fromState?: GreenfieldConnectionState
  toState?: GreenfieldConnectionState
  metadata: Record<string, string | number | boolean | null>
  createdAt: string
}
