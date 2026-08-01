import {
  GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
  createDefaultModuleSectionVersions,
  dependencyGraphFromManifest,
  manifestChecksum,
  runtimeSupportDiagnosticsForManifest,
  runtimeSupportForStandardVersion,
  type GreenfieldModuleManifest,
  type ModuleStandard20CapabilityDiscovery,
  type ModuleStandard20CompatibilityMatrix,
  type ModuleStandard20DependencyGraph,
  type ModuleStandard20EngineReadiness,
  type ModuleStandard20PermissionModel,
  type ModuleStandard20SectionVersions,
  type ModuleStandard20VersionedSection,
  type ModuleStandardRuntimeSupportDiagnostic,
} from '@modula/greenfield-module-manifest'

const STANDARD_2_VERSION = '2.0.0'
type ModuleStandard20JsonObject = Record<string, unknown>

export type NormalizedModuleManifest = {
  identity: {
    moduleId: string
    name: string
    description: string
    publisher: {
      publisherId: string
      displayName: string
      website?: string
    }
  }
  versions: {
    moduleVersion: string
    manifestVersion: number
    standardVersion: string
    normalizedFromStandardVersion: string
    sectionVersions: ModuleStandard20SectionVersions
  }
  artifact: {
    manifestSha256: string
    releaseSha256: string | null
    checksumSource: 'release-record' | 'manifest-integrity' | 'source-manifest'
  }
  dependencies: ModuleStandard20DependencyGraph
  capabilities: {
    discovery: ModuleStandard20CapabilityDiscovery
    provides: ModuleStandard20DependencyGraph['provides']
  }
  permissions: {
    legacy: GreenfieldModuleManifest['permissions']
    model: ModuleStandard20PermissionModel
  }
  services: ModuleStandard20VersionedSection
  apis: ModuleStandard20VersionedSection
  hooks: ModuleStandard20VersionedSection
  jobs: ModuleStandard20VersionedSection
  storage: ModuleStandard20VersionedSection
  events: ModuleStandard20VersionedSection
  settings: {
    contributions: unknown[]
    defaults: Record<string, unknown>
  }
  search: {
    enabled: boolean
    declarations: ModuleStandard20VersionedSection
  }
  ai: Record<string, unknown>
  backend: Record<string, unknown>
  widgets: ModuleStandard20VersionedSection
  navigation: ModuleStandard20VersionedSection
  uiContributions: ModuleStandard20VersionedSection
  health: ModuleStandard20VersionedSection
  diagnostics: {
    model: ModuleStandard20VersionedSection
    runtimeSupport: NonNullable<ReturnType<typeof runtimeSupportForStandardVersion>>
    unsupportedSections: ModuleStandardRuntimeSupportDiagnostic[]
  }
  compatibility: {
    host: GreenfieldModuleManifest['compatibility']
    matrix: ModuleStandard20CompatibilityMatrix
  }
  trust: {
    requestedLevel: GreenfieldModuleManifest['trust']['requestedLevel']
    licenseStatus: GreenfieldModuleManifest['license']['status']
    licenseSpdx: string | null
    evidenceIds: string[]
  }
  marketplace: Record<string, unknown>
  engineReadiness: ModuleStandard20EngineReadiness
  extensions: Record<string, unknown>
}

export type NormalizeModuleManifestOptions = {
  manifestSha256?: string | null
  releaseSha256?: string | null
}

export function normalizeModuleManifest(
  manifest: GreenfieldModuleManifest,
  options: NormalizeModuleManifestOptions = {},
): NormalizedModuleManifest {
  const source = cloneJson(manifest)
  const standardVersion = standardVersionForManifest(source)
  const runtimeStandardVersion = STANDARD_2_VERSION
  const runtimeSupport = runtimeSupportForStandardVersion(runtimeStandardVersion)!
  const runtimeDiagnostics = runtimeSupportDiagnosticsForManifest({
    ...source,
    standardVersion: runtimeStandardVersion,
  })
  const unsupportedSections = runtimeDiagnostics.filter(diagnostic =>
    diagnostic.declared && (diagnostic.state === 'DECLARATIVE_ONLY' || diagnostic.state === 'UNSUPPORTED' || diagnostic.state === 'PARTIALLY_SUPPORTED'),
  )
  const checksum = options.manifestSha256 ?? source.integrity.manifestSha256
  const checksumSource = options.manifestSha256
    ? 'release-record'
    : source.integrity.manifestSha256
      ? 'manifest-integrity'
      : 'source-manifest'

  return {
    identity: {
      moduleId: source.moduleId,
      name: source.name,
      description: source.description,
      publisher: cloneJson(source.publisher),
    },
    versions: {
      moduleVersion: source.version,
      manifestVersion: source.manifestVersion,
      standardVersion,
      normalizedFromStandardVersion: standardVersion,
      sectionVersions: sectionVersionsForManifest(source, standardVersion),
    },
    artifact: {
      manifestSha256: checksum ?? manifestChecksum(source),
      releaseSha256: options.releaseSha256 ?? source.integrity.releaseSha256 ?? null,
      checksumSource,
    },
    dependencies: cloneJson(dependencyGraphFromManifest(source)),
    capabilities: {
      discovery: cloneJson(standard20Object<ModuleStandard20CapabilityDiscovery>(source, 'capabilityDiscovery', {version: STANDARD_2_VERSION})),
      provides: cloneJson(dependencyGraphFromManifest(source).provides ?? []),
    },
    permissions: {
      legacy: cloneJson(source.permissions),
      model: cloneJson(standard20Object<ModuleStandard20PermissionModel>(source, 'permissionModel', {version: STANDARD_2_VERSION, categories: {}})),
    },
    services: cloneJson(versionedSection(source, 'serviceRegistry')),
    apis: cloneJson(versionedSection(source, 'apiRegistry')),
    hooks: cloneJson(versionedSection(source, 'hookRegistry')),
    jobs: cloneJson(versionedSection(source, 'jobRegistry')),
    storage: cloneJson(versionedSection(source, 'storageModel')),
    events: cloneJson(versionedSection(source, 'eventBus', legacyContributionItems(source, 'events'))),
    settings: {
      contributions: cloneJson(legacyContributionItems(source, 'settings')),
      defaults: {},
    },
    search: {
      enabled: standard20Object<ModuleStandard20CapabilityDiscovery>(source, 'capabilityDiscovery', {version: STANDARD_2_VERSION}).supportsSearch === true,
      declarations: cloneJson(versionedSection(source, 'search')),
    },
    ai: cloneJson(source.ai ?? {}),
    backend: cloneJson(source.backend ?? {mode: 'greenfield-managed'}),
    widgets: cloneJson(versionedSection(source, 'widgetRegistry', legacyContributionItems(source, 'widgets'))),
    navigation: cloneJson(versionedSection(source, 'navigationRegistry', [
      ...legacyContributionItems(source, 'routes'),
      ...legacyContributionItems(source, 'profileTabs'),
    ])),
    uiContributions: cloneJson(versionedSection(source, 'uiContributions', [
      ...legacyContributionItems(source, 'boardSurfaces'),
      ...legacyContributionItems(source, 'settings'),
    ])),
    health: cloneJson(versionedSection(source, 'healthModel')),
    diagnostics: {
      model: cloneJson(versionedSection(source, 'diagnosticsModel')),
      runtimeSupport,
      unsupportedSections,
    },
    compatibility: {
      host: cloneJson(source.compatibility),
      matrix: cloneJson(standard20Object<ModuleStandard20CompatibilityMatrix>(source, 'compatibilityMatrix', {
        version: STANDARD_2_VERSION,
        greenfieldVersion: `>=${source.compatibility.minimumGreenfieldVersion}`,
        platforms: source.compatibility.platforms,
      })),
    },
    trust: {
      requestedLevel: source.trust.requestedLevel,
      licenseStatus: source.license.status,
      licenseSpdx: source.license.spdx ?? null,
      evidenceIds: cloneJson(source.license.evidenceIds),
    },
    marketplace: cloneJson(standard20Object(source, 'marketplace', {})),
    engineReadiness: cloneJson(standard20Object<ModuleStandard20EngineReadiness>(source, 'engineReadiness', {version: STANDARD_2_VERSION, engines: []})),
    extensions: cloneJson(source.extensions ?? {}),
  }
}

function standardVersionForManifest(manifest: GreenfieldModuleManifest): string {
  if (manifest.manifestVersion === GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION && 'standardVersion' in manifest) return manifest.standardVersion
  if (manifest.ai) return '1.2.0'
  if (manifest.backend) return '1.1.0'
  return '1.0.0'
}

function sectionVersionsForManifest(
  manifest: GreenfieldModuleManifest,
  standardVersion: string,
): ModuleStandard20SectionVersions {
  if (manifest.manifestVersion === GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION && manifest.sectionVersions) {
    return cloneJson(manifest.sectionVersions)
  }
  if (standardVersion === STANDARD_2_VERSION) return createDefaultModuleSectionVersions(STANDARD_2_VERSION)
  return Object.fromEntries(
    Object.keys(createDefaultModuleSectionVersions(STANDARD_2_VERSION)).map(section => [section, '1.0.0']),
  ) as ModuleStandard20SectionVersions
}

function versionedSection(
  manifest: GreenfieldModuleManifest,
  key: keyof GreenfieldModuleManifest | string,
  fallbackItems: ModuleStandard20JsonObject[] = [],
): ModuleStandard20VersionedSection {
  const value = standard20Object<ModuleStandard20VersionedSection>(manifest, key, undefined)
  if (value) return value as ModuleStandard20VersionedSection
  return {version: STANDARD_2_VERSION, items: cloneJson(fallbackItems)}
}

function standard20Object<T extends Record<string, unknown>>(
  manifest: GreenfieldModuleManifest,
  key: keyof GreenfieldModuleManifest | string,
  fallback: T,
): T
function standard20Object<T extends Record<string, unknown>>(
  manifest: GreenfieldModuleManifest,
  key: keyof GreenfieldModuleManifest | string,
  fallback: undefined,
): T | undefined
function standard20Object<T extends Record<string, unknown>>(
  manifest: GreenfieldModuleManifest,
  key: keyof GreenfieldModuleManifest | string,
  fallback: T | undefined,
): T | undefined {
  const value = (manifest as Record<string, unknown>)[key]
  if (isJsonObject(value)) return cloneJson(value) as T
  return fallback ? cloneJson(fallback) : undefined
}

function legacyContributionItems(manifest: GreenfieldModuleManifest, key: string): ModuleStandard20JsonObject[] {
  const contributions = manifest.contributions as Record<string, unknown>
  const items = contributions[key]
  if (!Array.isArray(items)) return []
  return items.filter(isJsonObject).map(item => cloneJson(item))
}

function isJsonObject(value: unknown): value is ModuleStandard20JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
