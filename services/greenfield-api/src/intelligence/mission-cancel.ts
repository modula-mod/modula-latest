import {IntelligenceError, type IntelligenceLedgerEvent, type IntelligenceLedgerEventType, type IntelligenceMission} from '@modula/intelligence-contracts'
import {
  MissionRuntime,
  type MissionRuntimeStore,
  type VerifiedPrincipal,
} from '@modula/mar-runtime'
import type {ModulaDb} from '../database/client.js'
import type {Database} from '../database/types.js'
import {getOrCreateGreenfieldMissionRuntime} from './mission-runtime-binding.js'

/**
 * Verified GreenField session principal for MissionRuntime.
 */
export function sessionPrincipal(accountId: string, workspaceId?: string): VerifiedPrincipal {
  return {
    accountId,
    ...(workspaceId ? {workspaceId} : {}),
    assurance: {
      kind: 'verified',
      method: 'greenfield-session',
      verifiedAt: new Date().toISOString(),
    },
  }
}

export function createCancelRuntime(store: MissionRuntimeStore): MissionRuntime {
  return new MissionRuntime({
    store,
    planner: {plan: async () => unusedCancelPort()},
    decisions: {evaluate: async () => unusedCancelPort()},
    governor: {decide: () => unusedCancelPort()},
    capabilities: {list: async () => []},
    tools: {
      revalidate: async () => ({registered: false, schemaValid: false, permissionGranted: false, workspaceAccess: false}),
      execute: async () => unusedCancelPort(),
    },
  })
}

export function createGreenfieldCancelRuntime(db: ModulaDb): MissionRuntime {
  return getOrCreateGreenfieldMissionRuntime(db).runtime
}

function unusedCancelPort(): never {
  throw new IntelligenceError('EXECUTION_FAILED', 'This GreenField runtime binding is cancel-only')
}

class GreenfieldMissionCancelStore implements MissionRuntimeStore {
  constructor(private readonly db: ModulaDb) {}

  async readMission(missionId: string): Promise<IntelligenceMission | undefined> {
    const row = await this.db.selectFrom('intelligence_missions').selectAll().where('mission_id', '=', missionId).executeTakeFirst()
    return row ? toMission(row) : undefined
  }

  async writeMission(mission: IntelligenceMission): Promise<void> {
    await this.db.transaction().execute(async trx => {
      const row = await trx.selectFrom('intelligence_missions').selectAll().where('mission_id', '=', mission.id).forUpdate().executeTakeFirst()
      if (!row) throw new IntelligenceError('MISSION_NOT_FOUND', 'Mission not found')
      await trx.updateTable('intelligence_missions').set({
        status: mission.status,
        updated_at: new Date(mission.updatedAt),
        completed_at: mission.completedAt ? new Date(mission.completedAt) : null,
      }).where('mission_id', '=', mission.id).execute()
    })
  }

  async listEvents(missionId: string): Promise<readonly IntelligenceLedgerEvent[]> {
    const rows = await this.db.selectFrom('intelligence_ledger_events').selectAll().where('mission_id', '=', missionId).orderBy('occurred_at').orderBy('event_id').execute()
    return rows.map(toLedgerEvent)
  }

  async appendEvent(event: IntelligenceLedgerEvent): Promise<void> {
    await this.db.insertInto('intelligence_ledger_events').values({
      event_id: event.id,
      schema_version: event.schemaVersion,
      event_type: event.type,
      occurred_at: new Date(event.timestamp),
      actor_type: event.actor.type,
      actor_id: event.actor.id ?? null,
      mission_id: event.missionId,
      correlation_id: event.correlationId,
      owner_account_id: event.userId ?? null,
      workspace_id: event.workspaceId ?? null,
      proposal_id: event.proposalId ?? null,
      aki_decision_id: event.akiDecisionId ?? null,
      governor_decision_id: event.governorDecisionId ?? null,
      approval_id: event.approvalId ?? null,
      execution_id: event.executionId ?? null,
      artifact_id: event.artifactId ?? null,
      payload: sanitize(event.payload),
    }).execute()
  }

  async findMissionByCorrelation(): Promise<IntelligenceMission | undefined> { return unusedStorePort() }
  async insertMission(): Promise<void> { return unusedStorePort() }
  async readPlan() { return unusedStorePort() }
  async writePlan(): Promise<void> { return unusedStorePort() }
  async readProposal() { return unusedStorePort() }
  async listProposals() { return unusedStorePort() }
  async writeProposal(): Promise<void> { return unusedStorePort() }
  async readDecision() { return unusedStorePort() }
  async writeDecision(): Promise<void> { return unusedStorePort() }
  async readAuthorization() { return unusedStorePort() }
  async writeAuthorization(): Promise<void> { return unusedStorePort() }
  async readApproval() { return unusedStorePort() }
  async readApprovalForProposal() { return unusedStorePort() }
  async writeApproval(): Promise<void> { return unusedStorePort() }
  async readExecution() { return unusedStorePort() }
  async listExecutions() { return unusedStorePort() }
  async writeExecution(): Promise<void> { return unusedStorePort() }
  async writeArtifact(): Promise<void> { return unusedStorePort() }
  async listArtifacts() { return unusedStorePort() }
}

function unusedStorePort(): never {
  throw new IntelligenceError('EXECUTION_FAILED', 'GreenField cancel store only persists cancel reads and writes')
}

function toMission(row: Database['intelligence_missions']): IntelligenceMission {
  return {
    id: row.mission_id,
    userId: row.owner_account_id,
    workspaceId: row.workspace_id ?? undefined,
    objective: row.objective,
    status: row.status,
    correlationId: row.correlation_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    completedAt: row.completed_at?.toISOString(),
  }
}

function toLedgerEvent(row: Database['intelligence_ledger_events']): IntelligenceLedgerEvent {
  return {
    id: row.event_id,
    schemaVersion: row.schema_version,
    type: row.event_type as IntelligenceLedgerEventType,
    timestamp: row.occurred_at.toISOString(),
    actor: {type: row.actor_type, id: row.actor_id ?? undefined},
    missionId: row.mission_id,
    correlationId: row.correlation_id,
    userId: row.owner_account_id ?? undefined,
    workspaceId: row.workspace_id ?? undefined,
    proposalId: row.proposal_id ?? undefined,
    akiDecisionId: row.aki_decision_id ?? undefined,
    governorDecisionId: row.governor_decision_id ?? undefined,
    approvalId: row.approval_id ?? undefined,
    executionId: row.execution_id ?? undefined,
    artifactId: row.artifact_id ?? undefined,
    payload: asRecord(row.payload),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, /(?:secret|token|password|credential|apiKey)/i.test(key) ? '[redacted]' : sanitize(item)]))
}
