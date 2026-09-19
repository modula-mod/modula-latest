import {describe, expect, it, vi} from 'vitest'
import {
  DeterministicTestProvider,
  IntelligenceProviderRegistry,
  IntelligenceRouter,
} from '../src/index.js'
import type {
  IntelligenceAvailability,
  IntelligenceExecutionContext,
  IntelligenceProvider,
  IntelligenceRequest,
  IntelligenceResponse,
} from '../src/index.js'

describe('IntelligenceRouter privacy and routing', () => {
  it('local-only selects an available local provider', async () => {
    const providers = new IntelligenceProviderRegistry()
    providers.register(new DeterministicTestProvider())
    const router = new IntelligenceRouter({providers, remoteIntelligencePermitted: false})
    const result = await router.select('summarize', 'local-only')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.provider.id).toBe('modula.test.local')
      expect(result.provider.execution).toBe('local')
    }
  })

  it('local-only fails when only a remote provider exists', async () => {
    const providers = new IntelligenceProviderRegistry()
    providers.register(createRemoteProvider())
    const router = new IntelligenceRouter({providers, remoteIntelligencePermitted: true})
    const result = await router.select('summarize', 'local-only')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('NO_ELIGIBLE_PROVIDER')
    }
  })

  it('prefer-local selects local when available', async () => {
    const providers = new IntelligenceProviderRegistry()
    providers.register(new DeterministicTestProvider())
    providers.register(createRemoteProvider())
    const router = new IntelligenceRouter({providers, remoteIntelligencePermitted: true})
    const result = await router.select('summarize', 'prefer-local')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.provider.execution).toBe('local')
  })

  it('prefer-local may select remote when local unavailable and remote permitted', async () => {
    const providers = new IntelligenceProviderRegistry()
    const local = new DeterministicTestProvider()
    local.setAvailability({state: 'unavailable'})
    providers.register(local)
    providers.register(createRemoteProvider())
    const router = new IntelligenceRouter({providers, remoteIntelligencePermitted: true})
    const result = await router.select('summarize', 'prefer-local')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.provider.id).toBe('modula.test.remote')
      expect(result.provider.execution).toBe('remote')
    }
  })

  it('prefer-local forbids remote when settings disallow it', async () => {
    const providers = new IntelligenceProviderRegistry()
    const local = new DeterministicTestProvider()
    local.setAvailability({state: 'model-not-installed'})
    providers.register(local)
    providers.register(createRemoteProvider())
    const router = new IntelligenceRouter({providers, remoteIntelligencePermitted: false})
    const result = await router.select('summarize', 'prefer-local')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('REMOTE_EXECUTION_FORBIDDEN')
  })

  it('rejects unsupported capabilities', async () => {
    const providers = new IntelligenceProviderRegistry()
    providers.register(createRemoteProvider(['generate']))
    const router = new IntelligenceRouter({providers, remoteIntelligencePermitted: true})
    const result = await router.select('summarize', 'allow-remote')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CAPABILITY_UNSUPPORTED')
  })

  it('reports LOCAL_PROVIDER_UNAVAILABLE when local exists but is down under local-only', async () => {
    const providers = new IntelligenceProviderRegistry()
    const local = new DeterministicTestProvider()
    local.setAvailability({state: 'temporarily-unavailable'})
    providers.register(local)
    const router = new IntelligenceRouter({providers, remoteIntelligencePermitted: false})
    const result = await router.select('summarize', 'local-only')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('LOCAL_PROVIDER_UNAVAILABLE')
  })
})

function createRemoteProvider(
  capabilities: Array<'summarize' | 'generate'> = ['summarize'],
): IntelligenceProvider {
  const execute = vi.fn(
    async (
      _request: IntelligenceRequest,
      _context: IntelligenceExecutionContext,
    ): Promise<IntelligenceResponse> => {
      throw new Error('remote must not be selected unexpectedly')
    },
  )
  return {
    id: 'modula.test.remote',
    execution: 'remote',
    capabilities,
    async availability(): Promise<IntelligenceAvailability> {
      return {state: 'available'}
    },
    execute,
  }
}
