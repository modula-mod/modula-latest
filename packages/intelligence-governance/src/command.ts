import type {GovernorDecision, IntelligenceApproval, ModulaActionProposal} from '@modula/intelligence-contracts'
import {IntelligenceError} from '@modula/intelligence-contracts'

export type CommandRevalidation = {
  proposal: ModulaActionProposal
  authorization: GovernorDecision
  approval?: IntelligenceApproval
  permissionGranted: boolean
  workspaceAccess: boolean
  schemaValid: boolean
  executionCompleted: boolean
}

export function assertCommandBoundary(input: CommandRevalidation): void {
  const {proposal, authorization, approval} = input
  if (authorization.proposalId !== proposal.id || authorization.missionId !== proposal.missionId) {
    throw new IntelligenceError('GOVERNOR_BLOCKED', 'Authorization identity does not match the proposal')
  }
  if (authorization.authorization === 'blocked') throw new IntelligenceError('GOVERNOR_BLOCKED', 'Governor blocked execution')
  if (!authorization.allowedCapabilities.includes(proposal.capability)) {
    throw new IntelligenceError('CAPABILITY_DENIED', 'Authorization does not allow the proposal capability')
  }
  if (!input.permissionGranted) throw new IntelligenceError('PERMISSION_DENIED', 'Permission was revoked before execution')
  if (!input.workspaceAccess) throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Workspace access is no longer valid')
  if (!input.schemaValid) throw new IntelligenceError('INVALID_ACTION_SCHEMA', 'Current action schema rejected the proposal')
  if (authorization.authorization === 'human_required' || authorization.authorization === 'supervised') {
    if (!approval || approval.proposalId !== proposal.id || approval.status !== 'approved') {
      throw new IntelligenceError('APPROVAL_REQUIRED', 'A current approval is required')
    }
    if (approval.expiresAt && Date.parse(approval.expiresAt) <= Date.now()) {
      throw new IntelligenceError('APPROVAL_REQUIRED', 'Approval has expired')
    }
  }
  if (input.executionCompleted) throw new IntelligenceError('EXECUTION_ALREADY_COMPLETED', 'Proposal execution is already complete')
}
