import type {GreenfieldAIUsageUnits} from '@modula/greenfield-contracts'
import type {ModulaDb} from '../database/client.js'
import {ProviderExecutionError} from './providers/contract.js'
import {AIProviderRuntimeRepository, normalizeUsageUnits, type SetAIUsageLimitInput} from './runtime-repository.js'

export type AIQuotaEvaluationInput = {
  accountId: string
  moduleId: string
  installationId?: string | null
  providerId?: string | null
  modelId?: string | null
  estimatedInputUnits: number
  requestedOutputUnits: number
}

export class GreenfieldAIQuotaService {
  private readonly repository: AIProviderRuntimeRepository

  constructor(db: ModulaDb) {
    this.repository = new AIProviderRuntimeRepository(db)
  }

  setLimit(input: SetAIUsageLimitInput): Promise<string> {
    return this.repository.setUsageLimit(input)
  }

  async assertWithinLimits(input: AIQuotaEvaluationInput): Promise<void> {
    const limits = await this.repository.activeLimits(input)
    const now = new Date()
    for (const limit of limits) {
      const units = unitsForPreflight(limit.limit_kind, limit.unit, input)
      if (units === undefined) continue
      const bucketStart = bucketStartFor(now, limit.window_seconds)
      const consumed = await this.repository.consumedUnits(limit, bucketStart)
      if (units > limit.limit_value || consumed + units > limit.limit_value) {
        throw new ProviderExecutionError(
          limit.limit_kind === 'concurrent-executions' ? 'AI_CONCURRENCY_LIMIT' : 'AI_QUOTA_EXCEEDED',
          `AI quota exceeded: ${limit.limit_kind}`,
          false,
        )
      }
    }
  }

  async recordUsage(input: AIQuotaEvaluationInput & {usage: GreenfieldAIUsageUnits}): Promise<void> {
    const limits = await this.repository.activeLimits(input)
    const now = new Date()
    const usage = normalizeUsageUnits(input.usage)
    for (const limit of limits) {
      const units = unitsForUsage(limit.unit, usage)
      if (units === undefined || units <= 0) continue
      const bucketStart = bucketStartFor(now, limit.window_seconds)
      await this.repository.consumeQuota({
        limit,
        units,
        bucketStart,
        bucketEnd: new Date(bucketStart.getTime() + limit.window_seconds * 1000),
        providerId: input.providerId,
        modelId: input.modelId,
        currency: usage.currency,
      })
    }
  }
}

function unitsForPreflight(
  limitKind: string,
  unit: string,
  input: AIQuotaEvaluationInput,
): number | undefined {
  if (limitKind === 'requests-per-minute' && unit === 'request') return 1
  if (limitKind === 'single-request-size' && unit === 'context-byte') return input.estimatedInputUnits
  if (limitKind === 'daily-input-units' && unit === 'input-token') return input.estimatedInputUnits
  if (limitKind === 'daily-output-units' && unit === 'output-token') return input.requestedOutputUnits
  return undefined
}

function unitsForUsage(unit: string, usage: GreenfieldAIUsageUnits): number | undefined {
  if (unit === 'request') return 1
  if (unit === 'input-token') return usage.inputTokens
  if (unit === 'output-token') return usage.outputTokens
  if (unit === 'minor-currency-unit') return usage.providerCostMinorUnits
  return undefined
}

function bucketStartFor(now: Date, windowSeconds: number): Date {
  if (windowSeconds >= 86_400) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  }
  const bucketMs = windowSeconds * 1000
  return new Date(Math.floor(now.getTime() / bucketMs) * bucketMs)
}
