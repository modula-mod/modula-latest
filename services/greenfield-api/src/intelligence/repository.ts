import type {
  AkiCheck,
  AkiDecision,
  EvidenceReference,
  GaiaPlan,
  GovernorDecision,
  IntelligenceApproval,
  IntelligenceArtifact,
  IntelligenceExecution,
  IntelligenceLedgerEvent,
  IntelligenceLedgerEventType,
  IntelligenceMission,
  IntelligenceMissionStatus,
  LedgerActor,
  ModulaActionProposal,
} from '@modula/intelligence-contracts'
import {assertMissionTransition, IntelligenceError} from '@modula/intelligence-contracts'
import {sql, type Transaction} from 'kysely'
import type {Database} from '../database/types.js'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'

type DbExecutor = ModulaDb | Transaction<Database>

export class IntelligenceRepository {
  constructor(private readonly db: ModulaDb) {}

  async createMission(input: {accountId: string; workspaceId?: string; objective: string; correlationId: string}): Promise<IntelligenceMission> {
    const now = new Date()
    const mission: IntelligenceMission = {id: uuidv7(), userId: input.accountId, workspaceId: input.workspaceId, objective: input.objective, status: 'draft', correlationId: input.correlationId, createdAt: now.toISOString(), updatedAt: now.toISOString()}
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('intelligence_missions').values({mission_id: mission.id, owner_account_id: input.accountId, workspace_id: input.workspaceId ?? null, objective: input.objective, status: 'draft', correlation_id: input.correlationId, created_at: now, updated_at: now, completed_at: null}).execute()
      await this.append(trx, mission, 'mission.created', {type: 'user', id: input.accountId}, {objective: input.objective})
    })
    return mission
  }

  async listMissions(accountId: string): Promise<IntelligenceMission[]> {
    const rows = await this.db.selectFrom('intelligence_missions').selectAll().where('owner_account_id', '=', accountId).orderBy('created_at', 'desc').execute()
    return rows.map(toMission)
  }

  async ownedMission(accountId: string, missionId: string): Promise<IntelligenceMission> {
    const row = await this.db.selectFrom('intelligence_missions').selectAll().where('mission_id', '=', missionId).executeTakeFirst()
    if (!row) throw new IntelligenceError('MISSION_NOT_FOUND', 'Mission not found')
    if (row.owner_account_id !== accountId) throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Mission belongs to another account')
    return toMission(row)
  }

  async transition(accountId: string, missionId: string, to: IntelligenceMissionStatus, event?: IntelligenceLedgerEventType, payload: Record<string, unknown> = {}): Promise<IntelligenceMission> {
    return this.db.transaction().execute(async trx => {
      const row = await trx.selectFrom('intelligence_missions').selectAll().where('mission_id', '=', missionId).forUpdate().executeTakeFirst()
      if (!row) throw new IntelligenceError('MISSION_NOT_FOUND', 'Mission not found')
      if (row.owner_account_id !== accountId) throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Mission belongs to another account')
      assertMissionTransition(row.status, to)
      const now = new Date()
      const completedAt = ['completed', 'failed', 'cancelled', 'blocked'].includes(to) ? now : null
      const updated = await trx.updateTable('intelligence_missions').set({status: to, updated_at: now, completed_at: completedAt}).where('mission_id', '=', missionId).returningAll().executeTakeFirstOrThrow()
      const mission = toMission(updated)
      if (event) await this.append(trx, mission, event, actorFor(event, accountId), payload)
      return mission
    })
  }

  async savePlan(mission: IntelligenceMission, plan: GaiaPlan, planningDurationMs?: number): Promise<void> {
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('intelligence_plans').values({plan_id: plan.id, mission_id: mission.id, version: plan.version, summary: plan.summary, created_at: new Date(plan.createdAt)}).execute()
      for (const step of plan.steps) {
        await trx.insertInto('intelligence_plan_steps').values({step_id: step.id, plan_id: plan.id, mission_id: mission.id, order_index: step.order, description: step.description, capability: step.capability, dependencies: jsonb(step.dependencies), state: step.state, created_at: new Date(plan.createdAt), updated_at: new Date(plan.createdAt)}).execute()
        const proposal = step.actionProposal
        await trx.insertInto('intelligence_proposals').values({proposal_id: proposal.id, mission_id: mission.id, plan_id: plan.id, step_id: step.id, module_id: proposal.moduleId ?? null, family: proposal.family, capability: proposal.capability, action_id: proposal.actionId ?? null, input: proposal.input, requested_by: 'gaia', idempotency_key: proposal.idempotencyKey ?? null, created_at: new Date(plan.createdAt)}).execute()
        await this.append(trx, mission, 'proposal.created', {type: 'gaia'}, {family: proposal.family, capability: proposal.capability, input: proposal.input}, {proposalId: proposal.id})
      }
      await this.append(trx, mission, plan.version === 1 ? 'plan.created' : 'plan.revised', {type: 'gaia'}, {planId: plan.id, version: plan.version, summary: plan.summary, planningDurationMs, steps: plan.steps.map(step => ({id: step.id, order: step.order, capability: step.capability, dependencies: step.dependencies}))})
    })
  }

  async saveAki(mission: IntelligenceMission, decision: AkiDecision, durationMs?: number): Promise<void> {
    await this.db.transaction().execute(async trx => {
      await this.append(trx, mission, 'aki.verification_started', {type: 'aki'}, {}, {proposalId: decision.proposalId})
      await trx.insertInto('intelligence_aki_decisions').values({decision_id: decision.id, mission_id: decision.missionId, proposal_id: decision.proposalId, verdict: decision.verdict, risk: decision.risk, reversibility: decision.reversibility, checks: jsonb(decision.checks), evidence_state: decision.evidenceState, conflicts: jsonb(decision.conflicts), conditions: jsonb(decision.conditions), confidence: decision.confidence ?? null, created_at: new Date(decision.createdAt)}).execute()
      for (const evidence of decision.evidence) {
        await trx.insertInto('intelligence_evidence').values({evidence_id: evidence.id, mission_id: mission.id, proposal_id: decision.proposalId, kind: evidence.kind, source_id: evidence.sourceId ?? null, uri: evidence.uri ?? null, content_hash: evidence.hash ?? null, captured_at: evidence.capturedAt ? new Date(evidence.capturedAt) : null, metadata: {}, created_at: new Date()}).onConflict(oc => oc.column('evidence_id').doNothing()).execute()
      }
      await this.append(trx, mission, 'aki.decision_created', {type: 'aki'}, {verdict: decision.verdict, risk: decision.risk, reversibility: decision.reversibility, checks: decision.checks, evidenceState: decision.evidenceState, conditions: decision.conditions, conflicts: decision.conflicts, durationMs}, {proposalId: decision.proposalId, akiDecisionId: decision.id})
    })
  }

  async saveGovernor(mission: IntelligenceMission, decision: GovernorDecision, durationMs?: number): Promise<void> {
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('intelligence_governor_decisions').values({governor_decision_id: decision.id, mission_id: decision.missionId, proposal_id: decision.proposalId, aki_decision_id: decision.akiDecisionId, authorization_state: decision.authorization, allowed_capabilities: jsonb(decision.allowedCapabilities), constraints: jsonb(decision.constraints), created_at: new Date(decision.createdAt)}).execute()
      await this.append(trx, mission, 'governor.authorization_created', {type: 'governor'}, {authorization: decision.authorization, allowedCapabilities: decision.allowedCapabilities, constraints: decision.constraints, durationMs}, {proposalId: decision.proposalId, akiDecisionId: decision.akiDecisionId, governorDecisionId: decision.id})
    })
  }

  async createApproval(mission: IntelligenceMission, proposalId: string, reason: string): Promise<IntelligenceApproval> {
    const now = new Date()
    const approval: IntelligenceApproval = {id: uuidv7(), missionId: mission.id, proposalId, requestedUserId: mission.userId, reason, status: 'pending', requestedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 24 * 60 * 60_000).toISOString()}
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('intelligence_approvals').values({approval_id: approval.id, mission_id: mission.id, proposal_id: proposalId, requested_account_id: mission.userId, resolver_account_id: null, reason, status: 'pending', requested_at: now, resolved_at: null, expires_at: new Date(approval.expiresAt!)}).execute()
      await this.append(trx, mission, 'approval.requested', {type: 'governor'}, {reason, status: 'pending', expiresAt: approval.expiresAt}, {proposalId, approvalId: approval.id})
    })
    return approval
  }

  async resolveApproval(accountId: string, missionId: string, approvalId: string, status: 'approved' | 'rejected'): Promise<IntelligenceApproval> {
    return this.db.transaction().execute(async trx => {
      const missionRow = await trx.selectFrom('intelligence_missions').selectAll().where('mission_id', '=', missionId).forUpdate().executeTakeFirst()
      if (!missionRow) throw new IntelligenceError('MISSION_NOT_FOUND', 'Mission not found')
      if (missionRow.owner_account_id !== accountId) throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Cannot resolve another account approval')
      const row = await trx.selectFrom('intelligence_approvals').selectAll().where('approval_id', '=', approvalId).where('mission_id', '=', missionId).forUpdate().executeTakeFirst()
      if (!row) throw new IntelligenceError('MISSION_NOT_FOUND', 'Approval not found')
      if (row.requested_account_id !== accountId) throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Cannot resolve another account approval')
      if (row.status !== 'pending') throw new IntelligenceError('INVALID_MISSION_STATE', 'Approval is not pending')
      if (row.expires_at && row.expires_at.getTime() <= Date.now()) throw new IntelligenceError('APPROVAL_REJECTED', 'Approval has expired')
      const now = new Date()
      const updated = await trx.updateTable('intelligence_approvals').set({status, resolver_account_id: accountId, resolved_at: now}).where('approval_id', '=', approvalId).where('status', '=', 'pending').returningAll().executeTakeFirstOrThrow()
      const mission = toMission(missionRow)
      await this.append(trx, mission, status === 'approved' ? 'approval.approved' : 'approval.rejected', {type: 'user', id: accountId}, {status, approvalWaitDurationMs: now.getTime() - row.requested_at.getTime()}, {proposalId: row.proposal_id, approvalId})
      return toApproval(updated)
    })
  }

  async proposal(missionId: string, proposalId: string): Promise<ModulaActionProposal> {
    const row = await this.db.selectFrom('intelligence_proposals').selectAll().where('mission_id', '=', missionId).where('proposal_id', '=', proposalId).executeTakeFirst()
    if (!row) throw new IntelligenceError('MISSION_NOT_FOUND', 'Proposal not found')
    return toProposal(row)
  }

  async latestProposal(missionId: string): Promise<ModulaActionProposal> {
    const row = await this.db.selectFrom('intelligence_proposals').selectAll().where('mission_id', '=', missionId).orderBy('created_at', 'desc').executeTakeFirst()
    if (!row) throw new IntelligenceError('MISSION_NOT_FOUND', 'Mission proposal not found')
    return toProposal(row)
  }

  async latestGovernor(missionId: string, proposalId: string): Promise<GovernorDecision> {
    const row = await this.db.selectFrom('intelligence_governor_decisions').selectAll().where('mission_id', '=', missionId).where('proposal_id', '=', proposalId).orderBy('created_at', 'desc').executeTakeFirst()
    if (!row) throw new IntelligenceError('MISSION_NOT_FOUND', 'Governor decision not found')
    return {id: row.governor_decision_id, missionId: row.mission_id, proposalId: row.proposal_id, authorization: row.authorization_state, allowedCapabilities: strings(row.allowed_capabilities), constraints: strings(row.constraints), akiDecisionId: row.aki_decision_id, createdAt: row.created_at.toISOString()}
  }

  async approvalForProposal(missionId: string, proposalId: string): Promise<IntelligenceApproval | undefined> {
    const row = await this.db.selectFrom('intelligence_approvals').selectAll().where('mission_id', '=', missionId).where('proposal_id', '=', proposalId).executeTakeFirst()
    return row ? toApproval(row) : undefined
  }

  async getExecution(proposalId: string) {
    return this.db.selectFrom('intelligence_runs').selectAll().where('proposal_id', '=', proposalId).executeTakeFirst()
  }

  async claimExecution(mission: IntelligenceMission, proposal: ModulaActionProposal, governor: GovernorDecision, approval?: IntelligenceApproval) {
    return this.db.transaction().execute(async trx => {
      const existing = await trx.selectFrom('intelligence_runs').selectAll().where('proposal_id', '=', proposal.id).forUpdate().executeTakeFirst()
      if (existing) return {claimed: false as const, row: existing}
      const missionRow = await trx.selectFrom('intelligence_missions').selectAll().where('mission_id', '=', mission.id).forUpdate().executeTakeFirstOrThrow()
      assertMissionTransition(missionRow.status, 'running')
      const now = new Date()
      const executionId = uuidv7()
      const step = await trx.selectFrom('intelligence_proposals').select('step_id').where('proposal_id', '=', proposal.id).executeTakeFirstOrThrow()
      const row = await trx.insertInto('intelligence_runs').values({execution_id: executionId, mission_id: mission.id, proposal_id: proposal.id, governor_decision_id: governor.id, approval_id: approval?.id ?? null, status: 'running', idempotency_key: proposal.idempotencyKey ?? null, result: null, error_code: null, started_at: now, completed_at: null, created_at: now}).returningAll().executeTakeFirstOrThrow()
      await trx.insertInto('intelligence_run_steps').values({run_step_id: uuidv7(), execution_id: executionId, plan_step_id: step.step_id, status: 'running', started_at: now, completed_at: null, error_code: null}).execute()
      await trx.updateTable('intelligence_missions').set({status: 'running', updated_at: now}).where('mission_id', '=', mission.id).execute()
      await trx.updateTable('intelligence_plan_steps').set({state: 'running', updated_at: now}).where('step_id', '=', step.step_id).execute()
      await this.append(trx, {...mission, status: 'running', updatedAt: now.toISOString()}, 'execution.started', {type: 'command'}, {capability: proposal.capability}, {proposalId: proposal.id, governorDecisionId: governor.id, approvalId: approval?.id, executionId})
      return {claimed: true as const, row}
    })
  }

  async completeExecution(mission: IntelligenceMission, proposal: ModulaActionProposal, executionId: string, result: unknown): Promise<void> {
    await this.db.transaction().execute(async trx => {
      const now = new Date()
      const artifactId = uuidv7()
      const currentRun = await trx.selectFrom('intelligence_runs').select('started_at').where('execution_id', '=', executionId).forUpdate().executeTakeFirstOrThrow()
      const executionDurationMs = currentRun.started_at ? now.getTime() - currentRun.started_at.getTime() : undefined
      const missionDurationMs = now.getTime() - Date.parse(mission.createdAt)
      await trx.updateTable('intelligence_runs').set({status: 'completed', result: json(result), completed_at: now}).where('execution_id', '=', executionId).where('status', '=', 'running').executeTakeFirstOrThrow()
      await trx.updateTable('intelligence_run_steps').set({status: 'completed', completed_at: now}).where('execution_id', '=', executionId).execute()
      await trx.updateTable('intelligence_plan_steps').set({state: 'completed', updated_at: now}).where('step_id', '=', trx.selectFrom('intelligence_proposals').select('step_id').where('proposal_id', '=', proposal.id)).execute()
      await trx.insertInto('intelligence_artifacts').values({artifact_id: artifactId, mission_id: mission.id, execution_id: executionId, kind: 'runtime.result', media_type: 'application/json', uri: null, content_hash: null, metadata: {result: json(result)}, created_at: now}).execute()
      await trx.updateTable('intelligence_missions').set({status: 'completed', updated_at: now, completed_at: now}).where('mission_id', '=', mission.id).where('status', '=', 'running').executeTakeFirstOrThrow()
      const completed = {...mission, status: 'completed' as const, updatedAt: now.toISOString(), completedAt: now.toISOString()}
      await this.append(trx, completed, 'execution.completed', {type: 'runtime'}, {result: json(result), executionDurationMs}, {proposalId: proposal.id, executionId})
      await this.append(trx, completed, 'artifact.created', {type: 'runtime'}, {kind: 'runtime.result', mediaType: 'application/json'}, {proposalId: proposal.id, executionId, artifactId})
      await this.append(trx, completed, 'mission.completed', {type: 'system'}, {status: 'completed', missionDurationMs}, {proposalId: proposal.id, executionId, artifactId})
    })
  }

  async failExecution(mission: IntelligenceMission, proposal: ModulaActionProposal, executionId: string, errorCode: string): Promise<void> {
    await this.db.transaction().execute(async trx => {
      const now = new Date()
      await trx.updateTable('intelligence_runs').set({status: 'failed', error_code: errorCode, completed_at: now}).where('execution_id', '=', executionId).execute()
      await trx.updateTable('intelligence_run_steps').set({status: 'failed', error_code: errorCode, completed_at: now}).where('execution_id', '=', executionId).execute()
      await trx.updateTable('intelligence_missions').set({status: 'failed', updated_at: now, completed_at: now}).where('mission_id', '=', mission.id).where('status', '=', 'running').execute()
      const failed = {...mission, status: 'failed' as const, updatedAt: now.toISOString(), completedAt: now.toISOString()}
      await this.append(trx, failed, 'execution.failed', {type: 'runtime'}, {errorCode}, {proposalId: proposal.id, executionId})
      await this.append(trx, failed, 'mission.failed', {type: 'system'}, {errorCode}, {proposalId: proposal.id, executionId})
    })
  }

  async blockedExecution(mission: IntelligenceMission, proposal: ModulaActionProposal, reasonCode: string): Promise<void> {
    await this.db.transaction().execute(async trx => {
      const row = await trx.selectFrom('intelligence_missions').selectAll().where('mission_id', '=', mission.id).forUpdate().executeTakeFirstOrThrow()
      if (row.status !== 'blocked') {
        assertMissionTransition(row.status, 'blocked')
        await trx.updateTable('intelligence_missions').set({status: 'blocked', updated_at: new Date(), completed_at: new Date()}).where('mission_id', '=', mission.id).execute()
      }
      const blocked = {...mission, status: 'blocked' as const}
      await this.append(trx, blocked, 'execution.blocked', {type: 'command'}, {reasonCode}, {proposalId: proposal.id})
      await this.append(trx, blocked, 'mission.blocked', {type: 'system'}, {reasonCode}, {proposalId: proposal.id})
    })
  }

  async detail(accountId: string, missionId: string) {
    const mission = await this.ownedMission(accountId, missionId)
    const [plans, steps, proposals, evidence, aki, governor, approvals, runs, artifacts] = await Promise.all([
      this.db.selectFrom('intelligence_plans').selectAll().where('mission_id', '=', missionId).orderBy('version').execute(),
      this.db.selectFrom('intelligence_plan_steps').selectAll().where('mission_id', '=', missionId).orderBy('order_index').execute(),
      this.db.selectFrom('intelligence_proposals').selectAll().where('mission_id', '=', missionId).orderBy('created_at').execute(),
      this.db.selectFrom('intelligence_evidence').selectAll().where('mission_id', '=', missionId).orderBy('created_at').execute(),
      this.db.selectFrom('intelligence_aki_decisions').selectAll().where('mission_id', '=', missionId).orderBy('created_at').execute(),
      this.db.selectFrom('intelligence_governor_decisions').selectAll().where('mission_id', '=', missionId).orderBy('created_at').execute(),
      this.db.selectFrom('intelligence_approvals').selectAll().where('mission_id', '=', missionId).orderBy('requested_at').execute(),
      this.db.selectFrom('intelligence_runs').selectAll().where('mission_id', '=', missionId).orderBy('created_at').execute(),
      this.db.selectFrom('intelligence_artifacts').selectAll().where('mission_id', '=', missionId).orderBy('created_at').execute(),
    ])
    return {
      mission,
      plans: plans.map(toPlan),
      steps: steps.map(toPlanStep),
      proposals: proposals.map(toProposal),
      akiDecisions: aki.map(row => toAkiDecision(row, evidence.filter(item => item.proposal_id === row.proposal_id).map(toEvidence))),
      governorDecisions: governor.map(toGovernorDecision),
      approvals: approvals.map(toApproval),
      executions: runs.map(toExecution),
      artifacts: artifacts.map(toArtifact),
    }
  }

  async ledger(accountId: string, missionId: string) {
    await this.ownedMission(accountId, missionId)
    return (await this.db.selectFrom('intelligence_ledger_events').selectAll().where('mission_id', '=', missionId).orderBy('occurred_at').orderBy('event_id').execute()).map(toLedgerEvent)
  }

  async decisions(accountId: string, missionId: string) {
    await this.ownedMission(accountId, missionId)
    const [evidence, aki, governor] = await Promise.all([
      this.db.selectFrom('intelligence_evidence').selectAll().where('mission_id', '=', missionId).orderBy('created_at').execute(),
      this.db.selectFrom('intelligence_aki_decisions').selectAll().where('mission_id', '=', missionId).orderBy('created_at').execute(),
      this.db.selectFrom('intelligence_governor_decisions').selectAll().where('mission_id', '=', missionId).orderBy('created_at').execute(),
    ])
    return {
      aki: aki.map(row => toAkiDecision(row, evidence.filter(item => item.proposal_id === row.proposal_id).map(toEvidence))),
      governor: governor.map(toGovernorDecision),
    }
  }

  async approvals(accountId: string, missionId: string) {
    await this.ownedMission(accountId, missionId)
    return (await this.db.selectFrom('intelligence_approvals').selectAll().where('mission_id', '=', missionId).orderBy('requested_at').execute()).map(toApproval)
  }

  async evidence(accountId: string, missionId: string) {
    await this.ownedMission(accountId, missionId)
    return (await this.db.selectFrom('intelligence_evidence').selectAll().where('mission_id', '=', missionId).orderBy('created_at').execute()).map(toEvidence)
  }

  private async append(db: DbExecutor, mission: IntelligenceMission, type: IntelligenceLedgerEventType, actor: LedgerActor, payload: Record<string, unknown>, refs: {proposalId?: string; akiDecisionId?: string; governorDecisionId?: string; approvalId?: string; executionId?: string; artifactId?: string} = {}) {
    await db.insertInto('intelligence_ledger_events').values({event_id: uuidv7(), schema_version: '1.0.0', event_type: type, occurred_at: new Date(), actor_type: actor.type, actor_id: actor.id ?? null, mission_id: mission.id, correlation_id: mission.correlationId, owner_account_id: mission.userId, workspace_id: mission.workspaceId ?? null, proposal_id: refs.proposalId ?? null, aki_decision_id: refs.akiDecisionId ?? null, governor_decision_id: refs.governorDecisionId ?? null, approval_id: refs.approvalId ?? null, execution_id: refs.executionId ?? null, artifact_id: refs.artifactId ?? null, payload: sanitize(payload)}).execute()
  }
}

function toMission(row: Database['intelligence_missions']): IntelligenceMission {
  return {id: row.mission_id, userId: row.owner_account_id, workspaceId: row.workspace_id ?? undefined, objective: row.objective, status: row.status, correlationId: row.correlation_id, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), completedAt: row.completed_at?.toISOString()}
}

function toProposal(row: Database['intelligence_proposals']): ModulaActionProposal {
  return {id: row.proposal_id, missionId: row.mission_id, moduleId: row.module_id ?? undefined, family: row.family, capability: row.capability, actionId: row.action_id ?? undefined, input: row.input, requestedBy: 'gaia', idempotencyKey: row.idempotency_key ?? undefined}
}

function toPlan(row: Database['intelligence_plans']) {
  return {id: row.plan_id, missionId: row.mission_id, version: row.version, summary: row.summary, createdAt: row.created_at.toISOString()}
}

function toPlanStep(row: Database['intelligence_plan_steps']) {
  return {id: row.step_id, planId: row.plan_id, missionId: row.mission_id, order: row.order_index, description: row.description, capability: row.capability, dependencies: strings(row.dependencies), state: row.state, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()}
}

function toEvidence(row: Database['intelligence_evidence']): EvidenceReference {
  return {id: row.evidence_id, kind: row.kind, sourceId: row.source_id ?? undefined, uri: row.uri ?? undefined, hash: row.content_hash ?? undefined, capturedAt: row.captured_at?.toISOString()}
}

function toAkiDecision(row: Database['intelligence_aki_decisions'], evidence: EvidenceReference[]): AkiDecision {
  return {id: row.decision_id, missionId: row.mission_id, proposalId: row.proposal_id, verdict: row.verdict, risk: row.risk, reversibility: row.reversibility, checks: akiChecks(row.checks), evidence, evidenceState: row.evidence_state, conflicts: strings(row.conflicts), conditions: strings(row.conditions), confidence: row.confidence ?? undefined, createdAt: row.created_at.toISOString()}
}

function toGovernorDecision(row: Database['intelligence_governor_decisions']): GovernorDecision {
  return {id: row.governor_decision_id, missionId: row.mission_id, proposalId: row.proposal_id, authorization: row.authorization_state, allowedCapabilities: strings(row.allowed_capabilities), constraints: strings(row.constraints), akiDecisionId: row.aki_decision_id, createdAt: row.created_at.toISOString()}
}

function toExecution(row: Database['intelligence_runs']): IntelligenceExecution {
  return {id: row.execution_id, missionId: row.mission_id, proposalId: row.proposal_id, authorizationId: row.governor_decision_id, approvalId: row.approval_id ?? undefined, status: row.status, idempotencyKey: row.idempotency_key ?? undefined, result: row.result ?? undefined, errorCode: row.error_code ?? undefined, startedAt: row.started_at?.toISOString(), completedAt: row.completed_at?.toISOString(), createdAt: row.created_at.toISOString()}
}

function toArtifact(row: Database['intelligence_artifacts']): IntelligenceArtifact {
  return {id: row.artifact_id, missionId: row.mission_id, executionId: row.execution_id, kind: row.kind, mediaType: row.media_type, uri: row.uri ?? undefined, hash: row.content_hash ?? undefined, metadata: record(row.metadata), createdAt: row.created_at.toISOString()}
}

function toLedgerEvent(row: Database['intelligence_ledger_events']): IntelligenceLedgerEvent {
  return {id: row.event_id, schemaVersion: row.schema_version, type: row.event_type as IntelligenceLedgerEventType, timestamp: row.occurred_at.toISOString(), actor: {type: row.actor_type, id: row.actor_id ?? undefined}, missionId: row.mission_id, correlationId: row.correlation_id, userId: row.owner_account_id ?? undefined, workspaceId: row.workspace_id ?? undefined, proposalId: row.proposal_id ?? undefined, akiDecisionId: row.aki_decision_id ?? undefined, governorDecisionId: row.governor_decision_id ?? undefined, approvalId: row.approval_id ?? undefined, executionId: row.execution_id ?? undefined, artifactId: row.artifact_id ?? undefined, payload: record(row.payload)}
}

function toApproval(row: Database['intelligence_approvals']): IntelligenceApproval {
  return {id: row.approval_id, missionId: row.mission_id, proposalId: row.proposal_id, requestedUserId: row.requested_account_id, resolverUserId: row.resolver_account_id ?? undefined, reason: row.reason, status: row.status, requestedAt: row.requested_at.toISOString(), resolvedAt: row.resolved_at?.toISOString(), expiresAt: row.expires_at?.toISOString()}
}

function actorFor(event: IntelligenceLedgerEventType, accountId: string): LedgerActor {
  if (event.startsWith('mission.')) return {type: event === 'mission.planning_started' ? 'gaia' : 'system', id: event === 'mission.cancelled' ? accountId : undefined}
  return {type: 'system'}
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function akiChecks(value: unknown): AkiCheck[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is AkiCheck => Boolean(item && typeof item === 'object' && typeof (item as AkiCheck).id === 'string' && typeof (item as AkiCheck).reasonCode === 'string'))
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function json(value: unknown): any {
  return JSON.parse(JSON.stringify(value ?? null))
}

function jsonb(value: unknown) {
  return sql`${JSON.stringify(value)}::jsonb`
}

function sanitize(value: unknown): any {
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, /(?:secret|token|password|credential|apiKey)/i.test(key) ? '[redacted]' : sanitize(item)]))
}
