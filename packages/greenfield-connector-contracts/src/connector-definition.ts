import type {GreenfieldConnectorCapability} from './connector-capability.js'
import type {GreenfieldConnectorKind} from './connector-kind.js'
import type {GreenfieldConnectorActionDefinition} from './connection-action.js'
import type {GreenfieldConnectorSyncSupport} from './connection-sync.js'
import type {GreenfieldConnectorWebhookSupport} from './connection-webhook.js'

export type GreenfieldConnectorProviderType =
  | 'first-party'
  | 'trusted-provider'
  | 'generic'
  | 'metadata-only'

export type GreenfieldConnectorAuthorisationMethodKind =
  | 'oauth2'
  | 'api-key'
  | 'personal-access-token'
  | 'signed-webhook'
  | 'none'

export type GreenfieldConnectorConfigurationState = 'configured' | 'not-configured' | 'invalid'
export type GreenfieldConnectorAvailabilityStatus = 'available' | 'unavailable' | 'coming-later'
export type GreenfieldConnectorHealthStatus = 'not-checked' | 'healthy' | 'degraded' | 'unhealthy' | 'unavailable'

export type GreenfieldConnectorConfigurationRequirement = {
  key: string
  required: boolean
  secret: boolean
  description: string
}

export type GreenfieldConnectorAuthorisationMetadata = {
  method: GreenfieldConnectorAuthorisationMethodKind
  requiresBackendFlow: boolean
  supportsPkce: boolean
  requiredConfiguration: string[]
  callbackPath?: string
}

export type GreenfieldConnectorHealth = {
  status: GreenfieldConnectorHealthStatus
  checkedAt?: string
  reasonCode?: string
}

export type GreenfieldConnectorRateLimitPolicy = {
  windowSeconds: number
  maximumRequests: number
  burst?: number
}

export type GreenfieldConnectorDefinition = {
  providerId: string
  displayName: string
  providerType: GreenfieldConnectorProviderType
  connectorKinds: GreenfieldConnectorKind[]
  capabilities: GreenfieldConnectorCapability[]
  authorisation: GreenfieldConnectorAuthorisationMetadata
  requiredConfiguration: GreenfieldConnectorConfigurationRequirement[]
  configuredStatus: GreenfieldConnectorConfigurationState
  availabilityStatus: GreenfieldConnectorAvailabilityStatus
  health: GreenfieldConnectorHealth
  iconRef: string
  privacySummary: string
  dataAccessSummary: string
  supportedActions: GreenfieldConnectorActionDefinition[]
  sync: GreenfieldConnectorSyncSupport
  webhook: GreenfieldConnectorWebhookSupport
  rateLimit: GreenfieldConnectorRateLimitPolicy
  adapterTrusted: boolean
  operational: boolean
}

export type GreenfieldConnectorReadinessReasonCode =
  | 'connector.ready'
  | 'connector.not-configured'
  | 'connector.unavailable'
  | 'connector.coming-later'
  | 'connector.health-not-checked'
  | 'connector.unhealthy'
  | 'connector.adapter-untrusted'
  | 'connector.capability-invalid'
  | 'connector.callback-missing'

export type GreenfieldConnectorReadiness = {
  operational: boolean
  reasonCodes: GreenfieldConnectorReadinessReasonCode[]
}
