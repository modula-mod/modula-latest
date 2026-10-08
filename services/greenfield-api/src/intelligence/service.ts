import type {AkiDecision, GovernorDecision, IntelligenceMission, ModulaActionProposal} from '@modula/intelligence-contracts'
import {IntelligenceError} from '@modula/intelligence-contracts'
import {
  assertCommandBoundary,
  classifyActionRisk,
  DeterministicAkiDecisionFabric,
  DeterministicTestPlanner,
  GovernorV0,
} from '@modula/intelligence-governance'
import type {ModulaDb} from '../database/client.js'
import type {AppConfig} from '../config/index.js'
import {uuidv7} from '../lib/uuidv7.js'
import {IntelligenceActionBoundary} from './action-boundary.js'
import {IntelligenceRepository} from './repository.js'

export class GovernedIntelligenceService {
  private readonly repository: IntelligenceRepository
  private readonly boundary: IntelligenceActionBoundary
  private readonly planner = new DeterministicTestPlanner(uuidv7)
  private readonly aki = new DeterministicAkiDecisionFabric()
  private readonly governor = new GovernorV0()

  constructor(private readonly db: ModulaDb, config?: Pick<AppConfig, 'environment' | 'moduleAllowUntrustedDevelopmentReleases'>) {
    this.repository = new IntelligenceRepository(db)
    this.boundary = new IntelligenceActionBoundary(db, config)
  }

  async createMission(accountId: string, input: {objective?: unknown; workspaceId?: unknown; correlationId?: string}) {
    const objective = typeof input.objective === 'string' ? input.objective.trim() : ''
    if (!objective || objective.length > 8000) throw new IntelligenceError('INVALID_ACTION_SCHEMA', 'Objective must contain 1 to 8000 characters')
    const workspaceId = typeof input.workspaceId === 'string' && input.workspaceId ? input.workspaceId : undefined
    if (workspaceId && !(await this.hasWorkspaceAccess(accountId, workspaceId))) throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Workspace access is required')
    return this.repository.createMission({accountId, workspaceId, objective, correlationId: input.correlationId ?? uuidv7()})
  }

  listMissions(accountId: string) {
    return this.repository.listMissions(accountId)
  }

  detail(accountId: string, missionId: string) {
    return this.repository.detail(accountId, missionId)
  }

  ledger(accountId: string, missionId: string) {
    return this.repository.ledger(accountId, missionId)
  }

  decisions(accountId: string, missionId: string) {
    return this.repository.decisions(accountId, missionId)
  }

  approvals(accountId: string, missionId: string) {
    return this.repository.approvals(accountId, missionId)
  }

  evidence(accountId: string, missionId: string) {
    return this.repository.evidence(accountId, missionId)
  }

  async start(accountId: string, missionId: string) {
    let mission = await this.repository.ownedMission(accountId, missionId)
    if (mission.status !== 'draft') throw new IntelligenceError('INVALID_MISSION_STATE', 'Only a draft mission can start planning')
    mission = await this.repository.transition(accountId, missionId, 'planning', 'mission.planning_started', {planner: 'deterministic-test-v0'})
    try {
      const planningStarted = Date.now()
      const plan = await this.planner.plan({mission, availableActions: await this.boundary.availableActions(accountId)})
      await this.repository.savePlan(mission, plan, Date.now() - planningStarted)
      mission = await this.repository.transition(accountId, missionId, 'awaiting_verification')
      const proposal = plan.steps[0]!.actionProposal
      const boundary = await this.boundary.revalidate(accountId, mission.workspaceId, proposal)
      const {risk, reversibility} = classifyActionRisk(proposal.family)
      const akiStarted = Date.now()
      const akiResult = await this.aki.evaluate({mission, proposal, registered: boundary.registered, schemaValid: boundary.schemaValid, permissionGranted: boundary.permissionGranted, risk, reversibility, policyAllowed: risk !== 'financial'})
      const akiDecision: AkiDecision = {...akiResult, id: uuidv7(), createdAt: new Date().toISOString()}
      await this.repository.saveAki(mission, akiDecision, Date.now() - akiStarted)
      mission = await this.repository.transition(accountId, missionId, 'awaiting_authorization')
      const governorStarted = Date.now()
      const governorDecision: GovernorDecision = this.governor.decide({id: uuidv7(), proposal, aki: akiDecision})
      await this.repository.saveGovernor(mission, governorDecision, Date.now() - governorStarted)
      if (governorDecision.authorization === 'blocked') {
        await this.repository.blockedExecution(mission, proposal, akiDecision.verdict === 'deny' ? 'AKI_DENIED' : 'GOVERNOR_BLOCKED')
        return this.repository.detail(accountId, missionId)
      }
      if (governorDecision.authorization === 'human_required' || governorDecision.authorization === 'supervised') {
        await this.repository.createApproval(mission, proposal.id, `${governorDecision.authorization}:${risk}`)
        await this.repository.transition(accountId, missionId, 'awaiting_approval')
        return this.repository.detail(accountId, missionId)
      }
      await this.execute(accountId, missionId, proposal.id)
      return this.repository.detail(accountId, missionId)
    } catch (error) {
      const latest = await this.repository.ownedMission(accountId, missionId)
      if (!['completed', 'failed', 'cancelled', 'blocked'].includes(latest.status)) {
        await this.repository.transition(accountId, missionId, 'blocked', 'mission.blocked', {reasonCode: intelligenceCode(error)})
      }
      throw error
    }
  }

  async approve(accountId: string, missionId: string, approvalId: string) {
    const approval = await this.repository.resolveApproval(accountId, missionId, approvalId, 'approved')
    await this.execute(accountId, missionId, approval.proposalId)
    return this.repository.detail(accountId, missionId)
  }

  async reject(accountId: string, missionId: string, approvalId: string) {
    await this.repository.resolveApproval(accountId, missionId, approvalId, 'rejected')
    const mission = await this.repository.ownedMission(accountId, missionId)
    await this.repository.transition(accountId, missionId, 'blocked', 'mission.blocked', {reasonCode: 'APPROVAL_REJECTED'})
    return {...mission, status: 'blocked'}
  }

  async execute(accountId: string, missionId: string, proposalId: string) {
    const mission = await this.repository.ownedMission(accountId, missionId)
    const proposal = await this.repository.proposal(missionId, proposalId)
    const authorization = await this.repository.latestGovernor(missionId, proposalId)
    const approval = await this.repository.approvalForProposal(missionId, proposalId)
    const existing = await this.repository.getExecution(proposalId)
    if (existing?.status === 'completed') return {idempotent: true, executionId: existing.execution_id, result: existing.result}
    const boundary = await this.boundary.revalidate(accountId, mission.workspaceId, proposal)
    try {
      assertCommandBoundary({proposal, authorization, approval, permissionGranted: boundary.permissionGranted, workspaceAccess: boundary.workspaceAccess, schemaValid: boundary.registered && boundary.schemaValid, executionCompleted: false})
    } catch (error) {
      if (error instanceof IntelligenceError && error.code !== 'APPROVAL_REQUIRED') await this.repository.blockedExecution(mission, proposal, error.code)
      throw error
    }
    const claimed = await this.repository.claimExecution(mission, proposal, authorization, approval)
    if (!claimed.claimed) {
      if (claimed.row.status === 'completed') return {idempotent: true, executionId: claimed.row.execution_id, result: claimed.row.result}
      throw new IntelligenceError('EXECUTION_ALREADY_COMPLETED', `Execution is already ${claimed.row.status}`)
    }
    try {
      const result = await this.boundary.execute(accountId, proposal)
      await this.repository.completeExecution(mission, proposal, claimed.row.execution_id, result)
      return {idempotent: false, executionId: claimed.row.execution_id, result}
    } catch (error) {
      await this.repository.failExecution(mission, proposal, claimed.row.execution_id, intelligenceCode(error))
      throw new IntelligenceError('EXECUTION_FAILED', 'Governed runtime execution failed', {causeCode: intelligenceCode(error)})
    }
  }

  private async hasWorkspaceAccess(accountId: string, workspaceId: string): Promise<boolean> {
    const row = await this.db.selectFrom('greenfield_developer_organisation_memberships').select('membership_id').where('organisation_id', '=', workspaceId).where('account_id', '=', accountId).where('state', '=', 'ACTIVE').executeTakeFirst()
    return Boolean(row)
  }
}

function intelligenceCode(error: unknown): string {
  if (error instanceof IntelligenceError) return error.code
  if (error && typeof error === 'object' && 'code' in error) return String((error as {code: unknown}).code)
  return 'EXECUTION_FAILED'
}
