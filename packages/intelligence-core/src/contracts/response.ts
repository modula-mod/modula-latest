import type {IntelligenceCapability} from './capability.js'

export type IntelligenceExecutionLocation = 'local' | 'remote'

/**
 * Provenance is always visible. Chain-of-thought and raw prompts are never
 * part of this contract. Persistence of inputs/outputs is not automatic.
 */
export type IntelligenceResponse<TOutput = unknown> = {
  requestId: string
  output: TOutput
  execution: IntelligenceExecutionLocation
  providerId: string
  capability: IntelligenceCapability
  durationMs?: number
}
