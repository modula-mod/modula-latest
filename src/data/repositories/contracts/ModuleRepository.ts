import type {
  GreenfieldModuleAction,
  GreenfieldModuleFieldDefinition,
  GreenfieldModuleView,
  HostCapabilityNegotiation,
  HostCapabilityRequirement,
} from '@modula/greenfield-module-ui-contracts'
import type {
  GreenfieldModuleMarketplace,
  GreenfieldModuleRating,
} from '@modula/greenfield-module-registry-contracts'

export type ProductHubExtensionKind =
  | 'module'
  | 'addon'
  | 'tool'
  | 'function'
  | 'plugin'
  | 'connector'
  | 'widget'
  | 'service'
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
  latestStableVersion?: string | null
  newestPublishedVersion?: string | null
  newestPublishedChannel?: 'stable' | 'beta' | 'rc' | 'dev' | null
  releaseChannel?: 'stable' | 'beta' | 'rc' | 'dev' | null
  installedVersion?: string | null
  installedReleaseChannel?: 'stable' | 'beta' | 'rc' | 'dev' | null
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
  releasePublishedAt?: string | null
  releaseSizeBytes?: number | null
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
  marketplace?: GreenfieldModuleMarketplace
}

export type InstalledModule = {
  installationId: string
  moduleId: string
  version: string
  releaseChannel?: 'stable' | 'beta' | 'rc' | 'dev'
  status: string
  publisherName?: string
  name?: string
  health?: string
  updateState?: string
  configurationState?: string
  grantedPermissions?: string[]
  productKind?: ProductHubExtensionKind
  lifecycleState?: string
}

export type ModuleInstallPreview = {
  moduleId: string
  version: string
  productKind: ProductHubExtensionKind
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
  extensionTargets: {
    productId: string
    versionRange: string
    installedVersion: string | null
    installed: boolean
    compatible: boolean
    requiredCapabilities: string[]
    requiredExtensionPoints: string[]
  }[]
  extensionContributions: {
    id: string
    kind: string
    extensionPoint: string
    requiredCapability: string | null
  }[]
  provides?: {id: string; title: string; version: string; kind: 'service' | 'api' | 'record' | 'capability' | 'engine' | 'integration' | 'ui'}[]
  contributions: Record<string, number>
  migrationsRequired: boolean
  permissionIncrease: boolean
}

export type ModuleUninstallPreview = {
  moduleId: string
  version: string
  dependantModules: unknown[]
  dependantExtensions: {productId: string; productKind?: string; version?: string; state?: string}[]
  recordCount: number
  activeJobs: unknown[]
  registeredContributions: unknown[]
  dataChoices: ('keepData' | 'exportThenDelete' | 'deleteData')[]
  defaultChoice: 'keepData'
}

export type ModuleRuntimeView = GreenfieldModuleView & {
  allowedActions?: GreenfieldModuleAction[]
  available?: boolean
  capabilityNegotiation?: HostCapabilityNegotiation
  recordBinding?: {source: 'record.detail'; collection: string; recordId: string}
  recordListActionIds?: string[]
  searchEnabled?: boolean
}

export type MpsFrontendRoute = {
  path: string
  viewId?: string
  redirectTo?: string
  presentation?: string
}

export type MpsFrontendComponent = Record<string, unknown> & {
  type: string
  children?: MpsFrontendComponent[]
}

export type MpsFrontendView = Record<string, unknown> & {
  id: string
  kind: 'collection' | 'detail' | 'form' | 'dashboard' | 'settings' | 'emptyState'
  title: string | Record<string, unknown>
  root: MpsFrontendComponent
  bindings?: Record<string, unknown>[]
  states?: Record<string, MpsFrontendComponent>
}

export type MpsFrontendAction = Record<string, unknown> & {
  id: string
  family: string
  label: string | Record<string, unknown>
}

export type MpsFrontendArtifact = {
  schema: 'modula.frontend.1.0'
  frontendSchemaVersion: '1.0.0'
  mpsVersion: '1.0-RC' | '1.0'
  productId: string
  releaseVersion: string
  mode: 'declarative' | 'host-contribution'
  entry?: string
  hostRuntime: {versionRange: string}
  routes?: MpsFrontendRoute[]
  views?: MpsFrontendView[]
  actions?: MpsFrontendAction[]
  contributions?: Record<string, unknown>[]
  settings?: {viewId: string}
  capabilities?: {
    required?: (string | HostCapabilityRequirement)[]
    optional?: (string | HostCapabilityRequirement)[]
  }
  accessibility: Record<string, unknown>
}

export type ProductFrontendRuntime =
  | {
      source: 'legacy'
      productId: string
      version: string
      releaseId: string
      installationId: string
      installationStatus: 'enabled'
    }
  | {
      source: 'mps'
      productId: string
      version: string
      releaseId: string
      installationId: string
      installationStatus: 'enabled'
      mode: 'declarative' | 'host-contribution'
      artifact: {
        role: 'product.frontend'
        path: string
        mediaType: 'application/vnd.modula.frontend+json'
        sha256: string
        schemaVersion: '1.0.0'
        verifiedAt: string
      }
      mpsVersion: '1.0-RC' | '1.0'
      entryView: string | null
      routeCount: number
      compatibility: Record<string, unknown>
      requiredCapabilities: string[]
      frontend: MpsFrontendArtifact
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

export type ModuleProductRelationship = {
  productId: string
  productKind: ProductHubExtensionKind
  name: string
  description: string
  version: string
  versionRange: string
  requiredCapabilities: string[]
}

export type ModuleProductRelationships = {
  productId: string
  targets: ModuleProductRelationship[]
  extensions: ModuleProductRelationship[]
}

export type ModuleHostExtensionContribution = {
  contribution_registration_id: string
  extension_product_id: string
  contribution_id: string
  contribution_kind: string
  extension_point: string
  contract_id: string
  required_capability: string | null
  platforms: string[]
  requires_online: boolean
  priority: number
  status: string
  last_error_code: string | null
  frontend_source?: 'mps' | 'legacy'
  frontend_artifact_sha256?: string | null
  declaration: {
    title?: string
    actionId?: string
    functionId?: string
    requiredCapability?: string
    source?: 'mps-product-frontend'
    frontend?: MpsFrontendComponent | null
  }
}

export type ModuleHostComposition = {
  target: {productId: string; installationId: string; version: string; status: string}
  route: string | null
  platform: string
  core: {manifest: Record<string, unknown>; extensionPoints: Record<string, unknown>[]}
  extensions: ModuleHostExtensionContribution[]
  failureIsolation: boolean
  arbitraryRemoteCode: false
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
  rateModule(moduleId: string, rating: number): Promise<GreenfieldModuleRating>
  listInstalled(): Promise<InstalledModule[]>
  installPreview(moduleId: string, version?: string, platform?: 'ios' | 'android' | 'web' | 'desktop'): Promise<ModuleInstallPreview>
  install(moduleId: string, input?: {version?: string; enable?: boolean; approvedPermissions?: string[]; platform?: 'ios' | 'android' | 'web' | 'desktop'}): Promise<unknown>
  enable(moduleId: string): Promise<unknown>
  disable(moduleId: string): Promise<unknown>
  update(moduleId: string, version?: string): Promise<unknown>
  reviewPermissions(moduleId: string, approvedPermissions: string[]): Promise<unknown>
  uninstall(moduleId: string, choice?: 'keepData' | 'exportThenDelete' | 'deleteData', options?: {removeDependants?: boolean}): Promise<unknown>
  uninstallPreview(moduleId: string): Promise<ModuleUninstallPreview>
  listViews(moduleId: string): Promise<ModuleRuntimeView[]>
  getView(moduleId: string, viewId: string): Promise<ModuleRuntimeView | null>
  getProductFrontend(moduleId: string): Promise<ProductFrontendRuntime>
  listRecords(moduleId: string, collection: string, input?: {q?: string; folder?: string; sort?: string; direction?: 'asc' | 'desc'; cursor?: string; limit?: number; filters?: Record<string, string | number | boolean | null>; recordState?: 'active' | 'deleted'}): Promise<ModuleRecordPage>
  getRecord(moduleId: string, collection: string, recordId: string): Promise<ModuleRecord>
  createRecord(moduleId: string, collection: string, data: Record<string, unknown>): Promise<ModuleRecord>
  updateRecord(moduleId: string, collection: string, recordId: string, data: Record<string, unknown>, expectedRevision?: number): Promise<ModuleRecord>
  deleteRecord(moduleId: string, collection: string, recordId: string, expectedRevision?: number): Promise<unknown>
  restoreRecord(moduleId: string, collection: string, recordId: string, expectedRevision?: number): Promise<ModuleRecord>
  purgeRecord(moduleId: string, collection: string, recordId: string, expectedRevision?: number): Promise<unknown>
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
  getProductRelationships(productId: string): Promise<ModuleProductRelationships>
  getHostComposition(moduleId: string, input?: {platform?: string; route?: string; online?: boolean}): Promise<ModuleHostComposition>
  invokeExtensionContribution(extensionProductId: string, contributionId: string, input: {targetProductId: string; actionId: string; requiredCapabilities?: string[]; resource?: {type: 'moduleRecord'; id: string; collection?: string}; variables?: Record<string, unknown>}): Promise<unknown>
  reportExtensionContributionFailure(extensionProductId: string, contributionId: string, errorCode: string): Promise<unknown>
}
