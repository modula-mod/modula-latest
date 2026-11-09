import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import Fastify, {type FastifyInstance} from 'fastify'
import {sql} from 'kysely'
import {IntelligenceError, type GaiaPlan, type IntelligenceLedgerEvent, type ModulaActionProposal} from '@modula/intelligence-contracts'
import {
  DETERMINISTIC_TEST_PROVIDER_ID,
} from '@modula/intelligence-core'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {IntelligenceActionBoundary} from '../src/intelligence/action-boundary.js'
import {GovernedIntelligenceService} from '../src/intelligence/service.js'
import {registerIntelligenceRoutes} from '../src/intelligence/routes.js'
import {createGreenfieldCancelRuntime, sessionPrincipal} from '../src/intelligence/mission-cancel.js'
import {
  getGreenfieldMissionRuntimeTrace,
  installGreenfieldMissionRuntimeTestHooks,
  resetGreenfieldMissionRuntimeTrace,
} from '../src/intelligence/mission-runtime-binding.js'
import {GreenfieldMissionRuntimeStore} from '../src/intelligence/mission-runtime-store.js'
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

  afterAll(async () => {
    installGreenfieldMissionRuntimeTestHooks(db)
    await app?.close()
    await db?.destroy()
  })

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

  it('denies a cross-owner HTTP execute of a completed proposal without leaking the result', async () => {
    const mission = await service.createMission(accountA, {objective: genericQueryObjective, correlationId: `syn-xowner-${suffix}`})
    const detail = await service.start(accountA, mission.id)
    expect(detail.mission.status).toBe('completed')
    const proposalId = detail.proposals[0]!.id
    const secret = 'Synthetic 0'
    expect(JSON.stringify(detail.executions[0]?.result)).toContain(secret)

    const denied = await app.inject({
      method: 'POST',
      url: `/v1/intelligence/missions/${mission.id}/proposals/${proposalId}/execute`,
      headers: {authorization: 'Bearer token-b'},
    })
    expect(denied.statusCode).toBe(403)
    expect(denied.json().error.code).toBe('MISSION_ACCESS_DENIED')
    const body = JSON.stringify(denied.json())
    expect(body).not.toContain(secret)
    expect(body).not.toContain('Synthetic 1')
    expect(denied.json()).not.toHaveProperty('data')
    await expect(service.execute(accountB, mission.id, proposalId)).rejects.toMatchObject({code: 'MISSION_ACCESS_DENIED'})
  })

  it('denies executing a completed proposal under another owned mission without leaking the result', async () => {
    const completed = await service.createMission(accountA, {objective: genericQueryObjective, correlationId: `syn-bound-src-${suffix}`})
    const detail = await service.start(accountA, completed.id)
    expect(detail.mission.status).toBe('completed')
    const proposalId = detail.proposals[0]!.id
    const secret = 'Synthetic 0'
    expect(JSON.stringify(detail.executions[0]?.result)).toContain(secret)
    const other = await service.createMission(accountA, {objective: genericQueryObjective, correlationId: `syn-bound-dst-${suffix}`})

    const denied = await app.inject({
      method: 'POST',
      url: `/v1/intelligence/missions/${other.id}/proposals/${proposalId}/execute`,
      headers: {authorization: 'Bearer token-a'},
    })
    expect(denied.statusCode).toBe(404)
    expect(denied.json().error.code).toBe('MISSION_NOT_FOUND')
    const body = JSON.stringify(denied.json())
    expect(body).not.toContain(secret)
    expect(body).not.toContain('Synthetic 1')
    expect(denied.json()).not.toHaveProperty('data')
    await expect(service.execute(accountA, other.id, proposalId)).rejects.toMatchObject({code: 'MISSION_NOT_FOUND'})
  })

  it('serializes mission list updatedAt and query result updated_at as ISO-8601', async () => {
    const mission = await service.createMission(accountA, {objective: genericQueryObjective, correlationId: `syn-iso-${suffix}`})
    const detail = await service.start(accountA, mission.id)
    expect(detail.mission.status).toBe('completed')
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
    expect(detail.mission.updatedAt).toMatch(iso)
    expect(Number.isFinite(Date.parse(String(detail.mission.updatedAt)))).toBe(true)

    const listed = await app.inject({
      method: 'GET',
      url: '/v1/intelligence/missions',
      headers: {authorization: 'Bearer token-a'},
    })
    expect(listed.statusCode).toBe(200)
    const missions = listed.json().data as Array<{id: string; updatedAt?: unknown; updated_at?: unknown}>
    const row = missions.find(item => item.id === mission.id)
    expect(row).toBeTruthy()
    const listStamp = row!.updatedAt ?? row!.updated_at
    expect(String(listStamp)).toMatch(iso)
    expect(Number.isFinite(Date.parse(String(listStamp)))).toBe(true)

    const items = ((detail.executions[0]?.result as {items?: Array<{updated_at?: unknown; updatedAt?: unknown}>})?.items) ?? []
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      const stamp = item.updated_at ?? item.updatedAt
      expect(String(stamp)).toMatch(iso)
      expect(Number.isFinite(Date.parse(String(stamp)))).toBe(true)
    }
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

  it('revalidate requires the action to still be a declared AI-callable action', async () => {
    const boundary = new IntelligenceActionBoundary(db, developmentTrust)
    const declared = await boundary.revalidate(accountA, undefined, {
      id: `syn-revalidate-declared-${suffix}`,
      missionId: `syn-revalidate-mission-${suffix}`,
      moduleId,
      family: 'record.query',
      capability: `records:module.${moduleId}.${collection}:read`,
      actionId: queryActionId,
      input: {collection, limit: 25, sort: 'updatedAt', direction: 'desc'},
      requestedBy: 'gaia',
    })
    expect(declared).toMatchObject({registered: true, schemaValid: true, permissionGranted: true})

    const undeclaredReadable = await boundary.revalidate(accountA, undefined, {
      id: `syn-revalidate-undeclared-${suffix}`,
      missionId: `syn-revalidate-mission-${suffix}`,
      moduleId,
      family: 'record.query',
      capability: `records:module.${moduleId}.${undeclaredCollection}:read`,
      input: {collection: undeclaredCollection, limit: 25, sort: 'updatedAt', direction: 'desc'},
      requestedBy: 'gaia',
    })
    expect(undeclaredReadable.permissionGranted).toBe(true)
    expect(undeclaredReadable).toMatchObject({registered: false, schemaValid: false})

    const unregistered = {id: `syn-revalidate-unreg-${suffix}`, missionId: `syn-revalidate-mission-${suffix}`, input: {}, requestedBy: 'gaia' as const}
    for (const family of ['financial.fixture', 'unknown.superpower'] as const) {
      expect(await boundary.revalidate(accountA, undefined, {...unregistered, family, capability: family})).toMatchObject({registered: false})
    }
  })

  it('runs start, plan, verify, and execute to completion through MissionRuntime', async () => {
    resetGreenfieldMissionRuntimeTrace(db)
    const mission = await service.createMission(accountA, {objective: genericQueryObjective, correlationId: `syn-runtime-${suffix}`})
    const detail = await service.start(accountA, mission.id)
    expect(detail.mission.status).toBe('completed')
    expect(detail.executions).toHaveLength(1)
    expect(detail.executions[0]).toMatchObject({status: 'completed', missionId: mission.id})
    expect((detail.executions[0]?.result as {items?: unknown[]}).items).toHaveLength(5)
    const events = await service.ledger(accountA, mission.id)
    const planning = events.find(event => event.type === 'mission.planning_started')
    expect(planning?.payload).toMatchObject({
      planner: 'deterministic-test-v0',
      missionRuntime: 'injected',
      router: 'selection-only',
      selectedProviderId: DETERMINISTIC_TEST_PROVIDER_ID,
      modelProviderStatus: DETERMINISTIC_TEST_ADAPTER_STATUS,
    })
    expect(events.some(event => event.type === 'plan.created')).toBe(true)
    expect(events.some(event => event.type === 'aki.decision_created')).toBe(true)
    expect(events.some(event => event.type === 'governor.authorization_created')).toBe(true)
    expect(events.some(event => event.type === 'execution.completed')).toBe(true)
    expect(events.some(event => event.type === 'mission.completed')).toBe(true)
    const trace = getGreenfieldMissionRuntimeTrace(db)
    expect(trace).toMatchObject({planner: 1, decisions: 1, governor: 1, execute: 1})
    expect((trace?.revalidate ?? 0) >= 1).toBe(true)
    assertStrictlyMonotonicLedger(events)
    const proposalIndex = events.findIndex(event => event.type === 'proposal.created')
    const planIndex = events.findIndex(event => event.type === 'plan.created')
    expect(proposalIndex).toBeGreaterThanOrEqual(0)
    expect(planIndex).toBeGreaterThan(proposalIndex)
  })

  it('cancels a mid-run mission through the existing MissionRuntime cancel route', async () => {
    resetGreenfieldMissionRuntimeTrace(db)
    let release!: () => void
    const entered = new Promise<void>(resolve => {
      installGreenfieldMissionRuntimeTestHooks(db, {
        beforeExecute: async () => {
          resolve()
          await new Promise<void>(inner => { release = inner })
        },
      })
    })
    const mission = await service.createMission(accountA, {objective: genericQueryObjective, correlationId: `syn-cancel-${suffix}`})
    const started = service.start(accountA, mission.id)
    await entered
    const cancelled = await app.inject({
      method: 'POST',
      url: `/v1/intelligence/missions/${mission.id}/cancel`,
      headers: {authorization: 'Bearer token-a'},
    })
    expect(cancelled.statusCode).toBe(200)
    expect(cancelled.json().data.status).toBe('cancelled')
    const again = await createGreenfieldCancelRuntime(db).cancel(sessionPrincipal(accountA), mission.id)
    expect(again.status).toBe('cancelled')
    release()
    const detail = await started
    expect(detail.mission.status).toBe('cancelled')
    expect(detail.executions.some(execution => execution.status === 'completed')).toBe(false)
    const events = await service.ledger(accountA, mission.id)
    expect(events.some(event => event.type === 'mission.cancelled')).toBe(true)
    installGreenfieldMissionRuntimeTestHooks(db)
  })

  for (const outcome of ['resolves', 'rejects'] as const) {
    it(`keeps a mid-run cancel terminal when the blocked tool ${outcome} (D2)`, async () => {
      resetGreenfieldMissionRuntimeTrace(db)
      let settle!: (error?: Error) => void
      const entered = new Promise<void>(resolve => {
        installGreenfieldMissionRuntimeTestHooks(db, {
          beforeExecute: async () => {
            resolve()
            await new Promise<void>((ok, err) => {
              settle = error => { error ? err(error) : ok() }
            })
          },
        })
      })
      const mission = await service.createMission(accountA, {objective: genericQueryObjective, correlationId: `syn-d2-${outcome}-${suffix}`})
      const started = service.start(accountA, mission.id)
      await entered
      const cancelled = await app.inject({
        method: 'POST',
        url: `/v1/intelligence/missions/${mission.id}/cancel`,
        headers: {authorization: 'Bearer token-a'},
      })
      expect(cancelled.statusCode).toBe(200)
      expect(cancelled.json().data.status).toBe('cancelled')
      if (outcome === 'rejects') settle(new IntelligenceError('EXECUTION_FAILED', 'tool failed after cancel'))
      else settle()
      const detail = await started
      expect(detail.mission.status).toBe('cancelled')

      const run = await db.selectFrom('intelligence_runs').selectAll().where('mission_id', '=', mission.id).executeTakeFirstOrThrow()
      expect(run.status).toBe('failed')
      expect(run.completed_at).toBeTruthy()
      expect(run.status).not.toBe('cancelled')

      const events = await service.ledger(accountA, mission.id)
      assertStrictlyMonotonicLedger(events)
      const types = events.map(event => event.type)
      const cancelledAt = types.indexOf('mission.cancelled')
      expect(cancelledAt).toBeGreaterThanOrEqual(0)
      expect(types.filter(type => type === 'mission.cancelled')).toHaveLength(1)
      expect(types.slice(cancelledAt + 1)).not.toContain('execution.failed')
      expect(types.slice(cancelledAt + 1)).not.toContain('execution.completed')

      const executed = await app.inject({
        method: 'POST',
        url: `/v1/intelligence/missions/${mission.id}/proposals/${run.proposal_id}/execute`,
        headers: {authorization: 'Bearer token-a'},
      })
      expect(executed.statusCode).toBe(409)
      expect(executed.json().error.code).toBe('INVALID_MISSION_STATE')
      installGreenfieldMissionRuntimeTestHooks(db)
    })
  }

  it('returns a structured authorization error for a write-only grant without throwing a raw error', async () => {
    const deniedAccount = `syn-denied-struct-${suffix}`
    const now = new Date()
    await db.insertInto('greenfield_accounts').values({account_id: deniedAccount, primary_handle: `synds${suffix}`, status: 'active', created_at: now, updated_at: now}).execute()
    await seedDeniedReadInstallation(db, deniedAccount, `struct-${suffix}`)
    const mission = await service.createMission(deniedAccount, {objective: genericQueryObjective, correlationId: `syn-denied-struct-${suffix}`})
    const detail = await service.start(deniedAccount, mission.id)
    expect(detail.mission.status).toBe('blocked')
    expect(detail.executions).toHaveLength(0)
    const blocked = (await service.ledger(deniedAccount, mission.id)).find(event => event.type === 'mission.blocked')
    expect(blocked?.payload).toEqual(expect.objectContaining({
      reasonCode: expect.stringMatching(/^(AKI_DENIED|GOVERNOR_BLOCKED|PERMISSION_DENIED|CAPABILITY_UNKNOWN|CAPABILITY_DENIED)$/),
    }))
    expect(typeof blocked?.payload.reasonCode).toBe('string')
    const structured = new IntelligenceError(String(blocked?.payload.reasonCode), 'Authorization refused the proposal')
    expect(structured).toMatchObject({name: IntelligenceError.name, code: String(blocked?.payload.reasonCode)})
  })
  it('discards buffered proposal and ledger writes when the parent plan insert fails', async () => {
    const store = new GreenfieldMissionRuntimeStore(db)
    const now = new Date()
    const accountId = `syn-atom-account-${suffix}`
    const failedMissionId = `syn-atom-fail-${suffix}`
    const retryMissionId = `syn-atom-retry-${suffix}`
    const nextMissionId = `syn-atom-next-${suffix}`
    await db.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: `synatom${suffix}`, status: 'active', created_at: now, updated_at: now}).execute()
    for (const missionId of [failedMissionId, retryMissionId, nextMissionId]) {
      await store.insertMission({
        id: missionId,
        userId: accountId,
        objective: genericQueryObjective,
        status: 'planning',
        correlationId: `${missionId}-corr`,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
    }
    // Occupy version 1 so the parent plan insert fails the unique (mission_id, version) constraint.
    await db.insertInto('intelligence_plans').values({
      plan_id: `syn-atom-blocker-${suffix}`,
      mission_id: failedMissionId,
      version: 1,
      summary: 'blocking parent row',
      created_at: now,
    }).execute()

    const failedProposal = storeProposal(failedMissionId, `syn-atom-fail-proposal-${suffix}`)
    await store.writeProposal(failedProposal)
    await store.appendEvent(storeEvent(failedMissionId, failedProposal, 'proposal.created', 1, accountId))
    expect(store.bufferedState(failedMissionId).proposalIds).toEqual([failedProposal.id])
    expect(store.bufferedState(failedMissionId).eventIds).toHaveLength(1)

    await expect(store.writePlan(storePlan(failedMissionId, failedProposal, 1, `syn-atom-fail-plan-${suffix}`))).rejects.toThrow(/unique|duplicate|constraint/i)

    expect(await db.selectFrom('intelligence_proposals').select('proposal_id').where('mission_id', '=', failedMissionId).execute()).toEqual([])
    expect(await db.selectFrom('intelligence_ledger_events').select('event_id').where('mission_id', '=', failedMissionId).execute()).toEqual([])
    expect(await db.selectFrom('intelligence_plans').select('plan_id').where('mission_id', '=', failedMissionId).execute()).toEqual([
      expect.objectContaining({plan_id: `syn-atom-blocker-${suffix}`}),
    ])
    expect(store.bufferedState(failedMissionId)).toEqual({proposalIds: [], eventIds: []})

    // Retry on a fresh mission after clearing the buffer must not double-write.
    const retryProposal = storeProposal(retryMissionId, `syn-atom-retry-proposal-${suffix}`)
    await store.writeProposal(retryProposal)
    await store.appendEvent(storeEvent(retryMissionId, retryProposal, 'proposal.created', 1, accountId))
    await store.writePlan(storePlan(retryMissionId, retryProposal, 1, `syn-atom-retry-plan-${suffix}`))
    await store.appendEvent(storeEvent(retryMissionId, retryProposal, 'plan.created', 2, accountId))
    const retryProposals = await db.selectFrom('intelligence_proposals').select('proposal_id').where('mission_id', '=', retryMissionId).execute()
    const retryEvents = await store.listEvents(retryMissionId)
    expect(retryProposals).toEqual([{proposal_id: retryProposal.id}])
    expect(retryEvents.map(event => event.type)).toEqual(['proposal.created', 'plan.created'])
    expect(store.bufferedState(retryMissionId)).toEqual({proposalIds: [], eventIds: []})
    assertStrictlyMonotonicLedger(retryEvents)

    const nextProposal = storeProposal(nextMissionId, `syn-atom-next-proposal-${suffix}`)
    await store.writeProposal(nextProposal)
    await store.appendEvent(storeEvent(nextMissionId, nextProposal, 'proposal.created', 1, accountId))
    await store.writePlan(storePlan(nextMissionId, nextProposal, 1, `syn-atom-next-plan-${suffix}`))
    await store.appendEvent(storeEvent(nextMissionId, nextProposal, 'plan.created', 2, accountId))
    const nextEvents = await store.listEvents(nextMissionId)
    expect(nextEvents.map(event => event.type)).toEqual(['proposal.created', 'plan.created'])
    assertStrictlyMonotonicLedger(nextEvents)
    expect(nextEvents.map(event => event.payload.sequence)).toEqual([1, 2])
  })
})

function assertStrictlyMonotonicLedger(events: readonly {type: string; payload: Record<string, unknown>}[]) {
  const sequences = events
    .map(event => event.payload.sequence)
    .filter((value): value is number => typeof value === 'number')
  for (let index = 1; index < sequences.length; index += 1) {
    expect(sequences[index]).toBeGreaterThan(sequences[index - 1])
    expect(sequences[index]).toBe(sequences[index - 1] + 1)
  }
}

function storeProposal(missionId: string, proposalId: string): ModulaActionProposal {
  return {
    id: proposalId,
    missionId,
    family: 'record.query',
    capability: `records:module.${moduleId}.${collection}:read`,
    actionId: queryActionId,
    input: {collection, limit: 25, sort: 'updatedAt', direction: 'desc'},
    requestedBy: 'gaia',
  }
}

function storePlan(missionId: string, proposal: ModulaActionProposal, version: number, planId: string): GaiaPlan {
  return {
    id: planId,
    missionId,
    version,
    summary: 'atomic store fixture',
    createdAt: new Date().toISOString(),
    steps: [{
      id: `${planId}-step`,
      order: 1,
      description: 'Query the synthetic collection',
      capability: proposal.capability,
      actionProposal: proposal,
      dependencies: [],
      state: 'pending',
    }],
  }
}

function storeEvent(
  missionId: string,
  proposal: ModulaActionProposal,
  type: 'proposal.created' | 'plan.created',
  sequence: number,
  accountId: string,
): IntelligenceLedgerEvent {
  return {
    id: `${missionId}-${type}-${sequence}`,
    schemaVersion: '1.0.0',
    type,
    timestamp: new Date(Date.now() + sequence).toISOString(),
    actor: {type: 'gaia'},
    missionId,
    correlationId: `${missionId}-corr`,
    userId: accountId,
    proposalId: type === 'proposal.created' ? proposal.id : undefined,
    payload: {sequence, family: proposal.family, capability: proposal.capability},
  }
}

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

async function seedDeniedReadInstallation(db: ModulaDb, accountId: string, seedKey = suffix) {
  const now = new Date()
  const publisherId = `syn-denied-publisher-${seedKey}`
  const extensionId = `syn-denied-extension-${seedKey}`
  const extensionVersionId = `syn-denied-extension-version-${seedKey}`
  const moduleVersionId = `syn-denied-module-version-${seedKey}`
  const version = `0.0.${Date.now()}`
  const read = `records:module.${moduleId}.${collection}:read`
  const write = `records:module.${moduleId}.${collection}:write`
  const manifest = syntheticAiManifest([{permission: write, reason: 'write only', risk: 'medium'}, {permission: read, reason: 'read declared but denied', risk: 'low'}])
  await db.insertInto('greenfield_publishers').values({publisher_id: publisherId, display_name: 'Synthetic Denied Read', website: null, status: 'verified', trust_level: 'firstParty', created_at: now, updated_at: now, verified_at: now, suspended_at: null, revoked_at: null}).execute()
  await db.insertInto('greenfield_extensions').values({extension_id: extensionId, slug: `syn-denied-${seedKey}`, publisher_account_id: null, status: 'published', created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_versions').values({extension_version_id: extensionVersionId, extension_id: extensionId, version, manifest, status: 'published', created_at: now}).execute()
  await db.insertInto('greenfield_module_versions').values({module_version_id: moduleVersionId, extension_version_id: extensionVersionId, module_id: moduleId, version, publisher_id: publisherId, manifest, status: 'published', created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_module_releases').values({release_id: (seedKey === suffix ? deniedReleaseId : `syn-denied-release-${seedKey}`), module_version_id: moduleVersionId, extension_id: extensionId, extension_version_id: extensionVersionId, module_id: moduleId, version, publisher_id: publisherId, release_state: 'published', source_repository: 'modula-mod/modula-synthetic-records', source_commit: 'd'.repeat(40), manifest_path: 'module.manifest.json', manifest_sha256: 'e'.repeat(64), release_sha256: 'f'.repeat(64), signature_key_id: null, signature: null, compatibility: {}, license_status: 'firstParty', trust_level: 'firstParty', product_kind: 'module', extension_product: {}, published_at: now, quarantined_at: null, revoked_at: null, superseded_at: null, created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_installations').values({installation_id: (seedKey === suffix ? deniedInstallationId : `syn-denied-installation-${seedKey}`), extension_version_id: extensionVersionId, account_id: accountId, status: 'enabled', config: {}, created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_module_permission_reviews').values({review_id: `syn-denied-review-${seedKey}`, installation_id: (seedKey === suffix ? deniedInstallationId : `syn-denied-installation-${seedKey}`), release_id: (seedKey === suffix ? deniedReleaseId : `syn-denied-release-${seedKey}`), account_id: accountId, granted_permissions: jsonb([write]), denied_permissions: jsonb([read]), high_risk_increase: false, idempotency_key: `syn-denied-review-${seedKey}`, reviewed_at: now}).execute()
  await db.insertInto('greenfield_module_record_collections').values({collection_id: `syn-denied-collection-${seedKey}`, release_id: (seedKey === suffix ? deniedReleaseId : `syn-denied-release-${seedKey}`), module_id: moduleId, collection, schema_ref: 'schemas/item.json', default_visibility: 'private', fields: jsonb([{fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true}, {fieldId: 'body', name: 'body', type: 'text', label: 'Body', required: true}]), searchable_fields: jsonb(['title']), filterable_fields: jsonb([]), sortable_fields: jsonb(['title']), folder_field: null, reference_fields: jsonb([]), schema_definition: {}, retention_policy: 'keepOnUninstall', registration_status: 'registered', created_at: now, updated_at: now}).execute()
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
