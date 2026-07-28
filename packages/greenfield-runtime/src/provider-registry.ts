import type {GreenfieldEngineKind, GreenfieldEngineProvider, GreenfieldProviderStatus} from '@modula/greenfield-module-engine-contracts'
import type {GreenfieldRuntimeProviderAdapter} from './provider-adapter.js'

export class GreenfieldRuntimeProviderRegistry {
  private readonly adapters = new Map<string, GreenfieldRuntimeProviderAdapter>()

  register(adapter: GreenfieldRuntimeProviderAdapter): void {
    const {provider} = adapter
    if (!provider.providerId || !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(provider.providerId)) {
      throw new Error(`Invalid runtime provider ID: ${provider.providerId}`)
    }
    if (this.adapters.has(provider.providerId)) {
      throw new Error(`Runtime provider already registered: ${provider.providerId}`)
    }
    this.adapters.set(provider.providerId, adapter)
  }

  registerMany(adapters: readonly GreenfieldRuntimeProviderAdapter[]): void {
    for (const adapter of adapters) this.register(adapter)
  }

  get(providerId: string): GreenfieldRuntimeProviderAdapter | undefined {
    return this.adapters.get(providerId)
  }

  list(): GreenfieldEngineProvider[] {
    return [...this.adapters.values()].map(adapter => adapter.provider)
  }

  candidatesForKind(kind: GreenfieldEngineKind): GreenfieldRuntimeProviderAdapter[] {
    return [...this.adapters.values()].filter(adapter => adapter.provider.engineKind === kind)
  }

  setStatus(providerId: string, status: GreenfieldProviderStatus): void {
    const current = this.adapters.get(providerId)
    if (!current) throw new Error(`Runtime provider not found: ${providerId}`)
    this.adapters.set(providerId, {...current, provider: {...current.provider, status}})
  }
}
