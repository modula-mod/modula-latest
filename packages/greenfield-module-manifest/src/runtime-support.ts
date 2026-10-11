import {
  MODULA_MODULE_STANDARD_2_VERSION,
  MODULE_STANDARD_20_SECTION_NAMES,
  type ModuleStandard20SectionName,
} from '@modula/module-standard'

export const MODULE_STANDARD_RUNTIME_SUPPORT_STATES = [
  'SUPPORTED',
  'PARTIALLY_SUPPORTED',
  'DECLARATIVE_ONLY',
  'UNSUPPORTED',
  'DEPRECATED',
] as const

export type ModuleStandardRuntimeSupportState = (typeof MODULE_STANDARD_RUNTIME_SUPPORT_STATES)[number]

export type ModuleStandardRuntimeSupportDiagnostic = {
  section: ModuleStandard20SectionName
  state: ModuleStandardRuntimeSupportState
  declared: boolean
  operational: boolean
  message: string
}

export type ModuleStandardRuntimeSupport = {
  standardVersion: typeof MODULA_MODULE_STANDARD_2_VERSION
  maximumServiceInvocationDepth: 8
  sections: Record<ModuleStandard20SectionName, ModuleStandardRuntimeSupportState>
  diagnostics: Record<ModuleStandard20SectionName, string>
}

export const MODULE_STANDARD_RUNTIME_SUPPORT_2_0_0: ModuleStandardRuntimeSupport = {
  standardVersion: MODULA_MODULE_STANDARD_2_VERSION,
  maximumServiceInvocationDepth: 8,
  sections: {
    identity: 'SUPPORTED',
    lifecycle: 'PARTIALLY_SUPPORTED',
    backend: 'SUPPORTED',
    engines: 'DECLARATIVE_ONLY',
    ai: 'PARTIALLY_SUPPORTED',
    permissions: 'PARTIALLY_SUPPORTED',
    settings: 'SUPPORTED',
    routes: 'PARTIALLY_SUPPORTED',
    views: 'SUPPORTED',
    records: 'SUPPORTED',
    actions: 'PARTIALLY_SUPPORTED',
    functions: 'PARTIALLY_SUPPORTED',
    jobs: 'SUPPORTED',
    events: 'PARTIALLY_SUPPORTED',
    notifications: 'DECLARATIVE_ONLY',
    search: 'PARTIALLY_SUPPORTED',
    exports: 'PARTIALLY_SUPPORTED',
    imports: 'DECLARATIVE_ONLY',
    synchronization: 'DECLARATIVE_ONLY',
    dependencies: 'PARTIALLY_SUPPORTED',
    optionalDependencies: 'PARTIALLY_SUPPORTED',
    integrations: 'DECLARATIVE_ONLY',
    billing: 'DECLARATIVE_ONLY',
    telemetry: 'DECLARATIVE_ONLY',
    diagnostics: 'PARTIALLY_SUPPORTED',
    accessibility: 'DECLARATIVE_ONLY',
    localization: 'DECLARATIVE_ONLY',
    appearance: 'PARTIALLY_SUPPORTED',
    onboarding: 'DECLARATIVE_ONLY',
    migrations: 'PARTIALLY_SUPPORTED',
    capabilities: 'PARTIALLY_SUPPORTED',
    services: 'DECLARATIVE_ONLY',
    apis: 'DECLARATIVE_ONLY',
    hooks: 'DECLARATIVE_ONLY',
    metrics: 'DECLARATIVE_ONLY',
    storage: 'PARTIALLY_SUPPORTED',
    widgets: 'PARTIALLY_SUPPORTED',
    navigation: 'PARTIALLY_SUPPORTED',
    ui: 'PARTIALLY_SUPPORTED',
    automation: 'DECLARATIVE_ONLY',
    offline: 'DECLARATIVE_ONLY',
    realtime: 'DECLARATIVE_ONLY',
    versioning: 'PARTIALLY_SUPPORTED',
    compatibilityMatrix: 'PARTIALLY_SUPPORTED',
    marketplace: 'SUPPORTED',
  },
  diagnostics: {
    identity: 'Manifest identity is validated and used as the runtime namespace.',
    lifecycle: 'Install, enable, disable, update and uninstall requests exist; Block 13 transactional lifecycle stages are not complete.',
    backend: 'Greenfield-managed and module-managed backend declarations have runtime discovery, token and gateway boundaries.',
    engines: 'Engine readiness is accepted as metadata only; custom engines are not executed by the host.',
    ai: 'Provider-neutral product AI actions are gated; full Standard 2.0 AI engine coverage remains partial.',
    permissions: 'Legacy permission grants are enforced; split Standard 2.0 permission categories are not fully grantable yet.',
    settings: 'Module settings schemas and account-scoped settings are available through Greenfield.',
    routes: 'Module routes are namespaced, but full Standard 2.0 contributed route registration remains partial.',
    views: 'Declarative module views are resolved through the Greenfield module view runtime.',
    records: 'Module record collections are account-scoped, schema-oriented and exposed through repository APIs.',
    actions: 'Module actions exist through bounded host APIs; Standard 2.0 API-operation invocation is not complete.',
    functions: 'Function declarations are registered as bounded module contributions; arbitrary function execution is not enabled.',
    jobs: 'Declared jobs are registered and execute through the canonical worker or scoped service-pull lifecycle with leases, retries and dead letters.',
    events: 'Transactional outbox delivery and scoped backend publication are operational; complete manifest-driven subscription binding remains partial.',
    notifications: 'Notification declarations are metadata only in this runtime slice.',
    search: 'Search storage and fixed projectors exist; generic manifest-declared module-record projection remains partial.',
    exports: 'Export support exists for host-owned records; Standard 2.0 import/export registries remain partial.',
    imports: 'Import declarations are metadata only.',
    synchronization: 'Synchronization declarations are metadata only; offline sync remains deferred.',
    dependencies: 'Requires, optional, recommended, conflicts, replaces and provides are planned, but the full atomic graph engine is not complete.',
    optionalDependencies: 'Optional dependency degradation is surfaced in planning, but complete runtime degradation is not complete.',
    integrations: 'Integration declarations are metadata only.',
    billing: 'DIMON and billing declarations remain inactive metadata.',
    telemetry: 'Telemetry declarations are metadata only.',
    diagnostics: 'Host diagnostics expose registry and health metadata; full developer diagnostics are not complete.',
    accessibility: 'Accessibility declarations are metadata only.',
    localization: 'Localization declarations are metadata only.',
    appearance: 'Host UI inherits Modula theme surfaces; module-specific appearance declarations remain partial.',
    onboarding: 'Onboarding declarations are metadata only.',
    migrations: 'Host schema/data migrations exist; arbitrary module-declared migrations are not executed.',
    capabilities: 'Versioned host capability descriptors and required/optional negotiation are available; capability-specific executors and renderers remain partial.',
    services: 'Service declarations validate; the Block 13 service fabric is not complete.',
    apis: 'API declarations validate; inter-module invocation through the service gateway is not complete.',
    hooks: 'Hook declarations validate; controlled hook dispatch is not complete.',
    metrics: 'Metrics declarations are metadata only.',
    storage: 'Records, settings and backend storage boundaries exist; Standard 2.0 allocation tables are not complete.',
    widgets: 'Widget contributions can be represented; the complete Standard 2.0 widget runtime is not complete.',
    navigation: 'Navigation contributions are namespaced; collision-proof registration remains partial.',
    ui: 'Renderer-neutral Product UI semantics validate and unavailable capabilities fail closed; advanced renderers remain unavailable until implemented by a host.',
    automation: 'Automation declarations remain metadata only.',
    offline: 'Offline declarations remain metadata only.',
    realtime: 'Realtime declarations remain metadata only in this runtime slice.',
    versioning: 'Version declarations are validated and surfaced, but complete runtime negotiation is partial.',
    compatibilityMatrix: 'Compatibility metadata is evaluated for host/platform fit, but full runtime negotiation is partial.',
    marketplace: 'Product Hub surfaces marketplace and registry metadata through Greenfield.',
  },
}

export function runtimeSupportForStandardVersion(standardVersion: string | null | undefined): ModuleStandardRuntimeSupport | undefined {
  return standardVersion === MODULA_MODULE_STANDARD_2_VERSION ? MODULE_STANDARD_RUNTIME_SUPPORT_2_0_0 : undefined
}

export function runtimeSupportDiagnosticsForManifest(input: unknown): ModuleStandardRuntimeSupportDiagnostic[] {
  const manifest = asRecord(input)
  const support = runtimeSupportForStandardVersion(stringValue(manifest.standardVersion))
  if (!support) return []
  return MODULE_STANDARD_20_SECTION_NAMES.map(section => {
    const state = support.sections[section]
    return {
      section,
      state,
      declared: sectionDeclared(manifest, section),
      operational: state === 'SUPPORTED',
      message: support.diagnostics[section],
    }
  })
}

function sectionDeclared(manifest: Record<string, unknown>, section: ModuleStandard20SectionName): boolean {
  if (section in manifest) return true
  const contributions = asRecord(manifest.contributions)
  const graph = asRecord(manifest.dependencyGraph)
  const capabilityDiscovery = asRecord(manifest.capabilityDiscovery)
  switch (section) {
    case 'dependencies':
      return hasItems(graph.requires) || hasItems(graph.conflicts) || hasItems(graph.replaces) || hasItems(graph.provides) || hasItems(manifest.dependencies)
    case 'optionalDependencies':
      return hasItems(graph.optional) || hasItems(graph.recommended) || hasItems(manifest.dependencies)
    case 'services':
      return hasVersionedItems(manifest.serviceRegistry)
    case 'apis':
      return hasVersionedItems(manifest.apiRegistry)
    case 'hooks':
      return hasVersionedItems(manifest.hookRegistry)
    case 'events':
      return hasVersionedItems(manifest.eventBus) || hasItems(contributions.events)
    case 'jobs':
      return hasVersionedItems(manifest.jobRegistry) || hasItems(contributions.jobs)
    case 'storage':
      return hasVersionedItems(manifest.storageModel)
    case 'widgets':
      return hasVersionedItems(manifest.widgetRegistry) || hasItems(contributions.widgets)
    case 'navigation':
      return hasVersionedItems(manifest.navigationRegistry) || hasItems(contributions.routes) || hasItems(contributions.profileTabs)
    case 'ui':
      return hasVersionedItems(manifest.uiContributions) || hasItems(contributions.boardSurfaces) || hasItems(contributions.settings)
    case 'capabilities':
      return Object.keys(capabilityDiscovery).some(key => key.startsWith('supports')) || hasItems(asRecord(manifest.dependencyGraph).provides)
    case 'engines':
      return 'engineReadiness' in manifest
    case 'permissions':
      return 'permissionModel' in manifest || hasItems(manifest.permissions)
    case 'backend':
      return 'backend' in manifest
    case 'ai':
      return 'ai' in manifest
    case 'routes':
      return hasItems(contributions.routes)
    case 'views':
      return hasItems(contributions.boardSurfaces) || hasItems(contributions.profileTabs)
    case 'records':
      return hasItems(contributions.schemas)
    case 'actions':
      return hasItems(contributions.tools)
    case 'functions':
      return hasItems(contributions.functions)
    case 'settings':
      return hasItems(contributions.settings)
    case 'search':
      return capabilityDiscovery.supportsSearch === true
    case 'notifications':
      return capabilityDiscovery.supportsNotifications === true
    case 'automation':
      return hasVersionedItems(manifest.automationRegistry)
    case 'diagnostics':
      return hasVersionedItems(manifest.diagnosticsModel)
    case 'metrics':
      return hasVersionedItems(manifest.metrics)
    default:
      return false
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function hasVersionedItems(value: unknown): boolean {
  return hasItems(asRecord(value).items)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
