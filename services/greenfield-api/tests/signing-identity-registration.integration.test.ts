import {randomBytes, randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import pg from 'pg'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {PublisherOnlineSigningIdentityService} from '../src/publisher/signing-identity-service.js'
import {
  DisposableEd25519SigningProvider,
  type PublisherSigningProvider,
} from '../src/publisher/signing-provider.js'
import {
  dropAuthorizedPublicationRoles,
  provisionAuthorizedPublicationRoles,
  type AuthorizedPublicationRoleFixture,
} from './helpers/authorized-publication-fixture.js'
import {configureRegistryTestEnv} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_DATABASE_ADMIN_URL ?? databaseUrl
const describeDb = databaseUrl ? describe : describe.skip

describeDb('GF-SIGNER-R4A2-02A signing identity authority integration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const operatorId = `r4a2-02a-operator-${suffix}`
  const builderId = `r4a2-02a-builder-${suffix}`
  const operatorHandle = `r4a2op${suffix}`.slice(0, 20)
  const publisherId = `r4a2-${suffix}.publisher`
  const namespace = `r4a2-${suffix}.modula`
  const provider = new DisposableEd25519SigningProvider({allowInsecureTestProvider: true})
  let adminDb: ModulaDb
  let adminPool: pg.Pool
  let roles: AuthorizedPublicationRoleFixture
  let ordinaryApiDb: ModulaDb
  let ordinaryApiRole: string
  let service: PublisherOnlineSigningIdentityService
  let registeredIdentityId: string
  let registeredKeyId: string
  let registeredProviderKeyRef: string

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4092')
    process.env.MODULA_ADMIN_HANDLES = operatorHandle
    await migrateUp(databaseUrl!)
    adminDb = createDb(databaseUrl!, undefined, {applicationName: 'r4a2-02a-admin'})
    if (!adminDatabaseUrl) throw new Error('MODULA_TEST_DATABASE_ADMIN_URL is required for authority role fixtures')
    adminPool = new pg.Pool({connectionString: adminDatabaseUrl, max: 2, application_name: 'r4a2-02a-role-admin'})

    const now = new Date()
    await adminDb.insertInto('greenfield_accounts').values([
      {account_id: operatorId, primary_handle: operatorHandle, status: 'active', created_at: now, updated_at: now},
      {account_id: builderId, primary_handle: `r4a2builder${suffix}`.slice(0, 20), status: 'active', created_at: now, updated_at: now},
    ]).execute()
    await adminDb.insertInto('greenfield_publishers').values({
      publisher_id: publisherId,
      display_name: 'R4A2 identity registration fixture',
      website: null,
      status: 'verified',
      trust_level: 'verifiedPublisher',
      created_at: now,
      updated_at: now,
      verified_at: now,
      suspended_at: null,
      revoked_at: null,
    }).execute()
    await adminDb.insertInto('greenfield_publisher_namespaces').values({
      namespace,
      publisher_id: publisherId,
      verification_method: 'disposable-authority-integration-test',
      verification_evidence: {mission: 'GF-SIGNER-R4A2-02A'},
      verified_at: now,
      revoked_at: null,
      created_at: now,
    }).execute()

    roles = await provisionAuthorizedPublicationRoles({
      adminPool,
      targetDatabaseUrl: databaseUrl!,
      targetDb: adminDb,
      suffix: `02a${suffix}`,
    })
    service = new PublisherOnlineSigningIdentityService(
      adminDb,
      loadConfig({...process.env, MODULA_SIGNING_IDENTITY_AUTHORITY_DATABASE_URL: roles.urls.signingIdentityAuthority}),
      provider,
    )

    ordinaryApiRole = `r4a2_02a_api_${suffix}`
    const ordinaryApiPassword = randomBytes(24).toString('base64url')
    await adminPool.query(
      `CREATE ROLE ${identifier(ordinaryApiRole)} LOGIN PASSWORD ${literal(ordinaryApiPassword)} `
      + 'NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
    )
    await adminPool.query(`GRANT modula_api TO ${identifier(ordinaryApiRole)}`)
    ordinaryApiDb = createDb(databaseUrlForRole(databaseUrl!, ordinaryApiRole, ordinaryApiPassword), undefined, {
      max: 1,
      applicationName: 'r4a2-02a-ordinary-api',
    })
  }, 60_000)

  afterAll(async () => {
    await ordinaryApiDb?.destroy()
    if (adminPool && ordinaryApiRole) {
      await adminPool.query(`REVOKE modula_api FROM ${identifier(ordinaryApiRole)}`).catch(() => undefined)
      await adminPool.query(`DROP ROLE IF EXISTS ${identifier(ordinaryApiRole)}`).catch(() => undefined)
    }
    if (adminPool && roles) await dropAuthorizedPublicationRoles(adminPool, roles)
    await adminDb?.destroy()
    await adminPool?.end()
  })

  it('registers a valid publisher identity through the fixed authority and preserves the response contract', async () => {
    registeredKeyId = `r4a2-02a-key-${suffix}`
    registeredProviderKeyRef = `test/r4a2-02a-${suffix}`
    const publicKey = provider.createIdentity({providerKeyRef: registeredProviderKeyRef})
    const validFrom = new Date(Date.now() - 60_000)
    const validUntil = new Date(Date.now() + 3_600_000)

    const response = await service.register({
      actorAccountId: operatorId,
      publisherId,
      signingKeyId: registeredKeyId,
      providerKeyRef: registeredProviderKeyRef,
      purpose: 'PUBLISHER',
      firstPartyAuthorized: false,
      validFrom,
      validUntil,
    })
    registeredIdentityId = response.identityId

    expect(response).toEqual({
      identityId: expect.stringMatching(/^psi_[0-9a-f-]{36}$/),
      publisherId,
      signingKeyId: registeredKeyId,
      provider: 'DISPOSABLE_TEST',
      providerKeyRef: registeredProviderKeyRef,
      purpose: 'PUBLISHER',
      state: 'ACTIVE',
      firstPartyAuthorized: false,
      validFrom,
      validUntil,
    })
    expect(JSON.stringify(response)).not.toMatch(/PRIVATE KEY|privateKey/i)

    const principal = await adminDb.selectFrom('greenfield_publisher_release_authority_principals')
      .select('account_id')
      .where('database_role', '=', roles.roles.signingIdentityAuthority.name)
      .where('authority', '=', 'SIGNING_IDENTITY_AUTHORITY')
      .executeTakeFirstOrThrow()
    const identity = await adminDb.selectFrom('greenfield_publisher_online_signing_identities')
      .select(['publisher_id', 'signing_key_id', 'created_by_account_id'])
      .where('identity_id', '=', registeredIdentityId)
      .executeTakeFirstOrThrow()
    const key = await adminDb.selectFrom('greenfield_publisher_signing_keys')
      .select(['publisher_id', 'public_key_pem', 'fingerprint', 'registered_by_account_id'])
      .where('key_id', '=', registeredKeyId)
      .executeTakeFirstOrThrow()
    const audit = await adminDb.selectFrom('greenfield_publisher_signing_audit_events')
      .select(['actor_account_id', 'actor_database_role', 'details'])
      .where('identity_id', '=', registeredIdentityId)
      .where('event_type', '=', 'identity_registered')
      .executeTakeFirstOrThrow()

    expect(identity).toEqual({
      publisher_id: publisherId,
      signing_key_id: registeredKeyId,
      created_by_account_id: principal.account_id,
    })
    expect(key).toMatchObject({
      publisher_id: publisherId,
      public_key_pem: publicKey.publicKeyPem,
      fingerprint: publicKey.fingerprint,
      registered_by_account_id: principal.account_id,
    })
    expect(audit).toMatchObject({
      actor_account_id: principal.account_id,
      actor_database_role: roles.roles.signingIdentityAuthority.name,
      details: expect.objectContaining({
        signingKeyId: registeredKeyId,
        publicKeyFingerprint: publicKey.fingerprint,
        providerKeyRef: registeredProviderKeyRef,
      }),
    })
    expect(audit.actor_account_id).not.toBe(operatorId)
    const authoritySessions = await sql<{count: number}>`
      SELECT COUNT(*)::INTEGER AS count
      FROM pg_catalog.pg_stat_activity
      WHERE datname = current_database()
        AND application_name = 'modula-signing-identity-authority'
    `.execute(adminDb)
    expect(authoritySessions.rows[0]?.count).toBe(0)
    await expect(adminDb.updateTable('greenfield_publisher_signing_keys')
      .set({fingerprint: `sha256:${'f'.repeat(64)}`})
      .where('key_id', '=', registeredKeyId)
      .execute()).rejects.toMatchObject({code: '42501'})
  })

  it('rejects duplicate registration according to the lifecycle policy without duplicate evidence', async () => {
    await expect(service.register({
      actorAccountId: operatorId,
      publisherId,
      signingKeyId: registeredKeyId,
      providerKeyRef: registeredProviderKeyRef,
      purpose: 'PUBLISHER',
      firstPartyAuthorized: false,
      validUntil: new Date(Date.now() + 3_600_000),
    })).rejects.toMatchObject({code: 'CONFLICT'})
    expect(await adminDb.selectFrom('greenfield_publisher_online_signing_identities')
      .select('identity_id').where('signing_key_id', '=', registeredKeyId).execute()).toHaveLength(1)
    expect(await adminDb.selectFrom('greenfield_publisher_signing_audit_events')
      .select('event_id').where('identity_id', '=', registeredIdentityId)
      .where('event_type', '=', 'identity_registered').execute()).toHaveLength(1)
  })

  it('requires existing operator authentication before authority access', async () => {
    const getPublicKey = vi.spyOn(provider, 'getPublicKey')
    await expect(service.register({
      actorAccountId: builderId,
      publisherId,
      signingKeyId: `r4a2-02a-unauthorized-${suffix}`,
      providerKeyRef: registeredProviderKeyRef,
      purpose: 'PUBLISHER',
      firstPartyAuthorized: false,
      validUntil: new Date(Date.now() + 3_600_000),
    })).rejects.toMatchObject({code: 'FORBIDDEN'})
    expect(getPublicKey).not.toHaveBeenCalled()
    getPublicKey.mockRestore()
  })

  it('rejects an invalid publisher before authority registration', async () => {
    await expect(service.register({
      actorAccountId: operatorId,
      publisherId: `missing-${suffix}.publisher`,
      signingKeyId: `r4a2-02a-missing-${suffix}`,
      providerKeyRef: registeredProviderKeyRef,
      purpose: 'PUBLISHER',
      firstPartyAuthorized: false,
      validUntil: new Date(Date.now() + 3_600_000),
    })).rejects.toMatchObject({code: 'NOT_FOUND'})
  })

  it('fails closed when the dedicated authority configuration is missing or reuses the API principal', async () => {
    const input = {
      actorAccountId: operatorId,
      publisherId,
      signingKeyId: `r4a2-02a-unconfigured-${suffix}`,
      providerKeyRef: registeredProviderKeyRef,
      purpose: 'PUBLISHER' as const,
      firstPartyAuthorized: false,
      validUntil: new Date(Date.now() + 3_600_000),
    }
    await expect(new PublisherOnlineSigningIdentityService(
      adminDb,
      {...loadConfig(), signingIdentityAuthorityDatabaseUrl: null},
      provider,
    ).register(input)).rejects.toMatchObject({code: 'CAPABILITY_UNAVAILABLE'})
    await expect(new PublisherOnlineSigningIdentityService(
      adminDb,
      {...loadConfig(), signingIdentityAuthorityDatabaseUrl: loadConfig().databaseUrl},
      provider,
    ).register(input)).rejects.toMatchObject({code: 'CAPABILITY_UNAVAILABLE'})

    const rejectedCredential = 'must-not-escape-authority-error'
    const rejectedUrl = new URL(roles.urls.signingIdentityAuthority)
    rejectedUrl.password = rejectedCredential
    const rejected = await new PublisherOnlineSigningIdentityService(
      adminDb,
      {...loadConfig(), signingIdentityAuthorityDatabaseUrl: rejectedUrl.toString()},
      provider,
    ).register(input).catch(error => error as Error & {code?: string})
    expect(rejected).toMatchObject({code: 'CAPABILITY_UNAVAILABLE'})
    expect(JSON.stringify(rejected)).not.toContain(rejectedCredential)
  })

  it('rolls back key, identity, transition and audit facts when registration fails', async () => {
    const rollbackKeyId = `r4a2-02a-rollback-${suffix}`
    const sourceKey = provider.createIdentity({providerKeyRef: `test/r4a2-02a-rollback-source-${suffix}`})
    const rollbackProvider = providerWithPublicKey(sourceKey)
    const rollbackService = new PublisherOnlineSigningIdentityService(
      adminDb,
      {...loadConfig(), signingIdentityAuthorityDatabaseUrl: roles.urls.signingIdentityAuthority},
      rollbackProvider,
    )
    await expect(rollbackService.register({
      actorAccountId: operatorId,
      publisherId,
      signingKeyId: rollbackKeyId,
      providerKeyRef: 'invalid provider reference',
      purpose: 'PUBLISHER',
      firstPartyAuthorized: false,
      validUntil: new Date(Date.now() + 3_600_000),
    })).rejects.toMatchObject({code: 'VALIDATION_FAILED'})

    expect(await adminDb.selectFrom('greenfield_publisher_signing_keys').select('key_id')
      .where('key_id', '=', rollbackKeyId).executeTakeFirst()).toBeUndefined()
    expect(await adminDb.selectFrom('greenfield_publisher_online_signing_identities').select('identity_id')
      .where('signing_key_id', '=', rollbackKeyId).executeTakeFirst()).toBeUndefined()
    expect(await adminDb.selectFrom('greenfield_publisher_signing_key_lifecycle_transitions').select('transition_id')
      .where('key_id', '=', rollbackKeyId).execute()).toHaveLength(0)
    expect(await adminDb.selectFrom('greenfield_publisher_signing_audit_events').select('event_id')
      .where('publisher_id', '=', publisherId)
      .where('details', '@>', JSON.stringify({signingKeyId: rollbackKeyId}) as never)
      .execute()).toHaveLength(0)
  })

  it('keeps direct ordinary-API key, identity, and authority operations rejected', async () => {
    const directKeyId = `r4a2-02a-direct-${suffix}`
    const directRef = `test/r4a2-02a-direct-${suffix}`
    const directPublicKey = provider.createIdentity({providerKeyRef: directRef})
    const denied = async (operation: () => Promise<unknown>) => {
      await expect(operation()).rejects.toMatchObject({code: '42501'})
    }

    await denied(() => sql`INSERT INTO greenfield_publisher_signing_keys (
      key_id, publisher_id, algorithm, public_key_pem, fingerprint, state,
      valid_from, valid_until, registered_by_account_id
    ) VALUES (
      ${directKeyId}, ${publisherId}, 'Ed25519', ${directPublicKey.publicKeyPem},
      ${directPublicKey.fingerprint}, 'ACTIVE', NOW(), NOW() + INTERVAL '1 hour', ${operatorId}
    )`.execute(ordinaryApiDb))
    await denied(() => sql`INSERT INTO greenfield_publisher_online_signing_identities (
      identity_id, publisher_id, signing_key_id, provider, provider_key_ref,
      purpose, state, first_party_authorized, valid_from, valid_until, created_by_account_id
    ) VALUES (
      ${`psi_${randomUUID()}`}, ${publisherId}, ${directKeyId}, 'DISPOSABLE_TEST', ${directRef},
      'PUBLISHER', 'ACTIVE', FALSE, NOW(), NOW() + INTERVAL '1 hour', ${operatorId}
    )`.execute(ordinaryApiDb))
    await denied(() => sql`SELECT greenfield_signing_identity_authority_register(
      ${publisherId}, ${directKeyId}, ${directPublicKey.publicKeyPem}, ${directPublicKey.fingerprint},
      'DISPOSABLE_TEST', ${directRef}, 'PUBLISHER', FALSE, NOW(), NOW() + INTERVAL '1 hour', NULL
    )`.execute(ordinaryApiDb))
  })
})

function identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function databaseUrlForRole(baseUrl: string, role: string, password: string): string {
  const url = new URL(baseUrl)
  url.username = role
  url.password = password
  return url.toString()
}

function providerWithPublicKey(
  publicKey: Awaited<ReturnType<DisposableEd25519SigningProvider['getPublicKey']>>,
): PublisherSigningProvider {
  const unused = async (): Promise<never> => { throw new Error('unused test provider operation') }
  return {
    kind: 'VAULT_TRANSIT',
    resolveAuthorizedIdentity: unused,
    getPublicKey: async () => publicKey,
    signPublisherRelease: unused,
    verifyPublisherRelease: unused,
    getKeyState: unused,
    rotateKey: unused,
    revokeKey: unused,
  }
}
