import type {GreenfieldConnectionState} from '@modula/greenfield-connector-contracts'
import {GreenfieldConnectorProviderRegistry} from '../../../connectors/provider-registry.js'
import type {ModulaDb} from '../../../database/client.js'
import {connectorError} from '../errors.js'
import {
  ConnectorConnectionRepository,
  type ConnectorConnectionProjection,
  type CreateConnectorConnectionInput,
} from './repository.js'

export class ConnectorConnectionService {
  private readonly repository: ConnectorConnectionRepository

  constructor(
    db: ModulaDb,
    private readonly providers: GreenfieldConnectorProviderRegistry,
  ) {
    this.repository = new ConnectorConnectionRepository(db)
  }

  list(accountId: string): Promise<ConnectorConnectionProjection[]> {
    return this.repository.list(accountId)
  }

  async get(accountId: string, connectionId: string): Promise<ConnectorConnectionProjection> {
    const connection = await this.repository.get(accountId, connectionId)
    if (!connection) throw connectorError('NOT_FOUND', 'Connection not found')
    return connection
  }

  async create(input: CreateConnectorConnectionInput): Promise<ConnectorConnectionProjection> {
    this.requireProvider(input.providerId)
    return this.repository.create(input)
  }

  async enable(accountId: string, connectionId: string): Promise<ConnectorConnectionProjection> {
    return this.repository.transition({
      accountId,
      connectionId,
      toState: 'connected',
      enabled: true,
      eventType: 'connector.connection.enabled',
    })
  }

  async disable(accountId: string, connectionId: string): Promise<ConnectorConnectionProjection> {
    return this.repository.transition({
      accountId,
      connectionId,
      toState: 'disabled',
      enabled: false,
      eventType: 'connector.connection.disabled',
    })
  }

  async reconnect(
    accountId: string,
    connectionId: string,
    idempotencyKey?: string | null,
  ): Promise<ConnectorConnectionProjection> {
    return this.repository.transition({
      accountId,
      connectionId,
      toState: 'authorising',
      enabled: false,
      idempotencyKey,
      eventType: 'connector.connection.reconnect_requested',
    })
  }

  async expire(accountId: string, connectionId: string, failureCode = 'credentials_expired'): Promise<ConnectorConnectionProjection> {
    return this.repository.transition({
      accountId,
      connectionId,
      toState: 'expired',
      enabled: false,
      failureCode,
      eventType: 'connector.connection.expired',
    })
  }

  async revoke(
    accountId: string,
    connectionId: string,
    input: {reason?: string; revokedBy?: string; metadata?: Record<string, unknown>} = {},
  ): Promise<ConnectorConnectionProjection> {
    const now = new Date()
    return this.repository.transition({
      accountId,
      connectionId,
      toState: 'revoked',
      enabled: false,
      revokedAt: now,
      revocationReason: input.reason ?? 'account_requested',
      revokedBy: input.revokedBy ?? accountId,
      revocationMetadata: input.metadata ?? {},
      eventType: 'connector.connection.revoked',
    })
  }

  async disconnect(accountId: string, connectionId: string): Promise<ConnectorConnectionProjection> {
    const current = await this.get(accountId, connectionId)
    if (current.state === 'disconnected') return current
    return this.repository.transition({
      accountId,
      connectionId,
      toState: 'disconnected',
      enabled: false,
      eventType: 'connector.connection.disconnected',
    })
  }

  async beginRefresh(accountId: string, connectionId: string): Promise<ConnectorConnectionProjection> {
    return this.repository.transition({
      accountId,
      connectionId,
      toState: 'refreshing',
      eventType: 'connector.connection.refresh_started',
    })
  }

  async completeRefresh(
    accountId: string,
    connectionId: string,
    input: {expiresAt?: Date | null; healthReasonCode?: string | null} = {},
  ): Promise<ConnectorConnectionProjection> {
    return this.repository.transition({
      accountId,
      connectionId,
      toState: 'connected',
      enabled: true,
      healthStatus: input.healthReasonCode ? 'degraded' : 'healthy',
      healthCheckedAt: new Date(),
      healthReasonCode: input.healthReasonCode ?? null,
      expiresAt: input.expiresAt,
      eventType: 'connector.connection.refreshed',
    })
  }

  async fail(
    accountId: string,
    connectionId: string,
    input: {failureCode: string; fromState?: GreenfieldConnectionState},
  ): Promise<ConnectorConnectionProjection> {
    return this.repository.transition({
      accountId,
      connectionId,
      toState: 'failed',
      enabled: false,
      failureCode: input.failureCode,
      eventType: 'connector.connection.failed',
    })
  }

  private requireProvider(providerId: string): void {
    if (!this.providers.get(providerId)) throw connectorError('NOT_FOUND', 'Connector provider not found')
  }
}
