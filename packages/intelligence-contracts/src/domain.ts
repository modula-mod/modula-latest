export type IntelligenceMissionStatus =
  | 'draft'
  | 'planning'
  | 'awaiting_verification'
  | 'awaiting_authorization'
  | 'awaiting_approval'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked'

export type IntelligenceMission = {
  id: string
  userId: string
  workspaceId?: string
  objective: string
  status: IntelligenceMissionStatus
  correlationId: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type GaiaPlanStepState = 'pending' | 'ready' | 'authorized' | 'running' | 'completed' | 'failed' | 'blocked'

export type ModulaActionProposal = {
  id: string
  missionId: string
  moduleId?: string
  family: string
  capability: string
  actionId?: string
  input: unknown
  requestedBy: 'gaia'
  idempotencyKey?: string
}

export type GaiaPlanStep = {
  id: string
  order: number
  description: string
  capability: string
  actionProposal: ModulaActionProposal
  dependencies: string[]
  state: GaiaPlanStepState
}

export type GaiaPlan = {
  id: string
  missionId: string
  version: number
  summary: string
  steps: GaiaPlanStep[]
  createdAt: string
}

export type GaiaAvailableAction = {
  family: string
  capability: string
  moduleId?: string
  actionId?: string
  collection?: string
}

export type GaiaPlanningInput = {
  mission: IntelligenceMission
  availableActions: GaiaAvailableAction[]
  now?: string
}

export interface GaiaPlanner {
  plan(input: GaiaPlanningInput): Promise<GaiaPlan>
}

export type ActionRisk =
  | 'read_only'
  | 'write_reversible'
  | 'write_irreversible'
  | 'external_side_effect'
  | 'privileged'
  | 'financial'
  | 'unknown'

export type Reversibility = 'reversible' | 'compensatable' | 'irreversible'

export type EvidenceReference = {
  id: string
  kind: 'record' | 'document' | 'api' | 'user_input' | 'system' | 'derived'
  sourceId?: string
  uri?: string
  hash?: string
  capturedAt?: string
}

export type EvidenceState = 'EVIDENCE_PRESENT' | 'NO_EVIDENCE' | 'INSUFFICIENT_EVIDENCE' | 'CONFLICTING_EVIDENCE'

export type AkiVerdict = 'allow' | 'allow_with_conditions' | 'require_approval' | 'deny' | 'abstain'
export type AkiCheckSource = 'deterministic' | 'policy' | 'permission' | 'schema' | 'evidence' | 'model' | 'ensemble'
export type AkiCheckStatus = 'pass' | 'fail' | 'uncertain' | 'not_applicable'

export type AkiCheck = {
  id: string
  source: AkiCheckSource
  status: AkiCheckStatus
  reasonCode: string
  detail?: string
}

export type AkiDecision = {
  id: string
  missionId: string
  proposalId: string
  verdict: AkiVerdict
  risk: ActionRisk
  reversibility: Reversibility
  checks: AkiCheck[]
  evidence: EvidenceReference[]
  evidenceState: EvidenceState
  conflicts: string[]
  conditions: string[]
  confidence?: number
  createdAt: string
}

export type DecisionInput = {
  mission: IntelligenceMission
  proposal: ModulaActionProposal
  registered: boolean
  schemaValid: boolean
  permissionGranted: boolean
  risk: ActionRisk
  reversibility: Reversibility
  evidence?: EvidenceReference[]
  evidenceRequired?: boolean
  policyAllowed?: boolean
}

export type DecisionResult = Omit<AkiDecision, 'id' | 'createdAt'>

export interface DecisionEngine {
  evaluate(input: DecisionInput): Promise<DecisionResult>
}

export type GovernorAuthorization = 'autonomous' | 'supervised' | 'human_required' | 'blocked'

export type GovernorDecision = {
  id: string
  missionId: string
  proposalId: string
  authorization: GovernorAuthorization
  allowedCapabilities: string[]
  constraints: string[]
  akiDecisionId: string
  createdAt: string
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'

export type IntelligenceApproval = {
  id: string
  missionId: string
  proposalId: string
  requestedUserId: string
  resolverUserId?: string
  reason: string
  status: ApprovalStatus
  requestedAt: string
  resolvedAt?: string
  expiresAt?: string
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked'

export type IntelligenceExecution = {
  id: string
  missionId: string
  proposalId: string
  authorizationId: string
  approvalId?: string
  status: ExecutionStatus
  idempotencyKey?: string
  result?: unknown
  errorCode?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

export type IntelligenceArtifact = {
  id: string
  missionId: string
  executionId: string
  kind: string
  mediaType: string
  uri?: string
  hash?: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type LedgerActor = {type: 'user' | 'gaia' | 'aki' | 'governor' | 'command' | 'runtime' | 'system'; id?: string}

export type IntelligenceLedgerEventType =
  | 'mission.created'
  | 'mission.planning_started'
  | 'mission.completed'
  | 'mission.failed'
  | 'mission.cancelled'
  | 'mission.blocked'
  | 'plan.created'
  | 'plan.revised'
  | 'proposal.created'
  | 'aki.verification_started'
  | 'aki.decision_created'
  | 'governor.authorization_created'
  | 'approval.requested'
  | 'approval.approved'
  | 'approval.rejected'
  | 'approval.expired'
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.blocked'
  | 'artifact.created'

export type IntelligenceLedgerEvent = {
  id: string
  schemaVersion: '1.0.0'
  type: IntelligenceLedgerEventType
  timestamp: string
  actor: LedgerActor
  missionId: string
  correlationId: string
  userId?: string
  workspaceId?: string
  proposalId?: string
  akiDecisionId?: string
  governorDecisionId?: string
  approvalId?: string
  executionId?: string
  artifactId?: string
  payload: Record<string, unknown>
}

export type CircuitState = 'draft' | 'validating' | 'active' | 'deprecated' | 'quarantined'

export type CircuitCard = {
  id: string
  userId: string
  workspaceId?: string
  name: string
  state: CircuitState
  activeRevisionId?: string
  createdAt: string
  updatedAt: string
}

export type CircuitRevision = {
  id: string
  circuitId: string
  version: number
  definition: Record<string, unknown>
  createdByUserId: string
  createdAt: string
}

export type CircuitExecutionReference = {
  circuitId: string
  revisionId: string
  missionId: string
  executionId: string
}
