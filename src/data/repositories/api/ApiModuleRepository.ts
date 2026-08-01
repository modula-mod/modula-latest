import type {ApiClient} from '@/api/client'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import type {GreenfieldModuleFieldDefinition} from '@modula/greenfield-module-ui-contracts'
import type {
  InstalledModule,
  ApplyAIExecutionRequest,
  ApplyAIExecutionResponse,
  ModuleAIDeclaration,
  ModuleAIActionExecutionRequest,
  ModuleAIActionExecutionResponse,
  ModuleAIProductActionDefinition,
  ModuleBackendMetadata,
  ModuleCatalogueItem,
  ModuleContribution,
  ModuleDetail,
  ModuleHealth,
  ModuleInstallPreview,
  ModuleRecord,
  ModuleRecordPage,
  ModuleRepository,
  ModuleRuntimeSummary,
  ModuleRuntimeView,
  ModuleSettingsDocument,
  ModuleSettingsSchema,
  ModuleStandardRuntimeSupportState,
  ModuleUninstallPreview,
  ProductHubCategory,
} from '@/data/repositories/contracts/ModuleRepository'

const LOCAL_CATALOGUE: ModuleCatalogueItem[] = [
  {
    moduleId: 'digital.modula.vault-notes',
    name: 'Vault Notes',
    description: 'Private in Modula notes for posts, folders, tags and Board summaries.',
    publisherId: 'modula',
    publisherName: 'Modula',
    kind: 'module',
    category: 'Productivity',
    trustLevel: 'firstParty',
    latestVersion: '0.2.0',
    compatibility: 'Compatible',
    installable: true,
    installationState: 'available',
    priceState: 'Included',
    featured: true,
    standard: localStandardMetadata(),
  },
  {
    moduleId: 'digital.modula.tasks',
    name: 'Tasks',
    description: 'Planned first-party task module for social and Board workflows.',
    publisherId: 'modula',
    publisherName: 'Modula',
    kind: 'module',
    category: 'Productivity',
    trustLevel: 'firstParty',
    latestVersion: null,
    compatibility: 'Coming later',
    installable: false,
    installationState: 'comingSoon',
    priceState: 'Coming soon',
  },
  {
    moduleId: 'digital.dimon.core',
    name: 'DIMON Core',
    description: 'Reserved inactive system extension. No balances, prices or transfers are active.',
    publisherId: 'modula',
    publisherName: 'Modula',
    kind: 'system',
    category: 'Developer',
    trustLevel: 'firstParty',
    latestVersion: null,
    compatibility: 'Inactive',
    installable: false,
    installationState: 'notAvailable',
    priceState: 'Not available',
  },
]

const LOCAL_RECORD_STORE = new Map<string, ModuleRecord[]>()

async function localOnlyFallback<T>(operation: Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  try {
    return await operation
  } catch (error) {
    if (runtimeEnvironment.dataSource === 'local') return fallback()
    throw error
  }
}

export class ApiModuleRepository implements ModuleRepository {
  constructor(private readonly client: ApiClient) {}

  async listCatalogue(input: {q?: string; category?: ProductHubCategory; limit?: number} = {}): Promise<ModuleCatalogueItem[]> {
    return localOnlyFallback(
      this.client.get(
        {path: '/v1/registry/modules', query: {q: input.q, limit: input.limit ?? 50}},
        decodeCataloguePage,
      ),
      () => filterCatalogue(LOCAL_CATALOGUE, input),
    ).then(async remote => {
      if (runtimeEnvironment.dataSource === 'local' && remote === LOCAL_CATALOGUE) return remote
      const installed = await this.listInstalled()
      const byId = new Map(installed.map(item => [item.moduleId, item]))
      return filterCatalogue(remote.map(item => applyInstalledState(item, byId.get(item.moduleId))), input)
    })
  }

  async getModule(moduleId: string): Promise<ModuleDetail | null> {
    return localOnlyFallback(
      this.client.get({path: `/v1/registry/modules/${encodeURIComponent(moduleId)}`}, decodeModuleDetail),
      () => {
        const fallback = LOCAL_CATALOGUE.find(item => item.moduleId === moduleId)
        return fallback ? {
          ...fallback,
          longDescription: fallback.description,
          backend: defaultBackendMetadata(moduleId),
          permissions: [],
          contributions: {},
          privacy: moduleId.includes('vault-notes') ? 'Private in Modula' : undefined,
        } : null
      },
    ).then(async item => {
      if (!item) return null
      const installed = await this.listInstalled()
      return {...item, installationState: applyInstalledState(item, installed.find(row => row.moduleId === moduleId)).installationState}
    })
  }

  listInstalled(): Promise<InstalledModule[]> {
    return localOnlyFallback(
      this.client.get({path: '/v1/modules/installed', authenticated: true}, value =>
        Array.isArray(value) ? value.map(decodeInstalledModule) : [],
      ),
      () => [],
    )
  }

  installPreview(moduleId: string, version?: string): Promise<ModuleInstallPreview> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/install-preview`, authenticated: true, body: {version}}, decodeInstallPreview)
  }

  install(moduleId: string, input: {version?: string; enable?: boolean} = {}): Promise<unknown> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/install`, authenticated: true, body: {version: input.version, idempotencyKey: idempotencyKey('install', moduleId)}}, value => value)
  }

  enable(moduleId: string): Promise<unknown> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/enable`, authenticated: true, body: {idempotencyKey: idempotencyKey('enable', moduleId)}}, value => value)
  }

  disable(moduleId: string): Promise<unknown> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/disable`, authenticated: true, body: {idempotencyKey: idempotencyKey('disable', moduleId)}}, value => value)
  }

  update(moduleId: string, version?: string): Promise<unknown> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/update`, authenticated: true, body: {version, approvedPermissionIncrease: false, idempotencyKey: idempotencyKey('update', moduleId)}}, value => value)
  }

  reviewPermissions(moduleId: string, approvedPermissions: string[]): Promise<unknown> {
    return this.client.post({
      path: `/v1/modules/${encodeURIComponent(moduleId)}/permissions/review`,
      authenticated: true,
      body: {approvedPermissions, idempotencyKey: idempotencyKey('permissions-review', moduleId)},
    }, value => value)
  }

  uninstall(moduleId: string, choice: 'keepData' | 'exportThenDelete' | 'deleteData' = 'keepData'): Promise<unknown> {
    return this.client.delete({path: `/v1/modules/${encodeURIComponent(moduleId)}/install`, authenticated: true, body: {choice, recentAuth: false, confirmDelete: false, idempotencyKey: idempotencyKey('uninstall', moduleId)}}, value => value)
  }

  uninstallPreview(moduleId: string): Promise<ModuleUninstallPreview> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/uninstall-preview`, authenticated: true}, decodeUninstallPreview)
  }

  async listViews(moduleId: string): Promise<ModuleRuntimeView[]> {
    return localOnlyFallback(
      this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/views`, authenticated: true}, value => {
        const row = value as {views?: unknown}
        return Array.isArray(row.views) ? row.views.map(decodeRuntimeView) : []
      }),
      () => localViews(moduleId),
    )
  }

  async getView(moduleId: string, viewId: string): Promise<ModuleRuntimeView | null> {
    return localOnlyFallback(
      this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/views/${encodeURIComponent(viewId)}`, authenticated: true}, decodeRuntimeView),
      async () => {
        const views = await this.listViews(moduleId)
        return views.find(view => view.viewId === viewId) ?? views[0] ?? null
      },
    )
  }

  listRecords(moduleId: string, collection: string, input: {q?: string; folder?: string; sort?: string; direction?: 'asc' | 'desc'; cursor?: string; limit?: number} = {}): Promise<ModuleRecordPage> {
    return localOnlyFallback(
      this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/records/${encodeURIComponent(collection)}`, authenticated: true, query: input}, decodeRecordPage),
      () => ({moduleId, collection, items: localRecords(moduleId, collection, input.q), nextCursor: null, limit: input.limit ?? 25}),
    )
  }

  createRecord(moduleId: string, collection: string, data: Record<string, unknown>): Promise<ModuleRecord> {
    return localOnlyFallback(
      this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/records/${encodeURIComponent(collection)}`, authenticated: true, body: {data}}, decodeRecord),
      () => createLocalRecord(moduleId, collection, data),
    )
  }

  updateRecord(moduleId: string, collection: string, recordId: string, data: Record<string, unknown>, expectedRevision?: number): Promise<ModuleRecord> {
    return localOnlyFallback(
      this.client.patch({path: `/v1/modules/${encodeURIComponent(moduleId)}/records/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}`, authenticated: true, body: {data, expectedRevision}}, decodeRecord),
      () => updateLocalRecord(moduleId, collection, recordId, data, expectedRevision),
    )
  }

  deleteRecord(moduleId: string, collection: string, recordId: string, expectedRevision?: number): Promise<unknown> {
    return localOnlyFallback(
      this.client.delete({path: `/v1/modules/${encodeURIComponent(moduleId)}/records/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}`, authenticated: true, body: {expectedRevision}}, value => value),
      () => deleteLocalRecord(moduleId, collection, recordId, expectedRevision),
    )
  }

  runAction(moduleId: string, actionId: string, input: Record<string, unknown> = {}): Promise<unknown> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/actions/${encodeURIComponent(actionId)}`, authenticated: true, body: {input, idempotencyKey: idempotencyKey(actionId, moduleId)}}, value => value)
  }

  executeAIAction(moduleId: string, actionId: string, input: ModuleAIActionExecutionRequest): Promise<ModuleAIActionExecutionResponse> {
    return this.client.post({
      path: `/v1/modules/${encodeURIComponent(moduleId)}/ai/actions/${encodeURIComponent(actionId)}/executions`,
      authenticated: true,
      body: {...input, idempotencyKey: input.idempotencyKey ?? idempotencyKey(actionId, moduleId)},
    }, decodeAIExecution)
  }

  applyAIExecution(moduleId: string, executionId: string, input: ApplyAIExecutionRequest): Promise<ApplyAIExecutionResponse> {
    return this.client.post({
      path: `/v1/modules/${encodeURIComponent(moduleId)}/ai/executions/${encodeURIComponent(executionId)}/apply`,
      authenticated: true,
      body: {...input, idempotencyKey: input.idempotencyKey ?? idempotencyKey('ai-apply', moduleId)},
    }, decodeAIApplication)
  }

  getSettingsSchema(moduleId: string): Promise<ModuleSettingsSchema> {
    return localOnlyFallback(
      this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/settings-schema`, authenticated: true}, decodeSettingsSchema),
      () => localSettingsSchema(moduleId),
    )
  }

  getSettings(moduleId: string): Promise<ModuleSettingsDocument> {
    return localOnlyFallback(
      this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/settings`, authenticated: true}, decodeSettings),
      () => ({moduleId, installationId: `local:${moduleId}`, version: 0, values: localSettingsSchema(moduleId).defaults}),
    )
  }

  updateSettings(moduleId: string, values: Record<string, unknown>): Promise<ModuleSettingsDocument> {
    return this.client.patch({path: `/v1/modules/${encodeURIComponent(moduleId)}/settings`, authenticated: true, body: {values}}, decodeSettings)
  }

  getHealth(moduleId: string): Promise<ModuleHealth | null> {
    return localOnlyFallback(
      this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/health`, authenticated: true}, decodeHealth),
      () => null,
    )
  }

  getBackendDiagnostics(moduleId: string): Promise<ModuleBackendMetadata | null> {
    return localOnlyFallback(
      this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/backend`, authenticated: true}, value => decodeBackendMetadata(value, moduleId)),
      async () => (await this.getModule(moduleId))?.backend ?? null,
    )
  }

  reverifyBackend(moduleId: string, origin?: string): Promise<ModuleBackendMetadata | null> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/backend/discover`, authenticated: true, body: {origin}}, value => decodeBackendMetadata(value, moduleId))
  }

  checkBackendHealth(moduleId: string): Promise<ModuleBackendMetadata | null> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/backend/health`, authenticated: true}, value => decodeBackendMetadata(value, moduleId))
  }

  disableBackend(moduleId: string): Promise<ModuleBackendMetadata | null> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/backend/disable`, authenticated: true}, value => decodeBackendMetadata(value, moduleId))
  }

  listContributions(input: {surface?: string; moduleId?: string; enabledOnly?: boolean} = {}): Promise<ModuleContribution[]> {
    return localOnlyFallback(
      this.client.get({path: '/v1/modules/contributions', authenticated: true, query: input}, value =>
        Array.isArray(value) ? value.map(decodeContribution) : [],
      ),
      () => [],
    )
  }

  getRuntimeSummary(moduleId: string): Promise<ModuleRuntimeSummary | null> {
    return localOnlyFallback(
      this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/runtime`, authenticated: true}, decodeRuntimeSummary),
      () => null,
    )
  }
}

function decodeCataloguePage(value: unknown): ModuleCatalogueItem[] {
  const page = (value ?? {}) as {items?: unknown}
  return Array.isArray(page.items) ? page.items.map(decodeCatalogueItem) : []
}

function decodeCatalogueItem(value: unknown): ModuleCatalogueItem {
  const row = (value ?? {}) as Record<string, unknown>
  const moduleId = String(row.moduleId ?? row.module_id ?? row.slug ?? 'unknown')
  const status = String(row.status ?? 'published')
  const installable = Boolean(row.installable)
  const manifest = isRecord(row.manifest) ? row.manifest : {}
  return {
    moduleId,
    name: String(row.name ?? moduleId),
    description: String(row.description ?? ''),
    publisherId: String(row.publisherId ?? row.publisher_id ?? 'modula'),
    publisherName: String(row.publisherName ?? row.publisher ?? 'Modula'),
    kind: moduleId.includes('dimon') ? 'system' : 'module',
    category: categoryFor(moduleId, String(row.description ?? '')),
    trustLevel: String(row.trustLevel ?? row.trust ?? 'untrustedManifest'),
    latestVersion: typeof row.latestVersion === 'string' ? row.latestVersion : typeof row.version === 'string' ? row.version : null,
    compatibility: Array.isArray(row.platforms) ? `Platforms ${row.platforms.join(', ')}` : 'Compatible',
    installable,
    installationState: status === 'quarantined' ? 'quarantined' : installable ? 'available' : status === 'planned' ? 'comingSoon' : 'notAvailable',
    priceState: installable ? 'Free' : status === 'planned' ? 'Coming soon' : 'Not available',
    featured: moduleId.includes('vault-notes') || moduleId.includes('tasks'),
    standard: decodeStandardMetadata(row.standard ?? row.standardMetadata ?? manifest),
  }
}

function decodeModuleDetail(value: unknown): ModuleDetail {
  const row = (value ?? {}) as Record<string, unknown>
  const base = decodeCatalogueItem({...row, latestVersion: row.latestVersion, status: row.status})
  const publisher = (row.publisher ?? {}) as Record<string, unknown>
  const placeholder = (row.placeholder ?? {}) as Record<string, unknown>
  const source = (row.source ?? {}) as Record<string, unknown>
  const manifest = (row.manifest ?? row.placeholder ?? {}) as Record<string, unknown>
  const backendSource = isRecord(manifest.backend) ? manifest.backend : isRecord(row.backend) ? row.backend : undefined
  return {
    ...base,
    publisherId: String(publisher.publisherId ?? base.publisherId),
    publisherName: String(publisher.displayName ?? base.publisherName),
    longDescription: String(row.description ?? base.description),
    backend: decodeBackendMetadata(backendSource, base.moduleId),
    permissions: Array.isArray(row.permissions) ? row.permissions as ModuleDetail['permissions'] : [],
    contributions: (row.contributions ?? {}) as Record<string, unknown>,
    ai: decodeAIDeclaration(isRecord(manifest.ai) ? manifest.ai : row.ai),
    standard: decodeStandardMetadata(row.standardMetadata ?? row.standard ?? manifest),
    manifest,
    normalizedManifest: recordOrUndefined(row.normalizedManifest),
    dependencyGraph: recordOrUndefined(row.dependencyGraph ?? manifest.dependencyGraph),
    serviceRegistry: recordOrUndefined(row.serviceRegistry ?? manifest.serviceRegistry),
    apiRegistry: recordOrUndefined(row.apiRegistry ?? manifest.apiRegistry),
    eventBus: recordOrUndefined(row.eventBus ?? manifest.eventBus),
    hookRegistry: recordOrUndefined(row.hookRegistry ?? manifest.hookRegistry),
    capabilityDiscovery: recordOrUndefined(row.capabilityDiscovery ?? manifest.capabilityDiscovery),
    sourceRepository: String(source.repository ?? placeholder.sourceRepository ?? manifest.sourceRepository ?? ''),
    sourceCommit: typeof source.commit === 'string' ? source.commit : undefined,
    manifestChecksum: typeof row.manifestSha256 === 'string' ? row.manifestSha256 : undefined,
    releaseChecksum: typeof row.releaseSha256 === 'string' ? row.releaseSha256 : null,
    releaseNotes: Array.isArray(row.releaseNotes) ? row.releaseNotes.map(String) : [],
    privacy: base.moduleId.includes('vault-notes') ? 'Private in Modula' : undefined,
  }
}

function decodeBackendMetadata(value: unknown, moduleId: string): ModuleBackendMetadata {
  const backend = isRecord(value) ? value : {}
  const mode = backendMode(backend.mode)
  const deployment = isRecord(backend.deployment) ? backend.deployment : {}
  const data = isRecord(backend.data) ? backend.data : {}
  const trust = isRecord(backend.trust) ? backend.trust : {}
  const actions = Array.isArray(backend.actions) ? backend.actions.filter(isRecord) : []
  const diagnosticEndpoint = typeof backend.resolvedEndpoint === 'string' ? backend.resolvedEndpoint : typeof backend.resolvedOrigin === 'string' ? backend.resolvedOrigin : undefined
  const endpoint = diagnosticEndpoint ?? (Array.isArray(trust.allowedOrigins) ? trust.allowedOrigins.find((origin): origin is string => typeof origin === 'string') : undefined)
  const ownership = String(deployment.ownership ?? (typeof backend.deployment === 'string' ? backend.deployment : mode === 'greenfield-managed' ? 'modula-hosted' : 'publisher-hosted'))
  const dataLocation = String(data.primaryStore ?? backend.dataLocation ?? (mode === 'frontend-only' ? 'device' : mode === 'greenfield-managed' ? 'greenfield' : 'module-backend'))
  const provider = providerFor(mode, ownership)
  return {
    mode,
    provider,
    deploymentOwnership: ownership,
    dataLocation,
    regions: arrayOfStrings(deployment.regions ?? deployment.dataResidency ?? data.residency),
    status: String(backend.status ?? backend.lifecycleState ?? backend.verificationStatus ?? (mode === 'greenfield-managed' || mode === 'frontend-only' ? 'available' : 'unconfigured')),
    protocolVersion: typeof backend.protocolVersion === 'string' ? backend.protocolVersion : null,
    endpoint: endpoint ?? null,
    selfHostingSupported: Boolean(deployment.selfHostingSupported ?? backend.selfHostingSupported),
    externalDataProcessing: ['module-managed', 'hybrid'].includes(mode) || dataLocation.includes('module-backend'),
    backendPermissions: Array.from(new Set(actions.flatMap(action => arrayOfStrings(action.permissions)))),
  }
}

function defaultBackendMetadata(moduleId: string): ModuleBackendMetadata {
  return decodeBackendMetadata(moduleId.includes('dimon') ? {mode: 'frontend-only', deployment: {ownership: 'modula-hosted'}, data: {primaryStore: 'device'}} : {mode: 'greenfield-managed'}, moduleId)
}

function backendMode(value: unknown): ModuleBackendMetadata['mode'] {
  return value === 'module-managed' || value === 'hybrid' || value === 'frontend-only' ? value : 'greenfield-managed'
}

function providerFor(mode: ModuleBackendMetadata['mode'], ownership: string): string {
  if (mode === 'greenfield-managed') return 'Greenfield'
  if (mode === 'frontend-only') return 'Device'
  if (ownership === 'customer-hosted') return 'Customer-hosted'
  if (ownership === 'modula-hosted') return 'Modula-hosted'
  return 'Publisher-hosted'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function decodeInstalledModule(value: unknown): InstalledModule {
  const row = (value ?? {}) as Record<string, unknown>
  return {
    installationId: String(row.installationId ?? row.installation_id ?? ''),
    moduleId: String(row.moduleId ?? row.module_id ?? ''),
    version: String(row.version ?? '0.0.0'),
    status: String(row.status ?? 'installed'),
    publisherName: typeof row.publisherName === 'string' ? row.publisherName : undefined,
    name: typeof row.name === 'string' ? row.name : undefined,
    health: typeof row.health === 'string' ? row.health : 'Healthy',
    updateState: typeof row.updateState === 'string' ? row.updateState : 'Current',
    configurationState: typeof row.configurationState === 'string' ? row.configurationState : 'Configured',
    grantedPermissions: arrayOfStrings(row.grantedPermissions ?? row.granted_permissions),
  }
}

function decodeInstallPreview(value: unknown): ModuleInstallPreview {
  const row = (value ?? {}) as Record<string, unknown>
  return {
    moduleId: String(row.moduleId ?? ''),
    version: String(row.version ?? ''),
    compatible: Boolean(row.compatible),
    incompatibilityReasons: Array.isArray(row.incompatibilityReasons) ? row.incompatibilityReasons.map(String) : [],
    trust: (row.trust ?? {level: 'unknown', publisherStatus: 'pending', releaseStatus: 'unknown'}) as ModuleInstallPreview['trust'],
    permissions: Array.isArray(row.permissions) ? row.permissions as ModuleInstallPreview['permissions'] : [],
    dependencies: Array.isArray(row.dependencies) ? row.dependencies as ModuleInstallPreview['dependencies'] : [],
    dependencyWarnings: Array.isArray(row.dependencyWarnings) ? row.dependencyWarnings.map(String) : [],
    provides: Array.isArray(row.provides) ? row.provides as ModuleInstallPreview['provides'] : [],
    contributions: (row.contributions ?? {}) as Record<string, number>,
    migrationsRequired: Boolean(row.migrationsRequired),
    permissionIncrease: Boolean(row.permissionIncrease),
  }
}

function decodeStandardMetadata(value: unknown): ModuleDetail['standard'] {
  if (!isRecord(value)) return undefined
  const registries = isRecord(value.registries) ? value.registries : {}
  const dependencies = isRecord(value.dependencies) ? value.dependencies : {}
  const runtimeSupport = decodeRuntimeSupport(value.runtimeSupport)
  const manifestVersion = typeof value.manifestVersion === 'number' ? value.manifestVersion : null
  const sectionVersions = isRecord(value.sectionVersions) ? Object.fromEntries(Object.entries(value.sectionVersions).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {}
  const standardVersion = typeof value.standardVersion === 'string'
    ? value.standardVersion
    : typeof value.versioning === 'object' && value.versioning !== null && typeof (value.versioning as Record<string, unknown>).standardVersion === 'string'
      ? String((value.versioning as Record<string, unknown>).standardVersion)
      : null
  return {
    manifestVersion,
    standardVersion,
    sectionVersions,
    runtimeSupport,
    runtimeDiagnostics: decodeRuntimeDiagnostics(value.runtimeDiagnostics),
    dependencies: {
      requires: numberValue(dependencies.requires),
      optional: numberValue(dependencies.optional),
      recommended: numberValue(dependencies.recommended),
      conflicts: numberValue(dependencies.conflicts),
      replaces: numberValue(dependencies.replaces),
      provides: numberValue(dependencies.provides),
    },
    registries: {
      services: numberValue(registries.services),
      apis: numberValue(registries.apis),
      hooks: numberValue(registries.hooks),
      jobs: numberValue(registries.jobs),
      storage: numberValue(registries.storage),
      widgets: numberValue(registries.widgets),
      navigation: numberValue(registries.navigation),
      ui: numberValue(registries.ui),
      automation: numberValue(registries.automation),
      metrics: numberValue(registries.metrics),
    },
    capabilityFlags: isRecord(value.capabilityFlags) ? Object.fromEntries(Object.entries(value.capabilityFlags).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')) : {},
    capabilities: arrayOfStrings(value.capabilities),
    engines: arrayOfStrings(value.engines),
  }
}

function localStandardMetadata(): ModuleDetail['standard'] {
  return {
    manifestVersion: 1,
    standardVersion: null,
    sectionVersions: {},
    runtimeDiagnostics: [],
    dependencies: {requires: 0, optional: 0, recommended: 0, conflicts: 0, replaces: 0, provides: 0},
    registries: {services: 0, apis: 0, hooks: 0, jobs: 0, storage: 0, widgets: 0, navigation: 0, ui: 0, automation: 0, metrics: 0},
    capabilityFlags: {},
    capabilities: [],
    engines: [],
  }
}

function decodeRuntimeSupport(value: unknown): NonNullable<ModuleDetail['standard']>['runtimeSupport'] {
  if (!isRecord(value)) return undefined
  const sections = isRecord(value.sections)
    ? Object.fromEntries(Object.entries(value.sections).filter((entry): entry is [string, ModuleStandardRuntimeSupportState] => runtimeSupportState(entry[1]) !== null))
    : {}
  return {
    standardVersion: String(value.standardVersion ?? '2.0.0'),
    maximumServiceInvocationDepth: Number(value.maximumServiceInvocationDepth ?? 8),
    sections,
  }
}

function decodeRuntimeDiagnostics(value: unknown): NonNullable<ModuleDetail['standard']>['runtimeDiagnostics'] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map(item => ({
    section: String(item.section ?? ''),
    state: runtimeSupportState(item.state) ?? 'UNSUPPORTED',
    declared: item.declared === true,
    operational: item.operational === true,
    message: String(item.message ?? ''),
  })).filter(item => item.section.length > 0)
}

function runtimeSupportState(value: unknown): ModuleStandardRuntimeSupportState | null {
  if (value === 'SUPPORTED' || value === 'PARTIALLY_SUPPORTED' || value === 'DECLARATIVE_ONLY' || value === 'UNSUPPORTED' || value === 'DEPRECATED') return value
  return null
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function decodeRuntimeView(value: unknown): ModuleRuntimeView {
  return value as ModuleRuntimeView
}

function decodeAIDeclaration(value: unknown): ModuleAIDeclaration | undefined {
  if (!isRecord(value)) return undefined
  return {
    features: arrayOfStrings(value.features),
    productActions: Array.isArray(value.productActions)
      ? value.productActions.filter(isRecord).map(decodeAIProductAction)
      : [],
  }
}

function decodeAIProductAction(value: Record<string, unknown>): ModuleAIProductActionDefinition {
  const context = isRecord(value.context) ? value.context : {}
  const execution = isRecord(value.execution) ? value.execution : {}
  const application = isRecord(value.application) ? value.application : {}
  return {
    id: String(value.id ?? ''),
    name: String(value.name ?? value.id ?? 'AI action'),
    description: String(value.description ?? ''),
    promptId: String(value.promptId ?? ''),
    promptVersionRange: String(value.promptVersionRange ?? ''),
    inputSchema: String(value.inputSchema ?? ''),
    outputSchema: String(value.outputSchema ?? ''),
    requiredPermissions: arrayOfStrings(value.requiredPermissions),
    requiredCapabilities: arrayOfStrings(value.requiredCapabilities),
    context: {
      sources: arrayOfStrings(context.sources) as ModuleAIProductActionDefinition['context']['sources'],
      maximumRecords: Number(context.maximumRecords ?? 1),
      maximumCharacters: Number(context.maximumCharacters ?? 0),
      allowedClassifications: arrayOfStrings(context.allowedClassifications) as ModuleAIProductActionDefinition['context']['allowedClassifications'],
    },
    execution: {
      streaming: Boolean(execution.streaming),
      structuredOutput: Boolean(execution.structuredOutput),
      maximumToolCalls: Number(execution.maximumToolCalls ?? 0),
      timeoutMs: Number(execution.timeoutMs ?? 30_000),
    },
    application: {
      mode: applicationMode(application.mode),
      explicitConfirmation: application.explicitConfirmation === true,
      createsRecordRevision: application.createsRecordRevision === true,
    },
  }
}

function applicationMode(value: unknown): ModuleAIProductActionDefinition['application']['mode'] {
  if (value === 'replace-selection' || value === 'replace-document' || value === 'insert' || value === 'metadata-suggestion') return value
  return 'preview-only'
}

function decodeAIExecution(value: unknown): ModuleAIActionExecutionResponse {
  const row = (value ?? {}) as Record<string, unknown>
  return {
    executionId: String(row.executionId ?? ''),
    status: aiExecutionStatus(row.status),
    streamPath: typeof row.streamPath === 'string' ? row.streamPath : undefined,
    requestId: String(row.requestId ?? ''),
    result: recordOrUndefined(row.result),
    expiresAt: String(row.expiresAt ?? ''),
    usage: recordOrUndefined(row.usage),
  }
}

function decodeAIApplication(value: unknown): ApplyAIExecutionResponse {
  const row = (value ?? {}) as Record<string, unknown>
  return {
    executionId: String(row.executionId ?? ''),
    status: 'applied',
    recordId: String(row.recordId ?? ''),
    revision: Number(row.revision ?? 0),
    applicationId: String(row.applicationId ?? ''),
  }
}

function aiExecutionStatus(value: unknown): ModuleAIActionExecutionResponse['status'] {
  if (value === 'queued' || value === 'running' || value === 'completed' || value === 'failed' || value === 'cancelled' || value === 'expired') return value
  return 'failed'
}

function decodeRecordPage(value: unknown): ModuleRecordPage {
  const row = (value ?? {}) as Record<string, unknown>
  return {
    moduleId: String(row.moduleId ?? ''),
    collection: String(row.collection ?? ''),
    items: Array.isArray(row.items) ? row.items.map(decodeRecord) : [],
    nextCursor: typeof row.nextCursor === 'string' ? row.nextCursor : null,
    limit: Number(row.limit ?? 25),
  }
}

function decodeRecord(value: unknown): ModuleRecord {
  const row = (value ?? {}) as Record<string, unknown>
  return {
    record_id: String(row.record_id ?? row.recordId ?? ''),
    recordId: typeof row.recordId === 'string' ? row.recordId : undefined,
    module_id: typeof row.module_id === 'string' ? row.module_id : undefined,
    moduleId: typeof row.moduleId === 'string' ? row.moduleId : undefined,
    collection: String(row.collection ?? ''),
    data: (row.data ?? {}) as Record<string, unknown>,
    revision: Number(row.revision ?? 1),
    visibility: String(row.visibility ?? 'private'),
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  }
}

function decodeSettings(value: unknown): ModuleSettingsDocument {
  const row = (value ?? {}) as Record<string, unknown>
  return {
    moduleId: String(row.module_id ?? row.moduleId ?? ''),
    installationId: String(row.installation_id ?? row.installationId ?? ''),
    version: Number(row.version ?? 0),
    values: (row.values ?? {}) as Record<string, unknown>,
  }
}

function decodeHealth(value: unknown): ModuleHealth {
  const row = (value ?? {}) as Record<string, unknown>
  return {
    moduleId: String(row.moduleId ?? row.module_id ?? ''),
    version: String(row.version ?? ''),
    overall: String(row.overall ?? 'unknown'),
    runtime: recordOrUndefined(row.runtime),
    searchProjection: recordOrUndefined(row.searchProjection),
    exports: recordOrUndefined(row.exports),
    diagnostics: recordOrUndefined(row.diagnostics),
  }
}

function decodeRuntimeSummary(value: unknown): ModuleRuntimeSummary {
  const row = (value ?? {}) as Record<string, unknown>
  return {
    installationId: String(row.installationId ?? row.installation_id ?? ''),
    moduleId: String(row.moduleId ?? row.module_id ?? ''),
    status: String(row.status ?? 'unknown'),
    dependencies: arrayOfRecords(row.dependencies),
    permissions: arrayOfRecords(row.permissions),
    capabilities: arrayOfRecords(row.capabilities),
    services: arrayOfRecords(row.services),
    apis: arrayOfRecords(row.apis),
    hooks: arrayOfRecords(row.hooks),
    storage: arrayOfRecords(row.storage),
    jobs: arrayOfRecords(row.jobs),
    ui: arrayOfRecords(row.ui),
  }
}

function recordOrUndefined(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function decodeSettingsSchema(value: unknown): ModuleSettingsSchema {
  const row = (value ?? {}) as Record<string, unknown>
  const defaults = (row.defaults ?? {}) as Record<string, unknown>
  return {
    moduleId: String(row.moduleId ?? row.module_id ?? ''),
    version: String(row.version ?? ''),
    fields: decodeSettingsFields(row, defaults),
    defaults,
  }
}

function decodeSettingsFields(row: Record<string, unknown>, defaults: Record<string, unknown>) {
  const directFields = (row.fields ?? row.schemaFields) as unknown
  if (Array.isArray(directFields)) return directFields.map(normalizeField)
  const settings = row.settings
  if (Array.isArray(settings)) {
    const fields = settings.flatMap((item, index) => {
      const setting = (item ?? {}) as Record<string, unknown>
      const schema = (setting.schema ?? setting.schemaRef ?? setting) as Record<string, unknown>
      const candidates = schema.fields
      if (Array.isArray(candidates)) return candidates.map(normalizeField)
      const key = String(setting.key ?? setting.id ?? setting.settingId ?? setting.name ?? `setting${index}`)
      const value = defaults[key]
      return [normalizeField({
        fieldId: String(setting.fieldId ?? `${key}.field`),
        name: key,
        label: String(setting.label ?? titleize(key)),
        type: typeForValue(value),
        options: setting.options,
      })]
    })
    if (fields.length) return fields
  }
  return Object.entries(defaults).map(([key, value]) => normalizeField({
    fieldId: `${key}.field`,
    name: key,
    label: titleize(key),
    type: typeForValue(value),
  }))
}

function normalizeField(value: unknown): GreenfieldModuleFieldDefinition {
  const row = (value ?? {}) as Record<string, unknown>
  const name = String(row.name ?? row.key ?? row.fieldId ?? 'setting')
  return {
    fieldId: String(row.fieldId ?? row.id ?? name),
    name,
    type: typeForField(row.type),
    label: String(row.label ?? titleize(name)),
    required: Boolean(row.required),
    placeholder: typeof row.placeholder === 'string' ? row.placeholder : undefined,
    helpText: typeof row.helpText === 'string' ? row.helpText : undefined,
    sensitive: Boolean(row.sensitive),
    secretRefRequired: Boolean(row.secretRefRequired),
    options: Array.isArray(row.options) ? row.options.map(option => {
      const item = (option ?? {}) as Record<string, unknown>
      return {value: String(item.value ?? item.id ?? ''), label: String(item.label ?? item.value ?? item.id ?? '')}
    }) : undefined,
  }
}

const FIELD_TYPES = new Set<GreenfieldModuleFieldDefinition['type']>([
  'text',
  'multilineText',
  'boolean',
  'singleSelect',
  'multiSelect',
  'date',
  'dateTime',
  'number',
  'tags',
  'url',
  'recordReference',
])

function typeForField(value: unknown): GreenfieldModuleFieldDefinition['type'] {
  const type = String(value ?? '')
  if (FIELD_TYPES.has(type as GreenfieldModuleFieldDefinition['type'])) return type as GreenfieldModuleFieldDefinition['type']
  if (type === 'multiline') return 'multilineText'
  if (type === 'URL') return 'url'
  return 'text'
}

function typeForValue(value: unknown): GreenfieldModuleFieldDefinition['type'] {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (Array.isArray(value)) return 'multiSelect'
  return 'text'
}

function titleize(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/[-_.]+/g, ' ').replace(/^./, char => char.toUpperCase())
}

function decodeContribution(value: unknown): ModuleContribution {
  const row = (value ?? {}) as Record<string, unknown>
  return {
    moduleId: String(row.moduleId ?? ''),
    version: String(row.version ?? ''),
    type: String(row.type ?? ''),
    id: String(row.id ?? ''),
    manifest: (row.manifest ?? {}) as Record<string, unknown>,
    available: Boolean(row.available),
    disabledReason: typeof row.disabledReason === 'string' ? row.disabledReason : null,
    installationStatus: String(row.installationStatus ?? 'unknown'),
  }
}

function decodeUninstallPreview(value: unknown): ModuleUninstallPreview {
  const row = (value ?? {}) as Record<string, unknown>
  return {
    moduleId: String(row.moduleId ?? row.module_id ?? ''),
    version: String(row.version ?? ''),
    dependantModules: Array.isArray(row.dependantModules) ? row.dependantModules : [],
    recordCount: Number(row.recordCount ?? 0),
    activeJobs: Array.isArray(row.activeJobs) ? row.activeJobs : [],
    registeredContributions: Array.isArray(row.registeredContributions) ? row.registeredContributions : [],
    dataChoices: ['keepData', 'exportThenDelete', 'deleteData'],
    defaultChoice: 'keepData',
  }
}

function applyInstalledState(item: ModuleCatalogueItem, installed?: InstalledModule): ModuleCatalogueItem {
  if (!installed) return item
  const state = installed.status === 'enabled' ? 'enabled' : installed.status === 'disabled' || installed.status === 'installedDisabled' ? 'disabled' : 'installed'
  return {...item, installationState: state, latestVersion: installed.version || item.latestVersion}
}

function filterCatalogue(items: ModuleCatalogueItem[], input: {q?: string; category?: ProductHubCategory}) {
  const q = input.q?.trim().toLowerCase()
  return items.filter(item => {
    if (q && !`${item.name} ${item.description} ${item.moduleId}`.toLowerCase().includes(q)) return false
    if (input.category && input.category !== 'All' && input.category !== item.category) {
      if (input.category === 'First-party') return item.publisherId === 'modula'
      if (input.category === 'Installed') return ['installed', 'enabled', 'disabled', 'updateAvailable', 'configurationRequired'].includes(item.installationState)
      if (input.category === 'Compatible') return item.installable
      return false
    }
    return true
  })
}

function localSettingsSchema(moduleId: string): ModuleSettingsSchema {
  if (!moduleId.includes('vault-notes')) return {moduleId, version: 'local', fields: [], defaults: {}}
  return {
    moduleId,
    version: '0.2.0',
    defaults: {
      defaultFolder: 'inbox',
      autoCreateTitle: true,
      saveSourceLink: true,
      confirmBeforeSavingPost: true,
      defaultNoteSort: 'updatedAt',
      showRecentNotesOnBoard: true,
    },
    fields: [
      {fieldId: `${moduleId}.settings.defaultFolder`, name: 'defaultFolder', type: 'text', label: 'Default folder'},
      {fieldId: `${moduleId}.settings.autoCreateTitle`, name: 'autoCreateTitle', type: 'boolean', label: 'Auto-create title'},
      {fieldId: `${moduleId}.settings.saveSourceLink`, name: 'saveSourceLink', type: 'boolean', label: 'Save source link'},
      {fieldId: `${moduleId}.settings.confirmBeforeSavingPost`, name: 'confirmBeforeSavingPost', type: 'boolean', label: 'Confirm before saving a post'},
      {fieldId: `${moduleId}.settings.defaultNoteSort`, name: 'defaultNoteSort', type: 'singleSelect', label: 'Default note sort', options: [{value: 'updatedAt', label: 'Updated'}, {value: 'createdAt', label: 'Created'}, {value: 'title', label: 'Title'}]},
      {fieldId: `${moduleId}.settings.showRecentNotesOnBoard`, name: 'showRecentNotesOnBoard', type: 'boolean', label: 'Show recent notes on Board'},
    ],
  }
}

function categoryFor(moduleId: string, description: string): ProductHubCategory {
  const text = `${moduleId} ${description}`.toLowerCase()
  if (text.includes('automation')) return 'Automation'
  if (text.includes('ai') || text.includes('gaia') || text.includes('agent')) return 'AI'
  if (text.includes('creator')) return 'Creator'
  if (text.includes('media') || text.includes('video')) return 'Media'
  if (text.includes('social')) return 'Social'
  if (text.includes('developer') || text.includes('dimon')) return 'Developer'
  return 'Productivity'
}

function idempotencyKey(action: string, moduleId: string) {
  return `client-${action}-${moduleId}-${Date.now()}`
}

function localViews(moduleId: string): ModuleRuntimeView[] {
  if (!moduleId.includes('vault-notes')) return []
  return [
    {
      viewId: `${moduleId}.views.note-list`,
      moduleId,
      kind: 'collection',
      title: 'Vault Notes',
      collection: 'note',
      requiredCapabilities: [`records:module.${moduleId}.note:read`],
      layout: [{id: 'notes', component: 'recordList', collection: 'note'}],
      toolbar: [
        {
          actionId: `${moduleId}.actions.create-note`,
          kind: 'record.create',
          label: 'Create note',
          inputSchema: {
            fields: [
              {fieldId: `${moduleId}.fields.title`, name: 'title', type: 'text', label: 'Title', required: true},
              {fieldId: `${moduleId}.fields.body`, name: 'body', type: 'multilineText', label: 'Body'},
              {fieldId: `${moduleId}.fields.tags`, name: 'tags', type: 'tags', label: 'Tags'},
              {fieldId: `${moduleId}.fields.folderId`, name: 'folderId', type: 'text', label: 'Folder'},
              {fieldId: `${moduleId}.fields.sourceUri`, name: 'sourceUri', type: 'url', label: 'Source link'},
            ],
          },
          capability: `records:module.${moduleId}.note:write`,
          confirmationPolicy: 'none',
          destructive: false,
          successDestination: {kind: 'stay'},
          errorPresentation: {kind: 'inline'},
          requiresIdempotencyKey: true,
          target: {collection: 'note'},
        },
      ],
      available: true,
    },
  ]
}

function localRecords(moduleId: string, collection: string, q?: string): ModuleRecord[] {
  if (!moduleId.includes('vault-notes') || collection !== 'note') return []
  const key = localRecordKey(moduleId, collection)
  if (!LOCAL_RECORD_STORE.has(key)) {
    LOCAL_RECORD_STORE.set(key, [
      {record_id: 'local-vault-note-1', collection: 'note', moduleId, data: {title: 'Private in Modula', body: 'Vault Notes declarations render through the generic module host.', tags: ['vault'], folderId: 'inbox', sourceUri: 'https://modula.digital'}, revision: 1, visibility: 'private'},
    ])
  }
  const items = LOCAL_RECORD_STORE.get(key) ?? []
  return q ? items.filter(item => JSON.stringify(item.data).toLowerCase().includes(q.toLowerCase())) : items
}

function createLocalRecord(moduleId: string, collection: string, data: Record<string, unknown>): ModuleRecord {
  const key = localRecordKey(moduleId, collection)
  const items = localRecords(moduleId, collection)
  const record: ModuleRecord = {
    record_id: `local-${Date.now()}`,
    moduleId,
    collection,
    data,
    revision: 1,
    visibility: 'private',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  LOCAL_RECORD_STORE.set(key, [record, ...items])
  return record
}

function updateLocalRecord(moduleId: string, collection: string, recordId: string, data: Record<string, unknown>, expectedRevision?: number): ModuleRecord {
  const key = localRecordKey(moduleId, collection)
  const items = localRecords(moduleId, collection)
  const index = items.findIndex(item => item.record_id === recordId)
  if (index < 0) throw new Error('Local record not found')
  const current = items[index]
  if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new Error('Local revision conflict')
  const next = {...current, data: {...current.data, ...data}, revision: current.revision + 1, updatedAt: new Date().toISOString()}
  LOCAL_RECORD_STORE.set(key, items.map(item => item.record_id === recordId ? next : item))
  return next
}

function deleteLocalRecord(moduleId: string, collection: string, recordId: string, expectedRevision?: number): unknown {
  const key = localRecordKey(moduleId, collection)
  const items = localRecords(moduleId, collection)
  const current = items.find(item => item.record_id === recordId)
  if (!current) return {deleted: true}
  if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new Error('Local revision conflict')
  LOCAL_RECORD_STORE.set(key, items.filter(item => item.record_id !== recordId))
  return {deleted: true}
}

function localRecordKey(moduleId: string, collection: string) {
  return `${moduleId}:${collection}`
}
