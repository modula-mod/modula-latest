import type {
  AkiDecision,
  GaiaPlan,
  GovernorDecision,
  IntelligenceApproval,
  IntelligenceArtifact,
  IntelligenceExecution,
  IntelligenceLedgerEvent,
  IntelligenceLedgerEventType,
  IntelligenceMission,
  ModulaActionProposal,
} from '@modula/intelligence-contracts'
import {IntelligenceError} from '@modula/intelligence-contracts'
import type {MissionRuntimeStore} from '@modula/mar-runtime'
import {sql, type Transaction} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {Database} from '../database/types.js'
import {uuidv7} from '../lib/uuidv7.js'
import type {GovernedProviderSelection} from './provider-selection.js'

type Trx = Transaction<Database>
type Executor = ModulaDb | Trx

type MissionBuffers = {
  proposals: Map<string, ModulaActionProposal>
  events: IntelligenceLedgerEvent[]
}

/**
 * GreenField adapter for MissionRuntimeStore.
 *
 * The kernel writes proposals before plans, and appends proposal-scoped ledger
 * events before the proposal row exists. This store buffers those writes and
 * flushes them in foreign-key order without changing packages/mar-runtime.
 */
export class GreenfieldMissionRuntimeStore implements MissionRuntimeStore {
  private readonly buffers = new Map<string, MissionBuffers>()
  private planningSelection: GovernedProviderSelection | undefined

  constructor(private readonly db: ModulaDb) {}

  setPlanningSelection(selection: GovernedProviderSelection | undefined) {
    this.planningSelection = selection
  }

  /** Test/inspection helper: in-memory writes not yet committed. */
  bufferedState(missionId: string): {proposalIds: string[]; eventIds: string[]} {
    const pending = this.buffers.get(missionId)
    return {
      proposalIds: pending ? [...pending.proposals.keys()] : [],
      eventIds: pending ? pending.events.map(event => event.id) : [],
    }
  }

  async readMission(missionId: string): Promise<IntelligenceMission | undefined> {
    const row = await this.db.selectFrom('intelligence_missions').selectAll().where('mission_id', '=', missionId).executeTakeFirst()
    return row ? toMission(row) : undefined
  }

  async findMissionByCorrelation(accountId: string, correlationId: string): Promise<IntelligenceMission | undefined> {
    const row = await this.db
      .selectFrom('intelligence_missions')
      .selectAll()
      .where('owner_account_id', '=', accountId)
      .where('correlation_id', '=', correlationId)
      .orderBy('created_at', 'asc')
      .executeTakeFirst()
    return row ? toMission(row) : undefined
  }

  async insertMission(mission: IntelligenceMission): Promise<void> {
    await this.db.insertInto('intelligence_missions').values({
      mission_id: mission.id,
      owner_account_id: mission.userId,
      workspace_id: mission.workspaceId ?? null,
      objective: mission.objective,
      status: mission.status,
      correlation_id: mission.correlationId,
      created_at: new Date(mission.createdAt),
      updated_at: new Date(mission.updatedAt),
      completed_at: mission.completedAt ? new Date(mission.completedAt) : null,
    }).execute()
  }

  async writeMission(mission: IntelligenceMission): Promise<void> {
    await this.db.transaction().execute(async trx => {
      const row = await trx.selectFrom('intelligence_missions').selectAll().where('mission_id', '=', mission.id).forUpdate().executeTakeFirst()
      if (!row) throw new IntelligenceError('MISSION_NOT_FOUND', 'Mission not found')
      // Cancelled is terminal in the mission check constraint; do not attempt a later status write.
      if (row.status === 'cancelled' && mission.status !== 'cancelled') return
      await trx.updateTable('intelligence_missions').set({
        status: mission.status,
        updated_at: new Date(mission.updatedAt),
        completed_at: mission.completedAt ? new Date(mission.completedAt) : null,
      }).where('mission_id', '=', mission.id).execute()
    })
  }

  async listEvents(missionId: string): Promise<readonly IntelligenceLedgerEvent[]> {
    const rows = await this.db
      .selectFrom('intelligence_ledger_events')
      .selectAll()
      .where('mission_id', '=', missionId)
      .orderBy('occurred_at')
      .orderBy('event_id')
      .execute()
    const persisted = rows.map(toLedgerEvent)
    const pending = this.buffer(missionId).events
    if (pending.length === 0) return persisted
    const seen = new Set(persisted.map(event => event.id))
    return [...persisted, ...pending.filter(event => !seen.has(event.id))]
  }

  async appendEvent(event: IntelligenceLedgerEvent): Promise<void> {
    const next: IntelligenceLedgerEvent = event.type === 'mission.planning_started' && this.planningSelection
      ? {
          ...event,
          payload: {
            ...event.payload,
            ...this.planningSelection,
            missionRuntime: 'injected',
          },
        }
      : event
    if (next.type !== 'mission.cancelled' && await this.isCancelled(this.db, next.missionId)) return
    if (await this.canPersistEvent(this.db, next)) {
      await this.insertEvent(this.db, next)
      return
    }
    this.buffer(next.missionId).events.push(next)
  }

  async readPlan(missionId: string): Promise<GaiaPlan | undefined> {
    const plan = await this.db
      .selectFrom('intelligence_plans')
      .selectAll()
      .where('mission_id', '=', missionId)
      .orderBy('version', 'desc')
      .executeTakeFirst()
    if (!plan) return undefined
    const steps = await this.db
      .selectFrom('intelligence_plan_steps')
      .selectAll()
      .where('plan_id', '=', plan.plan_id)
      .orderBy('order_index')
      .execute()
    const proposals = await this.db
      .selectFrom('intelligence_proposals')
      .selectAll()
      .where('plan_id', '=', plan.plan_id)
      .execute()
    const byStep = new Map(proposals.map(row => [row.step_id, toProposal(row)]))
    return {
      id: plan.plan_id,
      missionId: plan.mission_id,
      version: plan.version,
      summary: plan.summary,
      createdAt: plan.created_at.toISOString(),
      steps: steps.map(step => {
        const proposal = byStep.get(step.step_id) ?? {
          id: step.step_id,
          missionId: step.mission_id,
          family: 'unknown',
          capability: step.capability,
          input: {},
          requestedBy: 'gaia' as const,
        }
        return {
          id: step.step_id,
          order: step.order_index,
          description: step.description,
          capability: step.capability,
          actionProposal: proposal,
          dependencies: strings(step.dependencies),
          state: step.state as GaiaPlan['steps'][number]['state'],
        }
      }),
    }
  }

  async writePlan(plan: GaiaPlan): Promise<void> {
    await this.withBufferedTransaction(plan.missionId, async (trx, pending) => {
      const existing = await trx.selectFrom('intelligence_plans').select('plan_id').where('plan_id', '=', plan.id).executeTakeFirst()
      if (!existing) {
        await trx.insertInto('intelligence_plans').values({
          plan_id: plan.id,
          mission_id: plan.missionId,
          version: plan.version,
          summary: plan.summary,
          created_at: new Date(plan.createdAt),
        }).execute()
      } else {
        await trx.updateTable('intelligence_plans').set({summary: plan.summary, version: plan.version}).where('plan_id', '=', plan.id).execute()
      }
      for (const step of plan.steps) {
        const existingStep = await trx.selectFrom('intelligence_plan_steps').select('step_id').where('step_id', '=', step.id).executeTakeFirst()
        if (!existingStep) {
          await trx.insertInto('intelligence_plan_steps').values({
            step_id: step.id,
            plan_id: plan.id,
            mission_id: plan.missionId,
            order_index: step.order,
            description: step.description,
            capability: step.capability,
            dependencies: jsonb(step.dependencies),
            state: step.state,
            created_at: new Date(plan.createdAt),
            updated_at: new Date(plan.createdAt),
          }).execute()
        }
        const proposal = pending.proposals.get(step.actionProposal.id) ?? step.actionProposal
        await this.insertProposal(trx, plan, step.id, proposal, plan.createdAt)
        pending.proposals.delete(proposal.id)
      }
      await this.flushEvents(trx, pending)
    })
  }

  async readProposal(missionId: string, proposalId: string): Promise<ModulaActionProposal | undefined> {
    const pending = this.buffer(missionId).proposals.get(proposalId)
    if (pending) return pending
    const row = await this.db
      .selectFrom('intelligence_proposals')
      .selectAll()
      .where('mission_id', '=', missionId)
      .where('proposal_id', '=', proposalId)
      .executeTakeFirst()
    return row ? toProposal(row) : undefined
  }

  async listProposals(missionId: string): Promise<readonly ModulaActionProposal[]> {
    const rows = await this.db
      .selectFrom('intelligence_proposals')
      .selectAll()
      .where('mission_id', '=', missionId)
      .orderBy('created_at')
      .orderBy('proposal_id')
      .execute()
    const persisted = rows.map(toProposal)
    const pending = [...this.buffer(missionId).proposals.values()].filter(proposal => !persisted.some(item => item.id === proposal.id))
    return [...persisted, ...pending]
  }

  async writeProposal(proposal: ModulaActionProposal): Promise<void> {
    const existing = await this.db.selectFrom('intelligence_proposals').select('proposal_id').where('proposal_id', '=', proposal.id).executeTakeFirst()
    if (existing) {
      await this.db.updateTable('intelligence_proposals').set({
        module_id: proposal.moduleId ?? null,
        family: proposal.family,
        capability: proposal.capability,
        action_id: proposal.actionId ?? null,
        input: jsonb(proposal.input),
        idempotency_key: proposal.idempotencyKey ?? null,
      }).where('proposal_id', '=', proposal.id).execute()
      return
    }
    this.buffer(proposal.missionId).proposals.set(proposal.id, proposal)
  }

  async readDecision(proposalId: string): Promise<AkiDecision | undefined> {
    const row = await this.db
      .selectFrom('intelligence_aki_decisions')
      .selectAll()
      .where('proposal_id', '=', proposalId)
      .orderBy('created_at', 'desc')
      .executeTakeFirst()
    if (!row) return undefined
    const evidence = await this.db
      .selectFrom('intelligence_evidence')
      .selectAll()
      .where('proposal_id', '=', proposalId)
      .orderBy('created_at')
      .execute()
    return toAkiDecision(row, evidence)
  }

  async writeDecision(decision: AkiDecision): Promise<void> {
    await this.withBufferedTransaction(decision.missionId, async (trx, pending) => {
      await trx.insertInto('intelligence_aki_decisions').values({
        decision_id: decision.id,
        mission_id: decision.missionId,
        proposal_id: decision.proposalId,
        verdict: decision.verdict,
        risk: decision.risk,
        reversibility: decision.reversibility,
        checks: jsonb(decision.checks),
        evidence_state: decision.evidenceState,
        conflicts: jsonb(decision.conflicts),
        conditions: jsonb(decision.conditions),
        confidence: decision.confidence ?? null,
        created_at: new Date(decision.createdAt),
      }).execute()
      for (const evidence of decision.evidence) {
        await trx.insertInto('intelligence_evidence').values({
          evidence_id: evidence.id,
          mission_id: decision.missionId,
          proposal_id: decision.proposalId,
          kind: evidence.kind,
          source_id: evidence.sourceId ?? null,
          uri: evidence.uri ?? null,
          content_hash: evidence.hash ?? null,
          captured_at: evidence.capturedAt ? new Date(evidence.capturedAt) : null,
          metadata: jsonb({}),
          created_at: new Date(decision.createdAt),
        }).onConflict(oc => oc.column('evidence_id').doNothing()).execute()
      }
      await this.flushEvents(trx, pending)
    })
  }

  async readAuthorization(proposalId: string): Promise<GovernorDecision | undefined> {
    const row = await this.db
      .selectFrom('intelligence_governor_decisions')
      .selectAll()
      .where('proposal_id', '=', proposalId)
      .orderBy('created_at', 'desc')
      .executeTakeFirst()
    return row ? toGovernorDecision(row) : undefined
  }

  async writeAuthorization(decision: GovernorDecision): Promise<void> {
    await this.withBufferedTransaction(decision.missionId, async (trx, pending) => {
      await trx.insertInto('intelligence_governor_decisions').values({
        governor_decision_id: decision.id,
        mission_id: decision.missionId,
        proposal_id: decision.proposalId,
        aki_decision_id: decision.akiDecisionId,
        authorization_state: decision.authorization,
        allowed_capabilities: jsonb(decision.allowedCapabilities),
        constraints: jsonb(decision.constraints),
        created_at: new Date(decision.createdAt),
      }).execute()
      await this.flushEvents(trx, pending)
    })
  }

  async readApproval(approvalId: string): Promise<IntelligenceApproval | undefined> {
    const row = await this.db.selectFrom('intelligence_approvals').selectAll().where('approval_id', '=', approvalId).executeTakeFirst()
    return row ? toApproval(row) : undefined
  }

  async readApprovalForProposal(proposalId: string): Promise<IntelligenceApproval | undefined> {
    const row = await this.db.selectFrom('intelligence_approvals').selectAll().where('proposal_id', '=', proposalId).executeTakeFirst()
    return row ? toApproval(row) : undefined
  }

  async writeApproval(approval: IntelligenceApproval): Promise<void> {
    await this.withBufferedTransaction(approval.missionId, async (trx, pending) => {
      const existing = await trx.selectFrom('intelligence_approvals').select('approval_id').where('approval_id', '=', approval.id).executeTakeFirst()
      if (!existing) {
        await trx.insertInto('intelligence_approvals').values({
          approval_id: approval.id,
          mission_id: approval.missionId,
          proposal_id: approval.proposalId,
          requested_account_id: approval.requestedUserId,
          resolver_account_id: approval.resolverUserId ?? null,
          reason: approval.reason,
          status: approval.status,
          requested_at: new Date(approval.requestedAt),
          resolved_at: approval.resolvedAt ? new Date(approval.resolvedAt) : null,
          expires_at: approval.expiresAt ? new Date(approval.expiresAt) : null,
        }).execute()
      } else {
        await trx.updateTable('intelligence_approvals').set({
          status: approval.status,
          resolver_account_id: approval.resolverUserId ?? null,
          resolved_at: approval.resolvedAt ? new Date(approval.resolvedAt) : null,
        }).where('approval_id', '=', approval.id).execute()
      }
      await this.flushEvents(trx, pending)
    })
  }

  async readExecution(proposalId: string): Promise<IntelligenceExecution | undefined> {
    const row = await this.db.selectFrom('intelligence_runs').selectAll().where('proposal_id', '=', proposalId).executeTakeFirst()
    return row ? toExecution(row) : undefined
  }

  async listExecutions(missionId: string): Promise<readonly IntelligenceExecution[]> {
    const rows = await this.db
      .selectFrom('intelligence_runs')
      .selectAll()
      .where('mission_id', '=', missionId)
      .orderBy('created_at')
      .execute()
    return rows.map(toExecution)
  }

  async writeExecution(execution: IntelligenceExecution): Promise<void> {
    await this.withBufferedTransaction(execution.missionId, async (trx, pending) => {
      // A cancelled mission has no cancelled run status. The kernel still
      // terminalizes the in-flight row as failed; any other post-cancel write is dropped.
      if (execution.status !== 'failed' && await this.isCancelled(trx, execution.missionId, pending)) {
        await this.flushEvents(trx, pending)
        return
      }
      const existing = await trx.selectFrom('intelligence_runs').selectAll().where('execution_id', '=', execution.id).forUpdate().executeTakeFirst()
      if (!existing) {
        const proposal = await trx.selectFrom('intelligence_proposals').select('step_id').where('proposal_id', '=', execution.proposalId).executeTakeFirst()
        await trx.insertInto('intelligence_runs').values({
          execution_id: execution.id,
          mission_id: execution.missionId,
          proposal_id: execution.proposalId,
          governor_decision_id: execution.authorizationId,
          approval_id: execution.approvalId ?? null,
          status: execution.status,
          idempotency_key: execution.idempotencyKey ?? null,
          result: execution.result === undefined ? null : json(execution.result),
          error_code: execution.errorCode ?? null,
          started_at: execution.startedAt ? new Date(execution.startedAt) : null,
          completed_at: execution.completedAt ? new Date(execution.completedAt) : null,
          created_at: new Date(execution.createdAt),
        }).execute()
        if (proposal?.step_id) {
          await trx.insertInto('intelligence_run_steps').values({
            run_step_id: uuidv7(),
            execution_id: execution.id,
            plan_step_id: proposal.step_id,
            status: execution.status === 'completed' || execution.status === 'failed' || execution.status === 'blocked' ? execution.status : 'running',
            started_at: execution.startedAt ? new Date(execution.startedAt) : new Date(),
            completed_at: execution.completedAt ? new Date(execution.completedAt) : null,
            error_code: execution.errorCode ?? null,
          }).execute()
        }
      } else {
        await trx.updateTable('intelligence_runs').set({
          status: execution.status,
          result: execution.result === undefined ? null : json(execution.result),
          error_code: execution.errorCode ?? null,
          completed_at: execution.completedAt ? new Date(execution.completedAt) : null,
        }).where('execution_id', '=', execution.id).execute()
        await trx.updateTable('intelligence_run_steps').set({
          status: execution.status === 'completed' || execution.status === 'failed' || execution.status === 'blocked' ? execution.status : 'running',
          completed_at: execution.completedAt ? new Date(execution.completedAt) : null,
          error_code: execution.errorCode ?? null,
        }).where('execution_id', '=', execution.id).execute()
      }
      await this.flushEvents(trx, pending)
    })
  }

  async writeArtifact(artifact: IntelligenceArtifact): Promise<void> {
    await this.withBufferedTransaction(artifact.missionId, async (trx, pending) => {
      if (await this.isCancelled(trx, artifact.missionId, pending)) {
        await this.flushEvents(trx, pending)
        return
      }
      await trx.insertInto('intelligence_artifacts').values({
        artifact_id: artifact.id,
        mission_id: artifact.missionId,
        execution_id: artifact.executionId,
        kind: artifact.kind,
        media_type: artifact.mediaType,
        uri: artifact.uri ?? null,
        content_hash: artifact.hash ?? null,
        metadata: jsonb(artifact.metadata ?? {}),
        created_at: new Date(artifact.createdAt),
      }).execute()
      await this.flushEvents(trx, pending)
    })
  }

  async listArtifacts(missionId: string): Promise<readonly IntelligenceArtifact[]> {
    const rows = await this.db
      .selectFrom('intelligence_artifacts')
      .selectAll()
      .where('mission_id', '=', missionId)
      .orderBy('created_at')
      .execute()
    return rows.map(toArtifact)
  }

  private buffer(missionId: string): MissionBuffers {
    const existing = this.buffers.get(missionId)
    if (existing) return existing
    const created: MissionBuffers = {proposals: new Map(), events: []}
    this.buffers.set(missionId, created)
    return created
  }

  private cloneBuffer(source: MissionBuffers): MissionBuffers {
    return {proposals: new Map(source.proposals), events: [...source.events]}
  }

  /**
   * Persist parent rows and any now-flushable buffered writes in a single
   * transaction. The in-memory buffer is updated only after commit. On
   * failure the transaction rolls back and the mission buffer is discarded
   * so a retry cannot double-write.
   */
  private async withBufferedTransaction(
    missionId: string,
    body: (trx: Trx, pending: MissionBuffers) => Promise<void>,
  ): Promise<void> {
    const working = this.cloneBuffer(this.buffer(missionId))
    try {
      await this.db.transaction().execute(async trx => {
        await body(trx, working)
      })
      if (working.proposals.size === 0 && working.events.length === 0) this.buffers.delete(missionId)
      else this.buffers.set(missionId, working)
    } catch (error) {
      this.buffers.delete(missionId)
      throw error
    }
  }

  private async insertProposal(trx: Trx, plan: GaiaPlan, stepId: string, proposal: ModulaActionProposal, createdAt: string): Promise<void> {
    const existing = await trx.selectFrom('intelligence_proposals').select('proposal_id').where('proposal_id', '=', proposal.id).executeTakeFirst()
    if (existing) return
    await trx.insertInto('intelligence_proposals').values({
      proposal_id: proposal.id,
      mission_id: plan.missionId,
      plan_id: plan.id,
      step_id: stepId,
      module_id: proposal.moduleId ?? null,
      family: proposal.family,
      capability: proposal.capability,
      action_id: proposal.actionId ?? null,
      input: jsonb(proposal.input),
      requested_by: 'gaia',
      idempotency_key: proposal.idempotencyKey ?? null,
      created_at: new Date(createdAt),
    }).execute()
  }

  private async flushEvents(executor: Executor, pending: MissionBuffers): Promise<void> {
    const remaining: IntelligenceLedgerEvent[] = []
    let cancelled = pending.events[0] ? await this.isCancelled(executor, pending.events[0].missionId) : false
    for (const event of pending.events) {
      if (cancelled && event.type !== 'mission.cancelled') continue
      if (await this.canPersistEvent(executor, event)) {
        await this.insertEvent(executor, event)
        if (event.type === 'mission.cancelled') cancelled = true
      } else if (!cancelled) {
        remaining.push(event)
      }
    }
    pending.events = remaining
  }

  private async isCancelled(executor: Executor, missionId: string, pending?: MissionBuffers): Promise<boolean> {
    if (pending?.events.some(event => event.type === 'mission.cancelled')) return true
    const mission = await executor.selectFrom('intelligence_missions').select('status').where('mission_id', '=', missionId).executeTakeFirst()
    if (mission?.status === 'cancelled') return true
    const event = await executor
      .selectFrom('intelligence_ledger_events')
      .select('event_id')
      .where('mission_id', '=', missionId)
      .where('event_type', '=', 'mission.cancelled')
      .executeTakeFirst()
    return Boolean(event)
  }

  private async canPersistEvent(executor: Executor, event: IntelligenceLedgerEvent): Promise<boolean> {
    if (event.proposalId && !(await this.exists(executor, 'intelligence_proposals', 'proposal_id', event.proposalId))) return false
    if (event.akiDecisionId && !(await this.exists(executor, 'intelligence_aki_decisions', 'decision_id', event.akiDecisionId))) return false
    if (event.governorDecisionId && !(await this.exists(executor, 'intelligence_governor_decisions', 'governor_decision_id', event.governorDecisionId))) return false
    if (event.approvalId && !(await this.exists(executor, 'intelligence_approvals', 'approval_id', event.approvalId))) return false
    if (event.executionId && !(await this.exists(executor, 'intelligence_runs', 'execution_id', event.executionId))) return false
    if (event.artifactId && !(await this.exists(executor, 'intelligence_artifacts', 'artifact_id', event.artifactId))) return false
    return true
  }

  private async exists(executor: Executor, table: keyof Database, column: string, id: string): Promise<boolean> {
    const row = await sql<{ok: number}>`
      SELECT 1 AS ok FROM ${sql.table(table)} WHERE ${sql.ref(column)} = ${id} LIMIT 1
    `.execute(executor)
    return row.rows.length > 0
  }

  private async insertEvent(executor: Executor, event: IntelligenceLedgerEvent): Promise<void> {
    if (event.type !== 'mission.cancelled' && await this.isCancelled(executor, event.missionId)) return
    await executor.insertInto('intelligence_ledger_events').values({
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
      payload: jsonb(sanitize(event.payload)),
    }).execute()
  }
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

function toProposal(row: Database['intelligence_proposals']): ModulaActionProposal {
  return {
    id: row.proposal_id,
    missionId: row.mission_id,
    moduleId: row.module_id ?? undefined,
    family: row.family,
    capability: row.capability,
    actionId: row.action_id ?? undefined,
    input: row.input,
    requestedBy: 'gaia',
    idempotencyKey: row.idempotency_key ?? undefined,
  }
}

function toAkiDecision(row: Database['intelligence_aki_decisions'], evidenceRows: Database['intelligence_evidence'][]): AkiDecision {
  return {
    id: row.decision_id,
    missionId: row.mission_id,
    proposalId: row.proposal_id,
    verdict: row.verdict,
    risk: row.risk,
    reversibility: row.reversibility,
    checks: Array.isArray(row.checks) ? row.checks as AkiDecision['checks'] : [],
    evidence: evidenceRows.map(item => ({
      id: item.evidence_id,
      kind: item.kind,
      sourceId: item.source_id ?? undefined,
      uri: item.uri ?? undefined,
      hash: item.content_hash ?? undefined,
      capturedAt: item.captured_at?.toISOString(),
    })),
    evidenceState: row.evidence_state,
    conflicts: strings(row.conflicts),
    conditions: strings(row.conditions),
    confidence: row.confidence ?? undefined,
    createdAt: row.created_at.toISOString(),
  }
}

function toGovernorDecision(row: Database['intelligence_governor_decisions']): GovernorDecision {
  return {
    id: row.governor_decision_id,
    missionId: row.mission_id,
    proposalId: row.proposal_id,
    authorization: row.authorization_state,
    allowedCapabilities: strings(row.allowed_capabilities),
    constraints: strings(row.constraints),
    akiDecisionId: row.aki_decision_id,
    createdAt: row.created_at.toISOString(),
  }
}

function toApproval(row: Database['intelligence_approvals']): IntelligenceApproval {
  return {
    id: row.approval_id,
    missionId: row.mission_id,
    proposalId: row.proposal_id,
    requestedUserId: row.requested_account_id,
    resolverUserId: row.resolver_account_id ?? undefined,
    reason: row.reason,
    status: row.status,
    requestedAt: row.requested_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString(),
    expiresAt: row.expires_at?.toISOString(),
  }
}

function toExecution(row: Database['intelligence_runs']): IntelligenceExecution {
  return {
    id: row.execution_id,
    missionId: row.mission_id,
    proposalId: row.proposal_id,
    authorizationId: row.governor_decision_id,
    approvalId: row.approval_id ?? undefined,
    status: row.status,
    idempotencyKey: row.idempotency_key ?? undefined,
    result: row.result ?? undefined,
    errorCode: row.error_code ?? undefined,
    startedAt: row.started_at?.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
  }
}

function toArtifact(row: Database['intelligence_artifacts']): IntelligenceArtifact {
  return {
    id: row.artifact_id,
    missionId: row.mission_id,
    executionId: row.execution_id,
    kind: row.kind,
    mediaType: row.media_type,
    uri: row.uri ?? undefined,
    hash: row.content_hash ?? undefined,
    metadata: record(row.metadata),
    createdAt: row.created_at.toISOString(),
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
    payload: record(row.payload),
  }
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null))
}

function jsonb(value: unknown) {
  return sql`${JSON.stringify(value)}::jsonb`
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, /(?:secret|token|password|credential|apiKey)/i.test(key) ? '[redacted]' : sanitize(item)]))
}
