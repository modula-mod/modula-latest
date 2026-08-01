import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {loadConfig} from '../src/config/env.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {
  GreenfieldConnectorProviderRegistry,
  loadGreenfieldConnectorProviderDefinitions,
} from '../src/connectors/index.js'
import {ConnectorCredentialService} from '../src/domains/connectors/credentials/index.js'
import {ConnectorConnectionService} from '../src/domains/connectors/connections/index.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Phase 7D connector connection lifecycle', () => {
  let db: ModulaDb
  let registry: GreenfieldConnectorProviderRegistry
  let connections: ConnectorConnectionService
  let credentials: ConnectorCredentialService
  let accountId = ''
  let otherAccountId = ''

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    const config = loadConfig()
    registry = new GreenfieldConnectorProviderRegistry()
    registry.registerMany(loadGreenfieldConnectorProviderDefinitions())
    connections = new ConnectorConnectionService(db, registry)
    credentials = new ConnectorCredentialService(db, config)
    await seedProvider(db, 'modula.github')
    accountId = `connection-lifecycle-${Date.now().toString(36)}`
    otherAccountId = `${accountId}-other`
    await seedAccount(db, accountId)
    await seedAccount(db, otherAccountId)
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('enforces legal enable/disable transitions and account isolation', async () => {
    const created = await connections.create({
      accountId,
      providerId: 'modula.github',
      displayName: 'GitHub',
      state: 'connected',
      scopes: ['read:user'],
      permissions: [{capability: 'source-control.issues.read', state: 'granted'}],
    })
    const disabled = await connections.disable(accountId, created.connectionId)
    expect(disabled.state).toBe('disabled')
    expect(disabled.enabled).toBe(false)
    const enabled = await connections.enable(accountId, created.connectionId)
    expect(enabled.state).toBe('connected')
    expect(enabled.enabled).toBe(true)

    await expect(connections.get(otherAccountId, created.connectionId)).rejects.toThrow(/Connection not found/)
    await expect(connections.disable(otherAccountId, created.connectionId)).rejects.toThrow(/Connection not found/)
    expect((await connections.get(accountId, created.connectionId)).state).toBe('connected')
  })

  it('rejects illegal transitions without partial mutation', async () => {
    const created = await connections.create({
      accountId,
      providerId: 'modula.github',
      displayName: 'Available GitHub',
      state: 'available',
    })
    await expect(connections.enable(accountId, created.connectionId)).rejects.toThrow(/Invalid Greenfield connection transition/)
    expect((await connections.get(accountId, created.connectionId)).state).toBe('available')
  })

  it('supports expire, reconnect, failure, revoke and disconnect with audit events', async () => {
    const expiring = await connections.create({
      accountId,
      providerId: 'modula.github',
      displayName: 'Expiring GitHub',
      state: 'connected',
    })
    expect((await connections.expire(accountId, expiring.connectionId)).state).toBe('expired')
    expect((await connections.reconnect(accountId, expiring.connectionId)).state).toBe('authorising')
    expect((await connections.fail(accountId, expiring.connectionId, {failureCode: 'oauth_denied'})).state).toBe('failed')
    expect((await connections.disconnect(accountId, expiring.connectionId)).state).toBe('disconnected')

    const revoked = await connections.create({
      accountId,
      providerId: 'modula.github',
      displayName: 'Revoked GitHub',
      state: 'connected',
    })
    expect((await connections.revoke(accountId, revoked.connectionId, {reason: 'test_revoke'})).state).toBe('revoked')
    expect((await connections.disconnect(accountId, revoked.connectionId)).state).toBe('disconnected')

    const events = await db
      .selectFrom('greenfield_connection_events')
      .select(['event_type'])
      .where('account_id', '=', accountId)
      .where('provider_id', '=', 'modula.github')
      .execute()
    expect(events.map(event => event.event_type)).toEqual(expect.arrayContaining([
      'connector.connection.created',
      'connector.connection.expired',
      'connector.connection.reconnect_requested',
      'connector.connection.failed',
      'connector.connection.revoked',
      'connector.connection.disconnected',
    ]))
  })

  it('persists encrypted credentials without leaking secrets in connection projections', async () => {
    const created = await connections.create({
      accountId,
      providerId: 'modula.github',
      displayName: 'Secret GitHub',
      state: 'connected',
    })
    await credentials.storeEncrypted({
      accountId,
      providerId: 'modula.github',
      connectionId: created.connectionId,
      credentials: {
        accessToken: 'gho_connection_secret',
        refreshToken: 'ghr_connection_secret',
        tokenType: 'bearer',
      },
    })
    const row = await db
      .selectFrom('greenfield_connection_credentials')
      .select(['encrypted_payload', 'encrypted_auxiliary_data', 'nonce', 'auth_tag', 'key_version'])
      .where('connection_id', '=', created.connectionId)
      .executeTakeFirstOrThrow()
    expect(row.key_version).toBe('1')
    expect(row.nonce).toBeTruthy()
    expect(row.auth_tag).toBeTruthy()
    expect(row.encrypted_payload?.toString('utf8')).not.toContain('gho_connection_secret')
    expect(row.encrypted_auxiliary_data?.toString('utf8')).not.toContain('ghr_connection_secret')

    const responseLike = JSON.stringify(await connections.get(accountId, created.connectionId))
    expect(responseLike).not.toContain('gho_connection_secret')
    expect(responseLike).not.toContain('ghr_connection_secret')
    expect(responseLike).not.toContain('encrypted_payload')
    expect(responseLike).not.toContain('auth_tag')
  })
})

function configureTestEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4021'
  process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4021'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
}

async function seedAccount(db: ModulaDb, accountId: string): Promise<void> {
  await db
    .insertInto('greenfield_accounts')
    .values({
      account_id: accountId,
      primary_handle: accountId.replace(/[^a-z0-9]/g, '').slice(0, 24),
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflict(oc => oc.column('account_id').doNothing())
    .execute()
}

async function seedProvider(db: ModulaDb, providerId: string): Promise<void> {
  const provider = loadGreenfieldConnectorProviderDefinitions().find(item => item.providerId === providerId)!
  await db
    .insertInto('greenfield_connector_providers')
    .values({
      provider_id: provider.providerId,
      display_name: provider.displayName,
      provider_type: provider.providerType,
      connector_kinds: jsonb(provider.connectorKinds),
      capabilities: jsonb(provider.capabilities),
      authorisation_method: provider.authorisation.method,
      required_configuration: jsonb(provider.requiredConfiguration),
      configured_status: provider.configuredStatus,
      availability_status: provider.availabilityStatus,
      health_status: provider.health.status,
      icon_ref: provider.iconRef,
      privacy_summary: provider.privacySummary,
      data_access_summary: provider.dataAccessSummary,
      supported_actions: jsonb(provider.supportedActions),
      sync_support: jsonb(provider.sync),
      webhook_support: jsonb(provider.webhook),
      rate_limit_policy: jsonb(provider.rateLimit),
      adapter_trusted: provider.adapterTrusted,
      operational: provider.operational,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflict(oc => oc.column('provider_id').doUpdateSet({
      updated_at: new Date(),
      configured_status: provider.configuredStatus,
      health_status: provider.health.status,
      operational: provider.operational,
    }))
    .execute()
}

function jsonb(value: unknown) {
  return sql<unknown>`${JSON.stringify(value)}::jsonb`
}
