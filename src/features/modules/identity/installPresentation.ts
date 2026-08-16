import type {ModuleInstallationState, ModulePriceState} from '@/data/repositories/contracts'
import {isVaultNotesModuleId} from '@modula/greenfield-contracts'

export type ModuleInstallPresentation = {
  installable: boolean
  customerStatus: string
  primaryAction: 'Install' | 'Open' | 'Enable' | 'Update' | 'Soon' | 'Can’t install on this device'
  /** Classification for B5 Vault Notes “Not available” / “Permission required”. */
  source:
    | 'OK'
    | 'STALE_REGISTRY_PROJECTION'
    | 'CLIENT_STATE_BUG'
    | 'INSTALLATION_STATE_BUG'
    | 'VERSION_MISMATCH'
    | 'CAPABILITY_MISMATCH'
    | 'OLD_RELEASE'
    | 'WRONG_ACCOUNT_STATE'
    | 'PRESENTATION_BUG'
}

const INSTALLED: ModuleInstallationState[] = [
  'installed',
  'enabled',
  'disabled',
  'updateAvailable',
  'configurationRequired',
]

export function isInstalledModuleState(state: ModuleInstallationState): boolean {
  return INSTALLED.includes(state)
}

/**
 * Never show “Not available” or “Permission required” for an installable product.
 * Canonical Vault Notes is installable when published unless quarantined/incompatible.
 */
export function resolveModuleInstallPresentation(input: {
  moduleId: string
  installable: boolean
  installationState: ModuleInstallationState
  priceState?: ModulePriceState
  latestVersion?: string | null
}): ModuleInstallPresentation {
  const {moduleId, installationState, priceState, latestVersion} = input
  const vault = isVaultNotesModuleId(moduleId)
  const comingSoon = installationState === 'comingSoon' || priceState === 'Coming soon'
  const blocked =
    installationState === 'quarantined' ||
    installationState === 'incompatible'
  const installed = isInstalledModuleState(installationState)

  let installable = input.installable
  let source: ModuleInstallPresentation['source'] = 'OK'

  if (vault && !installed && !blocked && !comingSoon) {
    if (!installable || installationState === 'notAvailable' || priceState === 'Not available') {
      installable = Boolean(latestVersion) || installable || installationState === 'available'
      source = !input.installable ? 'CLIENT_STATE_BUG' : 'PRESENTATION_BUG'
      if (installationState === 'notAvailable' && latestVersion) source = 'STALE_REGISTRY_PROJECTION'
    }
  }

  if (installed) {
    return {
      installable: true,
      customerStatus: installationState === 'updateAvailable' ? 'Update available' : 'Installed',
      primaryAction:
        installationState === 'updateAvailable'
          ? 'Update'
          : installationState === 'disabled' || installationState === 'installed'
            ? 'Enable'
            : 'Open',
      source: 'OK',
    }
  }

  if (comingSoon) {
    return {
      installable: false,
      customerStatus: 'Soon',
      primaryAction: 'Soon',
      source: 'OK',
    }
  }

  if (blocked) {
    return {
      installable: false,
      customerStatus:
        installationState === 'quarantined'
          ? 'Security review required'
          : 'Requires newer Modula version',
      primaryAction: 'Can’t install on this device',
      source: 'CAPABILITY_MISMATCH',
    }
  }

  if (installable || installationState === 'available' || vault) {
    return {
      installable: true,
      customerStatus: 'Available',
      primaryAction: 'Install',
      source,
    }
  }

  return {
    installable: false,
    customerStatus: 'Can’t install on this device',
    primaryAction: 'Can’t install on this device',
    source: 'CAPABILITY_MISMATCH',
  }
}
