import {moduleError} from '../../modules/module-errors.js'
import type {GreenfieldAIProviderAdapter} from './contract.js'
import {MockGreenfieldAIProviderAdapter} from './mock-provider.js'
import {OllamaGreenfieldAIProviderAdapter} from './ollama-provider.js'
import {OpenAIGreenfieldAIProviderAdapter} from './openai-provider.js'

export class GreenfieldAIProviderAdapterRegistry {
  private readonly adapters = new Map<string, GreenfieldAIProviderAdapter>()

  register(adapter: GreenfieldAIProviderAdapter): void {
    this.adapters.set(adapter.providerId, adapter)
  }

  require(providerId: string): GreenfieldAIProviderAdapter {
    const adapter = this.adapters.get(providerId)
    if (!adapter) throw moduleError('CAPABILITY_DISABLED', `AI provider adapter is not registered: ${providerId}`)
    return adapter
  }

  list(): GreenfieldAIProviderAdapter[] {
    return Array.from(this.adapters.values()).sort((a, b) => a.providerId.localeCompare(b.providerId))
  }
}

export function createDefaultProviderAdapterRegistry(input: {allowDevelopmentMock?: boolean} = {}): GreenfieldAIProviderAdapterRegistry {
  const registry = new GreenfieldAIProviderAdapterRegistry()
  if (input.allowDevelopmentMock) {
    registry.register(new MockGreenfieldAIProviderAdapter('provider:development-mock'))
  }
  registry.register(new OpenAIGreenfieldAIProviderAdapter('provider:openai'))
  registry.register(new OllamaGreenfieldAIProviderAdapter('provider:ollama'))
  registry.register(new OllamaGreenfieldAIProviderAdapter('provider:local'))
  return registry
}
