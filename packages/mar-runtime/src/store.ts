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

/**
 * Process-local persistence for the runtime kernel.
 * Records use the governed mission, execution, and ledger types.
 * A GreenField adapter can map this port onto IntelligenceRepository; this package does not open a database.
 */
export interface MissionRuntimeStore {
  readMission(missionId: string): Promise<IntelligenceMission | undefined>
  findMissionByCorrelation(accountId: string, correlationId: string): Promise<IntelligenceMission | undefined>
  insertMission(mission: IntelligenceMission): Promise<void>
  writeMission(mission: IntelligenceMission): Promise<void>
  listEvents(missionId: string): Promise<readonly IntelligenceLedgerEvent[]>
  appendEvent(event: IntelligenceLedgerEvent): Promise<void>
  readPlan(missionId: string): Promise<GaiaPlan | undefined>
  writePlan(plan: GaiaPlan): Promise<void>
  readProposal(missionId: string, proposalId: string): Promise<ModulaActionProposal | undefined>
  listProposals(missionId: string): Promise<readonly ModulaActionProposal[]>
  writeProposal(proposal: ModulaActionProposal): Promise<void>
  readDecision(proposalId: string): Promise<AkiDecision | undefined>
  writeDecision(decision: AkiDecision): Promise<void>
  readAuthorization(proposalId: string): Promise<GovernorDecision | undefined>
  writeAuthorization(decision: GovernorDecision): Promise<void>
  readApproval(approvalId: string): Promise<IntelligenceApproval | undefined>
  readApprovalForProposal(proposalId: string): Promise<IntelligenceApproval | undefined>
  writeApproval(approval: IntelligenceApproval): Promise<void>
  readExecution(proposalId: string): Promise<IntelligenceExecution | undefined>
  listExecutions(missionId: string): Promise<readonly IntelligenceExecution[]>
  writeExecution(execution: IntelligenceExecution): Promise<void>
  writeArtifact(artifact: IntelligenceArtifact): Promise<void>
  listArtifacts(missionId: string): Promise<readonly IntelligenceArtifact[]>
}
