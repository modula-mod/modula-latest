import type {GreenfieldConnectorHealthStatus} from './connector-definition.js'
import type {GreenfieldConnectionState} from './connection-state.js'

export type GreenfieldConnection = {
  connectionId: string
  accountId: string
  providerId: string
  displayName: string
  externalAccountId?: string
  externalAccountLabel?: string
  state: GreenfieldConnectionState
  enabled: boolean
  healthStatus: GreenfieldConnectorHealthStatus
  connectedAt?: string
  lastRefreshedAt?: string
  lastUsedAt?: string
  expiresAt?: string
  revokedAt?: string
  failureCode?: string
  createdAt: string
  updatedAt: string
}

export type GreenfieldSafeConnectionSummary = Omit<GreenfieldConnection, 'externalAccountId'> & {
  externalAccountId?: never
}
