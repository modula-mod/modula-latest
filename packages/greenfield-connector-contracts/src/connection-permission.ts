import type {GreenfieldConnectorCapability} from './connector-capability.js'

export type GreenfieldConnectionPermissionState = 'requested' | 'granted' | 'denied' | 'revoked'

export type GreenfieldConnectionPermission = {
  permissionId: string
  connectionId: string
  capability: GreenfieldConnectorCapability
  state: GreenfieldConnectionPermissionState
  reason?: string
  grantedAt?: string
  revokedAt?: string
}

export type GreenfieldConnectionPermissionDecision = {
  grantedCapabilities: GreenfieldConnectorCapability[]
  deniedCapabilities: GreenfieldConnectorCapability[]
  reasonCodes: string[]
}
