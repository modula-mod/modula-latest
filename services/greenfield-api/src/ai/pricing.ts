import type {GreenfieldAIUsageUnits} from '@modula/greenfield-contracts'

/**
 * Cost estimation for AI usage, from operator-set per-model pricing.
 *
 * Pricing lives in the model registry row's `limits` jsonb metadata:
 *
 *   { "inputPricePerMillionMinorUnits": 500, "outputPricePerMillionMinorUnits": 1500, "currency": "USD" }
 *
 * (minor units are cents for USD: 500 minor units per 1M input tokens =
 * $5.00 per 1M input tokens.) The operator sets it when configuring a real
 * model via `/v1/admin/ai/models`. The seeded general models ship without
 * pricing, so cost is unknown for them until an operator sets it.
 *
 * When pricing is unknown, cost is NOT accrued and a monthly budget does not
 * bind for that model. That is a documented limitation, not a silent pass:
 * budgets only bite where the operator has priced the model. Adapters never
 * invent prices, and providers do not return cost in their responses.
 */
export type ModelPricingMetadata = {
  inputPricePerMillionMinorUnits?: number
  outputPricePerMillionMinorUnits?: number
  currency?: string
}

export function parseModelPricing(limits: unknown): ModelPricingMetadata | undefined {
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return undefined
  const record = limits as Record<string, unknown>
  const input = record.inputPricePerMillionMinorUnits
  const output = record.outputPricePerMillionMinorUnits
  const currency = typeof record.currency === 'string' ? record.currency : undefined
  if (typeof input !== 'number' && typeof output !== 'number') return undefined
  return {
    inputPricePerMillionMinorUnits: typeof input === 'number' && Number.isFinite(input) && input >= 0 ? input : undefined,
    outputPricePerMillionMinorUnits: typeof output === 'number' && Number.isFinite(output) && output >= 0 ? output : undefined,
    currency,
  }
}

export function estimateCostMinorUnits(usage: GreenfieldAIUsageUnits, pricing: ModelPricingMetadata | undefined): {providerCostMinorUnits?: number; currency?: string} {
  if (!pricing) return {}
  const inputCost = usage.inputTokens !== undefined && pricing.inputPricePerMillionMinorUnits !== undefined
    ? Math.round((usage.inputTokens * pricing.inputPricePerMillionMinorUnits) / 1_000_000)
    : 0
  const outputCost = usage.outputTokens !== undefined && pricing.outputPricePerMillionMinorUnits !== undefined
    ? Math.round((usage.outputTokens * pricing.outputPricePerMillionMinorUnits) / 1_000_000)
    : 0
  if (inputCost === 0 && outputCost === 0) return {}
  return {providerCostMinorUnits: inputCost + outputCost, currency: pricing.currency ?? 'USD'}
}
