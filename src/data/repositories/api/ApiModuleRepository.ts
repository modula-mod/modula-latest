import type {ApiClient} from '@/api/client'
import type {GreenfieldModuleFieldDefinition} from '@modula/greenfield-module-ui-contracts'
import type {
  InstalledModule,
  ModuleBackendMetadata,
  ModuleCatalogueItem,
  ModuleContribution,
  ModuleDetail,
  ModuleHealth,
  ModuleInstallPreview,
  ModuleRecord,
  ModuleRecordPage,
  ModuleRepository,
  ModuleRuntimeView,
  ModuleSettingsDocument,
  ModuleSettingsSchema,
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

export class ApiModuleRepository implements ModuleRepository {
  constructor(private readonly client: ApiClient) {}

  async listCatalogue(input: {q?: string; category?: ProductHubCategory; limit?: number} = {}): Promise<ModuleCatalogueItem[]> {
    try {
      const remote = await this.client.get(
        {path: '/v1/registry/modules', query: {q: input.q, limit: input.limit ?? 50}},
        decodeCataloguePage,
      )
      const installed = await this.listInstalled()
      const byId = new Map(installed.map(item => [item.moduleId, item]))
      return filterCatalogue(remote.map(item => applyInstalledState(item, byId.get(item.moduleId))), input)
    } catch {
      return filterCatalogue(LOCAL_CATALOGUE, input)
    }
  }

  async getModule(moduleId: string): Promise<ModuleDetail | null> {
    try {
      const item = await this.client.get({path: `/v1/registry/modules/${encodeURIComponent(moduleId)}`}, decodeModuleDetail)
      const installed = await this.listInstalled()
      return {...item, installationState: applyInstalledState(item, installed.find(row => row.moduleId === moduleId)).installationState}
    } catch {
      const fallback = LOCAL_CATALOGUE.find(item => item.moduleId === moduleId)
      return fallback ? {
        ...fallback,
        longDescription: fallback.description,
        backend: defaultBackendMetadata(moduleId),
        permissions: [],
        contributions: {},
        privacy: moduleId.includes('vault-notes') ? 'Private in Modula' : undefined,
      } : null
    }
  }

  listInstalled(): Promise<InstalledModule[]> {
    return this.client.get({path: '/v1/modules/installed', authenticated: true}, value =>
      Array.isArray(value) ? value.map(decodeInstalledModule) : [],
    ).catch(() => [])
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

  uninstall(moduleId: string, choice: 'keepData' | 'exportThenDelete' | 'deleteData' = 'keepData'): Promise<unknown> {
    return this.client.delete({path: `/v1/modules/${encodeURIComponent(moduleId)}/install`, authenticated: true, body: {choice, recentAuth: false, confirmDelete: false, idempotencyKey: idempotencyKey('uninstall', moduleId)}}, value => value)
  }

  uninstallPreview(moduleId: string): Promise<ModuleUninstallPreview> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/uninstall-preview`, authenticated: true}, decodeUninstallPreview)
  }

  async listViews(moduleId: string): Promise<ModuleRuntimeView[]> {
    return this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/views`, authenticated: true}, value => {
      const row = value as {views?: unknown}
      return Array.isArray(row.views) ? row.views.map(decodeRuntimeView) : []
    }).catch(() => localViews(moduleId))
  }

  async getView(moduleId: string, viewId: string): Promise<ModuleRuntimeView | null> {
    return this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/views/${encodeURIComponent(viewId)}`, authenticated: true}, decodeRuntimeView).catch(async () => {
      const views = await this.listViews(moduleId)
      return views.find(view => view.viewId === viewId) ?? views[0] ?? null
    })
  }

  listRecords(moduleId: string, collection: string, input: {q?: string; folder?: string; sort?: string; direction?: 'asc' | 'desc'; cursor?: string; limit?: number} = {}): Promise<ModuleRecordPage> {
    return this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/records/${encodeURIComponent(collection)}`, authenticated: true, query: input}, decodeRecordPage)
      .catch(() => ({moduleId, collection, items: localRecords(moduleId, collection, input.q), nextCursor: null, limit: input.limit ?? 25}))
  }

  createRecord(moduleId: string, collection: string, data: Record<string, unknown>): Promise<ModuleRecord> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/records/${encodeURIComponent(collection)}`, authenticated: true, body: {data}}, decodeRecord)
      .catch(() => createLocalRecord(moduleId, collection, data))
  }

  updateRecord(moduleId: string, collection: string, recordId: string, data: Record<string, unknown>, expectedRevision?: number): Promise<ModuleRecord> {
    return this.client.patch({path: `/v1/modules/${encodeURIComponent(moduleId)}/records/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}`, authenticated: true, body: {data, expectedRevision}}, decodeRecord)
      .catch(() => updateLocalRecord(moduleId, collection, recordId, data, expectedRevision))
  }

  deleteRecord(moduleId: string, collection: string, recordId: string, expectedRevision?: number): Promise<unknown> {
    return this.client.delete({path: `/v1/modules/${encodeURIComponent(moduleId)}/records/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}`, authenticated: true, body: {expectedRevision}}, value => value)
      .catch(() => deleteLocalRecord(moduleId, collection, recordId, expectedRevision))
  }

  runAction(moduleId: string, actionId: string, input: Record<string, unknown> = {}): Promise<unknown> {
    return this.client.post({path: `/v1/modules/${encodeURIComponent(moduleId)}/actions/${encodeURIComponent(actionId)}`, authenticated: true, body: {input, idempotencyKey: idempotencyKey(actionId, moduleId)}}, value => value)
  }

  getSettingsSchema(moduleId: string): Promise<ModuleSettingsSchema> {
    return this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/settings-schema`, authenticated: true}, decodeSettingsSchema)
      .catch(() => localSettingsSchema(moduleId))
  }

  getSettings(moduleId: string): Promise<ModuleSettingsDocument> {
    return this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/settings`, authenticated: true}, decodeSettings)
      .catch(() => ({moduleId, installationId: `local:${moduleId}`, version: 0, values: localSettingsSchema(moduleId).defaults}))
  }

  updateSettings(moduleId: string, values: Record<string, unknown>): Promise<ModuleSettingsDocument> {
    return this.client.patch({path: `/v1/modules/${encodeURIComponent(moduleId)}/settings`, authenticated: true, body: {values}}, decodeSettings)
  }

  getHealth(moduleId: string): Promise<ModuleHealth | null> {
    return this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/health`, authenticated: true}, decodeHealth)
      .catch(() => null)
  }

  getBackendDiagnostics(moduleId: string): Promise<ModuleBackendMetadata | null> {
    return this.client.get({path: `/v1/modules/${encodeURIComponent(moduleId)}/backend`, authenticated: true}, value => decodeBackendMetadata(value, moduleId))
      .catch(async () => (await this.getModule(moduleId))?.backend ?? null)
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
    return this.client.get({path: '/v1/modules/contributions', authenticated: true, query: input}, value =>
      Array.isArray(value) ? value.map(decodeContribution) : [],
    ).catch(() => [])
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
    dependencies: Array.isArray(row.dependencies) ? row.dependencies : [],
    contributions: (row.contributions ?? {}) as Record<string, number>,
    migrationsRequired: Boolean(row.migrationsRequired),
    permissionIncrease: Boolean(row.permissionIncrease),
  }
}

function decodeRuntimeView(value: unknown): ModuleRuntimeView {
  return value as ModuleRuntimeView
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
