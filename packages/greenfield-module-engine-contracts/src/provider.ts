import type {GreenfieldRuntimeCapability} from './capability.js'
import type {GreenfieldEngineKind} from './engine-kind.js'
import type {GreenfieldRuntimeReasonCode} from './reason-code.js'

export type GreenfieldRuntimePlatform = 'ios' | 'android' | 'web' | 'server'

export type GreenfieldProviderStatus =
  | 'available'
  | 'not-configured'
  | 'unavailable'
  | 'disabled'
  | 'degraded'
  | 'quarantined'
  | 'failed'

export type GreenfieldProviderTrust = 'trusted-host' | 'trusted-first-party' | 'metadata-only' | 'untrusted'

export type GreenfieldResourceProfile = {
  memoryMb?: number
  cpuUnits?: number
  gpuRequired?: boolean
  storageMb?: number
  networkBudget?: 'none' | 'low' | 'standard' | 'high'
  backgroundExecution?: boolean
  batteryImpact?: 'low' | 'medium' | 'high'
}

export type GreenfieldEngineProvider = {
  providerId: string
  displayName: string
  engineKind: GreenfieldEngineKind
  trust: GreenfieldProviderTrust
  status: GreenfieldProviderStatus
  apiVersion: string
  capabilities: GreenfieldRuntimeCapability[]
  supportedPlatforms: GreenfieldRuntimePlatform[]
  launchable: boolean
  nativeBuildRequired: boolean
  resourceProfile?: GreenfieldResourceProfile
  reasonCodes?: GreenfieldRuntimeReasonCode[]
}

export type GreenfieldSelectedRuntimeProvider = {
  providerId: string
  engineKind: GreenfieldEngineKind
  apiVersion: string
  status: GreenfieldProviderStatus
  capabilities: GreenfieldRuntimeCapability[]
}

export function isTrustedRuntimeProvider(provider: GreenfieldEngineProvider): boolean {
  return provider.trust === 'trusted-host' || provider.trust === 'trusted-first-party'
}

export function isProviderLaunchable(provider: GreenfieldEngineProvider): boolean {
  return isTrustedRuntimeProvider(provider) && provider.launchable && ['available', 'degraded'].includes(provider.status)
}
