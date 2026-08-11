import type {RuntimeEnvironment} from '@/config/runtimeEnvironment'

/** Tunnel / Simulator cold starts regularly exceed 5s for refresh. */
export const SESSION_BOOTSTRAP_TIMEOUT_MS = 25000

export function shouldBootstrapOwner(environment: RuntimeEnvironment): boolean {
  return environment.appEnvironment !== 'production' && environment.demoSession === 'owner'
}
