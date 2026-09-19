import type {IntelligenceCapability} from './capability.js'
import type {IntelligencePrivacy} from './privacy.js'

/**
 * Request metadata must stay structural — never put note bodies, prompts,
 * or other personal content here.
 */
export type IntelligenceRequestMetadata = {
  source?: 'module' | 'host' | 'system' | 'test'
  moduleId?: string
  feature?: string
}

export type IntelligenceRequest<TInput = unknown> = {
  id: string
  capability: IntelligenceCapability
  input: TInput
  privacy: IntelligencePrivacy
  /** Explicitly registered tool IDs the caller authorizes for this request. */
  tools?: readonly string[]
  metadata?: IntelligenceRequestMetadata
}

export type IntelligenceExecuteInput<TInput = unknown> = {
  capability: IntelligenceCapability
  input: TInput
  privacy: IntelligencePrivacy
  id?: string
  tools?: readonly string[]
  metadata?: IntelligenceRequestMetadata
}
