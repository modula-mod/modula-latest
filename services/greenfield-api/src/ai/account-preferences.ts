import type {GreenfieldAIProviderRoutingStrategy} from '@modula/greenfield-contracts'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {moduleError} from '../modules/module-errors.js'
import {GreenfieldAIQuotaService} from './quota-service.js'

export const CLOUD_ROUTING_STRATEGIES: readonly GreenfieldAIProviderRoutingStrategy[] = [
  'fixed',
  'capability-first',
  'cost-aware',
  'latency-aware',
  'privacy-first',
  'local-first',
]

export const MONTHLY_BUDGET_WINDOW_SECONDS = 30 * 24 * 60 * 60

export type AIAccountPreferences = {
  accountId: string
  /** Cloud providers may be selected for this account. Default false: fail-closed to local. */
  allowRemoteCloud: boolean
  defaultRoutingStrategy: GreenfieldAIProviderRoutingStrategy
  preferredProviderId: string | null
  /** Monthly cloud spend budget in minor currency units (cents for USD). Null = no budget. */
  monthlyBudgetMinorUnits: number | null
  updatedAt: Date | null
}

export const DEFAULT_AI_ACCOUNT_PREFERENCES: Omit<AIAccountPreferences, 'accountId' | 'updatedAt'> = {
  allowRemoteCloud: false,
  defaultRoutingStrategy: 'local-first',
  preferredProviderId: null,
  monthlyBudgetMinorUnits: null,
}

export class AIAccountPreferencesService {
  private readonly audit: AuditRepository
  private readonly quotas: GreenfieldAIQuotaService

  constructor(private readonly db: ModulaDb) {
    this.audit = new AuditRepository(db)
    this.quotas = new GreenfieldAIQuotaService(db)
  }

  async getPreferences(accountId: string): Promise<AIAccountPreferences> {
    const row = await this.db
      .selectFrom('greenfield_ai_account_preferences')
      .selectAll()
      .where('account_id', '=', accountId)
      .executeTakeFirst()
    if (!row) return {accountId, ...DEFAULT_AI_ACCOUNT_PREFERENCES, updatedAt: null}
    return {
      accountId: row.account_id,
      allowRemoteCloud: row.allow_remote_cloud,
      defaultRoutingStrategy: toRoutingStrategy(row.default_routing_strategy),
      preferredProviderId: row.preferred_provider_id,
      monthlyBudgetMinorUnits: row.monthly_budget_minor_units,
      updatedAt: row.updated_at,
    }
  }

  async setPreferences(input: {
    accountId: string
    allowRemoteCloud?: boolean
    defaultRoutingStrategy?: GreenfieldAIProviderRoutingStrategy
    preferredProviderId?: string | null
    monthlyBudgetMinorUnits?: number | null
    actorId?: string | null
    requestId?: string | null
    correlationId?: string | null
  }): Promise<AIAccountPreferences> {
    const current = await this.getPreferences(input.accountId)
    const next: AIAccountPreferences = {
      accountId: input.accountId,
      allowRemoteCloud: input.allowRemoteCloud ?? current.allowRemoteCloud,
      defaultRoutingStrategy: input.defaultRoutingStrategy ?? current.defaultRoutingStrategy,
      preferredProviderId: input.preferredProviderId !== undefined ? input.preferredProviderId : current.preferredProviderId,
      monthlyBudgetMinorUnits: input.monthlyBudgetMinorUnits !== undefined ? input.monthlyBudgetMinorUnits : current.monthlyBudgetMinorUnits,
      updatedAt: new Date(),
    }
    validatePreferences(next)
    await this.assertPreferredProviderExists(next.preferredProviderId)
    const actorId = input.actorId ?? await this.actorIdForAccount(input.accountId)
    const now = new Date()
    await this.db
      .insertInto('greenfield_ai_account_preferences')
      .values({
        account_id: next.accountId,
        allow_remote_cloud: next.allowRemoteCloud,
        default_routing_strategy: next.defaultRoutingStrategy,
        preferred_provider_id: next.preferredProviderId,
        monthly_budget_minor_units: next.monthlyBudgetMinorUnits,
        created_at: now,
        updated_at: now,
      })
      .onConflict(conflict => conflict.column('account_id').doUpdateSet({
        allow_remote_cloud: next.allowRemoteCloud,
        default_routing_strategy: next.defaultRoutingStrategy,
        preferred_provider_id: next.preferredProviderId,
        monthly_budget_minor_units: next.monthlyBudgetMinorUnits,
        updated_at: now,
      }))
      .execute()
    await this.syncMonthlyBudgetLimit(next)
    await this.audit.append(
      'ai.account.preferences.updated',
      {
        accountId: next.accountId,
        allowRemoteCloud: next.allowRemoteCloud,
        defaultRoutingStrategy: next.defaultRoutingStrategy,
        preferredProviderId: next.preferredProviderId,
        monthlyBudgetMinorUnits: next.monthlyBudgetMinorUnits,
      },
      {type: 'aiAccountPreferences', id: next.accountId, actorId},
      {accountId: next.accountId, requestId: input.requestId ?? null, correlationId: input.correlationId ?? input.requestId ?? null},
    )
    return next
  }

  private async assertPreferredProviderExists(preferredProviderId: string | null): Promise<void> {
    if (preferredProviderId === null) return
    const row = await this.db
      .selectFrom('greenfield_ai_providers')
      .select('provider_id')
      .where('provider_id', '=', preferredProviderId)
      .executeTakeFirst()
    if (!row) throw moduleError('VALIDATION_FAILED', `Unknown AI provider: ${preferredProviderId}`)
  }

  private async actorIdForAccount(accountId: string): Promise<string | null> {
    const row = await this.db.selectFrom('actors').select('id').where('account_id', '=', accountId).orderBy('created_at', 'asc').executeTakeFirst()
    return row?.id ?? null
  }

  /**
   * The monthly budget is a normal quota limit row, so the existing quota
   * preflight enforces it. A null budget disables the row instead of
   * deleting it, so spend history stays auditable.
   */
  private async syncMonthlyBudgetLimit(preferences: AIAccountPreferences): Promise<void> {
    await this.quotas.setLimit({
      limitId: `ai-limit-monthly-spend:${preferences.accountId}`,
      scopeType: 'account',
      scopeId: preferences.accountId,
      limitKind: 'estimated-spend',
      unit: 'minor-currency-unit',
      windowSeconds: MONTHLY_BUDGET_WINDOW_SECONDS,
      limitValue: preferences.monthlyBudgetMinorUnits ?? 0,
      enabled: preferences.monthlyBudgetMinorUnits !== null,
      metadata: {source: 'ai-account-preferences'},
    })
  }
}

function toRoutingStrategy(value: string): GreenfieldAIProviderRoutingStrategy {
  return (CLOUD_ROUTING_STRATEGIES as readonly string[]).includes(value)
    ? value as GreenfieldAIProviderRoutingStrategy
    : 'local-first'
}

function validatePreferences(preferences: AIAccountPreferences): void {
  if (!CLOUD_ROUTING_STRATEGIES.includes(preferences.defaultRoutingStrategy)) {
    throw moduleError('VALIDATION_FAILED', `Unknown AI routing strategy: ${preferences.defaultRoutingStrategy}`)
  }
  if (preferences.preferredProviderId !== null && preferences.preferredProviderId.trim().length === 0) {
    throw moduleError('VALIDATION_FAILED', 'Preferred AI provider must be a non-empty provider id or null')
  }
  if (preferences.monthlyBudgetMinorUnits !== null &&
    (!Number.isInteger(preferences.monthlyBudgetMinorUnits) || preferences.monthlyBudgetMinorUnits <= 0)) {
    throw moduleError('VALIDATION_FAILED', 'Monthly AI budget must be a positive integer number of minor currency units or null')
  }
}
