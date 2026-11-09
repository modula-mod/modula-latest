import {IntelligenceError, isTerminalMissionStatus, type IntelligenceMission} from '@modula/intelligence-contracts'
import type {IntelligenceProviderRegistry, IntelligenceRouter} from '@modula/intelligence-core'
import type {ModulaDb} from '../database/client.js'
import type {AppConfig} from '../config/index.js'
import {uuidv7} from '../lib/uuidv7.js'
import {getOrCreateGreenfieldMissionRuntime} from './mission-runtime-binding.js'
import {sessionPrincipal} from './mission-cancel.js'
import {createGovernedIntelligenceRouter, selectGovernedIntelligenceProvider} from './provider-selection.js'
import {IntelligenceRepository} from './repository.js'
import type {GreenfieldMissionRuntimeStore} from './mission-runtime-store.js'
import type {MissionRuntime} from '@modula/mar-runtime'

const BLOCKED_WITHOUT_THROW = new Set([
  'AKI_DENIED',
  'GOVERNOR_BLOCKED',
  'CAPABILITY_UNKNOWN',
  'CAPABILITY_DENIED',
  'PERMISSION_DENIED',
  'AKI_ABSTAINED',
])

export class GovernedIntelligenceService {
  private readonly repository: IntelligenceRepository
  private readonly router: IntelligenceRouter
  private readonly runtime: MissionRuntime
  private readonly store: GreenfieldMissionRuntimeStore

  constructor(private readonly db: ModulaDb, config?: Pick<AppConfig, 'environment' | 'moduleAllowUntrustedDevelopmentReleases'>, options?: {providers?: IntelligenceProviderRegistry}) {
    this.repository = new IntelligenceRepository(db)
    this.router = createGovernedIntelligenceRouter(options?.providers).router
    const bound = getOrCreateGreenfieldMissionRuntime(db, config, {providers: options?.providers})
    this.runtime = bound.runtime
    this.store = bound.store
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
    const mission = await this.repository.ownedMission(accountId, missionId)
    if (mission.status !== 'draft') throw new IntelligenceError('INVALID_MISSION_STATE', 'Only a draft mission can start planning')
    const selection = await selectGovernedIntelligenceProvider(this.router)
    this.store.setPlanningSelection(selection)
    try {
      await this.runtime.start(this.principal(accountId, mission), missionId)
    } catch (error) {
      return this.settleStart(accountId, missionId, error)
    }
    return this.repository.detail(accountId, missionId)
  }

  async approve(accountId: string, missionId: string, approvalId: string) {
    const mission = await this.repository.ownedMission(accountId, missionId)
    await this.runtime.decideApproval(this.principal(accountId, mission), missionId, approvalId, 'approved')
    return this.repository.detail(accountId, missionId)
  }

  async reject(accountId: string, missionId: string, approvalId: string) {
    const mission = await this.repository.ownedMission(accountId, missionId)
    const blocked = await this.runtime.decideApproval(this.principal(accountId, mission), missionId, approvalId, 'rejected')
    return {...blocked, status: 'blocked' as const}
  }

  async execute(accountId: string, missionId: string, proposalId: string) {
    const existing = await this.repository.getExecution(proposalId)
    if (existing?.status === 'completed') return {idempotent: true, executionId: existing.execution_id, result: existing.result}
    const mission = await this.repository.ownedMission(accountId, missionId)
    if (mission.status === 'cancelled') {
      throw new IntelligenceError('INVALID_MISSION_STATE', 'Mission cannot execute from cancelled')
    }
    try {
      await this.runtime.execute(this.principal(accountId, mission), missionId, proposalId)
    } catch (error) {
      if (error instanceof IntelligenceError) throw error
      throw new IntelligenceError('EXECUTION_FAILED', 'Governed runtime execution failed', {causeCode: intelligenceCode(error)})
    }
    const row = await this.repository.getExecution(proposalId)
    if (row?.status === 'completed') return {idempotent: false, executionId: row.execution_id, result: row.result}
    if (row?.status === 'failed') {
      throw new IntelligenceError('EXECUTION_FAILED', 'Governed runtime execution failed', {causeCode: row.error_code ?? 'EXECUTION_FAILED'})
    }
    throw new IntelligenceError('EXECUTION_FAILED', 'Governed runtime execution failed')
  }

  private principal(accountId: string, mission: IntelligenceMission) {
    return sessionPrincipal(accountId, mission.workspaceId)
  }

  private async settleStart(accountId: string, missionId: string, error: unknown) {
    const latest = await this.repository.ownedMission(accountId, missionId)
    if (latest.status === 'blocked' && error instanceof IntelligenceError && BLOCKED_WITHOUT_THROW.has(error.code)) {
      return this.repository.detail(accountId, missionId)
    }
    if (latest.status === 'cancelled') {
      return this.repository.detail(accountId, missionId)
    }
    if (error instanceof IntelligenceError) throw error
    if (!isTerminalMissionStatus(latest.status)) {
      throw new IntelligenceError('EXECUTION_FAILED', 'Governed intelligence request failed', {causeCode: intelligenceCode(error)})
    }
    throw new IntelligenceError('EXECUTION_FAILED', 'Governed intelligence request failed', {causeCode: intelligenceCode(error)})
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
