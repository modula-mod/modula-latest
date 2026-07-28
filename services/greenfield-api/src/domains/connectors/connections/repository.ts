import {sql, type Kysely, type Transaction} from 'kysely'
import type {
  GreenfieldConnectionState,
  GreenfieldConnectorCapability,
} from '@modula/greenfield-connector-contracts'
import {assertGreenfieldConnectionTransition} from '@modula/greenfield-connector-contracts'
import type {ModulaDb} from '../../../database/client.js'
import type {Database, GreenfieldConnectorHealthStatus} from '../../../database/types.js'
import {AuditRepository} from '../../audit/repository.js'
import {uuidv7} from '../../../lib/uuidv7.js'
import {connectorError} from '../errors.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>
type ConnectionRow = Database['greenfield_connections']
type PermissionState = Database['greenfield_connection_permissions']['state']

const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export type ConnectorConnectionProjection = {
  connectionId: string
  accountId: string
  providerId: string
  displayName: string
  externalAccountId: string | null
  externalAccountLabel: string | null
  externalIdentityMetadata: Record<string, unknown>
  state: GreenfieldConnectionState
  enabled: boolean
  health: {
    status: GreenfieldConnectorHealthStatus
    checkedAt: string | null
    reasonCode: string | null
  }
  scopes: string[]
  permissions: Array<{
    capability: string
    state: PermissionState
    reason: string | null
    grantedAt: string | null
    revokedAt: string | null
  }>
  connectedAt: string | null
  lastRefreshedAt: string | null
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  revocationReason: string | null
  failureCode: string | null
  createdAt: string
  updatedAt: string
}

export type CreateConnectorConnectionInput = {
  accountId: string
  providerId: string
  displayName: string
  state?: GreenfieldConnectionState
  enabled?: boolean
  externalAccountId?: string | null
  externalAccountLabel?: string | null
  externalIdentityMetadata?: Record<string, unknown>
  scopes?: string[]
  permissions?: Array<{capability: GreenfieldConnectorCapability; state?: PermissionState; reason?: string | null}>
  expiresAt?: Date | null
  idempotencyKey?: string | null
}

export type TransitionConnectorConnectionInput = {
  accountId: string
  connectionId: string
  toState: GreenfieldConnectionState
  eventType: string
  enabled?: boolean
  healthStatus?: GreenfieldConnectorHealthStatus
  healthReasonCode?: string | null
  healthCheckedAt?: Date | null
  externalAccountId?: string | null
  externalAccountLabel?: string | null
  externalIdentityMetadata?: Record<string, unknown>
  expiresAt?: Date | null
  revokedAt?: Date | null
  revocationReason?: string | null
  revokedBy?: string | null
  revocationMetadata?: Record<string, unknown>
  failureCode?: string | null
  idempotencyKey?: string | null
  metadata?: Record<string, unknown>
}

export class ConnectorConnectionRepository {
  constructor(private readonly db: Db) {}

  async list(accountId: string): Promise<ConnectorConnectionProjection[]> {
    const rows = await this.db
      .selectFrom('greenfield_connections')
      .selectAll()
      .where('account_id', '=', accountId)
      .orderBy('updated_at', 'desc')
      .execute()
    return Promise.all(rows.map(row => this.hydrate(row)))
  }

  async get(accountId: string, connectionId: string): Promise<ConnectorConnectionProjection | null> {
    const row = await this.db
      .selectFrom('greenfield_connections')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('connection_id', '=', connectionId)
      .executeTakeFirst()
    return row ? this.hydrate(row) : null
  }

  async create(input: CreateConnectorConnectionInput): Promise<ConnectorConnectionProjection> {
    const now = new Date()
    const connectionId = uuidv7()
    const state = input.state ?? 'available'
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_connections')
        .values({
          connection_id: connectionId,
          account_id: input.accountId,
          provider_id: input.providerId,
          display_name: input.displayName,
          external_account_id: input.externalAccountId ?? null,
          external_account_label: input.externalAccountLabel ?? null,
          external_identity_metadata: jsonb(input.externalIdentityMetadata ?? {}),
          state,
          enabled: input.enabled ?? true,
          health_status: 'not-checked',
          health_checked_at: null,
          health_reason_code: null,
          connected_at: state === 'connected' ? now : null,
          last_refreshed_at: null,
          last_used_at: null,
          expires_at: input.expiresAt ?? null,
          revoked_at: null,
          revocation_reason: null,
          revoked_by: null,
          revocation_metadata: jsonb({}),
          failure_code: null,
          last_transition_idempotency_key: input.idempotencyKey ?? null,
          created_at: now,
          updated_at: now,
        })
        .execute()
      if (input.scopes?.length) {
        await trx
          .insertInto('greenfield_connection_scopes')
          .values(
            [...new Set(input.scopes)].map(scope => ({
              scope_id: uuidv7(),
              connection_id: connectionId,
              scope,
              granted_at: now,
              revoked_at: null,
            })),
          )
          .execute()
      }
      if (input.permissions?.length) {
        await trx
          .insertInto('greenfield_connection_permissions')
          .values(
            input.permissions.map(permission => ({
              permission_id: uuidv7(),
              connection_id: connectionId,
              capability: permission.capability,
              state: permission.state ?? 'requested',
              reason: permission.reason ?? null,
              granted_at: permission.state === 'granted' ? now : null,
              revoked_at: permission.state === 'revoked' ? now : null,
              created_at: now,
              updated_at: now,
            })),
          )
          .execute()
      }
      await this.appendEvent(trx, {
        accountId: input.accountId,
        providerId: input.providerId,
        connectionId,
        eventType: 'connector.connection.created',
        toState: state,
        metadata: {
          scopes: input.scopes ?? [],
          permissions: input.permissions?.map(permission => permission.capability) ?? [],
        },
      })
    })
    return this.require(input.accountId, connectionId)
  }

  async transition(input: TransitionConnectorConnectionInput): Promise<ConnectorConnectionProjection> {
    const now = new Date()
    let providerId = ''
    let fromState: GreenfieldConnectionState = 'available'
    await this.db.transaction().execute(async trx => {
      const current = await trx
        .selectFrom('greenfield_connections')
        .selectAll()
        .where('account_id', '=', input.accountId)
        .where('connection_id', '=', input.connectionId)
        .executeTakeFirst()
      if (!current) throw connectorError('NOT_FOUND', 'Connection not found')
      providerId = current.provider_id
      fromState = current.state
      assertTransitionOrConflict(current.state, input.toState)
      const updates: Partial<ConnectionRow> & Record<string, unknown> = {
        state: input.toState,
        updated_at: now,
      }
      if (input.enabled !== undefined) updates.enabled = input.enabled
      if (input.healthStatus) updates.health_status = input.healthStatus
      if (input.healthReasonCode !== undefined) updates.health_reason_code = input.healthReasonCode
      if (input.healthCheckedAt !== undefined) updates.health_checked_at = input.healthCheckedAt
      if (input.externalAccountId !== undefined) updates.external_account_id = input.externalAccountId
      if (input.externalAccountLabel !== undefined) updates.external_account_label = input.externalAccountLabel
      if (input.externalIdentityMetadata !== undefined) updates.external_identity_metadata = jsonb(input.externalIdentityMetadata)
      if (input.expiresAt !== undefined) updates.expires_at = input.expiresAt
      if (input.revokedAt !== undefined) updates.revoked_at = input.revokedAt
      if (input.revocationReason !== undefined) updates.revocation_reason = input.revocationReason
      if (input.revokedBy !== undefined) updates.revoked_by = input.revokedBy
      if (input.revocationMetadata !== undefined) updates.revocation_metadata = jsonb(input.revocationMetadata)
      if (input.failureCode !== undefined) updates.failure_code = input.failureCode
      if (input.idempotencyKey !== undefined) updates.last_transition_idempotency_key = input.idempotencyKey
      if (input.toState === 'connected' && !current.connected_at) updates.connected_at = now
      if (input.toState === 'connected' && fromState === 'refreshing') updates.last_refreshed_at = now
      const result = await trx
        .updateTable('greenfield_connections')
        .set(updates)
        .where('account_id', '=', input.accountId)
        .where('connection_id', '=', input.connectionId)
        .where('state', '=', current.state)
        .executeTakeFirst()
      if (updatedRows(result) !== 1) throw connectorError('CONFLICT', 'Connection transition failed')
      await this.appendEvent(trx, {
        accountId: input.accountId,
        providerId,
        connectionId: input.connectionId,
        eventType: input.eventType,
        fromState,
        toState: input.toState,
        metadata: input.metadata ?? {},
      })
    })
    return this.require(input.accountId, input.connectionId)
  }

  private async require(accountId: string, connectionId: string): Promise<ConnectorConnectionProjection> {
    const connection = await this.get(accountId, connectionId)
    if (!connection) throw connectorError('NOT_FOUND', 'Connection not found')
    return connection
  }

  private async hydrate(row: ConnectionRow): Promise<ConnectorConnectionProjection> {
    const [scopes, permissions] = await Promise.all([
      this.db
        .selectFrom('greenfield_connection_scopes')
        .select(['scope'])
        .where('connection_id', '=', row.connection_id)
        .where('revoked_at', 'is', null)
        .orderBy('scope')
        .execute(),
      this.db
        .selectFrom('greenfield_connection_permissions')
        .select(['capability', 'state', 'reason', 'granted_at', 'revoked_at'])
        .where('connection_id', '=', row.connection_id)
        .orderBy('capability')
        .execute(),
    ])
    return {
      connectionId: row.connection_id,
      accountId: row.account_id,
      providerId: row.provider_id,
      displayName: row.display_name,
      externalAccountId: row.external_account_id,
      externalAccountLabel: row.external_account_label,
      externalIdentityMetadata: objectOrEmpty(row.external_identity_metadata),
      state: row.state,
      enabled: row.enabled,
      health: {
        status: row.health_status,
        checkedAt: row.health_checked_at?.toISOString() ?? null,
        reasonCode: row.health_reason_code,
      },
      scopes: scopes.map(scope => scope.scope),
      permissions: permissions.map(permission => ({
        capability: permission.capability,
        state: permission.state,
        reason: permission.reason,
        grantedAt: permission.granted_at?.toISOString() ?? null,
        revokedAt: permission.revoked_at?.toISOString() ?? null,
      })),
      connectedAt: row.connected_at?.toISOString() ?? null,
      lastRefreshedAt: row.last_refreshed_at?.toISOString() ?? null,
      lastUsedAt: row.last_used_at?.toISOString() ?? null,
      expiresAt: row.expires_at?.toISOString() ?? null,
      revokedAt: row.revoked_at?.toISOString() ?? null,
      revocationReason: row.revocation_reason,
      failureCode: row.failure_code,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }
  }

  private async appendEvent(
    db: Db,
    input: {
      accountId: string
      providerId: string
      connectionId: string
      eventType: string
      fromState?: GreenfieldConnectionState
      toState?: GreenfieldConnectionState
      metadata: Record<string, unknown>
    },
  ): Promise<void> {
    await db
      .insertInto('greenfield_connection_events')
      .values({
        event_id: uuidv7(),
        account_id: input.accountId,
        provider_id: input.providerId,
        connection_id: input.connectionId,
        event_type: input.eventType,
        from_state: input.fromState ?? null,
        to_state: input.toState ?? null,
        metadata: jsonb(input.metadata),
        created_at: new Date(),
      })
      .execute()
    await new AuditRepository(db).append(input.eventType, {providerId: input.providerId, ...input.metadata}, {
      type: 'connectorConnection',
      id: input.connectionId,
      actorId: input.accountId,
    })
  }
}

function assertTransitionOrConflict(from: GreenfieldConnectionState, to: GreenfieldConnectionState): void {
  try {
    assertGreenfieldConnectionTransition(from, to)
  } catch (error) {
    throw connectorError('CONFLICT', error instanceof Error ? error.message : `Invalid connection transition ${from} -> ${to}`)
  }
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function updatedRows(result: {numUpdatedRows?: bigint | number | string}): number {
  return Number(result.numUpdatedRows ?? 0)
}
