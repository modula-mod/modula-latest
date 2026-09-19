import type {IntelligencePrivacy} from '../contracts/privacy.js'
import type {IntelligenceExecutionLocation} from '../contracts/response.js'

export type RoutingPolicyDecision =
  | {action: 'prefer-local'; allowRemoteFallback: boolean}
  | {action: 'local-only'}
  | {action: 'allow-remote'}

/**
 * Deterministic Mission 01 routing rules — no cost/quality scoring yet.
 */
export function resolveRoutingPolicy(
  privacy: IntelligencePrivacy,
  remoteIntelligencePermitted: boolean,
): RoutingPolicyDecision {
  switch (privacy) {
    case 'local-only':
      return {action: 'local-only'}
    case 'prefer-local':
      return {
        action: 'prefer-local',
        allowRemoteFallback: remoteIntelligencePermitted,
      }
    case 'allow-remote':
      return {action: 'allow-remote'}
    default: {
      const _exhaustive: never = privacy
      return _exhaustive
    }
  }
}

export function isExecutionAllowed(
  execution: IntelligenceExecutionLocation,
  privacy: IntelligencePrivacy,
  remoteIntelligencePermitted: boolean,
): boolean {
  if (execution === 'local') return true
  if (privacy === 'local-only') return false
  if (privacy === 'prefer-local') return remoteIntelligencePermitted
  return true
}
