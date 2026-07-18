export type GreenfieldExtensionStatus =
  | 'available'
  | 'installing'
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'needsConfiguration'
  | 'failed'
  | 'updateAvailable'
  | 'incompatible'
  | 'removed'

export type GreenfieldExtensionInstallation = {
  installationId: string
  accountId: string
  extensionId: string
  version: string
  status: GreenfieldExtensionStatus
  configuration: Record<string, unknown>
  failureCode: string | null
  failureMessage: string | null
  installedAt: string
  updatedAt: string
  uninstalledAt: string | null
}

export type GreenfieldExtensionInstallInput = {
  idempotencyKey: string
}

export type GreenfieldExtensionConfigurationInput = {
  configuration: Record<string, unknown>
  expectedVersion?: string
}
