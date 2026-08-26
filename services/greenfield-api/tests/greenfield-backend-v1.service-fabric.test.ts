import {randomUUID} from 'node:crypto'
import {createServer as createHttpServer, type Server} from 'node:http'
import type {AddressInfo} from 'node:net'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'
import {migrateUp} from '../src/database/migrate.js'
import {ModuleBackendTokenService} from '../src/modules/backend/token-service.js'
import {GreenfieldModuleRuntimeAccessService} from '../src/modules/runtime-access.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)
const productId = `test.modula.service-fabric-${suffix}`
const accountA = `service-account-a-${suffix}`
const accountB = `service-account-b-${suffix}`
const actorA = `service-actor-a-${suffix}`
const installationId = `installation:${productId}:${accountA}`
const releaseId = `release:${productId}:1.0.0`
const extensionId = `extension:${productId}`
const extensionVersionId = `${productId}@1.0.0`
const moduleVersionId = `module-version:${productId}:1.0.0`
const publisherId = `publisher:service-fabric-${suffix}`
const readRecords = `records:module.${productId}.entry:read`
const writeRecords = `records:module.${productId}.entry:write`
const deleteRecords = `records:module.${productId}.entry:delete`
const readData = `data:module.${productId}:read`
const writeData = `data:module.${productId}:write`
const useSecrets = 'secrets.use'

describeIfDb('Greenfield Backend V1 service fabric boundary', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let assertion = ''
  let readOnlyAssertion = ''
  let brokerServer: Server
  let brokerRequests = 0
  let brokerAssertion = ''

  beforeAll(async () => {
    configureTestEnv()
    brokerServer = createHttpServer(async (request, response) => {
      brokerRequests += 1
      brokerAssertion = String(request.headers['x-modula-service-assertion'] ?? '')
      expect(request.headers.authorization).toBeUndefined()
      expect(request.url).toBe('/v1/secrets/lease')
      for await (const chunk of request) void chunk
      response.writeHead(201, {'content-type': 'application/json', 'cache-control': 'no-store'})
      response.end(JSON.stringify({ok: true, data: {
        reference: 'secret://engine.ai/provider/test/primary', namespace: 'engine.ai', version: 'v1', state: 'CURRENT',
        manifestCommit: 'e'.repeat(40), environment: 'test', leaseId: `lease:${suffix}`,
        expiresAt: new Date(Date.now() + 30_000).toISOString(), useToken: `use-token-${'x'.repeat(40)}`,
      }}))
    })
    await new Promise<void>(resolve => brokerServer.listen(0, '127.0.0.1', resolve))
    process.env.MODULA_SECRETS_SERVICE_URL = `http://127.0.0.1:${(brokerServer.address() as AddressInfo).port}`
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    await seedPlatformState()
    const context = await new GreenfieldModuleRuntimeAccessService(db).resolve(accountA, productId, {requireEnabled: true})
    const issued = await new ModuleBackendTokenService(db, loadConfig()).issue({
      context,
      actorId: actorA,
      permissions: [readRecords, writeRecords, deleteRecords, readData, writeData, useSecrets],
      capabilities: [readRecords, writeRecords, deleteRecords, readData, writeData, useSecrets],
      requestId: `service-fabric-request-${suffix}`,
      traceId: `service-fabric-trace-${suffix}`,
      backend: {
        mode: 'module-managed',
        authentication: {tokenExchangeRequired: true, audience: `service.${productId}`, tokenTtlSeconds: 300},
      } as any,
      extensionInvocation: {
        consumerProductId: productId,
        targetProductId: productId,
        targetInstallationId: installationId,
        actionId: `${productId}.backend.sync`,
        serviceId: `service.${productId}.backend`,
        scope: {type: 'installation', ref: installationId},
      },
    })
    assertion = issued.token
    const readOnly = await new ModuleBackendTokenService(db, loadConfig()).issue({
      context,
      actorId: actorA,
      permissions: [readRecords],
      capabilities: [readRecords],
      backend: {
        mode: 'module-managed',
        authentication: {tokenExchangeRequired: true, audience: `service.${productId}`, tokenTtlSeconds: 300},
      } as any,
      extensionInvocation: {
        consumerProductId: productId,
        targetProductId: productId,
        targetInstallationId: installationId,
        actionId: `${productId}.backend.read`,
        serviceId: `service.${productId}.backend`,
        scope: {type: 'installation', ref: installationId},
      },
    })
    readOnlyAssertion = readOnly.token
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
    await new Promise<void>(resolve => brokerServer?.close(() => resolve()))
  })

  it('requires a verified service assertion and rejects raw bearer forwarding', async () => {
    const missing = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/identity/context`})
    expect(missing.statusCode).toBe(401)
    expect(missing.json().error.code).toBe('UNAUTHENTICATED')

    const rawBearer = await app.inject({
      method: 'GET',
      url: `/v1/backend/products/${productId}/identity/context`,
      headers: serviceHeaders({authorization: 'Bearer raw-user-token'}),
    })
    expect(rawBearer.statusCode).toBe(401)
    expect(rawBearer.json().error.message).toContain('Raw user bearer forwarding is forbidden')

    const crossProduct = await app.inject({
      method: 'GET',
      url: `/v1/backend/products/test.modula.other-${suffix}/identity/context`,
      headers: serviceHeaders(),
    })
    expect(crossProduct.statusCode).toBe(401)
    expect(crossProduct.json().error.code).toBe('UNAUTHENTICATED')
  })

  it('returns only assertion-scoped identity, account, installation and capabilities', async () => {
    const identity = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/identity/context`, headers: serviceHeaders()})
    expect(identity.statusCode, identity.body).toBe(200)
    expect(identity.json().data).toEqual({
      requestId: identity.json().meta.requestId,
      traceId: `service-fabric-trace-${suffix}`,
      accountId: accountA,
      organisationId: null,
      productId,
      releaseId,
      installationId,
      serviceId: `service.${productId}.backend`,
    })

    const account = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/accounts/${accountA}`, headers: serviceHeaders()})
    expect(account.statusCode, account.body).toBe(200)
    expect(account.json().data).toMatchObject({accountId: accountA, status: 'active'})
    expect(account.json().data).not.toHaveProperty('primaryHandle')

    const crossAccount = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/accounts/${accountB}`, headers: serviceHeaders()})
    expect(crossAccount.statusCode).toBe(403)

    const installation = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/installations/${encodeURIComponent(installationId)}`, headers: serviceHeaders()})
    expect(installation.statusCode, installation.body).toBe(200)
    expect(installation.json().data).toMatchObject({installationId, productId, releaseId, status: 'enabled'})

    const wrongInstallation = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/installations/${encodeURIComponent(`installation:other:${suffix}`)}`, headers: serviceHeaders()})
    expect(wrongInstallation.statusCode).toBe(403)

    const capabilities = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/installations/${encodeURIComponent(installationId)}/capabilities`, headers: serviceHeaders()})
    expect(capabilities.statusCode, capabilities.body).toBe(200)
    expect(capabilities.json().data.map((grant: {capabilityId: string}) => grant.capabilityId)).toEqual(expect.arrayContaining([readRecords, writeRecords, deleteRecords, readData, writeData]))

    const deniedCapability = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/capabilities/check`,
      headers: {'x-modula-service-assertion': readOnlyAssertion},
      payload: {installationId, capability: writeData},
    })
    expect(deniedCapability.statusCode, deniedCapability.body).toBe(200)
    expect(deniedCapability.json().data).toEqual({allowed: false, grant: null})

    const deniedMutation = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/resources`,
      headers: {'x-modula-service-assertion': readOnlyAssertion, 'idempotency-key': `read-only-resource-${suffix}`},
      payload: {},
    })
    expect(deniedMutation.statusCode).toBe(403)
    expect(deniedMutation.json().error.code).toBe('FORBIDDEN')
  })

  it('executes account-isolated records with idempotency conflict detection', async () => {
    const key = `record-create-${suffix}`
    const create = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/records/entry`,
      headers: serviceHeaders({'idempotency-key': key}),
      payload: {title: 'Service fabric entry', body: 'Account A private content'},
    })
    expect(create.statusCode, create.body).toBe(201)
    expect(create.json().data).toMatchObject({account_id: accountA, module_id: productId, collection: 'entry', revision: 1})

    const replay = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/records/entry`,
      headers: serviceHeaders({'idempotency-key': key}),
      payload: {title: 'Service fabric entry', body: 'Account A private content'},
    })
    expect(replay.statusCode, replay.body).toBe(201)
    expect(replay.json().data.record_id).toBe(create.json().data.record_id)

    const changedReplay = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/records/entry`,
      headers: serviceHeaders({'idempotency-key': key}),
      payload: {title: 'Changed payload', body: 'Must conflict'},
    })
    expect(changedReplay.statusCode).toBe(409)
    expect(changedReplay.json().error.code).toBe('CONFLICT')

    const list = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/records/entry`, headers: serviceHeaders()})
    expect(list.statusCode, list.body).toBe(200)
    expect(list.json().data.items).toHaveLength(1)
    expect(list.json().data.items[0].data.body).toBe('Account A private content')
  })

  it('registers and reads ledger resources only within the target installation', async () => {
    const key = `resource-register-${suffix}`
    const payload = {
      resourceKey: `${productId}.entries`,
      installationId,
      releaseId,
      schemaId: `${productId}.entries`,
      schemaVersion: '1.0.0',
      schemaDefinitionSha256: 'd'.repeat(64),
      schemaCompatibility: 'FULL',
      primaryStorageMode: 'greenfield-records',
      storageBindings: [{storageMode: 'greenfield-records', locatorRef: `greenfield://records/${installationId}/entries`}],
      retention: {mode: 'RETAIN', policyVersion: '1.0.0'},
      backup: {responsibility: 'GREENFIELD', mode: 'MANAGED'},
      exportHandler: `${productId}.data.export`,
      deleteHandler: `${productId}.data.delete`,
      encryptionClassification: 'private',
    }
    const registered = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/resources`,
      headers: serviceHeaders({'idempotency-key': key}),
      payload,
    })
    expect(registered.statusCode, registered.body).toBe(201)
    expect(registered.json().data).toMatchObject({ownerAccountId: accountA, owningProductId: productId, installationId})

    const replay = await app.inject({method: 'POST', url: `/v1/backend/products/${productId}/resources`, headers: serviceHeaders({'idempotency-key': key}), payload})
    expect(replay.statusCode, replay.body).toBe(201)
    expect(replay.json().data.resourceId).toBe(registered.json().data.resourceId)

    const listed = await app.inject({method: 'GET', url: `/v1/backend/products/${productId}/installations/${encodeURIComponent(installationId)}/resources`, headers: serviceHeaders()})
    expect(listed.statusCode, listed.body).toBe(200)
    expect(listed.json().data.items).toHaveLength(1)
    expect(listed.json().data.items[0].resourceId).toBe(registered.json().data.resourceId)
  })

  it('stores only token hashes and records zero raw user bearer forwarding', async () => {
    const session = await db.selectFrom('module_backend_sessions').select(['token_hash']).where('installation_id', '=', installationId).executeTakeFirstOrThrow()
    expect(session.token_hash).not.toBe(assertion)
    expect(session.token_hash).toMatch(/^[0-9a-f]{64}$/)
    const rows = await db.selectFrom('greenfield_extension_service_assertions').select(['raw_user_bearer_forwarded', 'consumed_at']).where('target_installation_id', '=', installationId).execute()
    expect(rows).toHaveLength(2)
    expect(rows.every(row => row.raw_user_bearer_forwarded === false)).toBe(true)
    expect(rows.every(row => row.consumed_at !== null)).toBe(true)
  })

  it('brokers a value-free, single-use secret lease through the trusted configured service', async () => {
    const leased = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/secrets/lease`,
      headers: serviceHeaders(),
      payload: {reference: 'secret://engine.ai/provider/test/primary', purpose: 'ai.generate'},
    })
    expect(leased.statusCode, leased.body).toBe(201)
    expect(leased.json().data).toMatchObject({
      reference: 'secret://engine.ai/provider/test/primary',
      namespace: 'engine.ai',
      state: 'CURRENT',
      manifestCommit: 'e'.repeat(40),
    })
    expect(leased.json().data).not.toHaveProperty('value')
    expect(brokerRequests).toBe(1)
    expect(brokerAssertion).toBe(assertion)

    const denied = await app.inject({
      method: 'POST',
      url: `/v1/backend/products/${productId}/secrets/lease`,
      headers: {'x-modula-service-assertion': readOnlyAssertion},
      payload: {reference: 'secret://engine.ai/provider/test/primary', purpose: 'ai.generate'},
    })
    expect(denied.statusCode).toBe(403)
    expect(brokerRequests).toBe(1)
  })

  async function seedPlatformState(): Promise<void> {
    const now = new Date()
    for (const [accountId, handle] of [[accountA, `servicea${suffix}`], [accountB, `serviceb${suffix}`]] as const) {
      await db.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: handle, status: 'active', created_at: now, updated_at: now}).execute()
    }
    await db.insertInto('actors').values({id: actorA, account_id: accountA, kind: 'person', created_at: now, updated_at: now, deleted_at: null, version: 1}).execute()
    await db.insertInto('greenfield_publishers').values({
      publisher_id: publisherId,
      display_name: 'Service Fabric Test Publisher',
      website: null,
      status: 'verified',
      trust_level: 'firstParty',
      created_at: now,
      updated_at: now,
      verified_at: now,
      suspended_at: null,
      revoked_at: null,
    }).execute()
    await db.insertInto('greenfield_extensions').values({extension_id: extensionId, slug: productId, publisher_account_id: null, status: 'published', created_at: now, updated_at: now}).execute()
    const manifest = {permissions: [], contributions: {events: []}}
    await db.insertInto('greenfield_extension_versions').values({extension_version_id: extensionVersionId, extension_id: extensionId, version: '1.0.0', manifest, status: 'published', created_at: now}).execute()
    await db.insertInto('greenfield_module_versions').values({module_version_id: moduleVersionId, extension_version_id: extensionVersionId, module_id: productId, version: '1.0.0', publisher_id: publisherId, manifest, status: 'published', created_at: now, updated_at: now}).execute()
    await db.insertInto('greenfield_module_releases').values({
      release_id: releaseId,
      module_version_id: moduleVersionId,
      extension_id: extensionId,
      extension_version_id: extensionVersionId,
      module_id: productId,
      version: '1.0.0',
      publisher_id: publisherId,
      release_state: 'published',
      source_repository: 'modula-mod/test-service-fabric',
      source_commit: 'a'.repeat(40),
      manifest_path: 'manifest.json',
      manifest_sha256: 'b'.repeat(64),
      release_sha256: 'c'.repeat(64),
      signature_key_id: 'test-key',
      signature: 'test-signature',
      compatibility: {},
      license_status: 'firstParty',
      trust_level: 'firstParty',
      product_kind: 'service',
      extension_product: {},
      published_at: now,
      quarantined_at: null,
      revoked_at: null,
      superseded_at: null,
      created_at: now,
      updated_at: now,
    }).execute()
    await db.insertInto('greenfield_extension_installations').values({installation_id: installationId, extension_version_id: extensionVersionId, account_id: accountA, status: 'enabled', config: {}, created_at: now, updated_at: now}).execute()
    await db.insertInto('greenfield_module_permission_reviews').values({
      review_id: `permission-review:${suffix}`,
      installation_id: installationId,
      release_id: releaseId,
      account_id: accountA,
      granted_permissions: jsonb([readRecords, writeRecords, deleteRecords, readData, writeData]),
      denied_permissions: jsonb([]),
      high_risk_increase: false,
      idempotency_key: `permission-review:${suffix}`,
      reviewed_at: now,
    }).execute()
    await db.insertInto('greenfield_module_record_collections').values({
      collection_id: `collection:${releaseId}:entry`,
      release_id: releaseId,
      module_id: productId,
      collection: 'entry',
      schema_ref: `${productId}.schemas.entry.v1`,
      default_visibility: 'private',
      fields: jsonb([
        {fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true},
        {fieldId: 'body', name: 'body', type: 'multilineText', label: 'Body', required: true},
      ]),
      searchable_fields: jsonb(['title', 'body']),
      filterable_fields: jsonb([]),
      sortable_fields: jsonb(['title']),
      folder_field: null,
      reference_fields: jsonb([]),
      schema_definition: jsonb({type: 'object'}),
      retention_policy: 'keepOnUninstall',
      registration_status: 'registered',
      created_at: now,
      updated_at: now,
    }).execute()
  }

  function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {'x-modula-service-assertion': assertion, ...extra}
  }
})

function configureTestEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4051'
  process.env.MODULA_PUBLIC_API_URL = 'https://api.test.modula.digital'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
  process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'greenfield-backend-v1-service-fabric-test-signing-key'
}

function jsonb(value: unknown) {
  return sql`${JSON.stringify(value)}::jsonb`
}
