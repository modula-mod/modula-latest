import type {
  GreenfieldAIModelCapability,
  GreenfieldAIModelRegistryEntry,
  GreenfieldAIProviderDefinition,
  GreenfieldAIProviderRoutingStrategy,
  ResolvedAIExecutionTarget,
} from '@modula/greenfield-contracts'
import type {ModulaDb} from '../../database/client.js'
import {moduleError} from '../../modules/module-errors.js'
import {GreenfieldAIRepository} from '../repository.js'
import {AIProviderRuntimeRepository} from '../runtime-repository.js'

export type GreenfieldAIProviderResolutionInput = {
  requiredCapabilities: GreenfieldAIModelCapability[]
  preferredModelId?: string
  preferredProviderId?: string
  permittedProviders?: string[]
  routingStrategy?: GreenfieldAIProviderRoutingStrategy
  structuredOutput?: boolean
  streaming?: boolean
  openCircuitDurationMs?: number
}

type Candidate = {
  provider: GreenfieldAIProviderDefinition
  model: GreenfieldAIModelRegistryEntry
  score: number
  reason: string
}

export class GreenfieldAIProviderResolver {
  private readonly repository: GreenfieldAIRepository
  private readonly runtime: AIProviderRuntimeRepository

  constructor(db: ModulaDb) {
    this.repository = new GreenfieldAIRepository(db)
    this.runtime = new AIProviderRuntimeRepository(db)
  }

  async resolve(input: GreenfieldAIProviderResolutionInput): Promise<ResolvedAIExecutionTarget> {
    const models = input.preferredModelId
      ? [await this.repository.requireModel(input.preferredModelId)]
      : await this.repository.listModels()
    const permittedProviders = input.permittedProviders?.length ? new Set(input.permittedProviders) : null
    const candidates: Candidate[] = []
    for (const model of models) {
      if (!model.enabled || model.availability !== 'available' || model.lifecycleStatus === 'retired') continue
      if (input.structuredOutput && !model.supportsStructuredOutputs) continue
      if (input.streaming && !model.supportsStreaming) continue
      if (!capabilitiesSatisfied(model, input.requiredCapabilities)) continue
      const provider = await this.repository.requireProvider(model.providerId)
      if (provider.status !== 'available') continue
      if (provider.configurationMode === 'disabled') continue
      if (permittedProviders && !permittedProviders.has(provider.providerId)) continue
      if (input.preferredProviderId && input.routingStrategy === 'fixed' && provider.providerId !== input.preferredProviderId) continue
      const health = await this.runtime.latestProviderHealth(provider.providerId, model.modelId)
      if (health?.state === 'disabled' || health?.state === 'authentication-failed' || health?.state === 'unavailable' || health?.state === 'rate-limited') continue
      const circuitAllowed = await this.runtime.circuitAllows(provider.providerId, model.modelId, input.openCircuitDurationMs ?? 60_000)
      if (!circuitAllowed) continue
      candidates.push(scoreCandidate(provider, model, input.routingStrategy ?? 'capability-first', input.preferredModelId, input.preferredProviderId))
    }
    candidates.sort((a, b) => b.score - a.score || a.provider.providerId.localeCompare(b.provider.providerId) || a.model.modelId.localeCompare(b.model.modelId))
    const target = candidates[0]
    if (!target) throw moduleError('CAPABILITY_DISABLED', 'No AI provider model satisfies the requested capabilities')
    return {
      providerId: target.provider.providerId,
      modelId: target.model.modelId,
      reason: target.reason,
      fallbackTargets: candidates.slice(1, 4).map(candidate => ({
        providerId: candidate.provider.providerId,
        modelId: candidate.model.modelId,
      })),
    }
  }
}

function scoreCandidate(
  provider: GreenfieldAIProviderDefinition,
  model: GreenfieldAIModelRegistryEntry,
  strategy: GreenfieldAIProviderRoutingStrategy,
  preferredModelId?: string,
  preferredProviderId?: string,
): Candidate {
  let score = 0
  const reasons: string[] = [`strategy:${strategy}`]
  if (preferredModelId && model.modelId === preferredModelId) {
    score += 1000
    reasons.push('preferred-model')
  }
  if (preferredProviderId && provider.providerId === preferredProviderId) {
    score += 500
    reasons.push('preferred-provider')
  }
  if (strategy === 'local-first' && isLocalProvider(provider)) {
    score += 250
    reasons.push('local-provider')
  }
  if (strategy === 'fixed' && preferredModelId && model.modelId !== preferredModelId) score -= 1000
  score += model.capabilities.length
  if (model.supportsStructuredOutputs) score += 10
  if (model.supportsStreaming) score += 5
  return {provider, model, score, reason: reasons.join(',')}
}

function isLocalProvider(provider: GreenfieldAIProviderDefinition): boolean {
  return provider.kind === 'ollama' ||
    provider.kind === 'local' ||
    provider.configurationMode === 'local' ||
    provider.configurationMode === 'local-runtime' ||
    provider.configurationMode === 'development-mock'
}

function capabilitiesSatisfied(model: GreenfieldAIModelRegistryEntry, requiredCapabilities: readonly string[]): boolean {
  const capabilities = new Set(model.capabilities)
  for (const capability of requiredCapabilities) {
    if (capability === 'streaming' && model.supportsStreaming) continue
    if (capability === 'structured-output' && model.supportsStructuredOutputs) continue
    if (capability === 'reasoning' && model.supportsReasoning) continue
    if (capability === 'vision' && model.supportsVision) continue
    if (capability === 'image-generation' && model.supportsImageGeneration) continue
    if (capability === 'embeddings' && model.supportsEmbeddings) continue
    if (capability === 'audio' && model.supportsAudio) continue
    if (!capabilities.has(capability as GreenfieldAIModelCapability)) return false
  }
  return true
}
