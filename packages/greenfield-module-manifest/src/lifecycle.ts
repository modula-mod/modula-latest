export const GREENFIELD_MODULE_EXECUTION_MODES = ['declarative', 'builtIn', 'backgroundJob', 'remoteHttp'] as const

export type GreenfieldModuleExecutionMode = (typeof GREENFIELD_MODULE_EXECUTION_MODES)[number]

export type GreenfieldModuleLifecycleManifest = {
  executionMode: GreenfieldModuleExecutionMode
  installHook?: string
  enableHook?: string
  disableHook?: string
  updateHook?: string
  uninstallHook?: string
}

export function executionModeEnabledByDefault(mode: GreenfieldModuleExecutionMode): boolean {
  return mode === 'declarative' || mode === 'builtIn' || mode === 'backgroundJob'
}
