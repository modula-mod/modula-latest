import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {
  DETERMINISTIC_TEST_PROVIDER_ID,
} from '@modula/intelligence-core'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {IntelligenceActionBoundary} from '../src/intelligence/action-boundary.js'
import {GovernedIntelligenceService} from '../src/intelligence/service.js'
import {
  DETERMINISTIC_TEST_ADAPTER_LIMITATION,
  DETERMINISTIC_TEST_ADAPTER_STATUS,
} from '../src/intelligence/provider-selection.js'
import {GreenfieldModuleRecordService} from '../src/modules/record-service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const moduleId = 'test.modula.synthetic-records'
const collection = 'item'
const undeclaredCollection = 'plain'
const queryActionId = `${moduleId}.action.item.query`
const queryFunctionId = `${moduleId}.function.item.query`
const genericQueryObjective = 'Query the authorized module collection for recently updated records.'
const suffix = randomUUID().slice(0, 8)
const accountA = `syn-a-${suffix}`
const accountB = `syn-b-${suffix}`
const releaseId = `syn-release-${suffix}`
const installationId = `syn-installation-${suffix}`
const deniedReleaseId = `syn-denied-release-${suffix}`
const deniedInstallationId = `syn-denied-installation-${suffix}`
const developmentTrust = {environment: 'development' as const, moduleAllowUntrustedDevelopmentReleases: true}
describeIfDb('synthetic authorized module intelligence path', () => {
  let db: ModulaDb
  let service: GovernedIntelligenceService

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    service = new GovernedIntelligenceService(db, developmentTrust)
    await seedRuntime(db)
  })

  afterAll(async () => { await db?.destroy() })

  it('plans and executes an owner-scoped record.query discovered from the synthetic module', async () => {
    const mission = await service.createMission(accountA, {objective: genericQueryObjective, correlationId: `syn-query-${suffix}`})
    const detail = await service.start(accountA, mission.id)
    expect(detail.mission.status).toBe('completed')
    expect(detail.proposals[0]).toMatchObject({
      family: 'record.query',
      moduleId,
      actionId: queryActionId,
      capability: `records:module.${moduleId}.${collection}:read`,
      input: {collection, limit: 25, sort: 'updatedAt', direction: 'desc'},
    })
    expect(detail.proposals[0]?.moduleId).not.toBe('digital.modula.vault-notes')
    expect(detail.akiDecisions[0]).toMatchObject({verdict: 'allow', risk: 'read_only'})
    expect(detail.governorDecisions[0]).toMatchObject({authorization: 'autonomous'})
    expect((detail.executions[0]?.result as {items?: unknown[]}).items).toHaveLength(5)
    const events = await service.ledger(accountA, mission.id)
    const planning = events.find(event => event.type === 'mission.planning_started')
    expect(planning?.payload).toMatchObject({
      router: 'selection-only',
      selectedProviderId: DETERMINISTIC_TEST_PROVIDER_ID,
      modelProviderStatus: DETERMINISTIC_TEST_ADAPTER_STATUS,
      limitation: DETERMINISTIC_TEST_ADAPTER_LIMITATION,
    })
  })

  it('does not discover a readable collection that has no AI-callable declaration', async () => {
    const actions = await new IntelligenceActionBoundary(db, developmentTrust).availableActions(accountA)
    expect(actions).toEqual([expect.objectContaining({
      family: 'record.query',
      moduleId,
      actionId: queryActionId,
      collection,
      capability: `records:module.${moduleId}.${collection}:read`,
    })])
    expect(actions.some(action => action.collection === undeclaredCollection)).toBe(false)
    expect(actions.some(action => action.family === 'record.create')).toBe(false)
  })

  it('treats an account with no installed module as a supported blocked state', async () => {
    const mission = await service.createMission(accountB, {objective: genericQueryObjective, correlationId: `syn-absent-${suffix}`})
    const detail = await service.start(accountB, mission.id)
    expect(detail.mission.status).toBe('blocked')
    expect(detail.proposals[0]).toMatchObject({family: 'module.absent', capability: 'module.absent'})
    expect(detail.executions).toHaveLength(0)
    expect(detail.governorDecisions[0]?.authorization).toBe('blocked')
  })

  it('refuses a query when the installation does not grant read permission', async () => {
    const deniedAccount = `syn-denied-${suffix}`
    const now = new Date()
    await db.insertInto('greenfield_accounts').values({account_id: deniedAccount, primary_handle: `synd${suffix}`, status: 'active', created_at: now, updated_at: now}).execute()
    await seedDeniedReadInstallation(db, deniedAccount)
    const mission = await service.createMission(deniedAccount, {objective: genericQueryObjective, correlationId: `syn-denied-${suffix}`})
    const detail = await service.start(deniedAccount, mission.id)
    expect(detail.mission.status).toBe('blocked')
    expect(detail.proposals[0]?.family).not.toBe('record.query')
    expect(detail.executions).toHaveLength(0)
    expect(detail.governorDecisions[0]?.authorization).toBe('blocked')
  })
})

async function seedRuntime(db: ModulaDb) {
  const now = new Date()
  for (const [accountId, handle] of [[accountA, `syna${suffix}`], [accountB, `synb${suffix}`]] as const) {
    await db.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: handle, status: 'active', created_at: now, updated_at: now}).execute()
  }
  const publisherId = `syn-publisher-${suffix}`
  const extensionId = `syn-extension-${suffix}`
  const extensionVersionId = `syn-extension-version-${suffix}`
  const moduleVersionId = `syn-module-version-${suffix}`
  const version = `0.0.${Date.now()}`
  const permissions = [
    `records:module.${moduleId}.${collection}:read`,
    `records:module.${moduleId}.${collection}:write`,
    `records:module.${moduleId}.${undeclaredCollection}:read`,
  ]
  const manifest = syntheticAiManifest(permissions.map(permission => ({permission, reason: 'synthetic intelligence fixture', risk: permission.endsWith(':read') ? 'low' : 'medium'})))
  await db.insertInto('greenfield_publishers').values({publisher_id: publisherId, display_name: 'Synthetic Intelligence Fixture', website: null, status: 'verified', trust_level: 'firstParty', created_at: now, updated_at: now, verified_at: now, suspended_at: null, revoked_at: null}).execute()
  await db.insertInto('greenfield_extensions').values({extension_id: extensionId, slug: `syn-records-${suffix}`, publisher_account_id: null, status: 'published', created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_versions').values({extension_version_id: extensionVersionId, extension_id: extensionId, version, manifest, status: 'published', created_at: now}).execute()
  await db.insertInto('greenfield_module_versions').values({module_version_id: moduleVersionId, extension_version_id: extensionVersionId, module_id: moduleId, version, publisher_id: publisherId, manifest, status: 'published', created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_module_releases').values({release_id: releaseId, module_version_id: moduleVersionId, extension_id: extensionId, extension_version_id: extensionVersionId, module_id: moduleId, version, publisher_id: publisherId, release_state: 'published', source_repository: 'modula-mod/modula-synthetic-records', source_commit: 'a'.repeat(40), manifest_path: 'module.manifest.json', manifest_sha256: 'b'.repeat(64), release_sha256: 'c'.repeat(64), signature_key_id: null, signature: null, compatibility: {}, license_status: 'firstParty', trust_level: 'firstParty', product_kind: 'module', extension_product: {}, published_at: now, quarantined_at: null, revoked_at: null, superseded_at: null, created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_installations').values({installation_id: installationId, extension_version_id: extensionVersionId, account_id: accountA, status: 'enabled', config: {}, created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_module_permission_reviews').values({review_id: `syn-review-${suffix}`, installation_id: installationId, release_id: releaseId, account_id: accountA, granted_permissions: jsonb(permissions), denied_permissions: jsonb([]), high_risk_increase: false, idempotency_key: `syn-review-${suffix}`, reviewed_at: now}).execute()
  const fields = [
    {fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true},
    {fieldId: 'body', name: 'body', type: 'text', label: 'Body', required: true},
  ]
  await db.insertInto('greenfield_module_record_collections').values([
    {collection_id: `syn-collection-${suffix}`, release_id: releaseId, module_id: moduleId, collection, schema_ref: 'schemas/item.json', default_visibility: 'private', fields: jsonb(fields), searchable_fields: jsonb(['title', 'body']), filterable_fields: jsonb([]), sortable_fields: jsonb(['title']), folder_field: null, reference_fields: jsonb([]), schema_definition: {}, retention_policy: 'keepOnUninstall', registration_status: 'registered', created_at: now, updated_at: now},
    {collection_id: `syn-plain-${suffix}`, release_id: releaseId, module_id: moduleId, collection: undeclaredCollection, schema_ref: 'schemas/plain.json', default_visibility: 'private', fields: jsonb(fields), searchable_fields: jsonb(['title', 'body']), filterable_fields: jsonb([]), sortable_fields: jsonb(['title']), folder_field: null, reference_fields: jsonb([]), schema_definition: {}, retention_policy: 'keepOnUninstall', registration_status: 'registered', created_at: now, updated_at: now},
  ]).execute()
  const records = new GreenfieldModuleRecordService(db, developmentTrust)
  for (let index = 0; index < 5; index += 1) {
    await records.create(accountA, moduleId, collection, {
      data: {title: `Synthetic ${index}`, body: `Body ${index}`},
      mutationId: `syn-seed:${suffix}:${index}`,
    })
  }
}

async function seedDeniedReadInstallation(db: ModulaDb, accountId: string) {
  const now = new Date()
  const publisherId = `syn-denied-publisher-${suffix}`
  const extensionId = `syn-denied-extension-${suffix}`
  const extensionVersionId = `syn-denied-extension-version-${suffix}`
  const moduleVersionId = `syn-denied-module-version-${suffix}`
  const version = `0.0.${Date.now()}`
  const read = `records:module.${moduleId}.${collection}:read`
  const write = `records:module.${moduleId}.${collection}:write`
  const manifest = syntheticAiManifest([{permission: write, reason: 'write only', risk: 'medium'}, {permission: read, reason: 'read declared but denied', risk: 'low'}])
  await db.insertInto('greenfield_publishers').values({publisher_id: publisherId, display_name: 'Synthetic Denied Read', website: null, status: 'verified', trust_level: 'firstParty', created_at: now, updated_at: now, verified_at: now, suspended_at: null, revoked_at: null}).execute()
  await db.insertInto('greenfield_extensions').values({extension_id: extensionId, slug: `syn-denied-${suffix}`, publisher_account_id: null, status: 'published', created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_versions').values({extension_version_id: extensionVersionId, extension_id: extensionId, version, manifest, status: 'published', created_at: now}).execute()
  await db.insertInto('greenfield_module_versions').values({module_version_id: moduleVersionId, extension_version_id: extensionVersionId, module_id: moduleId, version, publisher_id: publisherId, manifest, status: 'published', created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_module_releases').values({release_id: deniedReleaseId, module_version_id: moduleVersionId, extension_id: extensionId, extension_version_id: extensionVersionId, module_id: moduleId, version, publisher_id: publisherId, release_state: 'published', source_repository: 'modula-mod/modula-synthetic-records', source_commit: 'd'.repeat(40), manifest_path: 'module.manifest.json', manifest_sha256: 'e'.repeat(64), release_sha256: 'f'.repeat(64), signature_key_id: null, signature: null, compatibility: {}, license_status: 'firstParty', trust_level: 'firstParty', product_kind: 'module', extension_product: {}, published_at: now, quarantined_at: null, revoked_at: null, superseded_at: null, created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_installations').values({installation_id: deniedInstallationId, extension_version_id: extensionVersionId, account_id: accountId, status: 'enabled', config: {}, created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_module_permission_reviews').values({review_id: `syn-denied-review-${suffix}`, installation_id: deniedInstallationId, release_id: deniedReleaseId, account_id: accountId, granted_permissions: jsonb([write]), denied_permissions: jsonb([read]), high_risk_increase: false, idempotency_key: `syn-denied-review-${suffix}`, reviewed_at: now}).execute()
  await db.insertInto('greenfield_module_record_collections').values({collection_id: `syn-denied-collection-${suffix}`, release_id: deniedReleaseId, module_id: moduleId, collection, schema_ref: 'schemas/item.json', default_visibility: 'private', fields: jsonb([{fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true}, {fieldId: 'body', name: 'body', type: 'text', label: 'Body', required: true}]), searchable_fields: jsonb(['title']), filterable_fields: jsonb([]), sortable_fields: jsonb(['title']), folder_field: null, reference_fields: jsonb([]), schema_definition: {}, retention_policy: 'keepOnUninstall', registration_status: 'registered', created_at: now, updated_at: now}).execute()
}

function jsonb(value: unknown) {
  return sql`${JSON.stringify(value)}::jsonb`
}

function syntheticAiManifest(permissions: Array<{permission: string; reason: string; risk: string}>) {
  return {
    permissions,
    contributions: {schemas: [], events: []},
    actions: [{
      id: queryActionId,
      title: 'Query recent items',
      functionId: queryFunctionId,
      permissions: [`records:module.${moduleId}.${collection}:read`],
      confirmationPolicy: {required: false, policyMode: 'warn'},
      sideEffects: ['record.query'],
      audit: {event: 'synthetic.item.query', includeInput: false},
    }],
    functions: [{
      id: queryFunctionId,
      title: 'Query recent items',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          collection: {type: 'string', const: collection},
          limit: {type: 'integer', minimum: 1, maximum: 100, default: 25},
        },
      },
      outputSchema: {type: 'object'},
      permissions: [`records:module.${moduleId}.${collection}:read`],
      aiCallable: true,
      automationCallable: false,
      idempotent: true,
      sideEffects: ['record.query'],
      timeoutMs: 10_000,
      rateLimit: {windowSeconds: 60, maxCalls: 30},
      audit: {event: 'synthetic.item.query', includeInput: false, includeOutput: false},
      confirmationPolicy: {required: false, risk: 'low'},
    }],
    ai: [],
  }
}
