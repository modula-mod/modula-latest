import {IntelligenceError} from '@modula/intelligence-contracts'
import type {
  AkiDecision,
  GaiaPlan,
  GovernorDecision,
  IntelligenceApproval,
  IntelligenceArtifact,
  IntelligenceExecution,
  IntelligenceLedgerEvent,
  IntelligenceMission,
  ModulaActionProposal,
} from '@modula/intelligence-contracts'
import type {MissionRuntimeStore} from './store.js'

function clone<T>(value: T): T {
  return structuredClone(value)
}

export class InMemoryMissionRuntimeStore implements MissionRuntimeStore {
  private readonly missions = new Map<string, IntelligenceMission>()
  private readonly byCorrelation = new Map<string, string>()
  private readonly events = new Map<string, IntelligenceLedgerEvent[]>()
  private readonly plans = new Map<string, GaiaPlan>()
  private readonly proposals = new Map<string, ModulaActionProposal>()
  private readonly decisions = new Map<string, AkiDecision>()
  private readonly authorizations = new Map<string, GovernorDecision>()
  private readonly approvals = new Map<string, IntelligenceApproval>()
  private readonly executions = new Map<string, IntelligenceExecution>()
  private readonly artifacts = new Map<string, IntelligenceArtifact[]>()

  async readMission(missionId: string): Promise<IntelligenceMission | undefined> {
    const mission = this.missions.get(missionId)
    return mission ? clone(mission) : undefined
  }

  async findMissionByCorrelation(accountId: string, correlationId: string): Promise<IntelligenceMission | undefined> {
    const missionId = this.byCorrelation.get(correlationKey(accountId, correlationId))
    return missionId ? this.readMission(missionId) : undefined
  }

  async insertMission(mission: IntelligenceMission): Promise<void> {
    if (this.missions.has(mission.id)) throw new IntelligenceError('INVALID_MISSION_STATE', 'Mission id already exists')
    const key = correlationKey(mission.userId, mission.correlationId)
    if (this.byCorrelation.has(key)) throw new IntelligenceError('INVALID_MISSION_STATE', 'Idempotency key already exists')
    this.missions.set(mission.id, clone(mission))
    this.byCorrelation.set(key, mission.id)
    this.events.set(mission.id, [])
  }

  async writeMission(mission: IntelligenceMission): Promise<void> {
    if (!this.missions.has(mission.id)) throw new IntelligenceError('MISSION_NOT_FOUND', 'Mission not found')
    this.missions.set(mission.id, clone(mission))
  }

  async listEvents(missionId: string): Promise<readonly IntelligenceLedgerEvent[]> {
    return clone(this.events.get(missionId) ?? [])
  }

  async appendEvent(event: IntelligenceLedgerEvent): Promise<void> {
    const list = this.events.get(event.missionId) ?? []
    list.push(clone(event))
    this.events.set(event.missionId, list)
  }

  async readPlan(missionId: string): Promise<GaiaPlan | undefined> {
    const plan = this.plans.get(missionId)
    return plan ? clone(plan) : undefined
  }

  async writePlan(plan: GaiaPlan): Promise<void> {
    this.plans.set(plan.missionId, clone(plan))
  }

  async readProposal(missionId: string, proposalId: string): Promise<ModulaActionProposal | undefined> {
    const proposal = this.proposals.get(proposalId)
    return proposal && proposal.missionId === missionId ? clone(proposal) : undefined
  }

  async listProposals(missionId: string): Promise<readonly ModulaActionProposal[]> {
    return [...this.proposals.values()].filter(proposal => proposal.missionId === missionId).map(clone)
  }

  async writeProposal(proposal: ModulaActionProposal): Promise<void> {
    this.proposals.set(proposal.id, clone(proposal))
  }

  async readDecision(proposalId: string): Promise<AkiDecision | undefined> {
    const decision = this.decisions.get(proposalId)
    return decision ? clone(decision) : undefined
  }

  async writeDecision(decision: AkiDecision): Promise<void> {
    this.decisions.set(decision.proposalId, clone(decision))
  }

  async readAuthorization(proposalId: string): Promise<GovernorDecision | undefined> {
    const decision = this.authorizations.get(proposalId)
    return decision ? clone(decision) : undefined
  }

  async writeAuthorization(decision: GovernorDecision): Promise<void> {
    this.authorizations.set(decision.proposalId, clone(decision))
  }

  async readApproval(approvalId: string): Promise<IntelligenceApproval | undefined> {
    const approval = this.approvals.get(approvalId)
    return approval ? clone(approval) : undefined
  }

  async readApprovalForProposal(proposalId: string): Promise<IntelligenceApproval | undefined> {
    const approval = [...this.approvals.values()].find(item => item.proposalId === proposalId)
    return approval ? clone(approval) : undefined
  }

  async writeApproval(approval: IntelligenceApproval): Promise<void> {
    this.approvals.set(approval.id, clone(approval))
  }

  async readExecution(proposalId: string): Promise<IntelligenceExecution | undefined> {
    const execution = this.executions.get(proposalId)
    return execution ? clone(execution) : undefined
  }

  async listExecutions(missionId: string): Promise<readonly IntelligenceExecution[]> {
    return [...this.executions.values()].filter(execution => execution.missionId === missionId).map(clone)
  }

  async writeExecution(execution: IntelligenceExecution): Promise<void> {
    this.executions.set(execution.proposalId, clone(execution))
  }

  async writeArtifact(artifact: IntelligenceArtifact): Promise<void> {
    const list = this.artifacts.get(artifact.missionId) ?? []
    list.push(clone(artifact))
    this.artifacts.set(artifact.missionId, list)
  }

  async listArtifacts(missionId: string): Promise<readonly IntelligenceArtifact[]> {
    return clone(this.artifacts.get(missionId) ?? [])
  }

  async countMissions(): Promise<number> {
    return this.missions.size
  }
}

function correlationKey(accountId: string, correlationId: string): string {
  return `${accountId}\u0000${correlationId}`
}
