import type {GreenfieldModulePlatform} from '@modula/greenfield-module-manifest'
import type {GreenfieldModuleReleaseStatus} from './release.js'

export type GreenfieldRegistryModuleSummary = {
  moduleId: string
  name: string
  description: string
  publisherId: string
  publisherName: string
  latestVersion: string | null
  trustLevel: string
  licenseStatus: string
  status: GreenfieldModuleReleaseStatus | 'planned' | 'inactive' | 'unavailable'
  installable: boolean
  platforms: GreenfieldModulePlatform[]
}

export type GreenfieldRegistryFilter = {
  q?: string
  publisher?: string
  trust?: string
  platform?: GreenfieldModulePlatform
  status?: string
  compatible?: boolean
  capability?: string
  limit?: number
  cursor?: string
}
