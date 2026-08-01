import type {
  GreenfieldEngineProvider,
  GreenfieldResolvedModuleRuntimeSubject,
  GreenfieldRuntimeResolutionResult,
  GreenfieldRuntimeSession,
} from '@modula/greenfield-module-engine-contracts'

export type GreenfieldRuntimeProviderPreparationContext = {
  subject: GreenfieldResolvedModuleRuntimeSubject
  resolution: GreenfieldRuntimeResolutionResult
  session: GreenfieldRuntimeSession
}

export type GreenfieldRuntimeProviderPreparationResult = {
  ready: boolean
  metadata?: Record<string, string | number | boolean | null>
}

export interface GreenfieldRuntimeProviderAdapter {
  readonly provider: GreenfieldEngineProvider
  prepareSession?(
    context: GreenfieldRuntimeProviderPreparationContext,
  ): Promise<GreenfieldRuntimeProviderPreparationResult>
}

export function createMetadataOnlyAdapter(provider: GreenfieldEngineProvider): GreenfieldRuntimeProviderAdapter {
  return {provider}
}
