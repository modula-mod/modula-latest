import {runtimeEnvironment} from '@/config/runtimeEnvironment'

export type AppEnv = 'development' | 'preview' | 'production'

export type ModulaEnv = {
  appEnv: AppEnv
  apiUrl: string | null
}

/**
 * Compatibility wrapper for older Phase 1/2 call sites.
 * Runtime environment validation lives in src/config/runtimeEnvironment.ts.
 */
export function getEnv(): ModulaEnv {
  return {
    appEnv: runtimeEnvironment.appEnvironment,
    apiUrl: runtimeEnvironment.apiUrl,
  }
}

export const env = getEnv()
