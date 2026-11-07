import type {
  AkiDecision,
  DecisionEngine,
  GaiaAvailableAction,
  GaiaPlan,
  GaiaPlanner,
  GovernorDecision,
  IntelligenceApproval,
  IntelligenceArtifact,
  IntelligenceErrorCode,
  IntelligenceExecution,
  IntelligenceLedgerEvent,
  IntelligenceLedgerEventType,
  IntelligenceMission,
  IntelligenceMissionStatus,
  LedgerActor,
  ModulaActionProposal,
} from '@modula/intelligence-contracts'
import {IntelligenceError, isTerminalMissionStatus} from '@modula/intelligence-contracts'
import {assertCommandBoundary, classifyActionRisk} from '@modula/intelligence-governance'
import {assertVerifiedPrincipal, parseMissionRequest, type MissionRequest, type VerifiedPrincipal} from './identity.js'
import {assessProposal, isProposalRejection} from './proposal.js'
import {redact, redactRecord} from './redact.js'
import type {MissionRuntimeStore} from './store.js'
import {commitMissionStatus} from './transition.js'

export type MissionRuntimeBudget = {
  maxPlanSteps: number
  maxIterations: number
  maxDurationMs: number
}

export const DEFAULT_MISSION_RUNTIME_BUDGET: MissionRuntimeBudget = {
  maxPlanSteps: 1,
  maxIterations: 12,
  maxDurationMs: 30_000,
}

export type CapabilityCatalog = {
  list(accountId: string, workspaceId?: string): Promise<GaiaAvailableAction[]>
}

export type MissionToolGateway = {
  revalidate(
    accountId: string,
    workspaceId: string | undefined,
    proposal: ModulaActionProposal,
  ): Promise<{registered: boolean; schemaValid: boolean; permissionGranted: boolean; workspaceAccess: boolean}>
  execute(input: {accountId: string; proposal: ModulaActionProposal; signal: AbortSignal}): Promise<unknown>
}

export type MissionRuntimeDependencies = {
  store: MissionRuntimeStore
  planner: GaiaPlanner
  decisions: DecisionEngine
  governor: {
    decide(input: {id: string; proposal: ModulaActionProposal; aki: AkiDecision; createdAt?: string}): GovernorDecision
  }
  capabilities: CapabilityCatalog
  tools: MissionToolGateway
  ids?: () => string
  clock?: {nowIso(): string; nowMs(): number}
  budget?: Partial<MissionRuntimeBudget>
}

type Cycle = {
  principal: VerifiedPrincipal
  missionId: string
  signal: AbortSignal
  startedMs: number
}

type PhaseStop = 'stop' | 'continue'

/**
 * Original MAR kernel.
 * Status changes go through `assertMissionTransition`. Planning, verification,
 * authorization, and tool dispatch are injected. This module does not implement
 * Nodus, AKI, or a product module.
 */
export class MissionRuntime {
  private readonly store: MissionRuntimeStore
  private readonly planner: GaiaPlanner
  private readonly decisions: DecisionEngine
  private readonly governor: MissionRuntimeDependencies['governor']
  private readonly capabilities: CapabilityCatalog
  private readonly tools: MissionToolGateway
  private readonly ids: () => string
  private readonly clock: {nowIso(): string; nowMs(): number}
  private readonly budget: MissionRuntimeBudget
  private readonly controllers = new Map<string, AbortController>()
  private readonly locks = new Map<string, Promise<void>>()

  constructor(dependencies: MissionRuntimeDependencies) {
    this.store = dependencies.store
    this.planner = dependencies.planner
    this.decisions = dependencies.decisions
    this.governor = dependencies.governor
    this.capabilities = dependencies.capabilities
    this.tools = dependencies.tools
    this.ids = dependencies.ids ?? (() => crypto.randomUUID())
    this.clock = dependencies.clock ?? {nowIso: () => new Date().toISOString(), nowMs: () => Date.now()}
    this.budget = {...DEFAULT_MISSION_RUNTIME_BUDGET, ...dependencies.budget}
    if (this.budget.maxPlanSteps < 1 || this.budget.maxIterations < 1 || this.budget.maxDurationMs < 0) {
      throw new IntelligenceError('INVALID_ACTION_SCHEMA', 'Mission runtime budget is invalid')
    }
  }

  async createMission(principal: VerifiedPrincipal, body: unknown): Promise<IntelligenceMission> {
    assertVerifiedPrincipal(principal)
    const request = parseMissionRequest(body)
    return this.withKey(correlationLock(principal.accountId, request.correlationId), async () => {
      const existing = await this.store.findMissionByCorrelation(principal.accountId, request.correlationId)
      if (existing) {
        if (existing.objective !== request.objective || (existing.workspaceId ?? undefined) !== principal.workspaceId) {
          throw new IntelligenceError('INVALID_MISSION_STATE', 'Idempotency key already belongs to another mission', {reason: 'IDEMPOTENCY_CONFLICT'})
        }
        return existing
      }
      const now = this.clock.nowIso()
      const mission: IntelligenceMission = {
        id: this.ids(),
        userId: principal.accountId,
        workspaceId: principal.workspaceId,
        objective: request.objective,
        status: 'draft',
        correlationId: request.correlationId,
        createdAt: now,
        updatedAt: now,
      }
      await this.store.insertMission(mission)
      await this.append(mission, 'mission.created', {objective: request.objective}, actorFor('mission.created', principal.accountId))
      return mission
    })
  }

  async start(principal: VerifiedPrincipal, missionId: string): Promise<IntelligenceMission> {
    assertVerifiedPrincipal(principal)
    const mission = await this.owned(principal, missionId)
    if (mission.status !== 'draft') {
      throw new IntelligenceError('INVALID_MISSION_STATE', 'Only a draft mission can start planning')
    }
    return this.run(principal, missionId, async cycle => {
      if (await this.wasCancelled(cycle)) return this.owned(principal, missionId)
      try {
        await this.commit(cycle, 'planning', {type: 'mission.planning_started', payload: {planner: 'injected'}})
      } catch (error) {
        const latest = await this.owned(principal, missionId)
        if (latest.status === 'cancelled') return latest
        throw error
      }
      return this.drive(cycle)
    })
  }

  /**
   * Reload a persisted mission and continue only from a non-terminal status.
   * Completed, failed, cancelled, and blocked missions throw and are not resumed.
   * An in-flight execution is not dispatched again.
   */
  async recover(principal: VerifiedPrincipal, missionId: string): Promise<IntelligenceMission> {
    assertVerifiedPrincipal(principal)
    const mission = await this.owned(principal, missionId)
    if (isTerminalMissionStatus(mission.status)) {
      throw new IntelligenceError('INVALID_MISSION_STATE', `Mission cannot resume from ${mission.status}`)
    }
    if (mission.status === 'draft') return this.start(principal, missionId)
    if (mission.status === 'running' || mission.status === 'awaiting_approval') return mission
    return this.run(principal, missionId, cycle => this.drive(cycle))
  }

  async cancel(principal: VerifiedPrincipal, missionId: string): Promise<IntelligenceMission> {
    assertVerifiedPrincipal(principal)
    const mission = await this.owned(principal, missionId)
    if (mission.status === 'cancelled') return mission
    if (isTerminalMissionStatus(mission.status)) {
      throw new IntelligenceError('INVALID_MISSION_STATE', `Mission cannot transition from ${mission.status} to cancelled`)
    }
    this.controllers.get(missionId)?.abort()
    const cycle = this.cycleFor(principal, missionId, this.controllers.get(missionId)?.signal ?? new AbortController().signal)
    return this.commit(cycle, 'cancelled', {type: 'mission.cancelled', payload: {reason: 'cancelled'}})
  }

  async decideApproval(
    principal: VerifiedPrincipal,
    missionId: string,
    approvalId: string,
    decision: 'approved' | 'rejected',
  ): Promise<IntelligenceMission> {
    assertVerifiedPrincipal(principal)
    const mission = await this.owned(principal, missionId)
    if (mission.status !== 'awaiting_approval') {
      throw new IntelligenceError('INVALID_MISSION_STATE', 'Mission is not awaiting approval')
    }
    const approval = await this.store.readApproval(approvalId)
    if (!approval || approval.missionId !== missionId) throw new IntelligenceError('MISSION_NOT_FOUND', 'Approval not found')
    if (approval.requestedUserId !== principal.accountId) {
      throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Cannot resolve another account approval')
    }
    if (approval.status !== 'pending') throw new IntelligenceError('INVALID_MISSION_STATE', 'Approval is not pending')
    const resolved: IntelligenceApproval = {
      ...approval,
      status: decision,
      resolverUserId: principal.accountId,
      resolvedAt: this.clock.nowIso(),
    }
    await this.store.writeApproval(resolved)
    const cycle = this.cycleFor(principal, missionId, new AbortController().signal)
    await this.record(cycle, mission, decision === 'approved' ? 'approval.approved' : 'approval.rejected', {status: decision}, {proposalId: approval.proposalId, approvalId})
    if (decision === 'rejected') {
      const blocked = await this.commit(cycle, 'blocked')
      await this.record(cycle, blocked, 'execution.blocked', {reasonCode: 'APPROVAL_REJECTED'}, {proposalId: approval.proposalId, approvalId})
      await this.record(cycle, blocked, 'mission.blocked', {reasonCode: 'APPROVAL_REJECTED'}, {proposalId: approval.proposalId, approvalId})
      return blocked
    }
    return this.run(principal, missionId, async active => this.dispatch(active, await this.owned(principal, missionId)))
  }

  async execute(principal: VerifiedPrincipal, missionId: string, proposalId: string): Promise<IntelligenceMission> {
    assertVerifiedPrincipal(principal)
    await this.owned(principal, missionId)
    const existing = await this.store.readExecution(proposalId)
    if (existing) {
      if (existing.missionId !== missionId) throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Execution belongs to another mission')
      return this.settleExisting(existing)
    }
    const mission = await this.owned(principal, missionId)
    if (mission.status !== 'awaiting_authorization' && mission.status !== 'awaiting_approval') {
      throw new IntelligenceError('INVALID_MISSION_STATE', `Mission cannot execute from ${mission.status}`)
    }
    return this.run(principal, missionId, cycle => this.dispatch(cycle, mission))
  }

  async events(principal: VerifiedPrincipal, missionId: string): Promise<readonly IntelligenceLedgerEvent[]> {
    assertVerifiedPrincipal(principal)
    await this.owned(principal, missionId)
    return this.store.listEvents(missionId)
  }

  private async run(
    principal: VerifiedPrincipal,
    missionId: string,
    body: (cycle: Cycle) => Promise<IntelligenceMission>,
  ): Promise<IntelligenceMission> {
    const controller = new AbortController()
    this.controllers.set(missionId, controller)
    const cycle = this.cycleFor(principal, missionId, controller.signal)
    try {
      return await body(cycle)
    } finally {
      if (this.controllers.get(missionId) === controller) this.controllers.delete(missionId)
    }
  }

  private cycleFor(principal: VerifiedPrincipal, missionId: string, signal: AbortSignal): Cycle {
    return {principal, missionId, signal, startedMs: this.clock.nowMs()}
  }

  private async drive(cycle: Cycle): Promise<IntelligenceMission> {
    for (let iteration = 0; iteration < this.budget.maxIterations; iteration += 1) {
      if (await this.wasCancelled(cycle)) return this.owned(cycle.principal, cycle.missionId)
      const mission = await this.owned(cycle.principal, cycle.missionId)
      if (isTerminalMissionStatus(mission.status) || mission.status === 'awaiting_approval' || mission.status === 'running') {
        return mission
      }
      await this.enforceDeadline(cycle, mission)
      let outcome: PhaseStop
      if (mission.status === 'planning') outcome = await this.planPhase(cycle, mission)
      else if (mission.status === 'awaiting_verification') outcome = await this.verifyPhase(cycle, mission)
      else if (mission.status === 'awaiting_authorization') outcome = await this.authorizePhase(cycle, mission)
      else throw new IntelligenceError('INVALID_MISSION_STATE', `Runtime cannot continue from ${mission.status}`)
      if (outcome === 'stop') return this.owned(cycle.principal, cycle.missionId)
    }
    await this.fail(cycle, await this.owned(cycle.principal, cycle.missionId), new IntelligenceError(
      'EXECUTION_FAILED',
      'Execution iteration budget exceeded',
      {reason: 'BUDGET_EXCEEDED', maxIterations: this.budget.maxIterations},
    ))
    throw new Error('unreachable')
  }

  private async planPhase(cycle: Cycle, mission: IntelligenceMission): Promise<PhaseStop> {
    const stored = await this.store.readPlan(mission.id)
    if (stored && stored.steps.length > 0) {
      await this.commit(cycle, 'awaiting_verification')
      return 'continue'
    }
    const actions = await this.capabilities.list(cycle.principal.accountId, cycle.principal.workspaceId)
    if (await this.wasCancelled(cycle)) return 'stop'
    let plan: GaiaPlan | undefined
    try {
      plan = await this.planner.plan({mission, availableActions: actions, now: this.clock.nowIso()})
    } catch (error) {
      if (await this.wasCancelled(cycle)) return 'stop'
      if (actions.length === 0 && error instanceof IntelligenceError && error.code === 'CAPABILITY_UNKNOWN') return 'stop'
      if (error instanceof IntelligenceError) await this.fail(cycle, mission, error)
      await this.fail(cycle, mission, new IntelligenceError('EXECUTION_FAILED', 'Planner failed', {cause: errorText(error)}))
      throw new Error('unreachable')
    }
    if (!plan) throw new Error('unreachable')
    if (await this.wasCancelled(cycle)) return 'stop'
    await this.enforceDeadline(cycle, mission)
    if (actions.length === 0 && plan.steps.length === 0) {
      await this.rememberPlan(cycle, mission, plan, stored ? 'plan.revised' : 'plan.created')
      return 'stop'
    }
    if (plan.steps.length > this.budget.maxPlanSteps) {
      await this.fail(cycle, mission, new IntelligenceError('EXECUTION_FAILED', 'Plan exceeds the step budget', {
        reason: 'BUDGET_EXCEEDED',
        maxPlanSteps: this.budget.maxPlanSteps,
        planSteps: plan.steps.length,
      }))
      throw new Error('unreachable')
    }
    const step = plan.steps[0]
    if (!step) {
      await this.fail(cycle, mission, new IntelligenceError('EXECUTION_FAILED', 'Planner returned no proposal', {reason: 'EMPTY_PLAN'}))
      throw new Error('unreachable')
    }
    const assessed = assessProposal({...step.actionProposal, missionId: mission.id}, actions)
    if (isProposalRejection(assessed)) {
      await this.block(cycle, assessed.code, assessed.message)
      throw new Error('unreachable')
    }
    const proposal: ModulaActionProposal = {
      ...assessed.proposal,
      missionId: mission.id,
      idempotencyKey: assessed.proposal.idempotencyKey ?? `mission:${mission.id}:proposal:${assessed.proposal.id}`,
    }
    const boundPlan: GaiaPlan = {...plan, missionId: mission.id, steps: [{...step, actionProposal: proposal, capability: proposal.capability}]}
    await this.store.writeProposal(proposal)
    await this.record(cycle, mission, 'proposal.created', {family: proposal.family, capability: proposal.capability}, {proposalId: proposal.id})
    await this.rememberPlan(cycle, mission, boundPlan, stored ? 'plan.revised' : 'plan.created')
    await this.commit(cycle, 'awaiting_verification')
    return 'continue'
  }

  private async verifyPhase(cycle: Cycle, mission: IntelligenceMission): Promise<PhaseStop> {
    if (await this.wasCancelled(cycle)) return 'stop'
    const proposal = await this.primaryProposal(mission.id)
    const boundary = await this.tools.revalidate(cycle.principal.accountId, mission.workspaceId, proposal)
    const {risk, reversibility} = classifyActionRisk(proposal.family)
    const decisionResult = await this.decisions.evaluate({
      mission,
      proposal,
      registered: boundary.registered,
      schemaValid: boundary.schemaValid,
      permissionGranted: boundary.permissionGranted,
      risk,
      reversibility,
      policyAllowed: risk !== 'financial',
    })
    if (await this.wasCancelled(cycle)) return 'stop'
    const decision: AkiDecision = {...decisionResult, id: this.ids(), createdAt: this.clock.nowIso()}
    await this.store.writeDecision(decision)
    await this.record(cycle, mission, 'aki.verification_started', {}, {proposalId: proposal.id})
    await this.record(cycle, mission, 'aki.decision_created', {
      verdict: decision.verdict,
      risk: decision.risk,
      reversibility: decision.reversibility,
      checks: decision.checks,
      evidenceState: decision.evidenceState,
    }, {proposalId: proposal.id, akiDecisionId: decision.id})
    await this.commit(cycle, 'awaiting_authorization')
    return 'continue'
  }

  private async authorizePhase(cycle: Cycle, mission: IntelligenceMission): Promise<PhaseStop> {
    if (await this.wasCancelled(cycle)) return 'stop'
    const proposal = await this.primaryProposal(mission.id)
    const aki = await this.store.readDecision(proposal.id)
    if (!aki) {
      await this.fail(cycle, mission, new IntelligenceError('EXECUTION_FAILED', 'Verification decision is missing'))
      throw new Error('unreachable')
    }
    const governor = this.governor.decide({id: this.ids(), proposal, aki, createdAt: this.clock.nowIso()})
    await this.store.writeAuthorization(governor)
    await this.record(cycle, mission, 'governor.authorization_created', {
      authorization: governor.authorization,
      allowedCapabilities: governor.allowedCapabilities,
      constraints: governor.constraints,
    }, {proposalId: proposal.id, akiDecisionId: aki.id, governorDecisionId: governor.id})
    if (aki.verdict === 'deny' || governor.authorization === 'blocked') {
      await this.block(cycle, aki.verdict === 'deny' ? 'AKI_DENIED' : 'GOVERNOR_BLOCKED', 'Authorization refused the proposal', proposal.id)
      throw new Error('unreachable')
    }
    if (aki.verdict === 'abstain' && governor.authorization === 'autonomous') {
      await this.block(cycle, 'AKI_ABSTAINED', 'An abstention cannot dispatch a tool', proposal.id)
      throw new Error('unreachable')
    }
    if (governor.authorization === 'human_required' || governor.authorization === 'supervised' || aki.verdict === 'require_approval' || aki.verdict === 'abstain') {
      await this.requestApproval(cycle, mission, proposal, `${governor.authorization}:${aki.risk}`)
      return 'stop'
    }
    if (governor.authorization !== 'autonomous' || (aki.verdict !== 'allow' && aki.verdict !== 'allow_with_conditions')) {
      await this.block(cycle, 'GOVERNOR_BLOCKED', 'Proposal is not authorized for dispatch', proposal.id)
      throw new Error('unreachable')
    }
    await this.dispatch(cycle, await this.owned(cycle.principal, cycle.missionId))
    return 'stop'
  }

  private async requestApproval(cycle: Cycle, mission: IntelligenceMission, proposal: ModulaActionProposal, reason: string): Promise<void> {
    const now = this.clock.nowIso()
    const approval: IntelligenceApproval = {
      id: this.ids(),
      missionId: mission.id,
      proposalId: proposal.id,
      requestedUserId: mission.userId,
      reason,
      status: 'pending',
      requestedAt: now,
    }
    await this.store.writeApproval(approval)
    await this.record(cycle, mission, 'approval.requested', {reason, status: 'pending'}, {proposalId: proposal.id, approvalId: approval.id})
    await this.commit(cycle, 'awaiting_approval')
  }

  private async dispatch(cycle: Cycle, mission: IntelligenceMission): Promise<IntelligenceMission> {
    if (await this.wasCancelled(cycle)) return this.owned(cycle.principal, cycle.missionId)
    const proposal = await this.primaryProposal(mission.id)
    const existing = await this.store.readExecution(proposal.id)
    if (existing) return this.settleExisting(existing)
    const authorization = await this.store.readAuthorization(proposal.id)
    const approval = await this.store.readApprovalForProposal(proposal.id)
    if (!authorization) {
      await this.fail(cycle, mission, new IntelligenceError('EXECUTION_FAILED', 'Governor authorization is missing'))
      throw new Error('unreachable')
    }
    const boundary = await this.tools.revalidate(cycle.principal.accountId, mission.workspaceId, proposal)
    try {
      assertCommandBoundary({
        proposal,
        authorization,
        approval,
        permissionGranted: boundary.permissionGranted,
        workspaceAccess: boundary.workspaceAccess,
        schemaValid: boundary.registered && boundary.schemaValid,
        executionCompleted: false,
      })
    } catch (error) {
      if (error instanceof IntelligenceError && error.code !== 'APPROVAL_REQUIRED') {
        await this.block(cycle, error.code, error.message, proposal.id)
      }
      throw error
    }
    if (await this.wasCancelled(cycle)) return this.owned(cycle.principal, cycle.missionId)
    const execution: IntelligenceExecution = {
      id: this.ids(),
      missionId: mission.id,
      proposalId: proposal.id,
      authorizationId: authorization.id,
      approvalId: approval?.id,
      status: 'running',
      idempotencyKey: proposal.idempotencyKey,
      startedAt: this.clock.nowIso(),
      createdAt: this.clock.nowIso(),
    }
    await this.store.writeExecution(execution)
    let running: IntelligenceMission
    try {
      running = await this.commit(cycle, 'running')
    } catch (error) {
      const latest = await this.owned(cycle.principal, cycle.missionId)
      if (latest.status === 'cancelled') return this.cancelDispatch(cycle, execution)
      throw error
    }
    await this.record(cycle, running, 'execution.started', {capability: proposal.capability}, {
      proposalId: proposal.id,
      governorDecisionId: authorization.id,
      approvalId: approval?.id,
      executionId: execution.id,
    })
    if (cycle.signal.aborted || (await this.owned(cycle.principal, cycle.missionId)).status === 'cancelled') {
      return this.cancelDispatch(cycle, execution)
    }
    let output: unknown
    try {
      output = await this.tools.execute({accountId: cycle.principal.accountId, proposal, signal: cycle.signal})
    } catch (error) {
      const latest = await this.owned(cycle.principal, cycle.missionId)
      if (latest.status === 'cancelled' || cycle.signal.aborted) return this.cancelDispatch(cycle, execution)
      const causeCode = error instanceof IntelligenceError ? error.code : 'EXECUTION_FAILED'
      await this.store.writeExecution({...execution, status: 'failed', errorCode: causeCode, completedAt: this.clock.nowIso()})
      await this.record(cycle, latest, 'execution.failed', {errorCode: causeCode}, {proposalId: proposal.id, executionId: execution.id})
      await this.fail(cycle, latest, new IntelligenceError('EXECUTION_FAILED', 'Governed runtime execution failed', {causeCode}))
    }
    if (cycle.signal.aborted || (await this.owned(cycle.principal, cycle.missionId)).status === 'cancelled') {
      return this.cancelDispatch(cycle, execution)
    }
    const redacted = redact(output)
    const completedExecution: IntelligenceExecution = {...execution, status: 'completed', result: redacted, completedAt: this.clock.nowIso()}
    await this.store.writeExecution(completedExecution)
    const artifact: IntelligenceArtifact = {
      id: this.ids(),
      missionId: mission.id,
      executionId: execution.id,
      kind: 'runtime.result',
      mediaType: 'application/json',
      metadata: {result: redactedRecord(redacted)},
      createdAt: this.clock.nowIso(),
    }
    await this.store.writeArtifact(artifact)
    const current = await this.owned(cycle.principal, cycle.missionId)
    await this.record(cycle, current, 'execution.completed', {result: redactedRecord(redacted)}, {proposalId: proposal.id, executionId: execution.id})
    await this.record(cycle, current, 'artifact.created', {kind: artifact.kind, mediaType: artifact.mediaType}, {proposalId: proposal.id, executionId: execution.id, artifactId: artifact.id})
    return this.commit(cycle, 'completed', {type: 'mission.completed', payload: {status: 'completed'}, refs: {proposalId: proposal.id, executionId: execution.id, artifactId: artifact.id}})
  }

  private settleExisting(existing: IntelligenceExecution): Promise<IntelligenceMission> {
    if (existing.status === 'completed') return this.readOwnedExecution(existing)
    if (existing.status === 'failed') {
      throw new IntelligenceError('EXECUTION_FAILED', 'Execution failed', {executionId: existing.id, reason: 'FAILED_STAYS_FAILED'})
    }
    throw new IntelligenceError('EXECUTION_ALREADY_COMPLETED', `Execution is already ${existing.status}`, {executionId: existing.id})
  }

  private async readOwnedExecution(existing: IntelligenceExecution): Promise<IntelligenceMission> {
    const mission = await this.store.readMission(existing.missionId)
    if (!mission) throw new IntelligenceError('MISSION_NOT_FOUND', 'Mission not found')
    return mission
  }

  private async cancelDispatch(cycle: Cycle, execution: IntelligenceExecution): Promise<IntelligenceMission> {
    await this.store.writeExecution({...execution, status: 'failed', errorCode: 'EXECUTION_FAILED', completedAt: this.clock.nowIso(), result: undefined})
    const latest = await this.owned(cycle.principal, cycle.missionId)
    await this.record(cycle, latest, 'execution.failed', {errorCode: 'EXECUTION_FAILED', reason: 'cancelled'}, {proposalId: execution.proposalId, executionId: execution.id})
    if (latest.status === 'running') {
      return this.commit(cycle, 'cancelled', {type: 'mission.cancelled', payload: {reason: 'cancelled'}})
    }
    return latest
  }

  private async rememberPlan(cycle: Cycle, mission: IntelligenceMission, plan: GaiaPlan, event: 'plan.created' | 'plan.revised'): Promise<void> {
    await this.store.writePlan(plan)
    await this.record(cycle, mission, event, {
      planId: plan.id,
      version: plan.version,
      summary: plan.summary,
      steps: plan.steps.map(step => ({id: step.id, order: step.order, capability: step.capability})),
    })
  }

  private async primaryProposal(missionId: string): Promise<ModulaActionProposal> {
    const proposals = await this.store.listProposals(missionId)
    const proposal = proposals[0]
    if (!proposal) throw new IntelligenceError('MISSION_NOT_FOUND', 'Mission proposal not found')
    return proposal
  }

  private async enforceDeadline(cycle: Cycle, mission: IntelligenceMission): Promise<void> {
    if (this.clock.nowMs() - cycle.startedMs > this.budget.maxDurationMs) {
      await this.fail(cycle, mission, new IntelligenceError('EXECUTION_FAILED', 'Execution duration budget exceeded', {
        reason: 'BUDGET_EXCEEDED',
        maxDurationMs: this.budget.maxDurationMs,
      }))
    }
  }

  private async wasCancelled(cycle: Cycle): Promise<boolean> {
    const mission = await this.owned(cycle.principal, cycle.missionId)
    if (mission.status === 'cancelled') return true
    if (cycle.signal.aborted && !isTerminalMissionStatus(mission.status)) {
      await this.commit(cycle, 'cancelled', {type: 'mission.cancelled', payload: {reason: 'cancelled'}})
      return true
    }
    return false
  }

  private async fail(cycle: Cycle, mission: IntelligenceMission, error: IntelligenceError): Promise<never> {
    const latest = await this.owned(cycle.principal, cycle.missionId)
    if (latest.status === 'failed') throw error
    if (latest.status === 'cancelled') {
      throw new IntelligenceError('INVALID_MISSION_STATE', 'Mission was cancelled', {status: 'cancelled'})
    }
    if (!isTerminalMissionStatus(latest.status)) {
      const failed = await this.commit(cycle, 'failed', {
        type: 'mission.failed',
        payload: {errorCode: error.code, ...error.details},
      })
      void failed
    }
    throw error
  }

  private async block(cycle: Cycle, code: IntelligenceErrorCode, message: string, proposalId?: string): Promise<never> {
    const latest = await this.owned(cycle.principal, cycle.missionId)
    if (!isTerminalMissionStatus(latest.status)) {
      const blocked = await this.commit(cycle, 'blocked')
      await this.record(cycle, blocked, 'execution.blocked', {reasonCode: code}, {proposalId})
      await this.record(cycle, blocked, 'mission.blocked', {reasonCode: code}, {proposalId})
    }
    throw new IntelligenceError(code, message, proposalId ? {proposalId} : {})
  }

  private async owned(principal: VerifiedPrincipal, missionId: string): Promise<IntelligenceMission> {
    const mission = await this.store.readMission(missionId)
    if (!mission) throw new IntelligenceError('MISSION_NOT_FOUND', 'Mission not found')
    if (mission.userId !== principal.accountId) throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Mission belongs to another account')
    return mission
  }

  private async commit(
    cycle: Cycle,
    to: IntelligenceMissionStatus,
    event?: {type: IntelligenceLedgerEventType; payload: Record<string, unknown>; refs?: EventRefs},
  ): Promise<IntelligenceMission> {
    return this.withMission(cycle.missionId, async () => {
      const current = await this.store.readMission(cycle.missionId)
      if (!current) throw new IntelligenceError('MISSION_NOT_FOUND', 'Mission not found')
      if (current.userId !== cycle.principal.accountId) throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Mission belongs to another account')
      const next = commitMissionStatus(current, to, this.clock.nowIso())
      await this.store.writeMission(next)
      if (event) await this.append(next, event.type, event.payload, actorFor(event.type, cycle.principal.accountId), event.refs)
      return next
    })
  }

  private async record(
    cycle: Cycle,
    mission: IntelligenceMission,
    type: IntelligenceLedgerEventType,
    payload: Record<string, unknown>,
    refs: EventRefs = {},
  ): Promise<void> {
    await this.withMission(mission.id, async () => {
      const current = await this.store.readMission(mission.id)
      await this.append(current ?? mission, type, payload, actorFor(type, cycle.principal.accountId), refs)
    })
  }

  private async append(
    mission: IntelligenceMission,
    type: IntelligenceLedgerEventType,
    payload: Record<string, unknown>,
    actor: LedgerActor,
    refs: EventRefs = {},
  ): Promise<void> {
    const sequence = (await this.store.listEvents(mission.id)).length + 1
    const event: IntelligenceLedgerEvent = {
      id: this.ids(),
      schemaVersion: '1.0.0',
      type,
      timestamp: this.clock.nowIso(),
      actor,
      missionId: mission.id,
      correlationId: mission.correlationId,
      userId: mission.userId,
      workspaceId: mission.workspaceId,
      proposalId: refs.proposalId,
      akiDecisionId: refs.akiDecisionId,
      governorDecisionId: refs.governorDecisionId,
      approvalId: refs.approvalId,
      executionId: refs.executionId,
      artifactId: refs.artifactId,
      payload: redactRecord({...payload, sequence}),
    }
    await this.store.appendEvent(event)
  }

  private async withMission<T>(missionId: string, fn: () => Promise<T>): Promise<T> {
    return this.withKey(`mission:${missionId}`, fn)
  }

  private async withKey<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve()
    let release: () => void = () => undefined
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    this.locks.set(key, previous.then(() => gate, () => gate))
    await previous.catch(() => undefined)
    try {
      return await fn()
    } finally {
      release()
    }
  }
}

type EventRefs = {
  proposalId?: string
  akiDecisionId?: string
  governorDecisionId?: string
  approvalId?: string
  executionId?: string
  artifactId?: string
}

function correlationLock(accountId: string, correlationId: string): string {
  return `correlation:${accountId}:${correlationId}`
}

function actorFor(type: IntelligenceLedgerEventType, accountId: string): LedgerActor {
  switch (type) {
    case 'mission.created':
    case 'approval.approved':
    case 'approval.rejected':
      return {type: 'user', id: accountId}
    case 'mission.planning_started':
    case 'plan.created':
    case 'plan.revised':
    case 'proposal.created':
      return {type: 'gaia'}
    case 'aki.verification_started':
    case 'aki.decision_created':
      return {type: 'aki'}
    case 'governor.authorization_created':
    case 'approval.requested':
      return {type: 'governor'}
    case 'execution.started':
    case 'execution.blocked':
      return {type: 'command'}
    case 'execution.completed':
    case 'execution.failed':
    case 'artifact.created':
      return {type: 'runtime'}
    case 'mission.cancelled':
      return {type: 'system', id: accountId}
    default:
      return {type: 'system'}
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown'
}

function redactedRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {value}
}

export type {MissionRequest}
