import type {
  GreenfieldModuleAction,
  GreenfieldModuleFieldDefinition,
  GreenfieldModuleView,
} from '@modula/greenfield-module-ui-contracts'

export type ProductHubExtensionKind =
  | 'module'
  | 'tool'
  | 'function'
  | 'plugin'
  | 'connector'
  | 'widget'
  | 'system'

export type ProductHubCategory =
  | 'All'
  | 'Productivity'
  | 'Social'
  | 'Creator'
  | 'Media'
  | 'Automation'
  | 'AI'
  | 'Developer'
  | 'First-party'
  | 'Installed'
  | 'Compatible'

export type ModuleInstallationState =
  | 'available'
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'updateAvailable'
  | 'configurationRequired'
  | 'incompatible'
  | 'quarantined'
  | 'comingSoon'
  | 'notAvailable'

export type ModulePriceState = 'Free' | 'Included' | 'Coming soon' | 'Not available'

export type ModuleBackendMode =
  | 'greenfield-managed'
  | 'module-managed'
  | 'hybrid'
  | 'frontend-only'

export type ModuleBackendMetadata = {
  mode: ModuleBackendMode
  provider: string
  deploymentOwnership: string
  dataLocation: string
  regions: string[]
  status: string
  protocolVersion?: string | null
  endpoint?: string | null
  selfHostingSupported: boolean
  externalDataProcessing: boolean
  backendPermissions: string[]
}

export type ModuleCatalogueItem = {
  moduleId: string
  name: string
  description: string
  publisherId: string
  publisherName: string
  kind: ProductHubExtensionKind
  category: ProductHubCategory
  trustLevel: string
  latestVersion: string | null
  compatibility: string
  installable: boolean
  installationState: ModuleInstallationState
  priceState: ModulePriceState
  featured?: boolean
}

export type ModuleDetail = ModuleCatalogueItem & {
  longDescription: string
  backend: ModuleBackendMetadata
  permissions: {permission: string; reason: string; risk: 'low' | 'medium' | 'high' | 'restricted'}[]
  contributions: Record<string, unknown>
  sourceRepository?: string
  sourceCommit?: string
  manifestChecksum?: string
  releaseChecksum?: string | null
  releaseNotes?: string[]
  privacy?: string
}

export type InstalledModule = {
  installationId: string
  moduleId: string
  version: string
  status: string
  publisherName?: string
  name?: string
  health?: string
  updateState?: string
  configurationState?: string
}

export type ModuleInstallPreview = {
  moduleId: string
  version: string
  compatible: boolean
  incompatibilityReasons: string[]
  trust: {level: string; publisherStatus: string; releaseStatus: string}
  permissions: ModuleDetail['permissions']
  dependencies: unknown[]
  contributions: Record<string, number>
  migrationsRequired: boolean
  permissionIncrease: boolean
}

export type ModuleUninstallPreview = {
  moduleId: string
  version: string
  dependantModules: unknown[]
  recordCount: number
  activeJobs: unknown[]
  registeredContributions: unknown[]
  dataChoices: ('keepData' | 'exportThenDelete' | 'deleteData')[]
  defaultChoice: 'keepData'
}

export type ModuleRuntimeView = GreenfieldModuleView & {
  allowedActions?: GreenfieldModuleAction[]
  available?: boolean
}

export type ModuleRecord = {
  record_id: string
  recordId?: string
  module_id?: string
  moduleId?: string
  collection: string
  data: Record<string, unknown>
  revision: number
  visibility: string
  created_at?: string
  updated_at?: string
  createdAt?: string
  updatedAt?: string
}

export type ModuleRecordPage = {
  moduleId: string
  collection: string
  items: ModuleRecord[]
  nextCursor: string | null
  limit: number
}

export type ModuleContribution = {
  moduleId: string
  version: string
  type: string
  id: string
  manifest: Record<string, unknown>
  available: boolean
  disabledReason: string | null
  installationStatus: string
}

export type ModuleSettingsDocument = {
  moduleId: string
  installationId: string
  version: number
  values: Record<string, unknown>
}

export type ModuleSettingsSchema = {
  moduleId: string
  version: string
  fields: GreenfieldModuleFieldDefinition[]
  defaults: Record<string, unknown>
}

export type ModuleHealth = {
  moduleId: string
  version: string
  overall: string
  runtime?: Record<string, unknown>
  searchProjection?: Record<string, unknown>
  exports?: Record<string, unknown>
  diagnostics?: Record<string, unknown>
}

export interface ModuleRepository {
  listCatalogue(input?: {q?: string; category?: ProductHubCategory; limit?: number}): Promise<ModuleCatalogueItem[]>
  getModule(moduleId: string): Promise<ModuleDetail | null>
  listInstalled(): Promise<InstalledModule[]>
  installPreview(moduleId: string, version?: string): Promise<ModuleInstallPreview>
  install(moduleId: string, input?: {version?: string; enable?: boolean}): Promise<unknown>
  enable(moduleId: string): Promise<unknown>
  disable(moduleId: string): Promise<unknown>
  update(moduleId: string, version?: string): Promise<unknown>
  uninstall(moduleId: string, choice?: 'keepData' | 'exportThenDelete' | 'deleteData'): Promise<unknown>
  uninstallPreview(moduleId: string): Promise<ModuleUninstallPreview>
  listViews(moduleId: string): Promise<ModuleRuntimeView[]>
  getView(moduleId: string, viewId: string): Promise<ModuleRuntimeView | null>
  listRecords(moduleId: string, collection: string, input?: {q?: string; folder?: string; sort?: string; direction?: 'asc' | 'desc'; cursor?: string; limit?: number}): Promise<ModuleRecordPage>
  createRecord(moduleId: string, collection: string, data: Record<string, unknown>): Promise<ModuleRecord>
  updateRecord(moduleId: string, collection: string, recordId: string, data: Record<string, unknown>, expectedRevision?: number): Promise<ModuleRecord>
  deleteRecord(moduleId: string, collection: string, recordId: string, expectedRevision?: number): Promise<unknown>
  runAction(moduleId: string, actionId: string, input?: Record<string, unknown>): Promise<unknown>
  getSettingsSchema(moduleId: string): Promise<ModuleSettingsSchema>
  getSettings(moduleId: string): Promise<ModuleSettingsDocument>
  updateSettings(moduleId: string, values: Record<string, unknown>): Promise<ModuleSettingsDocument>
  getHealth(moduleId: string): Promise<ModuleHealth | null>
  getBackendDiagnostics(moduleId: string): Promise<ModuleBackendMetadata | null>
  reverifyBackend(moduleId: string, origin?: string): Promise<ModuleBackendMetadata | null>
  checkBackendHealth(moduleId: string): Promise<ModuleBackendMetadata | null>
  disableBackend(moduleId: string): Promise<ModuleBackendMetadata | null>
  listContributions(input?: {surface?: string; moduleId?: string; enabledOnly?: boolean}): Promise<ModuleContribution[]>
}
