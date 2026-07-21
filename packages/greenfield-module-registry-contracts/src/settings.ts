export type GreenfieldModuleSecretReference = {
  secretRef: string
  provider: string
  scope: 'account' | 'installation' | 'team'
  createdAt: string
  rotatedAt: string | null
}

export type GreenfieldModuleSettingValue =
  | string
  | number
  | boolean
  | null
  | GreenfieldModuleSecretReference
  | GreenfieldModuleSettingValue[]
  | {[key: string]: GreenfieldModuleSettingValue}

export type GreenfieldModuleSettingsDocument = {
  moduleId: string
  installationId: string
  version: number
  schemaVersion: number
  values: Record<string, GreenfieldModuleSettingValue>
  updatedAt: string
}

export type GreenfieldModuleSettingsSecretResponse = {
  configured: boolean
  secretRef: string
  updatedAt: string
}
