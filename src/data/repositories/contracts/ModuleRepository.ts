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

export type ModuleBetaClassification =
  | 'CANONICAL_PRODUCT'
  | 'VALID_OLDER_RELEASE'
  | 'PLACEHOLDER'
  | 'COMING_SOON'
  | 'INTERNAL_ONLY'
  | 'TEST_ONLY'
  | 'DUPLICATE'
  | 'STALE'
  | 'QUARANTINED'
  | 'BROKEN'

export type ModuleInstallabilityStatus =
  | 'available'
  | 'installed'
  | 'update_available'
  | 'coming_soon'
  | 'incompatible'
  | 'quarantined'
  | 'unavailable'

export type ModuleInstallabilityProjection = {
  moduleId: string
  release: {version: string; releaseId?: string | null} | null
  status: ModuleInstallabilityStatus
  reasonCode: string
  reason: string
}

export type ModuleBackendMode =
  | 'greenfield-managed'
  | 'module-managed'
  | 'hybrid'
  | 'frontend-only'

export type ModuleStandardRuntimeSupportState =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'DECLARATIVE_ONLY'
  | 'UNSUPPORTED'
  | 'DEPRECATED'

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

export type ModuleStandardMetadata = {
  manifestVersion: number | null
  standardVersion: string | null
  sectionVersions: Record<string, string>
  runtimeSupport?: {
    standardVersion: string
    maximumServiceInvocationDepth: number
    sections: Record<string, ModuleStandardRuntimeSupportState>
  }
  runtimeDiagnostics: {
    section: string
    state: ModuleStandardRuntimeSupportState
    declared: boolean
    operational: boolean
    message: string
  }[]
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
  standard?: ModuleStandardMetadata
  betaClassification?: ModuleBetaClassification
  installability?: ModuleInstallabilityProjection
}

export type ModuleDetail = ModuleCatalogueItem & {
  longDescription: string
  backend: ModuleBackendMetadata
  permissions: {permission: string; reason: string; risk: 'low' | 'medium' | 'high' | 'restricted'}[]
  contributions: Record<string, unknown>
  ai?: ModuleAIDeclaration
  sourceRepository?: string
  sourceCommit?: string
  manifestChecksum?: string
  releaseChecksum?: string | null
  releaseNotes?: string[]
  privacy?: string
  standard?: ModuleStandardMetadata
  manifest?: Record<string, unknown>
  normalizedManifest?: Record<string, unknown>
  dependencyGraph?: Record<string, unknown>
  serviceRegistry?: Record<string, unknown>
  apiRegistry?: Record<string, unknown>
  eventBus?: Record<string, unknown>
  hookRegistry?: Record<string, unknown>
  capabilityDiscovery?: Record<string, unknown>
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
  grantedPermissions?: string[]
}

export type ModuleInstallPreview = {
  moduleId: string
  version: string
  compatible: boolean
  incompatibilityReasons: string[]
  trust: {level: string; publisherStatus: string; releaseStatus: string}
  permissions: ModuleDetail['permissions']
  dependencies: {
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
  }[]
  dependencyWarnings?: string[]
  provides?: {id: string; title: string; version: string; kind: 'service' | 'api' | 'record' | 'capability' | 'engine' | 'integration' | 'ui'}[]
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

export type ModuleRuntimeSummary = {
  installationId: string
  moduleId: string
  status: string
  dependencies: Record<string, unknown>[]
  permissions: Record<string, unknown>[]
  capabilities: Record<string, unknown>[]
  services: Record<string, unknown>[]
  apis: Record<string, unknown>[]
  hooks: Record<string, unknown>[]
  storage: Record<string, unknown>[]
  jobs: Record<string, unknown>[]
  ui: Record<string, unknown>[]
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

export type ModuleAIProductActionApplicationMode =
  | 'preview-only'
  | 'replace-selection'
  | 'replace-document'
  | 'insert'
  | 'metadata-suggestion'

export type ModuleAIProductActionDefinition = {
  id: string
  name: string
  description: string
  promptId: string
  promptVersionRange: string
  inputSchema: string
  outputSchema: string
  requiredPermissions: string[]
  requiredCapabilities: string[]
  context: {
    sources: ('current-record' | 'selected-content' | 'record-metadata' | 'module-settings')[]
    maximumRecords: number
    maximumCharacters: number
    allowedClassifications: ('public' | 'internal' | 'private' | 'sensitive')[]
  }
  execution: {
    streaming: boolean
    structuredOutput: boolean
    maximumToolCalls: number
    timeoutMs: number
  }
  application: {
    mode: ModuleAIProductActionApplicationMode
    explicitConfirmation: boolean
    createsRecordRevision: boolean
  }
}

export type ModuleAIDeclaration = {
  features: string[]
  productActions: ModuleAIProductActionDefinition[]
}

export type ModuleAIActionExecutionRequest = {
  recordId: string
  expectedRevision: number
  selection?: {
    blockIds?: string[]
    text?: string
  }
  variables?: Record<string, unknown>
  streaming?: boolean
  idempotencyKey?: string
}

export type ModuleAIActionExecutionResponse = {
  executionId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'expired'
  streamPath?: string
  requestId: string
  result?: Record<string, unknown>
  expiresAt: string
  usage?: Record<string, unknown>
}

export type ApplyAIExecutionRequest = {
  recordId: string
  expectedRevision: number
  selectedResult?: Record<string, unknown>
  idempotencyKey?: string
}

export type ApplyAIExecutionResponse = {
  executionId: string
  status: 'applied'
  recordId: string
  revision: number
  applicationId: string
}

export interface ModuleRepository {
  listCatalogue(
    input?: {q?: string; category?: ProductHubCategory; limit?: number},
    options?: {includeInstalled?: boolean},
  ): Promise<ModuleCatalogueItem[]>
  getModule(moduleId: string, options?: {includeInstalled?: boolean}): Promise<ModuleDetail | null>
  listInstalled(): Promise<InstalledModule[]>
  installPreview(moduleId: string, version?: string): Promise<ModuleInstallPreview>
  install(moduleId: string, input?: {version?: string; enable?: boolean}): Promise<unknown>
  enable(moduleId: string): Promise<unknown>
  disable(moduleId: string): Promise<unknown>
  update(moduleId: string, version?: string): Promise<unknown>
  reviewPermissions(moduleId: string, approvedPermissions: string[]): Promise<unknown>
  uninstall(moduleId: string, choice?: 'keepData' | 'exportThenDelete' | 'deleteData'): Promise<unknown>
  uninstallPreview(moduleId: string): Promise<ModuleUninstallPreview>
  listViews(moduleId: string): Promise<ModuleRuntimeView[]>
  getView(moduleId: string, viewId: string): Promise<ModuleRuntimeView | null>
  listRecords(moduleId: string, collection: string, input?: {q?: string; folder?: string; sort?: string; direction?: 'asc' | 'desc'; cursor?: string; limit?: number}): Promise<ModuleRecordPage>
  createRecord(moduleId: string, collection: string, data: Record<string, unknown>): Promise<ModuleRecord>
  updateRecord(moduleId: string, collection: string, recordId: string, data: Record<string, unknown>, expectedRevision?: number): Promise<ModuleRecord>
  deleteRecord(moduleId: string, collection: string, recordId: string, expectedRevision?: number): Promise<unknown>
  runAction(moduleId: string, actionId: string, input?: Record<string, unknown>): Promise<unknown>
  executeAIAction(moduleId: string, actionId: string, input: ModuleAIActionExecutionRequest): Promise<ModuleAIActionExecutionResponse>
  applyAIExecution(moduleId: string, executionId: string, input: ApplyAIExecutionRequest): Promise<ApplyAIExecutionResponse>
  getSettingsSchema(moduleId: string): Promise<ModuleSettingsSchema>
  getSettings(moduleId: string): Promise<ModuleSettingsDocument>
  updateSettings(moduleId: string, values: Record<string, unknown>): Promise<ModuleSettingsDocument>
  getHealth(moduleId: string): Promise<ModuleHealth | null>
  getBackendDiagnostics(moduleId: string): Promise<ModuleBackendMetadata | null>
  reverifyBackend(moduleId: string, origin?: string): Promise<ModuleBackendMetadata | null>
  checkBackendHealth(moduleId: string): Promise<ModuleBackendMetadata | null>
  disableBackend(moduleId: string): Promise<ModuleBackendMetadata | null>
  listContributions(input?: {surface?: string; moduleId?: string; enabledOnly?: boolean}): Promise<ModuleContribution[]>
  getRuntimeSummary(moduleId: string): Promise<ModuleRuntimeSummary | null>
}
