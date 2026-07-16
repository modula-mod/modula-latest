import type {RuntimeEnvironment} from '@/config/runtimeEnvironment'

export const SESSION_BOOTSTRAP_TIMEOUT_MS = 5000

export function shouldBootstrapOwner(environment: RuntimeEnvironment): boolean {
  return environment.appEnvironment !== 'production' && environment.demoSession === 'owner'
}
