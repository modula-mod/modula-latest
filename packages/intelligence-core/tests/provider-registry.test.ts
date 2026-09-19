import {describe, expect, it} from 'vitest'
import {
  DeterministicTestProvider,
  IntelligenceError,
  IntelligenceProviderRegistry,
} from '../src/index.js'
import type {IntelligenceAvailability, IntelligenceProvider, IntelligenceRequest, IntelligenceExecutionContext, IntelligenceResponse} from '../src/index.js'

describe('IntelligenceProviderRegistry', () => {
  it('registers and looks up providers', () => {
    const registry = new IntelligenceProviderRegistry()
    const provider = new DeterministicTestProvider()
    registry.register(provider)
    expect(registry.get(provider.id)).toBe(provider)
    expect(registry.list()).toHaveLength(1)
  })

  it('rejects duplicate IDs', () => {
    const registry = new IntelligenceProviderRegistry()
    registry.register(new DeterministicTestProvider())
    expect(() => registry.register(new DeterministicTestProvider())).toThrow(IntelligenceError)
    try {
      registry.register(new DeterministicTestProvider())
    } catch (error) {
      expect(error).toBeInstanceOf(IntelligenceError)
      expect((error as IntelligenceError).code).toBe('DUPLICATE_PROVIDER')
    }
  })

  it('unregisters providers', () => {
    const registry = new IntelligenceProviderRegistry()
    registry.register(new DeterministicTestProvider())
    expect(registry.unregister('modula.test.local')).toBe(true)
    expect(registry.get('modula.test.local')).toBeUndefined()
  })

  it('filters by capability', () => {
    const registry = new IntelligenceProviderRegistry()
    registry.register(new DeterministicTestProvider())
    registry.register(createRemoteStub(['summarize']))
    expect(registry.listByCapability('summarize')).toHaveLength(2)
    expect(registry.listByCapability('tool-call')).toHaveLength(1)
  })
})

function createRemoteStub(capabilities: Array<'summarize' | 'generate'>): IntelligenceProvider {
  return {
    id: 'modula.test.remote',
    execution: 'remote',
    capabilities,
    async availability(): Promise<IntelligenceAvailability> {
      return {state: 'available'}
    },
    async execute(
      _request: IntelligenceRequest,
      _context: IntelligenceExecutionContext,
    ): Promise<IntelligenceResponse> {
      throw new Error('remote stub should not execute in registry tests')
    },
  }
}
