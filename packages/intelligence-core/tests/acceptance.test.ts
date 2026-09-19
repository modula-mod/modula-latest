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

/**
 * Mission 01 acceptance scenario:
 * 1) local-only with test provider succeeds with local provenance
 * 2) unregister local, leave only remote → NO_ELIGIBLE_PROVIDER, zero remote invocations
 */
describe('Mission 01 acceptance', () => {
  it('proves local-only fails closed with zero remote invocations', async () => {
    const remoteExecute = vi.fn(
      async (
        request: IntelligenceRequest,
        _context: IntelligenceExecutionContext,
      ): Promise<IntelligenceResponse> => ({
        requestId: request.id,
        output: 'LEAK',
        execution: 'remote',
        providerId: 'modula.test.remote',
        capability: request.capability,
      }),
    )

    const providers = new IntelligenceProviderRegistry()
    providers.register(new DeterministicTestProvider())
    const remote: IntelligenceProvider = {
      id: 'modula.test.remote',
      execution: 'remote',
      capabilities: ['summarize'],
      async availability(): Promise<IntelligenceAvailability> {
        return {state: 'available'}
      },
      execute: remoteExecute,
    }
    providers.register(remote)

    const ai = createModulaIntelligence({
      providers,
      remoteIntelligencePermitted: true,
    })

    const success = await ai.execute({
      capability: 'summarize',
      input: {text: 'Modula is a modular social operating system.'},
      privacy: 'local-only',
    })

    expect(success).toMatchObject({
      capability: 'summarize',
      providerId: 'modula.test.local',
      execution: 'local',
    })
    expect(remoteExecute).toHaveBeenCalledTimes(0)

    providers.unregister('modula.test.local')

    await expect(
      ai.execute({
        capability: 'summarize',
        input: {text: 'Modula is a modular social operating system.'},
        privacy: 'local-only',
      }),
    ).rejects.toMatchObject({code: 'NO_ELIGIBLE_PROVIDER'})

    expect(remoteExecute).toHaveBeenCalledTimes(0)
  })
})
