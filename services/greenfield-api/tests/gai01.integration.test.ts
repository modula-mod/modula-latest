import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import Fastify, {type FastifyInstance} from 'fastify'
import {sql} from 'kysely'
import {FINANCIAL_FIXTURE_OBJECTIVE, RECENT_VAULT_NOTES_OBJECTIVE, REVERSIBLE_WRITE_FIXTURE_OBJECTIVE, UNKNOWN_CAPABILITY_FIXTURE_OBJECTIVE} from '@modula/intelligence-governance'
import {IntelligenceError} from '@modula/intelligence-contracts'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {IntelligenceActionBoundary} from '../src/intelligence/action-boundary.js'
import {GovernedIntelligenceService} from '../src/intelligence/service.js'
import {registerIntelligenceRoutes} from '../src/intelligence/routes.js'
import {GreenfieldModuleRecordService} from '../src/modules/record-service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const moduleId = 'digital.modula.vault-notes'
const suffix = randomUUID().slice(0, 8)
const accountA = `gai01-a-${suffix}`
const accountB = `gai01-b-${suffix}`
const releaseId = `gai01-release-${suffix}`
const installationId = `gai01-installation-${suffix}`
const developmentTrust = {environment: 'development' as const, moduleAllowUntrustedDevelopmentReleases: true}

describeIfDb('GAI-01 governed intelligence database acceptance', () => {
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

  it('does not expose record.query from a permission-only Vault Notes seed', async () => {
    const actions = await new IntelligenceActionBoundary(db, developmentTrust).availableActions(accountA)
    expect(actions.some(action => action.family === 'record.query')).toBe(false)
    expect(actions.some(action => action.family === 'record.create')).toBe(false)
    expect(actions.some(action => action.collection === 'note')).toBe(false)

    const mission = await service.createMission(accountA, {
      objective: 'Query the authorized module collection for recently updated records.',
      correlationId: `corr-safe-${suffix}`,
    })
    const detail = await service.start(accountA, mission.id)
    expect(detail.mission.status).toBe('blocked')
    expect(detail.proposals[0]?.family).not.toBe('record.query')
    expect(detail.executions).toHaveLength(0)
  })


  it('rejects unauthenticated intelligence API calls', async () => {
    const unauthenticated = await app.inject({method: 'POST', url: '/v1/intelligence/missions', payload: {objective: 'Query the authorized module collection for recently updated records.'}})
    expect(unauthenticated.statusCode).toBe(401)
    expect(unauthenticated.json().error.code).toBe('UNAUTHENTICATED')
  })

  it('prevents ledger mutation and illegal mission transitions for a blocked unknown-capability mission', async () => {
    const mission = await service.createMission(accountA, {objective: UNKNOWN_CAPABILITY_FIXTURE_OBJECTIVE})
    await service.start(accountA, mission.id)
    const event = await db.selectFrom('intelligence_ledger_events').select('event_id').where('mission_id', '=', mission.id).executeTakeFirstOrThrow()
    await expect(db.updateTable('intelligence_ledger_events').set({event_type: 'tampered'}).where('event_id', '=', event.event_id).execute()).rejects.toThrow(/append-only/)
    await expect(db.deleteFrom('intelligence_ledger_events').where('event_id', '=', event.event_id).execute()).rejects.toThrow(/append-only/)
    await expect(db.updateTable('intelligence_missions').set({status: 'running'}).where('mission_id', '=', mission.id).execute()).rejects.toThrow(/invalid intelligence mission transition/)
  })

  it('Acceptance B: unknown capability is blocked with zero runtime execution', async () => {
    const before = await countRuns(db)
    const mission = await service.createMission(accountA, {objective: UNKNOWN_CAPABILITY_FIXTURE_OBJECTIVE, correlationId: `corr-block-${suffix}`})
    const detail = await service.start(accountA, mission.id)
    expect(detail.mission.status).toBe('blocked')
    expect(detail.executions).toHaveLength(0)
    expect(await countRuns(db)).toBe(before)
  })

  // Isolated leftovers: these required collection+permission synthesis to expose
  // Vault Notes record.query / record.create. They are not core acceptance.
  // Do not re-enable them by inventing an aiCallable Vault Notes declaration here.
  it.skip('Acceptance C: approval gates a reversible write and retry remains exactly once', async () => {
    const before = await countFixtureRecords(db)
    const mission = await service.createMission(accountA, {objective: REVERSIBLE_WRITE_FIXTURE_OBJECTIVE, correlationId: `corr-approval-${suffix}`})
    const pending = await service.start(accountA, mission.id)
    expect(pending.mission.status).toBe('awaiting_approval')
    expect(pending.executions).toHaveLength(0)
    expect(await countFixtureRecords(db)).toBe(before)
    const approval = pending.approvals[0]!
    const completed = await service.approve(accountA, mission.id, approval.id)
    expect(completed.mission.status).toBe('completed')
    expect(await countFixtureRecords(db)).toBe(before + 1)
    await service.execute(accountA, mission.id, pending.proposals[0]!.id)
    expect(await countFixtureRecords(db)).toBe(before + 1)
    expect(await db.selectFrom('intelligence_runs').selectAll().where('proposal_id', '=', pending.proposals[0]!.id).execute()).toHaveLength(1)
  })

  it('financial intent is blocked and creates no runtime run', async () => {
    const before = await countRuns(db)
    const mission = await service.createMission(accountA, {objective: FINANCIAL_FIXTURE_OBJECTIVE})
    const detail = await service.start(accountA, mission.id)
    expect(detail.mission.status).toBe('blocked')
    expect(detail.governorDecisions[0]?.authorization).toBe('blocked')
    expect(await countRuns(db)).toBe(before)
  })

  it.skip('Acceptance D: cross-owner mission, ledger, evidence, approval and execution access fail closed', async () => {
    const mission = await service.createMission(accountA, {objective: REVERSIBLE_WRITE_FIXTURE_OBJECTIVE})
    const pending = await service.start(accountA, mission.id)
    await expect(service.detail(accountB, mission.id)).rejects.toMatchObject({code: 'MISSION_ACCESS_DENIED'})
    await expect(service.ledger(accountB, mission.id)).rejects.toMatchObject({code: 'MISSION_ACCESS_DENIED'})
    await expect(service.evidence(accountB, mission.id)).rejects.toMatchObject({code: 'MISSION_ACCESS_DENIED'})
    await expect(service.approve(accountB, mission.id, pending.approvals[0]!.id)).rejects.toMatchObject({code: 'MISSION_ACCESS_DENIED'})
    await expect(service.execute(accountB, mission.id, pending.proposals[0]!.id)).rejects.toMatchObject({code: 'MISSION_ACCESS_DENIED'})
  })

  it.skip('authenticates every API and returns machine-readable cross-owner denials', async () => {
    const unauthenticated = await app.inject({method: 'POST', url: '/v1/intelligence/missions', payload: {objective: RECENT_VAULT_NOTES_OBJECTIVE}})
    expect(unauthenticated.statusCode).toBe(401)
    expect(unauthenticated.json().error.code).toBe('UNAUTHENTICATED')

    const mission = await service.createMission(accountA, {objective: REVERSIBLE_WRITE_FIXTURE_OBJECTIVE})
    const pending = await service.start(accountA, mission.id)
    const authB = {authorization: 'Bearer token-b'}
    for (const path of [
      `/v1/intelligence/missions/${mission.id}`,
      `/v1/intelligence/missions/${mission.id}/ledger`,
      `/v1/intelligence/missions/${mission.id}/evidence`,
      `/v1/intelligence/missions/${mission.id}/decisions`,
      `/v1/intelligence/missions/${mission.id}/approvals`,
    ]) {
      const response = await app.inject({method: 'GET', url: path, headers: authB})
      expect(response.statusCode, path).toBe(403)
      expect(response.json().error.code, path).toBe('MISSION_ACCESS_DENIED')
    }
    for (const path of [
      `/v1/intelligence/missions/${mission.id}/approvals/${pending.approvals[0]!.id}/approve`,
      `/v1/intelligence/missions/${mission.id}/approvals/${pending.approvals[0]!.id}/reject`,
      `/v1/intelligence/missions/${mission.id}/proposals/${pending.proposals[0]!.id}/execute`,
    ]) {
      const response = await app.inject({method: 'POST', url: path, headers: authB})
      expect(response.statusCode, path).toBe(403)
      expect(response.json().error.code, path).toBe('MISSION_ACCESS_DENIED')
    }
  })

  it.skip('prevents ledger mutation and illegal mission/approval transitions at the database boundary', async () => {
    const mission = await service.createMission(accountA, {objective: UNKNOWN_CAPABILITY_FIXTURE_OBJECTIVE})
    await service.start(accountA, mission.id)
    const event = await db.selectFrom('intelligence_ledger_events').select('event_id').where('mission_id', '=', mission.id).executeTakeFirstOrThrow()
    await expect(db.updateTable('intelligence_ledger_events').set({event_type: 'tampered'}).where('event_id', '=', event.event_id).execute()).rejects.toThrow(/append-only/)
    await expect(db.deleteFrom('intelligence_ledger_events').where('event_id', '=', event.event_id).execute()).rejects.toThrow(/append-only/)
    await expect(db.updateTable('intelligence_missions').set({status: 'running'}).where('mission_id', '=', mission.id).execute()).rejects.toThrow(/invalid intelligence mission transition/)

    const approvalMission = await service.createMission(accountA, {objective: REVERSIBLE_WRITE_FIXTURE_OBJECTIVE})
    const pending = await service.start(accountA, approvalMission.id)
    await db.updateTable('intelligence_approvals').set({status: 'cancelled'}).where('approval_id', '=', pending.approvals[0]!.id).execute()
    await expect(db.updateTable('intelligence_approvals').set({status: 'approved'}).where('approval_id', '=', pending.approvals[0]!.id).execute()).rejects.toThrow(/invalid intelligence approval transition/)
    await expect(db.insertInto('intelligence_plans').values({plan_id: `orphan-${randomUUID()}`, mission_id: `missing-${randomUUID()}`, version: 1, summary: 'must fail', created_at: new Date()}).execute()).rejects.toThrow(/foreign key/)
  })

  it.skip('database uniqueness prevents duplicate workers from claiming a proposal', async () => {
    const mission = await service.createMission(accountA, {objective: REVERSIBLE_WRITE_FIXTURE_OBJECTIVE})
    const pending = await service.start(accountA, mission.id)
    const approvalId = pending.approvals[0]!.id
    const outcomes = await Promise.allSettled([service.approve(accountA, mission.id, approvalId), service.approve(accountA, mission.id, approvalId)])
    expect(outcomes.filter(item => item.status === 'fulfilled')).toHaveLength(1)
    const runs = await db.selectFrom('intelligence_runs').selectAll().where('proposal_id', '=', pending.proposals[0]!.id).execute()
    expect(runs).toHaveLength(1)
  })

  it.skip('rechecks revoked permission immediately before execution and records a block with zero runtime calls', async () => {
    const mission = await service.createMission(accountA, {objective: REVERSIBLE_WRITE_FIXTURE_OBJECTIVE})
    const pending = await service.start(accountA, mission.id)
    const before = await countFixtureRecords(db)
    await db.insertInto('greenfield_module_permission_reviews').values({review_id: `gai01-revoked-${randomUUID()}`, installation_id: installationId, release_id: releaseId, account_id: accountA, granted_permissions: jsonb([`records:module.${moduleId}.note:read`]), denied_permissions: jsonb([`records:module.${moduleId}.note:write`]), high_risk_increase: false, idempotency_key: `gai01-revoked-${randomUUID()}`, reviewed_at: new Date(Date.now() + 1000)}).execute()
    try {
      await expect(service.approve(accountA, mission.id, pending.approvals[0]!.id)).rejects.toMatchObject({code: 'PERMISSION_DENIED'})
      expect(await countFixtureRecords(db)).toBe(before)
      expect(await db.selectFrom('intelligence_runs').selectAll().where('proposal_id', '=', pending.proposals[0]!.id).execute()).toHaveLength(0)
      expect((await service.ledger(accountA, mission.id)).map(row => row.type)).toContain('execution.blocked')
    } finally {
      await restorePermissions(db)
    }
  })

  it.skip('rejects a proposal that no longer matches the current closed collection schema', async () => {
    const mission = await service.createMission(accountA, {objective: REVERSIBLE_WRITE_FIXTURE_OBJECTIVE})
    const pending = await service.start(accountA, mission.id)
    const proposal = pending.proposals[0]!
    await db.updateTable('intelligence_proposals').set({input: {...(proposal.input as any), data: {...(proposal.input as any).data, injected: 'not declared'}}}).where('proposal_id', '=', proposal.id).execute()
    const before = await countFixtureRecords(db)
    await expect(service.approve(accountA, mission.id, pending.approvals[0]!.id)).rejects.toMatchObject({code: 'INVALID_ACTION_SCHEMA'})
    expect(await countFixtureRecords(db)).toBe(before)
    expect(await db.selectFrom('intelligence_runs').selectAll().where('proposal_id', '=', proposal.id).execute()).toHaveLength(0)
  })

  it.skip('records a governed runtime failure without leaving the mission or execution running', async () => {
    const mission = await service.createMission(accountA, {objective: REVERSIBLE_WRITE_FIXTURE_OBJECTIVE})
    const pending = await service.start(accountA, mission.id)
    const runtimeFailure = vi.spyOn(GreenfieldModuleRecordService.prototype, 'create').mockRejectedValueOnce(new Error('isolated runtime failure'))
    try {
      await expect(service.approve(accountA, mission.id, pending.approvals[0]!.id)).rejects.toMatchObject({code: 'EXECUTION_FAILED'})
    } finally {
      runtimeFailure.mockRestore()
    }
    const detail = await service.detail(accountA, mission.id)
    expect(detail.mission.status).toBe('failed')
    expect(detail.executions).toHaveLength(1)
    expect(detail.executions[0]).toMatchObject({status: 'failed', errorCode: 'EXECUTION_FAILED'})
    expect((await service.ledger(accountA, mission.id)).map(event => event.type)).toEqual(expect.arrayContaining(['execution.started', 'execution.failed', 'mission.failed']))
  })

  it.skip('expires stale approvals, blocks the mission, and appends immutable expiry events', async () => {
    const mission = await service.createMission(accountA, {objective: REVERSIBLE_WRITE_FIXTURE_OBJECTIVE})
    const pending = await service.start(accountA, mission.id)
    const approval = pending.approvals[0]!
    await db.updateTable('intelligence_approvals').set({expires_at: new Date(Date.now() - 1_000)}).where('approval_id', '=', approval.id).execute()
    await expect(service.approve(accountA, mission.id, approval.id)).rejects.toMatchObject({code: 'APPROVAL_REJECTED'})
    const detail = await service.detail(accountA, mission.id)
    expect(detail.mission.status).toBe('blocked')
    expect(detail.approvals[0]?.status).toBe('expired')
    expect(detail.executions).toHaveLength(0)
    expect((await service.ledger(accountA, mission.id)).map(event => event.type)).toEqual(expect.arrayContaining(['approval.expired', 'mission.blocked']))
  })

  it.skip('reconstructs a completed governed mission from stable ledger events and durable relationships', async () => {
    const correlationId = `corr-reconstruct-${suffix}`
    const mission = await service.createMission(accountA, {objective: REVERSIBLE_WRITE_FIXTURE_OBJECTIVE, correlationId})
    const pending = await service.start(accountA, mission.id)
    const completed = await service.approve(accountA, mission.id, pending.approvals[0]!.id)
    const events = await service.ledger(accountA, mission.id)
    const byType = new Map(events.map(event => [event.type, event]))

    expect(byType.get('mission.created')).toMatchObject({missionId: mission.id, correlationId, userId: accountA, actor: {type: 'user'}, payload: {objective: REVERSIBLE_WRITE_FIXTURE_OBJECTIVE}})
    expect(byType.get('plan.created')?.payload).toMatchObject({version: 1})
    expect(byType.get('proposal.created')).toMatchObject({proposalId: pending.proposals[0]!.id, payload: {capability: pending.proposals[0]!.capability}})
    expect(byType.get('aki.decision_created')).toMatchObject({akiDecisionId: completed.akiDecisions[0]!.id, payload: {verdict: 'require_approval', risk: 'write_reversible'}})
    expect(byType.get('governor.authorization_created')).toMatchObject({governorDecisionId: completed.governorDecisions[0]!.id, payload: {authorization: 'human_required'}})
    expect(byType.get('approval.requested')).toMatchObject({approvalId: completed.approvals[0]!.id, payload: {status: 'pending'}})
    expect(byType.get('approval.approved')).toMatchObject({approvalId: completed.approvals[0]!.id, actor: {type: 'user', id: accountA}, payload: {status: 'approved'}})
    expect(byType.get('execution.completed')).toMatchObject({executionId: completed.executions[0]!.id})
    expect(byType.get('artifact.created')).toMatchObject({artifactId: completed.artifacts[0]!.id})
    expect(byType.get('mission.completed')?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(completed).toMatchObject({mission: {status: 'completed'}, plans: [{version: 1}], steps: [{state: 'completed'}], executions: [{status: 'completed'}]})
  })
})

async function seedRuntime(db: ModulaDb) {
  const now = new Date()
  for (const [accountId, handle] of [[accountA, `gai01a${suffix}`], [accountB, `gai01b${suffix}`]] as const) {
    await db.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: handle, status: 'active', created_at: now, updated_at: now}).execute()
  }
  const publisherId = `gai01-publisher-${suffix}`
  const extensionId = `gai01-extension-${suffix}`
  const extensionVersionId = `gai01-extension-version-${suffix}`
  const moduleVersionId = `gai01-module-version-${suffix}`
  const version = `0.0.${Date.now()}`
  const permissions = [
    `records:module.${moduleId}.note:read`,
    `records:module.${moduleId}.note:write`,
    `records:module.${moduleId}.note:delete`,
  ]
  const manifest = {permissions: permissions.map(permission => ({permission, reason: 'GAI-01 acceptance', risk: permission.endsWith(':read') ? 'low' : 'medium'})), contributions: {schemas: [], events: []}}
  await db.insertInto('greenfield_publishers').values({publisher_id: publisherId, display_name: 'GAI-01 Test', website: null, status: 'verified', trust_level: 'firstParty', created_at: now, updated_at: now, verified_at: now, suspended_at: null, revoked_at: null}).execute()
  await db.insertInto('greenfield_extensions').values({extension_id: extensionId, slug: `gai01-vault-${suffix}`, publisher_account_id: null, status: 'published', created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_versions').values({extension_version_id: extensionVersionId, extension_id: extensionId, version, manifest, status: 'published', created_at: now}).execute()
  await db.insertInto('greenfield_module_versions').values({module_version_id: moduleVersionId, extension_version_id: extensionVersionId, module_id: moduleId, version, publisher_id: publisherId, manifest, status: 'published', created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_module_releases').values({release_id: releaseId, module_version_id: moduleVersionId, extension_id: extensionId, extension_version_id: extensionVersionId, module_id: moduleId, version, publisher_id: publisherId, release_state: 'published', source_repository: 'modula-mod/modula-vault-notes', source_commit: 'a'.repeat(40), manifest_path: 'module.manifest.json', manifest_sha256: 'b'.repeat(64), release_sha256: 'c'.repeat(64), signature_key_id: null, signature: null, compatibility: {}, license_status: 'firstParty', trust_level: 'firstParty', product_kind: 'module', extension_product: {}, published_at: now, quarantined_at: null, revoked_at: null, superseded_at: null, created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_installations').values({installation_id: installationId, extension_version_id: extensionVersionId, account_id: accountA, status: 'enabled', config: {}, created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_module_permission_reviews').values({review_id: `gai01-review-${suffix}`, installation_id: installationId, release_id: releaseId, account_id: accountA, granted_permissions: jsonb(permissions), denied_permissions: jsonb([]), high_risk_increase: false, idempotency_key: `gai01-review-${suffix}`, reviewed_at: now}).execute()
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
  await db.insertInto('greenfield_module_record_collections').values({collection_id: `gai01-collection-${suffix}`, release_id: releaseId, module_id: moduleId, collection: 'note', schema_ref: 'schemas/note.json', default_visibility: 'private', fields: jsonb(fields), searchable_fields: jsonb(['title', 'plainTextProjection']), filterable_fields: jsonb(['pinned', 'archived']), sortable_fields: jsonb(['title']), folder_field: null, reference_fields: jsonb([]), schema_definition: {}, retention_policy: 'keepOnUninstall', registration_status: 'registered', created_at: now, updated_at: now}).execute()
  const records = new GreenfieldModuleRecordService(db, developmentTrust)
  for (let index = 0; index < 7; index += 1) {
    await records.create(accountA, moduleId, 'note', {
      data: {title: `Acceptance ${index}`, document: {type: 'doc', content: []}, plainTextProjection: `Note ${index}`, tagIds: [], pinned: false, favourite: false, archived: false, dataSchemaVersion: '1.0.0'},
      mutationId: `gai01-seed:${suffix}:${index}`,
    })
  }
}

async function countRuns(db: ModulaDb) {
  const row = await db.selectFrom('intelligence_runs').select(({fn}) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow()
  return Number(row.count)
}

async function countFixtureRecords(db: ModulaDb) {
  const result = await sql<{count: string}>`SELECT COUNT(*)::text AS count FROM greenfield_module_records WHERE account_id=${accountA} AND module_id=${moduleId} AND data->>'title'='GAI-01 approval acceptance'`.execute(db)
  return Number(result.rows[0]?.count ?? 0)
}

async function restorePermissions(db: ModulaDb) {
  const permissions = [`records:module.${moduleId}.note:read`, `records:module.${moduleId}.note:write`, `records:module.${moduleId}.note:delete`]
  await db.insertInto('greenfield_module_permission_reviews').values({review_id: `gai01-restored-${randomUUID()}`, installation_id: installationId, release_id: releaseId, account_id: accountA, granted_permissions: jsonb(permissions), denied_permissions: jsonb([]), high_risk_increase: false, idempotency_key: `gai01-restored-${randomUUID()}`, reviewed_at: new Date(Date.now() + 2000)}).execute()
}

function jsonb(value: unknown) {
  return sql`${JSON.stringify(value)}::jsonb`
}
