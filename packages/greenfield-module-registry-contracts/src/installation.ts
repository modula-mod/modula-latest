export type GreenfieldModuleInstallationStatus =
  | 'notInstalled'
  | 'resolving'
  | 'permissionReview'
  | 'installing'
  | 'installedDisabled'
  | 'enabling'
  | 'enabled'
  | 'disabling'
  | 'disabled'
  | 'updating'
  | 'updateAvailable'
  | 'incompatible'
  | 'uninstalling'
  | 'failed'
  | 'quarantined'
  | 'removed'

export const GREENFIELD_MODULE_INSTALLATION_TRANSITIONS: Record<GreenfieldModuleInstallationStatus, GreenfieldModuleInstallationStatus[]> = {
  notInstalled: ['resolving'],
  resolving: ['permissionReview', 'failed'],
  permissionReview: ['installing', 'failed'],
  installing: ['installedDisabled', 'failed'],
  installedDisabled: ['enabling', 'updating', 'quarantined', 'uninstalling'],
  enabling: ['enabled', 'failed', 'quarantined'],
  enabled: ['disabling', 'updating', 'updateAvailable', 'incompatible', 'quarantined', 'uninstalling'],
  disabling: ['disabled', 'failed', 'quarantined'],
  disabled: ['enabling', 'updating', 'updateAvailable', 'incompatible', 'quarantined', 'uninstalling'],
  updating: ['enabled', 'disabled', 'installedDisabled', 'failed', 'quarantined'],
  updateAvailable: ['updating', 'enabled', 'disabled', 'incompatible', 'uninstalling'],
  incompatible: ['disabled', 'updateAvailable', 'uninstalling'],
  uninstalling: ['removed', 'failed'],
  failed: ['resolving', 'uninstalling', 'quarantined'],
  quarantined: ['uninstalling'],
  removed: [],
}

export function canTransitionInstallation(
  from: GreenfieldModuleInstallationStatus,
  to: GreenfieldModuleInstallationStatus,
): boolean {
  return GREENFIELD_MODULE_INSTALLATION_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertInstallationTransition(
  from: GreenfieldModuleInstallationStatus,
  to: GreenfieldModuleInstallationStatus,
): void {
  if (!canTransitionInstallation(from, to)) {
    throw Object.assign(new Error(`Invalid module installation transition ${from} -> ${to}`), {code: 'INVALID_INSTALLATION_TRANSITION'})
  }
}

export type GreenfieldModuleInstallation = {
  installationId: string
  accountId: string
  moduleId: string
  version: string
  status: GreenfieldModuleInstallationStatus
  enabledAt: string | null
  updatedAt: string
}
