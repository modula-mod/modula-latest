import type {GreenfieldExtensionStatus} from './extension-installation.js'

export type GreenfieldExtensionLifecycleEvent =
  | 'installRequested'
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'configurationChanged'
  | 'updateRequested'
  | 'updated'
  | 'uninstallRequested'
  | 'uninstalled'
  | 'failed'

export type GreenfieldExtensionLifecycleRecord = {
  eventId: string
  accountId: string
  extensionId: string
  event: GreenfieldExtensionLifecycleEvent
  fromStatus: GreenfieldExtensionStatus | null
  toStatus: GreenfieldExtensionStatus | null
  detail: string | null
  createdAt: string
}

/**
 * Phase 6S rules:
 * - only first-party extensions may execute
 * - verified extensions remain disabled unless explicitly approved
 * - community manifests are catalogue-only
 * - untrusted manifests cannot execute
 * - module contracts do not install module code yet
 */
export type GreenfieldExtensionExecutionPolicy = {
  mayInstall: boolean
  mayEnable: boolean
  mayExecute: boolean
  reason: string | null
}
