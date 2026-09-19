import type {IntelligenceAvailability} from '../contracts/availability.js'
import type {IntelligenceCapability} from '../contracts/capability.js'
import type {IntelligenceProvider, IntelligenceExecutionContext} from '../contracts/provider.js'
import type {IntelligenceRequest} from '../contracts/request.js'
import type {IntelligenceResponse} from '../contracts/response.js'
import {IntelligenceError} from '../contracts/errors.js'

export const DETERMINISTIC_TEST_PROVIDER_ID = 'modula.test.local'

const SUPPORTED_CAPABILITIES: readonly IntelligenceCapability[] = [
  'generate',
  'rewrite',
  'summarize',
  'classify',
  'extract',
  'intent',
  'tool-call',
]

/**
 * In-process fixture provider for architectural verification only.
 * Never masquerades as a real model. No network. No weights.
 */
export class DeterministicTestProvider implements IntelligenceProvider {
  readonly id = DETERMINISTIC_TEST_PROVIDER_ID
  readonly execution = 'local' as const
  readonly capabilities = SUPPORTED_CAPABILITIES

  private availabilityState: IntelligenceAvailability = {state: 'available'}

  setAvailability(availability: IntelligenceAvailability): void {
    this.availabilityState = availability
  }

  async availability(): Promise<IntelligenceAvailability> {
    return this.availabilityState
  }

  async execute(
    request: IntelligenceRequest,
    context: IntelligenceExecutionContext,
  ): Promise<IntelligenceResponse> {
    if (context.signal?.aborted) {
      throw new IntelligenceError('REQUEST_CANCELLED', 'Intelligence request was cancelled', {
        requestId: request.id,
      })
    }

    if (!this.capabilities.includes(request.capability)) {
      throw new IntelligenceError(
        'CAPABILITY_UNSUPPORTED',
        `Test provider does not support ${request.capability}`,
        {capability: request.capability},
      )
    }

    const started = Date.now()
    const output = fixtureFor(request.capability, request.input)

    if (context.signal?.aborted) {
      throw new IntelligenceError('REQUEST_CANCELLED', 'Intelligence request was cancelled', {
        requestId: request.id,
      })
    }

    return {
      requestId: request.id,
      output,
      execution: 'local',
      providerId: this.id,
      capability: request.capability,
      durationMs: Date.now() - started,
    }
  }
}

function fixtureFor(capability: IntelligenceCapability, input: unknown): unknown {
  switch (capability) {
    case 'summarize':
      return {summary: 'Test summary', source: 'modula.test.local'}
    case 'rewrite':
      return {text: 'Test rewrite', source: 'modula.test.local'}
    case 'generate':
      return {text: 'Test generation', source: 'modula.test.local'}
    case 'classify':
      return {label: 'test', confidence: 1, source: 'modula.test.local'}
    case 'extract':
      return {items: [], source: 'modula.test.local'}
    case 'intent':
      return {intent: 'test', source: 'modula.test.local'}
    case 'tool-call':
      return {
        toolCalls: [],
        note: 'Deterministic test provider does not invent tools',
        echoInputType: typeof input,
        source: 'modula.test.local',
      }
    default: {
      const _exhaustive: never = capability
      return _exhaustive
    }
  }
}
