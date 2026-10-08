import {createHmac, randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {manifestChecksum, validateGreenfieldModuleManifest, type GreenfieldModuleManifestV1} from '@modula/greenfield-module-manifest'
import {sql} from 'kysely'
import {loadConfig} from '../src/config/env.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {ModuleBackendEventService} from '../src/modules/backend/event-service.js'
import {ModuleBackendGatewayService} from '../src/modules/backend/gateway-service.js'
import {ModuleBackendRepository} from '../src/modules/backend/repository.js'
import {ModuleBackendTokenService} from '../src/modules/backend/token-service.js'
import {ModuleBackendWebhookService} from '../src/modules/backend/webhook-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldModuleRuntimeAccessService} from '../src/modules/runtime-access.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

describe('Phase 7E module backend manifest guardrails', () => {
  it('accepts module-managed backend declarations and keeps 1.0 manifests greenfield-managed by default', () => {
    const managed = backendManifest('modula.phase7e.backend-static', '1.0.0')
    const result = validateGreenfieldModuleManifest(managed)
    expect(result.valid).toBe(true)
    expect(managed.backend?.mode).toBe('module-managed')

    const standard10 = baseManifest('modula.phase7e.standard10', '1.0.0')
    delete standard10.backend
    expect(validateGreenfieldModuleManifest(standard10).valid).toBe(true)
  })
})

describeIfDb('Phase 7E module backend runtime substrate', () => {
  let db: ModulaDb
  let config: ReturnType<typeof loadConfig>
  let accountId = ''
  let actorId = ''
  let moduleId = ''
  let releaseId = ''
  let installationId = ''

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    config = loadConfig()
    const suffix = randomUUID().slice(0, 8)
    accountId = `backend-account-${suffix}`
    actorId = `actor-${accountId}`
    moduleId = `modula.phase7e.backend-${suffix}`
    installationId = `installation:${moduleId}:${accountId}`
    await seedProfileAccount(db, accountId, actorId, `backend${suffix}`.slice(0, 24))
    await seedInstalledBackendModule()
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('persists backend definitions during release import without module-owned domain data', async () => {
    const definition = await db
      .selectFrom('module_backend_definitions')
      .select(['release_id', 'module_id', 'mode', 'protocol_version', 'endpoint_strategy', 'backend'])
      .where('release_id', '=', releaseId)
      .executeTakeFirstOrThrow()

    expect(definition).toMatchObject({
      release_id: releaseId,
      module_id: moduleId,
      mode: 'module-managed',
      protocol_version: '1.0.0',
      endpoint_strategy: 'self-hosted',
    })
    expect(JSON.stringify(definition.backend)).not.toContain('customer-contact')
  })

  it('issues and resolves scoped module session tokens without storing raw credentials', async () => {
    const context = await new GreenfieldModuleRuntimeAccessService(db, config).resolve(accountId, moduleId, {requireEnabled: true})
    const backend = await new ModuleBackendRepository(db).ensureDefinitionForContext(context)
    const issued = await new ModuleBackendTokenService(db, config).issue({
      context,
      backend,
      actorId,
      permissions: [readPermission(moduleId)],
      capabilities: [`${moduleId}.actions.read`],
      requestId: 'req-phase7e-backend-token',
    })
    const resolved = await new ModuleBackendTokenService(db, config).resolve(issued.token)

    expect(resolved).toMatchObject({
      installationId,
      moduleId,
      accountId,
      actorId,
      permissions: [readPermission(moduleId)],
      capabilities: [`${moduleId}.actions.read`],
    })
    expect(issued.claims.audience).toBe(`modula-module:${moduleId}`)
    expect(issued.claims.expiresAt - issued.claims.issuedAt).toBeLessThanOrEqual(900)

    const stored = await db.selectFrom('module_backend_sessions').select(['token_hash']).where('session_id', '=', issued.claims.sessionId).executeTakeFirstOrThrow()
    expect(stored.token_hash).toHaveLength(64)
    expect(stored.token_hash).not.toBe(issued.token)
  })

  it('accepts signed module backend events once, rejects duplicates, and stores metadata-only Greenfield events', async () => {
    const token = await issueToken(['events:subscribe'], ['events'])
    const events = new ModuleBackendEventService(db, config)
    const body = {
      eventId: `event-${randomUUID()}`,
      eventType: `module.${moduleId}.contact.created`,
      occurredAt: new Date().toISOString(),
      requestId: 'req-phase7e-backend-event',
    }
    const first = await events.ingest(moduleId, body, token, signature(token, body))
    const duplicate = await events.ingest(moduleId, body, token, signature(token, body))

    expect(first).toEqual({accepted: true, duplicate: false})
    expect(duplicate).toEqual({accepted: false, duplicate: true})
    const greenfieldEvents = await db
      .selectFrom('greenfield_domain_events')
      .select(['event_type', 'payload', 'metadata'])
      .where('aggregate_type', '=', 'moduleBackendEvent')
      .where('aggregate_id', '=', body.eventId)
      .execute()
    expect(greenfieldEvents).toHaveLength(1)
    expect(greenfieldEvents[0]).toMatchObject({
      event_type: body.eventType,
      payload: {moduleId, installationId, externalEventId: body.eventId},
    })
    expect(JSON.stringify(greenfieldEvents[0])).not.toContain('customer-contact')

    await expect(events.ingest(moduleId, {...body, eventId: `event-${randomUUID()}`}, token, 'bad-signature')).rejects.toMatchObject({code: 'FORBIDDEN'})
  })

  it('accepts signed webhooks once and records invalid signatures without exposing payloads', async () => {
    const token = await issueToken(['notifications:create'], ['webhooks'])
    const webhooks = new ModuleBackendWebhookService(db, config)
    const body = {
      webhookId: `webhook-${randomUUID()}`,
      eventType: `module.${moduleId}.sync.completed`,
      idempotencyKey: `webhook-key-${randomUUID()}`,
      privatePayload: 'customer-contact-secret',
    }

    expect(await webhooks.receive(moduleId, body, token, signature(token, body))).toEqual({accepted: true, duplicate: false})
    expect(await webhooks.receive(moduleId, body, token, signature(token, body))).toEqual({accepted: false, duplicate: true})
    await expect(webhooks.receive(moduleId, {...body, webhookId: `webhook-${randomUUID()}`, idempotencyKey: `webhook-key-${randomUUID()}`}, token, 'bad-signature')).rejects.toMatchObject({code: 'FORBIDDEN'})

    const deliveries = await db
      .selectFrom('module_backend_webhook_deliveries')
      .select(['status', 'signature_valid', 'payload_hash', 'redacted_details'])
      .where('installation_id', '=', installationId)
      .execute()
    expect(deliveries.some(delivery => delivery.status === 'duplicate')).toBe(true)
    expect(deliveries.some(delivery => delivery.status === 'rejected' && delivery.signature_valid === false)).toBe(true)
    expect(JSON.stringify(deliveries)).not.toContain('customer-contact-secret')
    expect(deliveries.every(delivery => delivery.payload_hash.length === 64)).toBe(true)
  })

  it('blocks gateway access when the backend connection is disabled before discovery or outbound calls', async () => {
    const context = await new GreenfieldModuleRuntimeAccessService(db, config).resolve(accountId, moduleId, {requireEnabled: true})
    const repository = new ModuleBackendRepository(db)
    await repository.ensureInstallation(context, null)
    await repository.disableInstallation(installationId)
    await expect(new ModuleBackendGatewayService(db, config).executeAction({
      context,
      actionId: `${moduleId}.actions.write`,
      actorId,
      payload: {value: 'customer-contact-secret'},
      idempotencyKey: 'phase7e-disabled-write',
      requestId: 'req-phase7e-disabled-gateway',
    })).rejects.toMatchObject({code: 'FORBIDDEN'})
  })

  async function issueToken(permissions: string[], capabilities: string[]): Promise<string> {
    const context = await new GreenfieldModuleRuntimeAccessService(db, config).resolve(accountId, moduleId, {requireEnabled: true})
    const backend = await new ModuleBackendRepository(db).ensureDefinitionForContext(context)
    const issued = await new ModuleBackendTokenService(db, config).issue({context, backend, actorId, permissions, capabilities, requestId: `req-${randomUUID()}`})
    return issued.token
  }

  async function seedInstalledBackendModule() {
    const version = '1.0.0'
    const manifest = backendManifest(moduleId, version)
    const release = await new GreenfieldModuleReleaseService(db).importPendingReview(manifest)
    const published = await new GreenfieldModuleReleaseService(db).publishRelease(moduleId, version)
    releaseId = published.releaseId
    await db
      .insertInto('greenfield_extension_installations')
      .values({
        installation_id: installationId,
        extension_version_id: release.extensionVersionId,
        account_id: accountId,
        status: 'enabled',
        config: {},
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
    await db
      .insertInto('greenfield_module_permission_reviews')
      .values({
        review_id: `review:${installationId}`,
        installation_id: installationId,
        release_id: releaseId,
        account_id: accountId,
        granted_permissions: jsonb([
          readPermission(moduleId),
          writePermission(moduleId),
          'events:subscribe',
          'notifications:create',
        ]),
        denied_permissions: jsonb([]),
        high_risk_increase: false,
        idempotency_key: `review-${moduleId}`,
        reviewed_at: new Date(),
      })
      .execute()
  }
})

function configureTestEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES = 'true'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4029'
  process.env.MODULA_PUBLIC_API_URL = 'https://api.test.modula.digital'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
  process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'phase7e-module-backend-test-signing-key'
}

function backendManifest(moduleId: string, version: string): GreenfieldModuleManifestV1 {
  const manifest = baseManifest(moduleId, version)
  manifest.backend = {
    mode: 'module-managed',
    protocolVersion: '1.0.0',
    endpoints: {
      baseUrlStrategy: 'self-hosted',
      apiVersion: 'v1',
      discoveryPath: '/.well-known/modula-module',
      healthPath: '/v1/health',
      capabilitiesPath: '/v1/capabilities',
      actionsPath: '/v1/actions',
      eventsPath: '/v1/events',
      webhooksPath: '/v1/webhooks/modula',
      allowedHosts: ['crm.example-company.com'],
    },
    authentication: {
      type: 'greenfield-token-exchange',
      tokenExchangeRequired: true,
      audience: `modula-module:${moduleId}`,
      tokenTtlSeconds: 900,
      sessionExchangePath: '/v1/session/exchange',
    },
    trust: {
      publisherId: 'modula',
      allowedOrigins: ['https://crm.example-company.com'],
      releaseChecksum: 'c'.repeat(64),
      backendBuildChecksum: 'd'.repeat(64),
    },
    data: {
      primaryStore: 'module-backend',
      categories: [{
        id: 'contacts',
        description: 'CRM contacts kept in the module backend',
        location: 'module-backend',
        classification: 'restricted',
        exportable: true,
        deletable: true,
      }],
      exportSupported: true,
      deletionSupported: true,
      backupResponsibility: 'publisher',
      residency: ['GB', 'EU'],
    },
    deployment: {
      ownership: 'customer-hosted',
      multiTenant: false,
      regions: ['eu-west'],
      dataResidency: ['GB', 'EU'],
      selfHostingSupported: true,
    },
    network: {
      denyPrivateRanges: true,
      denyLocalhost: true,
      denyLinkLocal: true,
      denyMetadataEndpoints: true,
      allowRedirects: false,
      allowedPorts: [443],
      developmentAllowsLocalhost: false,
    },
    lifecycle: {
      states: ['unconfigured', 'discovering', 'verifying', 'available', 'degraded', 'unreachable', 'incompatible', 'revoked', 'quarantined', 'disabled'],
      initialState: 'unconfigured',
    },
    actions: [
      {
        actionId: `${moduleId}.actions.read`,
        method: 'POST',
        path: '/v1/actions/read',
        inputSchema: 'schemas/read.input.json',
        outputSchema: 'schemas/read.output.json',
        permissions: [readPermission(moduleId)],
        idempotent: true,
        sideEffects: 'none',
        confirmation: 'none',
        timeoutMs: 2_000,
      },
      {
        actionId: `${moduleId}.actions.write`,
        method: 'POST',
        path: '/v1/actions/write',
        inputSchema: 'schemas/write.input.json',
        outputSchema: 'schemas/write.output.json',
        permissions: [writePermission(moduleId)],
        idempotent: true,
        sideEffects: 'internal-write',
        confirmation: 'user',
        timeoutMs: 2_000,
      },
    ],
  }
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

function baseManifest(moduleId: string, version: string): GreenfieldModuleManifestV1 {
  const manifest: GreenfieldModuleManifestV1 = {
    manifestVersion: 1,
    moduleId,
    name: 'Phase 7E Backend Runtime',
    description: 'Test module for independently operated module backends.',
    version,
    publisher: {publisherId: 'modula', displayName: 'Modula'},
    source: {
      provider: 'github',
      repository: 'modula-mod/phase7e-backend-runtime',
      commit: '0123456789abcdef0123456789abcdef01234567',
      manifestPath: 'module.manifest.json',
    },
    license: {status: 'firstParty', evidenceIds: ['first-party-policy']},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {
      minimumGreenfieldVersion: '0.1.0',
      minimumModulaHostVersion: '0.1.0',
      protocolVersions: ['greenfield.v1'],
      platforms: ['server', 'web'],
    },
    permissions: [
      {permission: readPermission(moduleId), reason: 'Read records via the module backend', risk: 'low'},
      {permission: writePermission(moduleId), reason: 'Write records via the module backend', risk: 'medium'},
      {permission: 'events:subscribe', reason: 'Bridge backend events into Greenfield', risk: 'medium'},
      {permission: 'notifications:create', reason: 'Receive managed backend webhooks', risk: 'medium'},
    ],
    contributions: {
      routes: [{id: `${moduleId}.routes.home`, title: 'Backend Runtime', path: `/module/${moduleId}`, routeKind: 'module'}],
    },
    integrity: {manifestSha256: 'a'.repeat(64), releaseSha256: 'b'.repeat(64)},
  }
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

async function seedProfileAccount(db: ModulaDb, accountId: string, actorId: string, handle: string): Promise<void> {
  const now = new Date()
  await db
    .insertInto('greenfield_accounts')
    .values({
      account_id: accountId,
      primary_handle: handle,
      status: 'active',
      created_at: now,
      updated_at: now,
    })
    .execute()
  await db
    .insertInto('actors')
    .values({
      id: actorId,
      account_id: accountId,
      kind: 'person',
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    })
    .execute()
  await db
    .insertInto('profiles')
    .values({
      id: `profile-${actorId}`,
      actor_id: actorId,
      handle,
      display_name: 'Phase 7E Backend Runtime',
      kind: 'person',
      bio: '',
      avatar_url: null,
      cover_url: null,
      cover_colour: null,
      pronouns: null,
      location_label: null,
      location_visibility: null,
      website_label: null,
      website_url: null,
      website_domain: null,
      website_visibility: null,
      focus_status_id: 'available',
      focus_status_label: 'Available',
      focus_status_message: '',
      focus_status_updated_at: now,
      visibility: 'public',
      module_count: 0,
      featured_module_ids: [],
      identity_claims: [],
      joined_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    })
    .execute()
}

function signature(token: string, body: unknown): string {
  return createHmac('sha256', token).update(canonicalJsonStringify(body)).digest('hex')
}

function readPermission(moduleId: string): string {
  return `records:module.${moduleId}.contact:read`
}

function writePermission(moduleId: string): string {
  return `records:module.${moduleId}.contact:write`
}
