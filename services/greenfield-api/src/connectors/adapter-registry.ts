import type {ConnectorCredentialPlaintext} from '../security/encryption/connector-credentials.js'
import {connectorError} from '../domains/connectors/errors.js'

export type ConnectorAuthorisationUrlInput = {
  accountId: string
  providerId: string
  state: string
  redirectUri: string
  scopes: string[]
  pkceChallenge: string | null
  pkceChallengeMethod: 'S256' | null
}

export type ConnectorAuthorisationUrlResult = {
  authorisationUrl: string
  expiresAt?: string
}

export type ConnectorAuthorisationCompletionInput = {
  accountId: string
  providerId: string
  stateId: string
  code: string
  redirectUri: string
  pkceVerifier: string | null
}

export type ConnectorAuthorisationCompletionResult = {
  displayName: string
  externalAccountId: string | null
  externalAccountLabel: string | null
  externalIdentityMetadata?: Record<string, unknown>
  scopes: string[]
  permissions: string[]
  credentials: ConnectorCredentialPlaintext
}

export type ConnectorHealthResult = {
  status: 'not-checked' | 'healthy' | 'degraded' | 'unhealthy' | 'unavailable'
  reasonCode: string | null
  checkedAt: string
}

export interface TrustedConnectorProviderAdapter {
  readonly providerId: string
  getAuthorisationUrl(input: ConnectorAuthorisationUrlInput): Promise<ConnectorAuthorisationUrlResult>
  completeAuthorisation(input: ConnectorAuthorisationCompletionInput): Promise<ConnectorAuthorisationCompletionResult>
  refreshCredentials(input: {
    accountId: string
    providerId: string
    connectionId: string
    credentials: ConnectorCredentialPlaintext
  }): Promise<ConnectorCredentialPlaintext>
  revokeConnection(input: {
    accountId: string
    providerId: string
    connectionId: string
    credentials?: ConnectorCredentialPlaintext
  }): Promise<void>
  getHealth(input: {
    accountId: string
    providerId: string
    connectionId: string
    credentials?: ConnectorCredentialPlaintext
  }): Promise<ConnectorHealthResult>
}

export class TrustedConnectorAdapterRegistry {
  private readonly adapters = new Map<string, TrustedConnectorProviderAdapter>()

  register(adapter: TrustedConnectorProviderAdapter): void {
    if (this.adapters.has(adapter.providerId)) {
      throw connectorError('CONFLICT', `Connector adapter already registered: ${adapter.providerId}`)
    }
    this.adapters.set(adapter.providerId, adapter)
  }

  get(providerId: string): TrustedConnectorProviderAdapter | undefined {
    return this.adapters.get(providerId)
  }

  require(providerId: string): TrustedConnectorProviderAdapter {
    const adapter = this.get(providerId)
    if (!adapter) throw connectorError('CAPABILITY_DISABLED', 'Connector provider adapter is not configured')
    return adapter
  }

  listProviderIds(): string[] {
    return [...this.adapters.keys()].sort()
  }
}
