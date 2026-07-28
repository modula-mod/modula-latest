import type {GreenfieldEngineRequirement} from './requirement.js'
import type {GreenfieldRuntimeReasonCode} from './reason-code.js'
import type {GreenfieldSelectedRuntimeProvider} from './provider.js'

export type GreenfieldRuntimeCompatibility = 'compatible' | 'degraded' | 'blocked'

export type GreenfieldLaunchPermission = 'allowed' | 'degraded-only' | 'denied'

export type GreenfieldNativeBuildRequirement = 'not-required' | 'required' | 'unavailable'

export type GreenfieldUnresolvedEngineRequirement = {
  requirementId: string
  kind: GreenfieldEngineRequirement['kind']
  capabilities: string[]
  reasonCodes: GreenfieldRuntimeReasonCode[]
}

export type GreenfieldRuntimeResolutionResult = {
  accountId: string
  moduleId: string
  releaseId: string
  compatibility: GreenfieldRuntimeCompatibility
  launchPermission: GreenfieldLaunchPermission
  selectedProviders: GreenfieldSelectedRuntimeProvider[]
  unresolvedRequirements: GreenfieldUnresolvedEngineRequirement[]
  requiredPermissions: string[]
  deniedCapabilities: string[]
  nativeBuildRequirement: GreenfieldNativeBuildRequirement
  degradedModeEligible: boolean
  reasonCodes: GreenfieldRuntimeReasonCode[]
}

export function canLaunchRuntimeResolution(result: GreenfieldRuntimeResolutionResult): boolean {
  return result.launchPermission === 'allowed' || result.launchPermission === 'degraded-only'
}
