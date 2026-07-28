import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {loadConfig} from '../src/config/env.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {
  ConnectorCredentialEncryptionService,
  type ConnectorCredentialEnvelope,
} from '../src/security/encryption/connector-credentials.js'
import {
  GreenfieldConnectorProviderRegistry,
  loadGreenfieldConnectorProviderDefinitions,
} from '../src/connectors/index.js'
import {ConnectorOAuthStateService} from '../src/domains/connectors/oauth-state/index.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

function testEncryptionService(key = Buffer.alloc(32, 7)): ConnectorCredentialEncryptionService {
  return new ConnectorCredentialEncryptionService({
    connectorCredentialEncryptionKey: {version: 1, key},
    connectorCredentialEncryptionKeysByVersion: new Map([[1, key]]),
  } as any)
}

describe('Phase 7D connector credential encryption', () => {
  it('round-trips credential envelopes without plaintext ciphertext', () => {
    const service = testEncryptionService()
    const context = {accountId: 'acct-a', providerId: 'modula.github', connectionId: 'conn-a'} as const
    const envelope = service.encryptCredentials(context, {
      accessToken: 'gho_access_secret',
      refreshToken: 'ghr_refresh_secret',
      tokenType: 'bearer',
      auxiliary: {provider: 'github'},
    })
    expect(envelope.algorithm).toBe('AES-256-GCM')
    expect(envelope.keyVersion).toBe('1')
    expect(envelope.nonce).toHaveLength(12)
    expect(envelope.ciphertext.toString('utf8')).not.toContain('gho_access_secret')
    expect(envelope.ciphertext.toString('utf8')).not.toContain('ghr_refresh_secret')
    expect(service.decryptCredentials(context, envelope)).toMatchObject({
      accessToken: 'gho_access_secret',
      refreshToken: 'ghr_refresh_secret',
      tokenType: 'bearer',
    })
  })

  it('rejects corrupted ciphertext and wrong-key decrypts', () => {
    const context = {accountId: 'acct-a', providerId: 'modula.github', connectionId: 'conn-a'} as const
    const service = testEncryptionService(Buffer.alloc(32, 3))
    const envelope = service.encryptCredentials(context, {accessToken: 'secret-token'})
    const corrupted: ConnectorCredentialEnvelope = {
      ...envelope,
      ciphertext: Buffer.concat([envelope.ciphertext.subarray(0, -1), Buffer.from([envelope.ciphertext.at(-1)! ^ 1])]),
    }
    expect(() => service.decryptCredentials(context, corrupted)).toThrow(/authentication failed/)
    expect(() =>
      testEncryptionService(Buffer.alloc(32, 4)).decryptCredentials(context, envelope),
    ).toThrow(/authentication failed/)
  })

  it('binds decrypts to account/provider/connection associated data', () => {
    const service = testEncryptionService()
    const context = {accountId: 'acct-a', providerId: 'modula.github', connectionId: 'conn-a'} as const
    const envelope = service.encryptCredentials(context, {accessToken: 'secret-token'})
    expect(() =>
      service.decryptCredentials({...context, accountId: 'acct-b'}, envelope),
    ).toThrow(/authentication failed/)
    expect(() =>
      service.decryptCredentials({...context, providerId: 'modula.google'}, envelope),
    ).toThrow(/authentication failed/)
  })
})

describeIfDb('Phase 7D connector OAuth state lifecycle', () => {
  let db: ModulaDb
  let config: ReturnType<typeof loadConfig>
  let registry: GreenfieldConnectorProviderRegistry
  let accountId = ''
  let otherAccountId = ''

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    config = loadConfig()
    registry = new GreenfieldConnectorProviderRegistry()
    registry.registerMany(loadGreenfieldConnectorProviderDefinitions())
    await seedProvider(db, 'modula.github')
    accountId = `connector-security-${Date.now().toString(36)}`
    otherAccountId = `${accountId}-other`
    await seedAccount(db, accountId)
    await seedAccount(db, otherAccountId)
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('stores account/provider-bound OAuth state with encrypted PKCE verifier', async () => {
    const service = new ConnectorOAuthStateService(db, config, registry)
    const initiated = await service.initiate({accountId, providerId: 'modula.github'})
    expect(initiated.status).toBe('authorising')
    expect(initiated.pkceChallenge).toBeTruthy()
    expect((initiated as any).pkceVerifier).toBeUndefined()

    const row = await db
      .selectFrom('greenfield_connector_oauth_states')
      .selectAll()
      .where('state_id', '=', initiated.stateId)
      .executeTakeFirstOrThrow()
    expect(row.account_id).toBe(accountId)
    expect(row.provider_id).toBe('modula.github')
    expect(row.state_hash).not.toBe(initiated.state)
    expect(row.pkce_verifier_ciphertext?.toString('utf8')).not.toContain(initiated.pkceChallenge!)

    const consumed = await service.consume({
      state: initiated.state,
      providerId: 'modula.github',
      redirectUri: initiated.redirectUri,
    })
    expect(consumed.accountId).toBe(accountId)
    expect(consumed.pkceVerifier).toBeTruthy()
    await expect(
      service.consume({state: initiated.state, providerId: 'modula.github', redirectUri: initiated.redirectUri}),
    ).rejects.toThrow(/already been consumed/)
  })

  it('rejects expired, mismatched, cancelled and invalid-redirect states', async () => {
    const service = new ConnectorOAuthStateService(db, config, registry)
    const expired = await service.initiate({accountId, providerId: 'modula.github'})
    await db
      .updateTable('greenfield_connector_oauth_states')
      .set({expires_at: new Date(Date.now() - 60_000)})
      .where('state_id', '=', expired.stateId)
      .execute()
    await expect(
      service.consume({state: expired.state, providerId: 'modula.github', redirectUri: expired.redirectUri}),
    ).rejects.toThrow(/OAuth callback rejected/)

    const accountMismatch = await service.initiate({accountId, providerId: 'modula.github'})
    await expect(
      service.consume({
        state: accountMismatch.state,
        providerId: 'modula.github',
        redirectUri: accountMismatch.redirectUri,
        accountId: otherAccountId,
      }),
    ).rejects.toThrow(/OAuth callback rejected/)

    const providerMismatch = await service.initiate({accountId, providerId: 'modula.github'})
    await expect(
      service.consume({
        state: providerMismatch.state,
        providerId: 'modula.google',
        redirectUri: providerMismatch.redirectUri,
      }),
    ).rejects.toThrow(/OAuth callback rejected/)

    const redirectMismatch = await service.initiate({accountId, providerId: 'modula.github'})
    await expect(
      service.consume({
        state: redirectMismatch.state,
        providerId: 'modula.github',
        redirectUri: `${config.publicApiUrl}/v1/connectors/modula.github/callback/evil`,
      }),
    ).rejects.toThrow(/OAuth callback rejected/)

    const cancelled = await service.initiate({accountId, providerId: 'modula.github'})
    await service.cancel(accountId, cancelled.stateId)
    await expect(
      service.consume({state: cancelled.state, providerId: 'modula.github', redirectUri: cancelled.redirectUri}),
    ).rejects.toThrow(/OAuth callback rejected/)
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
