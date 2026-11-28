import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import Fastify, {type FastifyInstance} from 'fastify'
import {sql} from 'kysely'
import {REVERSIBLE_WRITE_FIXTURE_OBJECTIVE, UNKNOWN_CAPABILITY_FIXTURE_OBJECTIVE} from '@modula/intelligence-governance'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GovernedIntelligenceService} from '../src/intelligence/service.js'
import {registerIntelligenceRoutes} from '../src/intelligence/routes.js'

// UI-readiness acceptance for /v1/intelligence: pagination on the list
// endpoints, the cross-mission approvals queue, and the Ledger view.
// Same harness as gai01.integration.test.ts (real Postgres via
// MODULA_TEST_DATABASE_URL, stubbed bearer sessions, app.inject).
// Skipped without a database URL, like the other DB suites.
//
// The pending approval comes from the REAL governed flow, not a hand-made
// row: the seed is a synthetic module (same pattern as
// synthetic-module-intelligence.integration.test.ts) whose manifest
// declares AI-callable record.query/record.create actions on a `note`
// collection shaped like the GAI-01 fixture note. Vault Notes itself is
// deliberately NOT given an aiCallable declaration here — the GAI-01
// suite forbids inventing one.
const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const moduleId = 'test.modula.synthetic-ui-readiness'
const collection = 'note'
const queryActionId = `${moduleId}.action.note.query`
const queryFunctionId = `${moduleId}.function.note.query`
const createActionId = `${moduleId}.action.note.create`
const createFunctionId = `${moduleId}.function.note.create`
const suffix = randomUUID().slice(0, 8)
const accountA = `intui-a-${suffix}`
const accountB = `intui-b-${suffix}`
const releaseId = `intui-release-${suffix}`
const installationId = `intui-installation-${suffix}`
const developmentTrust = {environment: 'development' as const, moduleAllowUntrustedDevelopmentReleases: true}

describeIfDb('Intelligence UI readiness (missions pagination, approvals queue, Ledger view)', () => {
  let db: ModulaDb
  let service: GovernedIntelligenceService
  let app: FastifyInstance

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    service = new GovernedIntelligenceService(db, developmentTrust)
    await seedRuntime(db)
    app = Fastify()
    await registerIntelligenceRoutes(app, db, {
      resolveAccess: async (token: string) => token === 'token-a' ? {accountId: accountA} : token === 'token-b' ? {accountId: accountB} : null,
    } as any, {profileConfig: {}, writeConfig: {}}, developmentTrust)
    await app.ready()
  })

  afterAll(async () => { await app?.close(); await db?.destroy() })

  async function createDraft(objective: string) {
    return service.createMission(accountA, {objective, correlationId: `intui-${suffix}-${randomUUID()}`})
  }

  it('lists missions as a bare array with no params (historical shape, unchanged)', async () => {
    const first = await createDraft('UI readiness draft one.')
    const second = await createDraft('UI readiness draft two.')
    const third = await createDraft('UI readiness draft three.')
    const response = await app.inject({method: 'GET', url: '/v1/intelligence/missions', headers: {authorization: 'Bearer token-a'}})
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const ids = body.data.map((mission: {id: string}) => mission.id)
    expect(ids).toContain(first.id)
    expect(ids).toContain(second.id)
    expect(ids).toContain(third.id)
  })

  it('paginates the missions list with limit/cursor and filters by status', async () => {
    const first = await createDraft('UI readiness page one.')
    const second = await createDraft('UI readiness page two.')
    const third = await createDraft('UI readiness page three.')
    const seen = new Set<string>()
    let cursor: string | null = null
    let total = 0
    for (let page = 0; page < 10; page += 1) {
      const url = cursor === null
        ? '/v1/intelligence/missions?status=draft&limit=2'
        : `/v1/intelligence/missions?status=draft&limit=2&cursor=${cursor}`
      const response = await app.inject({method: 'GET', url, headers: {authorization: 'Bearer token-a'}})
      expect(response.statusCode).toBe(200)
      const body = response.json().data
      expect(body.limit).toBe(2)
      total = body.total
      for (const mission of body.items as {id: string}[]) seen.add(mission.id)
      cursor = body.nextCursor
      if (cursor === null) break
    }
    expect(cursor).toBeNull()
    expect(seen.size).toBe(total)
    expect(total).toBeGreaterThanOrEqual(3)
    expect(seen.has(first.id)).toBe(true)
    expect(seen.has(second.id)).toBe(true)
    expect(seen.has(third.id)).toBe(true)
    const completed = await app.inject({method: 'GET', url: '/v1/intelligence/missions?status=completed', headers: {authorization: 'Bearer token-a'}})
    expect(completed.json().data).toMatchObject({items: [], total: 0, nextCursor: null})
  })

  it('rejects invalid pagination and status values with INVALID_ACTION_SCHEMA (400)', async () => {
    for (const url of [
      '/v1/intelligence/missions?status=bogus',
      '/v1/intelligence/missions?limit=0',
      '/v1/intelligence/missions?limit=abc',
      '/v1/intelligence/missions?cursor=-1',
      '/v1/intelligence/missions?cursor=abc',
      '/v1/intelligence/missions/123/ledger?order=bogus',
    ]) {
      const response = await app.inject({method: 'GET', url, headers: {authorization: 'Bearer token-a'}})
      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('INVALID_ACTION_SCHEMA')
    }
  })

  it('clamps limit to 100', async () => {
    const response = await app.inject({method: 'GET', url: '/v1/intelligence/missions?limit=200', headers: {authorization: 'Bearer token-a'}})
    expect(response.statusCode).toBe(200)
    expect(response.json().data.limit).toBe(100)
  })

  it('serves the Ledger as a bare array with no params and paginated newest-first with params', async () => {
    const mission = await createDraft(UNKNOWN_CAPABILITY_FIXTURE_OBJECTIVE)
    const detail = await service.start(accountA, mission.id)
    expect(detail.mission.status).toBe('blocked')
    const plain = await app.inject({method: 'GET', url: `/v1/intelligence/missions/${mission.id}/ledger`, headers: {authorization: 'Bearer token-a'}})
    expect(plain.statusCode).toBe(200)
    const events = plain.json().data
    expect(Array.isArray(events)).toBe(true)
    expect(events.length).toBeGreaterThanOrEqual(3)
    expect(events[0].type).toBe('mission.created')
    expect(events[events.length - 1].type).toBe('mission.blocked')
    const page = await app.inject({method: 'GET', url: `/v1/intelligence/missions/${mission.id}/ledger?limit=2&order=desc`, headers: {authorization: 'Bearer token-a'}})
    expect(page.statusCode).toBe(200)
    const pageBody = page.json().data
    expect(pageBody.items).toHaveLength(2)
    expect(pageBody.items[0].type).toBe('mission.blocked')
    expect(pageBody.total).toBe(events.length)
    expect(pageBody.nextCursor).toBe('2')
    const otherAccount = await app.inject({method: 'GET', url: `/v1/intelligence/missions/${mission.id}/ledger`, headers: {authorization: 'Bearer token-b'}})
    expect(otherAccount.statusCode).toBe(403)
    expect(otherAccount.json().error.code).toBe('MISSION_ACCESS_DENIED')
    const missing = await app.inject({method: 'GET', url: '/v1/intelligence/missions/does-not-exist/ledger', headers: {authorization: 'Bearer token-a'}})
    expect(missing.statusCode).toBe(404)
    expect(missing.json().error.code).toBe('MISSION_NOT_FOUND')
  })

  it('serves the cross-mission approvals queue with mission and proposal context', async () => {
    const mission = await createDraft(REVERSIBLE_WRITE_FIXTURE_OBJECTIVE)
    const pending = await service.start(accountA, mission.id)
    expect(pending.mission.status).toBe('awaiting_approval')
    const approval = pending.approvals[0]!
    expect(approval.status).toBe('pending')
    const queue = await app.inject({method: 'GET', url: '/v1/intelligence/approvals', headers: {authorization: 'Bearer token-a'}})
    expect(queue.statusCode).toBe(200)
    const queueBody = queue.json().data
    expect(queueBody.total).toBe(1)
    expect(queueBody.limit).toBe(25)
    expect(queueBody.nextCursor).toBeNull()
    const item = queueBody.items[0]
    expect(item.approval.id).toBe(approval.id)
    expect(item.approval.status).toBe('pending')
    expect(item.approval.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    // The 24h expiry is real: the live runtime path used to store a NULL
    // expiry, so approvals never expired. expiresAt must be requestedAt
    // + 24h (within a minute of clock skew between the two stamps).
    const expiryMs = Date.parse(item.approval.expiresAt!) - Date.parse(item.approval.requestedAt)
    expect(expiryMs).toBeGreaterThanOrEqual(24 * 60 * 60_000)
    expect(expiryMs).toBeLessThan(24 * 60 * 60_000 + 60_000)
    expect(item.mission).toMatchObject({id: mission.id, objective: REVERSIBLE_WRITE_FIXTURE_OBJECTIVE, status: 'awaiting_approval'})
    expect(item.proposal).toMatchObject({id: approval.proposalId, family: 'record.create', moduleId})
    const approved = await app.inject({method: 'GET', url: '/v1/intelligence/approvals?status=approved', headers: {authorization: 'Bearer token-a'}})
    expect(approved.json().data).toMatchObject({items: [], total: 0})
    const otherAccount = await app.inject({method: 'GET', url: '/v1/intelligence/approvals', headers: {authorization: 'Bearer token-b'}})
    expect(otherAccount.json().data).toMatchObject({items: [], total: 0})
    const unauthenticated = await app.inject({method: 'GET', url: '/v1/intelligence/approvals'})
    expect(unauthenticated.statusCode).toBe(401)
    expect(unauthenticated.json().error.code).toBe('UNAUTHENTICATED')
  })

  it('drains the queue when the pending approval is approved', async () => {
    // Clear any pending approval left by the earlier queue test so this
    // test is self-contained.
    const before = await app.inject({method: 'GET', url: '/v1/intelligence/approvals', headers: {authorization: 'Bearer token-a'}})
    for (const item of before.json().data.items as {approval: {id: string}; mission: {id: string}}[]) {
      await app.inject({method: 'POST', url: `/v1/intelligence/missions/${item.mission.id}/approvals/${item.approval.id}/approve`, headers: {authorization: 'Bearer token-a'}})
    }
    const mission = await createDraft(REVERSIBLE_WRITE_FIXTURE_OBJECTIVE)
    const pending = await service.start(accountA, mission.id)
    expect(pending.mission.status).toBe('awaiting_approval')
    const approval = pending.approvals[0]!
    const queued = await app.inject({method: 'GET', url: '/v1/intelligence/approvals', headers: {authorization: 'Bearer token-a'}})
    expect(queued.json().data.total).toBe(1)
    const resolved = await app.inject({method: 'POST', url: `/v1/intelligence/missions/${mission.id}/approvals/${approval.id}/approve`, headers: {authorization: 'Bearer token-a'}})
    expect(resolved.statusCode).toBe(200)
    expect(resolved.json().data.mission.status).toBe('completed')
    const queue = await app.inject({method: 'GET', url: '/v1/intelligence/approvals', headers: {authorization: 'Bearer token-a'}})
    expect(queue.json().data.total).toBe(0)
    const approvedQueue = await app.inject({method: 'GET', url: '/v1/intelligence/approvals?status=approved', headers: {authorization: 'Bearer token-a'}})
    const approvedIds = (approvedQueue.json().data.items as {approval: {id: string}}[]).map(item => item.approval.id)
    expect(approvedIds).toContain(approval.id)
  })
})

async function seedRuntime(db: ModulaDb) {
  const now = new Date()
  for (const [accountId, handle] of [[accountA, `intuia${suffix}`], [accountB, `intuib${suffix}`]] as const) {
    await db.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: handle, status: 'active', created_at: now, updated_at: now}).execute()
  }
  const publisherId = `intui-publisher-${suffix}`
  const extensionId = `intui-extension-${suffix}`
  const extensionVersionId = `intui-extension-version-${suffix}`
  const moduleVersionId = `intui-module-version-${suffix}`
  const version = `0.0.${Date.now()}`
  const permissions = [
    `records:module.${moduleId}.note:read`,
    `records:module.${moduleId}.note:write`,
    `records:module.${moduleId}.note:delete`,
  ]
  const manifest = syntheticAiManifest(permissions.map(permission => ({permission, reason: 'Intelligence UI readiness acceptance', risk: permission.endsWith(':read') ? 'low' : 'medium'})))
  await db.insertInto('greenfield_publishers').values({publisher_id: publisherId, display_name: 'Intelligence UI Test', website: null, status: 'verified', trust_level: 'firstParty', created_at: now, updated_at: now, verified_at: now, suspended_at: null, revoked_at: null}).execute()
  await db.insertInto('greenfield_extensions').values({extension_id: extensionId, slug: `intui-vault-${suffix}`, publisher_account_id: null, status: 'published', created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_versions').values({extension_version_id: extensionVersionId, extension_id: extensionId, version, manifest, status: 'published', created_at: now}).execute()
  await db.insertInto('greenfield_module_versions').values({module_version_id: moduleVersionId, extension_version_id: extensionVersionId, module_id: moduleId, version, publisher_id: publisherId, manifest, status: 'published', created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_module_releases').values({release_id: releaseId, module_version_id: moduleVersionId, extension_id: extensionId, extension_version_id: extensionVersionId, module_id: moduleId, version, publisher_id: publisherId, release_state: 'published', source_repository: 'modula-mod/modula-synthetic-records', source_commit: 'a'.repeat(40), manifest_path: 'module.manifest.json', manifest_sha256: 'b'.repeat(64), release_sha256: 'c'.repeat(64), signature_key_id: null, signature: null, compatibility: {}, license_status: 'firstParty', trust_level: 'firstParty', product_kind: 'module', extension_product: {}, published_at: now, quarantined_at: null, revoked_at: null, superseded_at: null, created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_installations').values({installation_id: installationId, extension_version_id: extensionVersionId, account_id: accountA, status: 'enabled', config: {}, created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_module_permission_reviews').values({review_id: `intui-review-${suffix}`, installation_id: installationId, release_id: releaseId, account_id: accountA, granted_permissions: jsonb(permissions), denied_permissions: jsonb([]), high_risk_increase: false, idempotency_key: `intui-review-${suffix}`, reviewed_at: now}).execute()
  const fields = [
    {fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true},
    {fieldId: 'document', name: 'document', type: 'json', label: 'Document', required: true},
    {fieldId: 'plainTextProjection', name: 'plainTextProjection', type: 'multilineText', label: 'Plain text', required: true},
    {fieldId: 'tagIds', name: 'tagIds', type: 'tags', label: 'Tags'},
    {fieldId: 'pinned', name: 'pinned', type: 'boolean', label: 'Pinned'},
    {fieldId: 'favourite', name: 'favourite', type: 'boolean', label: 'Favourite'},
    {fieldId: 'archived', name: 'archived', type: 'boolean', label: 'Archived'},
    {fieldId: 'dataSchemaVersion', name: 'dataSchemaVersion', type: 'text', label: 'Schema', required: true},
  ]
  await db.insertInto('greenfield_module_record_collections').values({collection_id: `intui-collection-${suffix}`, release_id: releaseId, module_id: moduleId, collection: 'note', schema_ref: 'schemas/note.json', default_visibility: 'private', fields: jsonb(fields), searchable_fields: jsonb(['title', 'plainTextProjection']), filterable_fields: jsonb(['pinned', 'archived']), sortable_fields: jsonb(['title']), folder_field: null, reference_fields: jsonb([]), schema_definition: {}, retention_policy: 'keepOnUninstall', registration_status: 'registered', created_at: now, updated_at: now}).execute()
}

function jsonb(value: unknown) {
  return sql`${JSON.stringify(value)}::jsonb`
}

function syntheticAiManifest(permissions: Array<{permission: string; reason: string; risk: string}>) {
  return {
    permissions,
    contributions: {schemas: [], events: []},
    actions: [
      {
        id: queryActionId,
        title: 'Query recent notes',
        functionId: queryFunctionId,
        permissions: [`records:module.${moduleId}.${collection}:read`],
        confirmationPolicy: {required: false, policyMode: 'warn'},
        sideEffects: ['record.query'],
        audit: {event: 'synthetic.note.query', includeInput: false},
      },
      {
        id: createActionId,
        title: 'Create a note',
        functionId: createFunctionId,
        permissions: [`records:module.${moduleId}.${collection}:write`],
        confirmationPolicy: {required: true, policyMode: 'warn'},
        sideEffects: ['record.create'],
        audit: {event: 'synthetic.note.create', includeInput: false},
      },
    ],
    functions: [
      {
        id: queryFunctionId,
        title: 'Query recent notes',
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
        audit: {event: 'synthetic.note.query', includeInput: false, includeOutput: false},
        confirmationPolicy: {required: false, risk: 'low'},
      },
      {
        id: createFunctionId,
        title: 'Create a note',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            collection: {type: 'string', const: collection},
            data: {type: 'object'},
          },
        },
        outputSchema: {type: 'object'},
        permissions: [`records:module.${moduleId}.${collection}:write`],
        aiCallable: true,
        automationCallable: false,
        idempotent: true,
        sideEffects: ['record.create'],
        timeoutMs: 10_000,
        rateLimit: {windowSeconds: 60, maxCalls: 30},
        audit: {event: 'synthetic.note.create', includeInput: false, includeOutput: false},
        confirmationPolicy: {required: true, risk: 'medium'},
      },
    ],
    ai: [],
  }
}
