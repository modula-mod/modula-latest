import {describe, expect, it, vi} from 'vitest'
import {
  createModulaIntelligence,
  DeterministicTestProvider,
  IntelligenceError,
  IntelligenceProviderRegistry,
} from '../src/index.js'
import type {
  IntelligenceAvailability,
  IntelligenceExecutionContext,
  IntelligenceProvider,
  IntelligenceRequest,
  IntelligenceResponse,
} from '../src/index.js'

describe('ModulaIntelligence execution', () => {
  it('executes deterministic local provider with provenance', async () => {
    const ai = createModulaIntelligence()
    ai.providers.register(new DeterministicTestProvider())

    const result = await ai.execute({
      capability: 'summarize',
      input: {text: 'Modula is a modular social operating system.'},
      privacy: 'local-only',
      metadata: {source: 'module', moduleId: 'vault-notes', feature: 'mission-01'},
    })

    expect(result.providerId).toBe('modula.test.local')
    expect(result.execution).toBe('local')
    expect(result.capability).toBe('summarize')
    expect(result.requestId).toMatch(/^intel_/)
    expect(result.output).toEqual({summary: 'Test summary', source: 'modula.test.local'})
  })

  it('supports AbortSignal cancellation', async () => {
    const ai = createModulaIntelligence()
    ai.providers.register(new DeterministicTestProvider())
    const controller = new AbortController()
    controller.abort()

    await expect(
      ai.execute(
        {capability: 'summarize', input: {text: 'x'}, privacy: 'local-only'},
        {signal: controller.signal},
      ),
    ).rejects.toMatchObject({code: 'REQUEST_CANCELLED'})
  })

  it('throws typed failures for empty registries under local-only', async () => {
    const ai = createModulaIntelligence()
    await expect(
      ai.execute({capability: 'summarize', input: {}, privacy: 'local-only'}),
    ).rejects.toBeInstanceOf(IntelligenceError)

    try {
      await ai.execute({capability: 'summarize', input: {}, privacy: 'local-only'})
    } catch (error) {
      expect((error as IntelligenceError).code).toBe('NO_ELIGIBLE_PROVIDER')
    }
  })

  it('records structural diagnostics without request content', async () => {
    const events: Array<{requestId: string; status: string; errorCode?: string}> = []
    const ai = createModulaIntelligence({
      onDiagnostic: event => {
        events.push({
          requestId: event.requestId,
          status: event.status,
          errorCode: event.errorCode,
        })
      },
    })
    ai.providers.register(new DeterministicTestProvider())
    await ai.execute({
      capability: 'summarize',
      input: {secret: 'must-not-appear-in-diagnostics'},
      privacy: 'local-only',
    })
    const snapshot = await ai.getDiagnostics()
    expect(snapshot.networkRequired).toBe(false)
    expect(snapshot.core).toBe('ready')
    expect(JSON.stringify(events)).not.toContain('must-not-appear-in-diagnostics')
    expect(JSON.stringify(snapshot)).not.toContain('must-not-appear-in-diagnostics')
  })

  it('never invokes remote execute under local-only (acceptance)', async () => {
    const execute = vi.fn(
      async (
        _request: IntelligenceRequest,
        _context: IntelligenceExecutionContext,
      ): Promise<IntelligenceResponse> => ({
        requestId: 'should-not-run',
        output: 'remote',
        execution: 'remote',
        providerId: 'modula.test.remote',
        capability: 'summarize',
      }),
    )

    const remote: IntelligenceProvider = {
      id: 'modula.test.remote',
      execution: 'remote',
      capabilities: ['summarize'],
      async availability(): Promise<IntelligenceAvailability> {
        return {state: 'available'}
      },
      execute,
    }

    const providers = new IntelligenceProviderRegistry()
    providers.register(remote)
    const ai = createModulaIntelligence({
      providers,
      remoteIntelligencePermitted: true,
    })

    await expect(
      ai.execute({
        capability: 'summarize',
        input: {text: 'Modula is a modular social operating system.'},
        privacy: 'local-only',
      }),
    ).rejects.toMatchObject({code: 'NO_ELIGIBLE_PROVIDER'})

    expect(execute).toHaveBeenCalledTimes(0)
  })
})
