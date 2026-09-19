import {isProviderAvailable} from '../contracts/availability.js'
import {IntelligenceError} from '../contracts/errors.js'
import type {IntelligenceCapability} from '../contracts/capability.js'
import type {IntelligencePrivacy} from '../contracts/privacy.js'
import type {IntelligenceProvider} from '../contracts/provider.js'
import type {IntelligenceProviderRegistry} from '../providers/ProviderRegistry.js'
import {resolveRoutingPolicy} from './routing-policy.js'
import type {IntelligenceRoutingResult} from './routing-result.js'

export type IntelligenceRouterOptions = {
  providers: IntelligenceProviderRegistry
  remoteIntelligencePermitted: boolean
}

type Candidate = {
  provider: IntelligenceProvider
  available: boolean
  supportsCapability: boolean
}

/**
 * Selection only — never inference. Fail closed for local-only.
 */
export class IntelligenceRouter {
  constructor(private readonly options: IntelligenceRouterOptions) {}

  async select(
    capability: IntelligenceCapability,
    privacy: IntelligencePrivacy,
  ): Promise<IntelligenceRoutingResult> {
    const policy = resolveRoutingPolicy(
      privacy,
      this.options.remoteIntelligencePermitted,
    )
    const candidates = await this.collectCandidates(capability)

    const localEligible = candidates.filter(
      c => c.provider.execution === 'local' && c.supportsCapability && c.available,
    )
    const remoteEligible = candidates.filter(
      c => c.provider.execution === 'remote' && c.supportsCapability && c.available,
    )

    if (policy.action === 'local-only') {
      if (localEligible.length > 0) {
        return {
          ok: true,
          provider: localEligible[0]!.provider,
          reason: 'local-only: selected available local provider',
        }
      }

      const hadLocalCapability = candidates.some(
        c => c.provider.execution === 'local' && c.supportsCapability,
      )
      if (hadLocalCapability) {
        return {
          ok: false,
          code: 'LOCAL_PROVIDER_UNAVAILABLE',
          reason: 'local-only: local provider exists but is not available',
        }
      }

      // Remote providers must never be selected under local-only — even if present.
      return {
        ok: false,
        code: 'NO_ELIGIBLE_PROVIDER',
        reason: 'local-only: no eligible local provider; remote providers are ineligible',
      }
    }

    if (policy.action === 'prefer-local') {
      if (localEligible.length > 0) {
        return {
          ok: true,
          provider: localEligible[0]!.provider,
          reason: 'prefer-local: selected available local provider',
        }
      }
      if (policy.allowRemoteFallback && remoteEligible.length > 0) {
        return {
          ok: true,
          provider: remoteEligible[0]!.provider,
          reason: 'prefer-local: local unavailable; remote permitted by settings',
        }
      }
      if (!policy.allowRemoteFallback && remoteEligible.length > 0) {
        return {
          ok: false,
          code: 'REMOTE_EXECUTION_FORBIDDEN',
          reason: 'prefer-local: remote providers exist but settings forbid remote intelligence',
        }
      }
      return {
        ok: false,
        code: 'NO_ELIGIBLE_PROVIDER',
        reason: 'prefer-local: no eligible provider',
      }
    }

    // allow-remote: still prefer local when available (simple deterministic policy).
    if (localEligible.length > 0) {
      return {
        ok: true,
        provider: localEligible[0]!.provider,
        reason: 'allow-remote: preferred available local provider',
      }
    }
    if (remoteEligible.length > 0) {
      return {
        ok: true,
        provider: remoteEligible[0]!.provider,
        reason: 'allow-remote: selected available remote provider',
      }
    }

    const anyCapability = candidates.some(c => c.supportsCapability)
    if (!anyCapability) {
      return {
        ok: false,
        code: 'CAPABILITY_UNSUPPORTED',
        reason: `No registered provider supports capability: ${capability}`,
      }
    }

    return {
      ok: false,
      code: 'NO_ELIGIBLE_PROVIDER',
      reason: 'allow-remote: no available provider for capability',
    }
  }

  private async collectCandidates(capability: IntelligenceCapability): Promise<Candidate[]> {
    const providers = this.options.providers.list()
    const results: Candidate[] = []
    for (const provider of providers) {
      const supportsCapability = provider.capabilities.includes(capability)
      let available = false
      if (supportsCapability) {
        try {
          const availability = await provider.availability()
          available = isProviderAvailable(availability)
        } catch {
          available = false
        }
      }
      results.push({provider, available, supportsCapability})
    }
    return results
  }
}

export function routingFailureToError(result: Extract<IntelligenceRoutingResult, {ok: false}>): IntelligenceError {
  return new IntelligenceError(result.code, result.reason)
}
