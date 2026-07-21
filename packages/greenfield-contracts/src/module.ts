/**
 * Host-facing module manifest boundary only.
 * Module implementations (e.g. Vault Notes) remain in separate repositories.
 */

export type GreenfieldModuleUninstallBehaviour = 'retainData' | 'purgeData' | 'exportThenPurge'

export type GreenfieldModuleRouteContribution = {
  path: string
  title: string
  capability?: string
}

export type GreenfieldModuleProfileTabContribution = {
  tabId: string
  title: string
  route: string
}

export type GreenfieldModuleBoardSurfaceContribution = {
  surfaceId: string
  title: string
}

export type GreenfieldModuleSettingsContribution = {
  settingsId: string
  title: string
  route: string
}

export type GreenfieldModuleManifest = {
  moduleId: string
  name: string
  description?: string
  /** Separately distributed package identity */
  repositoryUrl: string
  packageVersion: string
  hostCompatibility: {
    minimumHostVersion: string
    maximumHostVersion?: string
  }
  routes?: GreenfieldModuleRouteContribution[]
  profileTabs?: GreenfieldModuleProfileTabContribution[]
  boardSurfaces?: GreenfieldModuleBoardSurfaceContribution[]
  settings?: GreenfieldModuleSettingsContribution[]
  functions?: string[]
  tools?: string[]
  widgets?: string[]
  schemas?: string[]
  capabilities: string[]
  permissions: string[]
  migrationMetadata?: Record<string, string>
  uninstallBehaviour: GreenfieldModuleUninstallBehaviour
}
