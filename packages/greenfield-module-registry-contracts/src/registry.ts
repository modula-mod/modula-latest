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
  standard?: GreenfieldRegistryStandardMetadata
}

export type GreenfieldRegistryStandardMetadata = {
  manifestVersion: number | null
  standardVersion: string | null
  sectionVersions: Record<string, string>
  dependencies: Record<'requires' | 'optional' | 'recommended' | 'conflicts' | 'replaces' | 'provides', number>
  registries: {
    services: number
    apis: number
    hooks: number
    jobs: number
    storage: number
    widgets: number
    navigation: number
    ui: number
    automation: number
    metrics: number
  }
  capabilityFlags: Record<string, boolean>
  capabilities: string[]
  engines: string[]
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
