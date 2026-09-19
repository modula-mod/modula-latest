import {IntelligenceError} from '../contracts/errors.js'
import type {IntelligenceCapability} from '../contracts/capability.js'
import type {IntelligenceProvider} from '../contracts/provider.js'
import type {IntelligenceExecutionLocation} from '../contracts/response.js'

const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/

export class IntelligenceProviderRegistry {
  private readonly providers = new Map<string, IntelligenceProvider>()

  register(provider: IntelligenceProvider): void {
    if (!provider.id || !PROVIDER_ID_PATTERN.test(provider.id)) {
      throw new IntelligenceError('INVALID_REQUEST', `Invalid provider ID: ${provider.id}`)
    }
    if (this.providers.has(provider.id)) {
      throw new IntelligenceError(
        'DUPLICATE_PROVIDER',
        `Provider already registered: ${provider.id}`,
        {providerId: provider.id},
      )
    }
    this.providers.set(provider.id, provider)
  }

  unregister(id: string): boolean {
    return this.providers.delete(id)
  }

  get(id: string): IntelligenceProvider | undefined {
    return this.providers.get(id)
  }

  list(): readonly IntelligenceProvider[] {
    return [...this.providers.values()]
  }

  listByExecution(execution: IntelligenceExecutionLocation): readonly IntelligenceProvider[] {
    return this.list().filter(provider => provider.execution === execution)
  }

  listByCapability(capability: IntelligenceCapability): readonly IntelligenceProvider[] {
    return this.list().filter(provider => provider.capabilities.includes(capability))
  }
}
