import {IntelligenceError, isTerminalMissionStatus, type ApprovalStatus, type IntelligenceApprovalQueueItem, type IntelligenceLedgerEvent, type IntelligenceListPage, type IntelligenceMission, type IntelligenceMissionStatus} from '@modula/intelligence-contracts'
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

  /**
   * Paginated missions list for the native missions screen. `status`
   * filters to one mission status; `limit` defaults to 25 (max 100);
   * `cursor` is the opaque offset returned as `nextCursor`. Invalid
   * values fail with INVALID_ACTION_SCHEMA (HTTP 400), like the other
   * input validation on this service.
   */
  listMissionsPage(accountId: string, query: {status?: unknown; limit?: unknown; cursor?: unknown}): Promise<IntelligenceListPage<IntelligenceMission>> {
    return this.repository.listMissionsPage(accountId, {status: missionStatusFilter(query.status), limit: pageLimit(query.limit, 25), offset: pageCursor(query.cursor)})
  }

  /**
   * Paginated Ledger for the native Ledger view. `order` is `asc`
   * (chronological, the historical default) or `desc` (newest first);
   * `limit` defaults to 50 (max 100) — a full single-step mission cycle
   * is ~15–20 events, so one page normally holds the whole Ledger.
   */
  ledgerPage(accountId: string, missionId: string, query: {limit?: unknown; cursor?: unknown; order?: unknown}): Promise<IntelligenceListPage<IntelligenceLedgerEvent>> {
    return this.repository.ledgerPage(accountId, missionId, {limit: pageLimit(query.limit, 50), offset: pageCursor(query.cursor), order: ledgerOrder(query.order)})
  }

  /**
   * Cross-mission approvals queue for the native approvals screen.
   * `status` defaults to `pending` (the queue that needs action);
   * `limit` defaults to 25 (max 100). Ordered oldest-first so the
   * approval closest to its 24h expiry is on top.
   */
  approvalsQueue(accountId: string, query: {status?: unknown; limit?: unknown; cursor?: unknown}): Promise<IntelligenceListPage<IntelligenceApprovalQueueItem>> {
    return this.repository.listApprovalsQueue(accountId, {status: approvalStatusFilter(query.status, 'pending'), limit: pageLimit(query.limit, 25), offset: pageCursor(query.cursor)})
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
    const mission = await this.repository.ownedMission(accountId, missionId)
    await this.repository.proposal(missionId, proposalId)
    if (mission.status === 'cancelled') {
      throw new IntelligenceError('INVALID_MISSION_STATE', 'Mission cannot execute from cancelled')
    }
    const existing = await this.repository.getExecution(proposalId)
    if (existing?.status === 'completed' && existing.mission_id === missionId) {
      return {idempotent: true, executionId: existing.execution_id, result: existing.result}
    }
    try {
      await this.runtime.execute(this.principal(accountId, mission), missionId, proposalId)
    } catch (error) {
      if (error instanceof IntelligenceError) throw error
      throw new IntelligenceError('EXECUTION_FAILED', 'Governed runtime execution failed', {causeCode: intelligenceCode(error)})
    }
    const row = await this.repository.getExecution(proposalId)
    if (row?.status === 'completed' && row.mission_id === missionId) {
      return {idempotent: false, executionId: row.execution_id, result: row.result}
    }
    if (row?.status === 'failed' && row.mission_id === missionId) {
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

const MISSION_STATUSES: readonly IntelligenceMissionStatus[] = ['draft', 'planning', 'awaiting_verification', 'awaiting_authorization', 'awaiting_approval', 'running', 'completed', 'failed', 'cancelled', 'blocked']
const APPROVAL_STATUSES: readonly ApprovalStatus[] = ['pending', 'approved', 'rejected', 'expired', 'cancelled']

/** UI pagination: `limit` defaults when absent, clamps to 100, rejects non-positive integers. Mirrors the records-service `clampLimit` contract. */
function pageLimit(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) throw new IntelligenceError('INVALID_ACTION_SCHEMA', 'limit must be a positive integer')
  return Math.min(parsed, 100)
}

/** UI pagination: the cursor is the opaque offset string from `nextCursor`. Absent means the first page. */
function pageCursor(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new IntelligenceError('INVALID_ACTION_SCHEMA', 'cursor must be a non-negative integer offset')
  return parsed
}

function missionStatusFilter(value: unknown): IntelligenceMissionStatus | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !(MISSION_STATUSES as readonly string[]).includes(value)) throw new IntelligenceError('INVALID_ACTION_SCHEMA', `Unknown mission status: ${String(value)}`)
  return value as IntelligenceMissionStatus
}

function approvalStatusFilter(value: unknown, fallback: ApprovalStatus): ApprovalStatus {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string' || !(APPROVAL_STATUSES as readonly string[]).includes(value)) throw new IntelligenceError('INVALID_ACTION_SCHEMA', `Unknown approval status: ${String(value)}`)
  return value as ApprovalStatus
}

function ledgerOrder(value: unknown): 'asc' | 'desc' {
  if (value === undefined || value === null || value === '') return 'asc'
  if (value === 'asc' || value === 'desc') return value
  throw new IntelligenceError('INVALID_ACTION_SCHEMA', 'order must be asc or desc')
}
