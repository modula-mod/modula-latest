export type GreenfieldModuleInstallPreview = {
  moduleId: string
  version: string
  productKind?: 'module' | 'addon' | 'plugin' | 'function' | 'tool' | 'widget' | 'connector' | 'service'
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
    provides: string | null
    relation: 'requires' | 'optional' | 'recommended' | 'conflicts' | 'replaces'
    requestedRange: string
    resolvedVersion: string | null
    resolvedModuleId: string | null
    installed: boolean
    optional: boolean
    blocking: boolean
    satisfied: boolean
    reason?: string
  }>
  dependencyWarnings?: string[]
  extensionTargets?: Array<{
    productId: string
    versionRange: string
    installedVersion: string | null
    installed: boolean
    compatible: boolean
    requiredCapabilities: string[]
    requiredExtensionPoints: string[]
  }>
  extensionContributions?: Array<{
    id: string
    kind: string
    extensionPoint: string
    requiredCapability: string | null
  }>
  provides?: Array<{id: string; title: string; version: string; kind: 'service' | 'api' | 'record' | 'capability' | 'engine' | 'integration' | 'ui'}>
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
    jobs: number
    events: number
  }
  migrationsRequired: boolean
  permissionIncrease: boolean
  dataDeletionRisk: boolean
}
