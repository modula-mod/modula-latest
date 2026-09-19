import {describe, expect, it, vi} from 'vitest'
import {
  createModulaIntelligence,
  DeterministicTestProvider,
  IntelligenceProviderRegistry,
} from '../src/index.js'
import type {
  IntelligenceAvailability,
  IntelligenceExecutionContext,
  IntelligenceProvider,
  IntelligenceRequest,
  IntelligenceResponse,
} from '../src/index.js'

describe('Privacy enforcement', () => {
  it('local-only + local provider → local executes', async () => {
    const ai = createModulaIntelligence()
    ai.providers.register(new DeterministicTestProvider())
    const result = await ai.execute({
      capability: 'summarize',
      input: 'Example',
      privacy: 'local-only',
    })
    expect(result.execution).toBe('local')
    expect(result.providerId).toBe('modula.test.local')
  })

  it('local-only + only remote → fails and never calls remote execute', async () => {
    const execute = vi.fn()
    const remote = createSpyRemote(execute)
    const providers = new IntelligenceProviderRegistry()
    providers.register(remote)
    const ai = createModulaIntelligence({providers, remoteIntelligencePermitted: true})

    await expect(
      ai.execute({capability: 'summarize', input: 'Example', privacy: 'local-only'}),
    ).rejects.toMatchObject({code: 'NO_ELIGIBLE_PROVIDER'})
    expect(execute).not.toHaveBeenCalled()
  })

  it('prefer-local + local available → local executes', async () => {
    const execute = vi.fn()
    const providers = new IntelligenceProviderRegistry()
    providers.register(new DeterministicTestProvider())
    providers.register(createSpyRemote(execute))
    const ai = createModulaIntelligence({providers, remoteIntelligencePermitted: true})
    const result = await ai.execute({
      capability: 'summarize',
      input: 'Example',
      privacy: 'prefer-local',
    })
    expect(result.execution).toBe('local')
    expect(execute).not.toHaveBeenCalled()
  })

  it('prefer-local + local unavailable + remote permitted → remote may execute', async () => {
    const execute = vi.fn(
      async (
        request: IntelligenceRequest,
        _context: IntelligenceExecutionContext,
      ): Promise<IntelligenceResponse> => ({
        requestId: request.id,
        output: {summary: 'Remote fixture'},
        execution: 'remote',
        providerId: 'modula.test.remote',
        capability: request.capability,
      }),
    )
    const local = new DeterministicTestProvider()
    local.setAvailability({state: 'offline'})
    const providers = new IntelligenceProviderRegistry()
    providers.register(local)
    providers.register(createSpyRemote(execute))
    const ai = createModulaIntelligence({providers, remoteIntelligencePermitted: true})
    const result = await ai.execute({
      capability: 'summarize',
      input: 'Example',
      privacy: 'prefer-local',
    })
    expect(result.execution).toBe('remote')
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('has no hidden remote fallback path under local-only when both are registered', async () => {
    const execute = vi.fn()
    const providers = new IntelligenceProviderRegistry()
    const local = new DeterministicTestProvider()
    local.setAvailability({state: 'disabled'})
    providers.register(local)
    providers.register(createSpyRemote(execute))
    const ai = createModulaIntelligence({providers, remoteIntelligencePermitted: true})

    await expect(
      ai.execute({capability: 'summarize', input: 'Example', privacy: 'local-only'}),
    ).rejects.toMatchObject({code: 'LOCAL_PROVIDER_UNAVAILABLE'})
    expect(execute).toHaveBeenCalledTimes(0)
  })
})

function createSpyRemote(
  execute: IntelligenceProvider['execute'],
): IntelligenceProvider {
  return {
    id: 'modula.test.remote',
    execution: 'remote',
    capabilities: ['summarize'],
    async availability(): Promise<IntelligenceAvailability> {
      return {state: 'available'}
    },
    execute,
  }
}
