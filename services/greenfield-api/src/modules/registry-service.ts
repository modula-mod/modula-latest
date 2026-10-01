import {
  extractModuleStandard20Summary,
  runtimeSupportDiagnosticsForManifest,
  runtimeSupportForStandardVersion,
  type GreenfieldModuleManifest,
} from '@modula/greenfield-module-manifest'
import type {GreenfieldRegistryFilter, GreenfieldRegistryModuleSummary, GreenfieldRegistryStandardMetadata} from '@modula/greenfield-module-registry-contracts'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from './module-errors.js'
import type {GreenfieldModuleReleaseRecord} from './module-domain.js'
import {normalizeModuleManifest} from './manifest-normalizer.js'
import {GreenfieldModuleReleaseService} from './release-service.js'
import {classifyBetaModule, installabilityForBetaModule} from './beta-catalogue-policy.js'
import {moduleIdFamily, resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import {GreenfieldModuleMarketplaceService} from './marketplace-service.js'
import {GreenfieldRegistryPresentationService} from './registry-presentation-service.js'
import {GreenfieldRegistryTrustService, productProjection, type RegistryTrustOptions} from './registry-trust-service.js'

export type GreenfieldModuleRegistryOptions = {publicApiUrl?: string | null}

export class GreenfieldModuleRegistryService {
  private readonly releases: GreenfieldModuleReleaseService
  private readonly marketplace: GreenfieldModuleMarketplaceService
  readonly presentation: GreenfieldRegistryPresentationService
  readonly trust: GreenfieldRegistryTrustService

  constructor(private readonly db: ModulaDb, options: GreenfieldModuleRegistryOptions = {}) {
    this.releases = new GreenfieldModuleReleaseService(db)
    this.marketplace = new GreenfieldModuleMarketplaceService(db)
    this.presentation = new GreenfieldRegistryPresentationService(db, options.publicApiUrl)
    this.trust = new GreenfieldRegistryTrustService(db)
  }

  async listModules(filters: GreenfieldRegistryFilter = {}): Promise<{items: GreenfieldRegistryModuleSummary[]; nextCursor: string | null}> {
    const limit = Math.max(1, Math.min(filters.limit ?? 50, 100))
    const releases = await this.db
      .selectFrom('greenfield_module_releases')
      .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
      .innerJoin('greenfield_publishers', 'greenfield_publishers.publisher_id', 'greenfield_module_releases.publisher_id')
      .select([
        'greenfield_module_releases.release_id',
        'greenfield_module_releases.module_id',
        'greenfield_module_releases.version',
        'greenfield_module_releases.release_state',
        'greenfield_module_releases.license_status',
        'greenfield_module_releases.trust_level',
        'greenfield_module_releases.published_at',
        'greenfield_module_releases.product_kind',
        'greenfield_module_versions.manifest',
        'greenfield_publishers.publisher_id',
        'greenfield_publishers.display_name',
      ])
      .$if(Boolean(filters.publisher), qb => qb.where('greenfield_module_releases.publisher_id', '=', filters.publisher!))
      .$if(Boolean(filters.trust), qb => qb.where('greenfield_module_releases.trust_level', '=', filters.trust as any))
      .$if(Boolean(filters.status), qb => qb.where('greenfield_module_releases.release_state', '=', filters.status as any))
      .$if((filters.productKind ?? 'module') !== 'all', qb => qb.where('greenfield_module_releases.product_kind', '=', (filters.productKind ?? 'module') as any))
      .orderBy('greenfield_module_releases.module_id')
      .orderBy('greenfield_module_releases.version', 'desc')
      .execute()

    const byModule = new Map<string, GreenfieldRegistryModuleSummary>()
    const latestReleaseIds = new Map<string, string>()
    for (const row of releases as any[]) {
      const manifest = row.manifest as GreenfieldModuleManifest
      const canonicalId = resolveCanonicalModuleId(row.module_id)
      if (filters.q && !`${manifest.name} ${manifest.description} ${canonicalId}`.toLowerCase().includes(filters.q.toLowerCase())) continue
      if (filters.platform && !manifest.compatibility.platforms.includes(filters.platform)) continue
      const beta = classifyBetaModule({moduleId: canonicalId, status: row.release_state, manifest: manifest as any})
      if (!beta.visibleInBeta) continue
      const existing = byModule.get(canonicalId)
      const newer = !existing || versionIsNewer(row.version, existing.latestVersion)
      if (newer) {
        const installable = row.release_state === 'published'
        latestReleaseIds.set(canonicalId, row.release_id)
        byModule.set(canonicalId, {
          moduleId: canonicalId,
          productKind: row.product_kind,
          name: manifest.name,
          description: manifest.description,
          publisherId: row.publisher_id,
          publisherName: row.display_name,
          latestVersion: row.version,
          trustLevel: row.trust_level,
          licenseStatus: row.license_status,
          status: row.release_state,
          installable,
          platforms: manifest.compatibility.platforms,
          standard: standardMetadataForManifest(manifest),
          betaClassification: beta.classification,
          installability: installabilityForBetaModule({
            moduleId: canonicalId,
            version: row.version,
            releaseState: row.release_state,
            classification: beta.classification,
            installable,
          }),
        } as any)
      }
    }

    const placeholders = await this.db
      .selectFrom('greenfield_extension_catalogue')
      .selectAll()
      .$if((filters.productKind ?? 'module') !== 'all', qb => qb.where('kind', '=', filters.productKind ?? 'module'))
      .execute()
    for (const row of placeholders) {
      const manifest = (row.manifest ?? {}) as any
      const moduleId = resolveCanonicalModuleId(manifest.moduleId ?? row.slug)
      const status = (manifest.state === 'planned' ? 'planned' : row.catalogue_status) as GreenfieldRegistryModuleSummary['status']
      const beta = classifyBetaModule({moduleId, status, manifest})
      if (!beta.visibleInBeta) continue
      if (byModule.has(moduleId)) continue
      if (filters.q && !`${row.name} ${row.description} ${moduleId}`.toLowerCase().includes(filters.q.toLowerCase())) continue
      if (filters.status && filters.status !== row.catalogue_status && filters.status !== manifest.state) continue
      byModule.set(moduleId, {
        moduleId,
        productKind: row.kind as any,
        name: row.name,
        description: row.description,
        publisherId: 'modula',
        publisherName: row.publisher,
        latestVersion: null,
        trustLevel: row.trust,
        licenseStatus: manifest.inactive ? 'unknown' : 'firstParty',
        status,
        installable: false,
        platforms: [],
        standard: standardMetadataForManifest(manifest),
        betaClassification: beta.classification,
        installability: installabilityForBetaModule({
          moduleId,
          version: null,
          releaseState: status,
          classification: beta.classification,
          installable: false,
        }),
      } as any)
    }

    const items = Array.from(byModule.values()).sort((a, b) => a.moduleId.localeCompare(b.moduleId)).slice(0, limit)
    const presentations = await this.presentation.forReleases(items.map(item => latestReleaseIds.get(item.moduleId) ?? ''))
    for (const item of items as any[]) {
      const releaseId = latestReleaseIds.get(item.moduleId)
      item.registryReleaseId = releaseId ?? null
      item.presentation = releaseId ? summaryPresentation(presentations.get(releaseId) ?? null) : null
    }
    return {items, nextCursor: byModule.size > limit ? String(limit) : null}
  }

  async getModule(moduleId: string, trustOptions: RegistryTrustOptions = {}) {
    const canonicalId = resolveCanonicalModuleId(moduleId)
    const releases = await this.listVersions(canonicalId)
    if (releases.length > 0) {
      const latest = releases[0]!
      const latestPublishedVersion = releases.find(item => item.releaseState === 'published')?.version ?? null
      const beta = classifyBetaModule({moduleId: latest.moduleId, status: latest.releaseState, manifest: latest.manifest as any})
      if (!beta.visibleInBeta) throw moduleError('NOT_FOUND', `Module ${moduleId} not found`)
      const installable = latest.releaseState === 'published'
      const manifestRecord = latest.manifest as Record<string, unknown>
      const [marketplace, presentation, trust, product] = await Promise.all([
        this.marketplace.project({
          moduleId: latest.moduleId,
          manifest: latest.manifest,
          registryPublishedAt: latest.publishedAt,
        }),
        this.presentation.forRelease(latest.releaseId),
        this.trust.forRelease(latest, trustOptions, latestPublishedVersion),
        this.productProjectionFor(latest.releaseId),
      ])
      return {
        registryReleaseId: latest.releaseId,
        product,
        presentation,
        registryTrust: trust,
        moduleId: latest.moduleId,
        productKind: (latest.manifest as any).extensionProduct?.kind ?? 'module',
        name: latest.manifest.name,
        description: latest.manifest.description,
        publisher: latest.manifest.publisher,
        latestVersion: latest.version,
        status: latest.releaseState,
        trust: latest.trustLevel,
        license: latest.licenseStatus,
        compatibility: latest.manifest.compatibility,
        contributions: latest.manifest.contributions,
        permissions: latest.manifest.permissions,
        backend: latest.manifest.backend,
        ai: latest.manifest.ai,
        manifest: latest.manifest,
        manifestSha256: latest.manifestSha256,
        releaseSha256: latest.releaseSha256,
        source: {
          repository: latest.sourceRepository,
          commit: latest.sourceCommit,
          manifestPath: latest.manifestPath,
        },
        standardMetadata: standardMetadataForManifest(latest.manifest),
        normalizedManifest: normalizeModuleManifest(latest.manifest, {
          manifestSha256: latest.manifestSha256,
          releaseSha256: latest.releaseSha256,
        }),
        marketplace,
        releaseNotes: marketplace.release.notes,
        publishedAt: marketplace.release.publishedAt,
        releaseSizeBytes: marketplace.release.sizeBytes,
        betaClassification: beta.classification,
        installability: installabilityForBetaModule({
          moduleId: latest.moduleId,
          version: latest.version,
          releaseId: latest.releaseId,
          releaseState: latest.releaseState,
          classification: beta.classification,
          installable,
        }),
        dependencyGraph: manifestRecord.dependencyGraph,
        serviceRegistry: manifestRecord.serviceRegistry,
        apiRegistry: manifestRecord.apiRegistry,
        eventBus: manifestRecord.eventBus,
        hookRegistry: manifestRecord.hookRegistry,
        capabilityDiscovery: manifestRecord.capabilityDiscovery,
      }
    }
    const placeholder = await this.db
      .selectFrom('greenfield_extension_catalogue')
      .selectAll()
      .where('slug', 'in', [...moduleIdFamily(canonicalId)])
      .where('kind', '=', 'module')
      .executeTakeFirst()
    if (!placeholder) throw moduleError('NOT_FOUND', `Module ${moduleId} not found`)
    const manifest = (placeholder.manifest ?? {}) as Record<string, unknown>
    const status = (manifest.state === 'planned' ? 'planned' : placeholder.catalogue_status) as GreenfieldRegistryModuleSummary['status']
    const beta = classifyBetaModule({moduleId, status, manifest})
    if (!beta.visibleInBeta) throw moduleError('NOT_FOUND', `Module ${moduleId} not found`)
    return {
      moduleId: canonicalId,
      name: placeholder.name,
      description: placeholder.description,
      publisher: {publisherId: 'modula', displayName: placeholder.publisher},
      latestVersion: null,
      status,
      trust: placeholder.trust,
      license: 'unknown',
      compatibility: {},
      contributions: {},
      placeholder: manifest,
      standardMetadata: standardMetadataForManifest(manifest),
      betaClassification: beta.classification,
      installability: installabilityForBetaModule({
        moduleId,
        version: null,
        releaseState: status,
        classification: beta.classification,
        installable: false,
      }),
    }
  }

  async listVersions(moduleId: string): Promise<GreenfieldModuleReleaseRecord[]> {
    const canonicalId = resolveCanonicalModuleId(moduleId)
    const preflight = classifyBetaModule({moduleId: canonicalId, status: 'published'})
    if (!preflight.visibleInBeta) throw moduleError('NOT_FOUND', `Module ${canonicalId} not found`)
    const rows = await this.db
      .selectFrom('greenfield_module_releases')
      .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
      .select([
        'greenfield_module_releases.release_id',
        'greenfield_module_releases.extension_id',
        'greenfield_module_releases.extension_version_id',
        'greenfield_module_releases.module_id',
        'greenfield_module_releases.version',
        'greenfield_module_releases.publisher_id',
        'greenfield_module_releases.release_state',
        'greenfield_module_releases.manifest_sha256',
        'greenfield_module_releases.release_sha256',
        'greenfield_module_releases.signature_key_id',
        'greenfield_module_releases.signature',
        'greenfield_module_releases.source_repository',
        'greenfield_module_releases.source_commit',
        'greenfield_module_releases.manifest_path',
        'greenfield_module_releases.license_status',
        'greenfield_module_releases.trust_level',
        'greenfield_module_releases.published_at',
        'greenfield_module_versions.manifest',
      ])
      .where('greenfield_module_releases.module_id', 'in', [...moduleIdFamily(canonicalId)])
      .orderBy('greenfield_module_releases.version', 'desc')
      .execute()
    // Order by semantic version, not by string ("1.10.0" must sort above "1.9.0").
    const ordered = [...(rows as any[])].sort((left, right) => (versionIsNewer(left.version, right.version) ? -1 : versionIsNewer(right.version, left.version) ? 1 : 0))
    return ordered.map(row => ({
      releaseId: row.release_id,
      extensionId: row.extension_id,
      extensionVersionId: row.extension_version_id,
      moduleId: resolveCanonicalModuleId(row.module_id),
      version: row.version,
      publisherId: row.publisher_id,
      releaseState: row.release_state,
      manifest: row.manifest,
      manifestSha256: row.manifest_sha256,
      releaseSha256: row.release_sha256,
      signatureKeyId: row.signature_key_id,
      signature: row.signature,
      sourceRepository: row.source_repository,
      sourceCommit: row.source_commit,
      manifestPath: row.manifest_path,
      licenseStatus: row.license_status,
      trustLevel: row.trust_level,
      publishedAt: row.published_at ?? null,
    }))
  }

  async getVersion(moduleId: string, version: string): Promise<GreenfieldModuleReleaseRecord> {
    const release = await this.releases.getRelease(moduleId, version)
    if (!release) throw moduleError('NOT_FOUND', `Module release ${moduleId}@${version} not found`)
    return release
  }

  async getVersionDetail(moduleId: string, version: string, trustOptions: RegistryTrustOptions = {}) {
    const release = await this.getVersion(moduleId, version)
    const latestPublishedVersion = (await this.listVersions(release.moduleId)).find(item => item.releaseState === 'published')?.version ?? null
    const [presentation, trust, product] = await Promise.all([
      this.presentation.forRelease(release.releaseId),
      this.trust.forRelease(release, trustOptions, latestPublishedVersion),
      this.productProjectionFor(release.releaseId),
    ])
    return {...release, registryReleaseId: release.releaseId, product, presentation, registryTrust: trust}
  }

  async productProjectionFor(releaseId: string) {
    const ingestion = await this.db.selectFrom('greenfield_mps_ingestions')
      .select(['manifest', 'manifest_sha256', 'product_standard'])
      .where('release_id', '=', releaseId)
      .executeTakeFirst()
    return productProjection(ingestion)
  }

  async latestPublished(moduleId: string): Promise<GreenfieldModuleReleaseRecord> {
    const releases = await this.listVersions(moduleId)
    const published = releases.filter(item => item.releaseState === 'published')
    const release = published.sort((left, right) => (versionIsNewer(left.version, right.version) ? -1 : 1))[0]
    if (!release) throw moduleError('NOT_FOUND', `Published release for ${moduleId} not found`)
    return release
  }
}

function summaryPresentation(presentation: Awaited<ReturnType<GreenfieldRegistryPresentationService['forRelease']>>) {
  if (!presentation) return null
  return {
    releaseId: presentation.releaseId,
    version: presentation.version,
    icon: presentation.icon,
    cover: presentation.cover,
    screenshots: presentation.screenshots,
    developmentAssets: presentation.developmentAssets,
  }
}

function versionIsNewer(candidate: string, current: string | null | undefined): boolean {
  if (!current) return true
  const parse = (value: string) => value.split(/[.-]/).map(part => Number.parseInt(part, 10) || 0)
  const left = parse(candidate)
  const right = parse(current)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0
    const b = right[index] ?? 0
    if (a > b) return true
    if (a < b) return false
  }
  return false
}

function standardMetadataForManifest(input: unknown): GreenfieldRegistryStandardMetadata {
  const manifest = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}
  const summary = extractModuleStandard20Summary(manifest)
  const runtimeSupport = runtimeSupportForStandardVersion(summary.standardVersion)
  const runtimeDiagnostics = runtimeSupportDiagnosticsForManifest(manifest)
    .filter(diagnostic => diagnostic.declared && !diagnostic.operational)
  return {
    manifestVersion: typeof manifest.manifestVersion === 'number' ? manifest.manifestVersion : null,
    standardVersion: typeof manifest.standardVersion === 'string' ? manifest.standardVersion : null,
    sectionVersions: Object.fromEntries(Object.entries(summary.sectionVersions).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    runtimeSupport: runtimeSupport ? {
      standardVersion: runtimeSupport.standardVersion,
      maximumServiceInvocationDepth: runtimeSupport.maximumServiceInvocationDepth,
      sections: runtimeSupport.sections,
    } : undefined,
    runtimeDiagnostics,
    dependencies: summary.dependencies,
    registries: {
      services: summary.services,
      apis: summary.apis,
      hooks: summary.hooks,
      jobs: summary.jobs,
      storage: summary.storage,
      widgets: summary.widgets,
      navigation: summary.navigation,
      ui: summary.ui,
      automation: summary.automation,
      metrics: summary.metrics,
    },
    capabilityFlags: summary.capabilityFlags,
    capabilities: Array.isArray(manifest.capabilities)
      ? manifest.capabilities.map(capability => {
          if (typeof capability === 'string') return capability
          if (capability && typeof capability === 'object' && typeof (capability as Record<string, unknown>).id === 'string') return (capability as Record<string, string>).id
          return null
        }).filter((capability): capability is string => Boolean(capability))
      : [],
    engines: summary.engines,
  }
}
