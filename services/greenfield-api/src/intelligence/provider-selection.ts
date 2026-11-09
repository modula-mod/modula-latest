import {IntelligenceError} from '@modula/intelligence-contracts'
import {
  DETERMINISTIC_TEST_PROVIDER_ID,
  DeterministicTestProvider,
  IntelligenceProviderRegistry,
  IntelligenceRouter,
} from '@modula/intelligence-core'

export const DETERMINISTIC_TEST_ADAPTER_STATUS = 'deterministic-test-adapter' as const
export const DETERMINISTIC_TEST_ADAPTER_LIMITATION =
  'No Nodus-backed provider is registered. DeterministicTestProvider is a test adapter, not a live model.'

export type GovernedProviderSelection = {
  planner: 'deterministic-test-v0'
  router: 'selection-only'
  selectedProviderId: string
  selectedProviderExecution: 'local' | 'remote'
  modelProviderStatus: typeof DETERMINISTIC_TEST_ADAPTER_STATUS | 'registered-provider'
  limitation?: string
}

export function createGovernedIntelligenceRouter(existing?: IntelligenceProviderRegistry) {
  const providers = existing ?? new IntelligenceProviderRegistry()
  const hasRegisteredProvider = providers.list().some(provider => provider.id !== DETERMINISTIC_TEST_PROVIDER_ID)
  if (!hasRegisteredProvider && !providers.get(DETERMINISTIC_TEST_PROVIDER_ID)) {
    providers.register(new DeterministicTestProvider())
  }
  return {
    providers,
    router: new IntelligenceRouter({providers, remoteIntelligencePermitted: false}),
  }
}

export async function selectGovernedIntelligenceProvider(router: IntelligenceRouter): Promise<GovernedProviderSelection> {
  const routing = await router.select('tool-call', 'local-only')
  if (!routing.ok) {
    throw new IntelligenceError('CAPABILITY_UNKNOWN', routing.reason, {routerCode: routing.code})
  }
  const isTestAdapter = routing.provider.id === DETERMINISTIC_TEST_PROVIDER_ID
  return {
    planner: 'deterministic-test-v0',
    router: 'selection-only',
    selectedProviderId: routing.provider.id,
    selectedProviderExecution: routing.provider.execution,
    modelProviderStatus: isTestAdapter ? DETERMINISTIC_TEST_ADAPTER_STATUS : 'registered-provider',
    ...(isTestAdapter ? {limitation: DETERMINISTIC_TEST_ADAPTER_LIMITATION} : {}),
  }
}
