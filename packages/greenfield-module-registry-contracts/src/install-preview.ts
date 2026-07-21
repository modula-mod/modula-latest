export type GreenfieldModuleInstallPreview = {
  moduleId: string
  version: string
  compatible: boolean
  incompatibilityReasons: string[]
  trust: {
    level: string
    publisherStatus: string
    releaseStatus: string
  }
  license: {
    status: string
    spdx?: string
    evidenceSummary: string[]
  }
  permissions: Array<{
    permission: string
    reason: string
    risk: 'low' | 'medium' | 'high' | 'restricted'
  }>
  dependencies: Array<{
    moduleId: string
    requestedRange: string
    resolvedVersion: string | null
    installed: boolean
    optional: boolean
  }>
  contributions: {
    routes: number
    profileTabs: number
    boardSurfaces: number
    settings: number
    schemas: number
    tools: number
    functions: number
    widgets: number
    plugins: number
    connectors: number
  }
  migrationsRequired: boolean
  permissionIncrease: boolean
  dataDeletionRisk: boolean
}
