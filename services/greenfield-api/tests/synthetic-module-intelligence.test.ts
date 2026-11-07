import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'
import {
  DETERMINISTIC_TEST_PROVIDER_ID,
  DeterministicTestProvider,
  IntelligenceProviderRegistry,
} from '@modula/intelligence-core'
import {
  DETERMINISTIC_TEST_ADAPTER_LIMITATION,
  DETERMINISTIC_TEST_ADAPTER_STATUS,
  createGovernedIntelligenceRouter,
  selectGovernedIntelligenceProvider,
} from '../src/intelligence/provider-selection.js'

const boundarySource = readFileSync(new URL('../src/intelligence/action-boundary.ts', import.meta.url), 'utf8')
const serviceSource = readFileSync(new URL('../src/intelligence/service.ts', import.meta.url), 'utf8')

describe('generic intelligence discovery and router selection', () => {
  it('discovers record.query from authorized collections rather than hardcoded product IDs', () => {
    expect(boundarySource).toContain('collectionsForRelease')
    expect(boundarySource).toContain('collectionPermission')
    expect(boundarySource).toContain("family: 'record.query'")
    expect(boundarySource).not.toContain('digital.modula.vault-notes')
    expect(boundarySource).not.toContain('RECENT_VAULT_NOTES')
    expect(serviceSource).toContain('selectGovernedIntelligenceProvider')
    expect(serviceSource).toContain('this.boundary.availableActions')
  })

  it('selects the deterministic test adapter through IntelligenceRouter and never presents it as a live model', async () => {
    const {router, providers} = createGovernedIntelligenceRouter()
    expect(providers.get(DETERMINISTIC_TEST_PROVIDER_ID)).toBeInstanceOf(DeterministicTestProvider)
    const selection = await selectGovernedIntelligenceProvider(router)
    expect(selection).toMatchObject({
      planner: 'deterministic-test-v0',
      router: 'selection-only',
      selectedProviderId: DETERMINISTIC_TEST_PROVIDER_ID,
      selectedProviderExecution: 'local',
      modelProviderStatus: DETERMINISTIC_TEST_ADAPTER_STATUS,
      limitation: DETERMINISTIC_TEST_ADAPTER_LIMITATION,
    })
    expect(selection.modelProviderStatus).toBe(DETERMINISTIC_TEST_ADAPTER_STATUS)
    expect(selection.modelProviderStatus).not.toBe('live-model')
  })

  it('prefers a registered non-test provider when one is available', async () => {
    const providers = new IntelligenceProviderRegistry()
    providers.register({
      id: 'test.modula.registered-local',
      execution: 'local',
      capabilities: ['tool-call'],
      availability: async () => ({state: 'available'}),
      execute: async () => {
        throw new Error('selection-only test stub must not execute')
      },
    })
    const selection = await selectGovernedIntelligenceProvider(createGovernedIntelligenceRouter(providers).router)
    expect(selection.selectedProviderId).toBe('test.modula.registered-local')
    expect(selection.modelProviderStatus).toBe('registered-provider')
    expect(selection.limitation).toBeUndefined()
  })
})
