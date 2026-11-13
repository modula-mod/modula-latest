import {sql} from 'kysely'
import type {
  GubicAvailability,
  GubicCatalogueEntryInput,
  GubicEligibility,
  GubicGameOrigin,
  GubicGameSummary,
  GubicPublicationStatus,
  GubicRuntimeCategory,
} from '@modula/greenfield-module-registry-contracts'
import {resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import {compareSemver} from '@modula/greenfield-module-manifest'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {GreenfieldModuleDistributionService, type DistributionHostContext} from './distribution-service.js'
import {GreenfieldModuleInstallationService} from './installation-service.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleRegistryService} from './registry-service.js'
import {GreenfieldModuleReleaseService} from './release-service.js'
import {GreenfieldRegistryTrustService} from './registry-trust-service.js'

export type GubicListFilters = {
  q?: string
  category?: string
  genre?: string
  publisherId?: string
  origin?: GubicGameOrigin
  sort?: 'title' | 'new'
  limit?: number
}

const ORIGINS = new Set<GubicGameOrigin>([
  'modula-developed', 'external-open-source', 'independent-publisher', 'commercial-publisher',
])
const RUNTIMES = new Set<GubicRuntimeCategory>([
  'html5-javascript', 'phaser', 'playcanvas', 'browser-runtime', 'streamed',
])
const AVAILABILITIES = new Set<GubicAvailability>([
  'available', 'coming-soon', 'unavailable', 'region-restricted',
])

/**
 * Game-specific Product Hub projection. The registry remains authoritative for
 * release, signature, dependency, compatibility, artifact and install facts.
 */
export class GreenfieldGubicService {
  private readonly registry: GreenfieldModuleRegistryService
  private readonly distribution: GreenfieldModuleDistributionService
  private readonly installations: GreenfieldModuleInstallationService
  private readonly releases: GreenfieldModuleReleaseService
  private readonly trust: GreenfieldRegistryTrustService

  constructor(private readonly db: ModulaDb, private readonly config: AppConfig) {
    this.registry = new GreenfieldModuleRegistryService(db, {publicApiUrl: config.publicApiUrl})
    this.distribution = new GreenfieldModuleDistributionService(db, config)
    this.installations = new GreenfieldModuleInstallationService(db, config)
    this.releases = new GreenfieldModuleReleaseService(db)
    this.trust = new GreenfieldRegistryTrustService(db)
  }

  async listGames(filters: GubicListFilters = {}): Promise<{items: GubicGameSummary[]; nextCursor: null}> {
    const limit = Math.max(1, Math.min(Number(filters.limit) || 50, 100))
    const entries = await this.db.selectFrom('greenfield_game_catalogue_entries')
      .selectAll()
      .where('publication_status', '=', 'published')
      .execute()
    const entryById = new Map(entries.map(row => [resolveCanonicalModuleId(row.game_id), row]))
    if (!entryById.size) return {items: [], nextCursor: null}

    const registry = await this.registry.listModules({productKind: 'game', status: 'published', limit: 100})
    const candidates = registry.items.filter(item => entryById.has(resolveCanonicalModuleId(item.moduleId)))
    const releaseIds = candidates.map(item => String((item as any).registryReleaseId ?? '')).filter(Boolean)
    const [releaseRows, ingestionRows, artifactRows] = await Promise.all([
      releaseIds.length ? this.db.selectFrom('greenfield_module_releases')
        .select(['release_id', 'published_at'])
        .where('release_id', 'in', releaseIds).execute() : [],
      releaseIds.length ? this.db.selectFrom('greenfield_mps_ingestions')
        .select(['release_id', 'manifest'])
        .where('release_id', 'in', releaseIds).execute() : [],
      releaseIds.length ? this.db.selectFrom('greenfield_release_artifacts as artifact')
        .innerJoin('greenfield_release_asset_blobs as blob', 'blob.sha256', 'artifact.sha256')
        .select(['artifact.release_id', 'artifact.sha256', 'artifact.required_for_offline_launch', 'blob.byte_size'])
        .where('artifact.release_id', 'in', releaseIds).execute() : [],
    ])
    const publishedAt = new Map(releaseRows.map(row => [row.release_id, row.published_at]))
    const productByRelease = new Map(ingestionRows.flatMap(row => row.release_id ? [[row.release_id, record(row.manifest)]] as const : []))
    const downloadBytes = new Map<string, number>()
    const seenDigests = new Set<string>()
    for (const row of artifactRows) {
      if (!row.required_for_offline_launch) continue
      const key = `${row.release_id}:${row.sha256}`
      if (seenDigests.has(key)) continue
      seenDigests.add(key)
      downloadBytes.set(row.release_id, (downloadBytes.get(row.release_id) ?? 0) + Number(row.byte_size))
    }

    let items = candidates.flatMap(item => {
      const entry = entryById.get(resolveCanonicalModuleId(item.moduleId))
      const releaseId = String((item as any).registryReleaseId ?? '')
      if (!entry || !releaseId || !(item as any).trustSummary?.verified) return []
      const product = productByRelease.get(releaseId)
      const gameRuntime = record(product?.gameRuntime)
      const distribution = record(product?.distribution)
      const artifact = record(distribution?.artifact)
      const runtimeDependency = record(gameRuntime?.runtimeDependency)
      return [{
        gameId: resolveCanonicalModuleId(item.moduleId),
        title: item.name,
        description: item.description,
        publisher: {
          publisherId: item.publisherId,
          displayName: item.publisherName,
          verified: Boolean((item as any).trustSummary?.publisherVerified),
        },
        origin: entry.origin_type,
        genre: entry.genre,
        categories: stringArray(entry.categories),
        runtime: {
          category: entry.runtime_category,
          engine: text(gameRuntime?.engine),
          engineVersion: text(gameRuntime?.engineVersion),
          runtimePackageId: text(runtimeDependency?.packageId),
          streamed: entry.runtime_category === 'streamed',
        },
        release: {
          releaseId,
          version: item.latestVersion!,
          channel: String((item as any).releaseChannel ?? 'stable'),
          publishedAt: publishedAt.get(releaseId)?.toISOString() ?? null,
        },
        compatibility: record(product?.compatibility) ?? (item.compatibility as Record<string, unknown>),
        sizes: {
          downloadBytes: downloadBytes.get(releaseId) ?? ((item as any).releaseSizeBytes ?? null),
          installedSizeEstimateBytes: nonNegativeInteger(artifact?.installedSizeEstimateBytes),
          // Native owns cache slots and reclamation measurements.
          nativeCacheBytes: null,
        },
        ageClassification: record(entry.age_classification) ?? {},
        availability: entry.availability,
        publicationStatus: 'published' as const,
        featured: entry.featured,
        featuredRank: entry.featured_rank,
        presentation: (item as any).presentation ?? null,
        trust: (item as any).trustSummary ?? null,
      } satisfies GubicGameSummary]
    })

    const q = filters.q?.trim().toLowerCase()
    if (q) items = items.filter(item => [item.gameId, item.title, item.description, item.genre, ...item.categories, item.publisher.displayName]
      .some(value => value.toLowerCase().includes(q)))
    if (filters.category) items = items.filter(item => item.categories.includes(filters.category!))
    if (filters.genre) items = items.filter(item => item.genre === filters.genre)
    if (filters.publisherId) items = items.filter(item => item.publisher.publisherId === filters.publisherId)
    if (filters.origin) items = items.filter(item => item.origin === filters.origin)
    items.sort(filters.sort === 'new'
      ? (left, right) => String(right.release.publishedAt ?? '').localeCompare(String(left.release.publishedAt ?? '')) || left.gameId.localeCompare(right.gameId)
      : (left, right) => left.title.localeCompare(right.title) || left.gameId.localeCompare(right.gameId))
    return {items: items.slice(0, limit), nextCursor: null}
  }

  async featuredGames(limit = 20) {
    const result = await this.listGames({limit: 100})
    return {items: result.items.filter(item => item.featured)
      .sort((left, right) => (left.featuredRank ?? 1001) - (right.featuredRank ?? 1001) || left.gameId.localeCompare(right.gameId))
      .slice(0, Math.max(1, Math.min(limit, 100)))}
  }

  async newReleases(limit = 20) {
    const result = await this.listGames({sort: 'new', limit})
    return {items: result.items}
  }

  async categories() {
    const games = (await this.listGames({limit: 100})).items
    const categories = new Map<string, number>()
    for (const game of games) for (const category of game.categories) categories.set(category, (categories.get(category) ?? 0) + 1)
    return {items: [...categories].map(([category, gameCount]) => ({category, gameCount})).sort((a, b) => a.category.localeCompare(b.category))}
  }

  async getGame(gameIdInput: string): Promise<GubicGameSummary> {
    const gameId = resolveCanonicalModuleId(gameIdInput)
    const game = (await this.listGames({limit: 100})).items.find(item => item.gameId === gameId)
    if (!game) throw moduleError('NOT_FOUND', 'Published game not found')
    return game
  }

  async publisherDetail(publisherId: string) {
    const games = (await this.listGames({publisherId, limit: 100})).items
    if (!games.length) throw moduleError('NOT_FOUND', 'Published game publisher not found')
    const publisher = await this.db.selectFrom('greenfield_publishers').selectAll().where('publisher_id', '=', publisherId).executeTakeFirst()
    if (!publisher) throw moduleError('NOT_FOUND', 'Published game publisher not found')
    return {
      publisherId: publisher.publisher_id,
      displayName: publisher.display_name,
      website: publisher.website,
      verified: publisher.status === 'verified',
      status: publisher.status,
      trustLevel: publisher.trust_level,
      origins: [...new Set(games.map(game => game.origin))],
      games,
    }
  }

  async versions(gameIdInput: string, context: DistributionHostContext = {}) {
    const game = await this.getGame(gameIdInput)
    const releases = await this.registry.listVersions(game.gameId)
    const items = []
    for (const release of releases.filter(item => ['published', 'superseded'].includes(item.releaseState))) {
      const detail = await this.registry.getVersionDetail(game.gameId, release.version, context)
      if (!detail.registryTrust?.verified || detail.registryTrust.revocation.revoked) continue
      items.push({
        releaseId: release.releaseId,
        version: release.version,
        channel: release.releaseChannel,
        state: release.releaseState,
        publishedAt: release.publishedAt ? new Date(release.publishedAt).toISOString() : null,
        compatibility: detail.registryTrust.compatibility,
        trust: detail.registryTrust,
      })
    }
    return {gameId: game.gameId, items}
  }

  async eligibility(accountId: string | null, gameIdInput: string, context: DistributionHostContext = {}): Promise<GubicEligibility> {
    const game = await this.getGame(gameIdInput)
    const entitlement = await this.entitlement(accountId, game.gameId)
    if (game.availability !== 'available') {
      return {gameId: game.gameId, eligible: false, reasonCode: 'NOT_AVAILABLE', reason: 'Game is not currently available for installation', entitlement, packagePlan: null}
    }
    if (entitlement.required && !entitlement.owned) {
      return {gameId: game.gameId, eligible: false, reasonCode: 'ENTITLEMENT_REQUIRED', reason: 'An active game entitlement is required', entitlement, packagePlan: null}
    }
    try {
      const packagePlan = await this.distribution.packageInstallPlan(accountId, game.gameId, null, context, [])
      return {gameId: game.gameId, eligible: true, reasonCode: 'ELIGIBLE', reason: 'Game is eligible for installation', entitlement, packagePlan}
    } catch (error) {
      const code = String((error as {code?: unknown})?.code ?? 'INSTALLATION_UNAVAILABLE')
      return {gameId: game.gameId, eligible: false, reasonCode: code, reason: error instanceof Error ? error.message : 'Game installation is unavailable', entitlement, packagePlan: null}
    }
  }

  async packageInstallPlan(accountId: string, gameId: string, context: DistributionHostContext, cachedPublicDigests: string[]) {
    const eligibility = await this.eligibility(accountId, gameId, context)
    if (!eligibility.eligible) throw moduleError(eligibility.reasonCode === 'ENTITLEMENT_REQUIRED' ? 'FORBIDDEN' : 'CONFLICT', eligibility.reason)
    return this.distribution.packageInstallPlan(accountId, gameId, null, context, cachedPublicDigests)
  }

  async myGames(accountId: string, context: DistributionHostContext = {}) {
    const [installed, updates, publicGames, ownedEntitlements] = await Promise.all([
      this.installations.listInstalled(accountId),
      this.distribution.updateFeed(accountId, context),
      this.listGames({limit: 100}),
      this.db.selectFrom('greenfield_entitlements as entitlement')
        .innerJoin('greenfield_game_catalogue_entries as game', 'game.game_id', 'entitlement.product_id')
        .select('entitlement.product_id')
        .where('entitlement.owner_account_id', '=', accountId)
        .where('entitlement.state', 'in', ['TRIAL', 'ACTIVE', 'GRACE'])
        .where(eb => eb.or([eb('entitlement.expires_at', 'is', null), eb('entitlement.expires_at', '>', new Date())]))
        .execute(),
    ])
    const gameIds = new Set((await this.db.selectFrom('greenfield_game_catalogue_entries').select('game_id').execute()).map(row => resolveCanonicalModuleId(row.game_id)))
    const publicById = new Map(publicGames.items.map(game => [game.gameId, game]))
    const updateById = new Map(updates.items.map(item => [resolveCanonicalModuleId(item.moduleId), item]))
    const installedById = new Map(installed.filter(row => gameIds.has(resolveCanonicalModuleId(row.moduleId)))
      .map(row => [resolveCanonicalModuleId(row.moduleId), row]))
    const accountGameIds = new Set([
      ...installedById.keys(),
      ...ownedEntitlements.map(row => resolveCanonicalModuleId(row.product_id)).filter(gameId => gameIds.has(gameId)),
    ])
    const items = []
    for (const gameId of [...accountGameIds].sort()) {
      const installation = installedById.get(gameId)
      const game = publicById.get(gameId) ?? null
      const entitlement = await this.entitlement(accountId, gameId)
      const eligibility = game
        ? await this.eligibility(accountId, gameId, context)
        : {gameId, eligible: false, reasonCode: 'NOT_PUBLIC', reason: 'Game is not publicly installable', entitlement, packagePlan: null}
      items.push({
        gameId,
        installation: installation ? {
          installationId: installation.installationId,
          version: installation.version,
          status: installation.status,
          releaseChannel: installation.releaseChannel,
        } : null,
        game,
        update: updateById.get(gameId) ?? null,
        eligibility,
        entitlement,
        nativeCacheBytes: null,
      })
    }
    return {revision: updates.revision, generatedAt: updates.generatedAt, items}
  }

  /** Blocks generic installation bypass for products projected as games. */
  async assertCatalogueInstallAllowed(accountId: string | null, gameIdInput: string): Promise<void> {
    const gameId = resolveCanonicalModuleId(gameIdInput)
    const gameProjection = await this.db.selectFrom('greenfield_mps_ingestions as ingestion')
      .innerJoin('greenfield_module_releases as release', 'release.release_id', 'ingestion.release_id')
      .select('ingestion.product_id')
      .where('ingestion.product_id', '=', gameId)
      .where('ingestion.registry_kind', '=', 'game')
      .executeTakeFirst()
    if (!gameProjection) return
    const entry = await this.catalogueEntry(gameId)
    if (!entry || entry.publication_status !== 'published' || entry.availability !== 'available') {
      throw moduleError('FORBIDDEN', 'Game is not approved for catalogue installation')
    }
    const entitlement = await this.entitlement(accountId, gameId)
    if (entitlement.required && !entitlement.owned) throw moduleError('FORBIDDEN', 'An active game entitlement is required')
  }

  async upsertCatalogueEntry(accountId: string, gameIdInput: string, input: GubicCatalogueEntryInput) {
    const gameId = resolveCanonicalModuleId(gameIdInput)
    const publisherId = requiredText(input.publisherId, 120, 'Publisher is required')
    await this.requirePublisherAccess(accountId, publisherId)
    const release = await this.db.selectFrom('greenfield_module_releases as release')
      .innerJoin('greenfield_mps_ingestions as ingestion', 'ingestion.release_id', 'release.release_id')
      .select(['release.publisher_id', 'ingestion.registry_kind'])
      .where('release.module_id', '=', gameId)
      .where('ingestion.registry_kind', '=', 'game')
      .executeTakeFirst()
    if (!release) throw moduleError('NOT_FOUND', 'Registry game release not found')
    if (release.publisher_id !== publisherId) throw moduleError('FORBIDDEN', 'Publisher cannot manage another publisher’s game')
    const existing = await this.catalogueEntry(gameId)
    if (existing && existing.publisher_id !== publisherId) throw moduleError('FORBIDDEN', 'Publisher cannot take over another publisher’s game')
    const origin = ORIGINS.has(input.origin) ? input.origin : invalid('Invalid game origin')
    const runtime = RUNTIMES.has(input.runtimeCategory) ? input.runtimeCategory : invalid('Invalid game runtime')
    const categories = [...new Set((input.categories ?? []).map(value => requiredText(value, 80, 'Invalid game category')))].sort()
    if (!categories.length || categories.length > 20) throw moduleError('VALIDATION_FAILED', 'One to twenty game categories are required')
    const genre = requiredText(input.genre, 80, 'Game genre is required')
    const availability = input.availability && AVAILABILITIES.has(input.availability) ? input.availability : existing?.availability ?? 'unavailable'
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_game_catalogue_entries').values({
        game_id: gameId, publisher_id: publisherId, origin_type: origin, genre,
        categories: sql`${JSON.stringify(categories)}::jsonb`, runtime_category: runtime,
        age_classification: sql`${JSON.stringify(record(input.ageClassification) ?? {})}::jsonb`,
        availability, publication_status: existing?.publication_status ?? 'draft',
        featured: existing?.featured ?? false, featured_rank: existing?.featured_rank ?? null,
        created_by_account_id: existing?.created_by_account_id ?? accountId, updated_by_account_id: accountId,
        created_at: existing?.created_at ?? now, updated_at: now,
      }).onConflict(oc => oc.column('game_id').doUpdateSet({
        origin_type: origin, genre, categories: sql`${JSON.stringify(categories)}::jsonb`, runtime_category: runtime,
        age_classification: sql`${JSON.stringify(record(input.ageClassification) ?? {})}::jsonb`, availability,
        updated_by_account_id: accountId, updated_at: now,
      })).execute()
      await trx.insertInto('greenfield_game_catalogue_events').values({
        event_id: uuidv7(), game_id: gameId, publisher_id: publisherId,
        event_type: existing ? 'metadata-updated' : 'registered', actor_account_id: accountId,
        previous_status: existing?.publication_status ?? null, publication_status: existing?.publication_status ?? 'draft',
        evidence: sql`${JSON.stringify({source: 'publisher-catalogue-api'})}::jsonb`, occurred_at: now,
      }).execute()
    })
    return this.catalogueEntry(gameId)
  }

  async reviewCatalogueEntry(accountId: string, gameIdInput: string, input: {
    publicationStatus?: GubicPublicationStatus
    availability?: GubicAvailability
    featured?: boolean
    featuredRank?: number | null
    reason?: string
  }) {
    await this.requireAdmin(accountId)
    const gameId = resolveCanonicalModuleId(gameIdInput)
    const entry = await this.catalogueEntry(gameId)
    if (!entry) throw moduleError('NOT_FOUND', 'Game catalogue entry not found')
    const status = input.publicationStatus ?? entry.publication_status
    if (!['draft', 'in-review', 'published', 'rejected', 'retired'].includes(status)) invalid('Invalid publication status')
    const availability = input.availability ?? entry.availability
    if (!AVAILABILITIES.has(availability)) invalid('Invalid game availability')
    const featured = input.featured ?? entry.featured
    const featuredRank = featured ? Number(input.featuredRank ?? entry.featured_rank) : null
    if (featured && (!Number.isInteger(featuredRank) || featuredRank! < 1 || featuredRank! > 1000)) invalid('Featured rank must be between 1 and 1000')
    if (featured && (status !== 'published' || availability !== 'available')) invalid('Only available published games can be featured')
    if (status === 'published') {
      const registryGame = await this.latestPublishedRegistryGame(gameId)
      if (!registryGame || !registryGame.verified || registryGame.publisherId !== entry.publisher_id) {
        throw moduleError('FORBIDDEN', 'A trusted published registry release owned by this publisher is required')
      }
    }
    const now = new Date()
    const eventType = status === 'published' ? (featured ? 'featured' : 'published')
      : status === 'rejected' ? 'rejected' : status === 'retired' ? 'retired'
        : featured ? 'featured' : entry.featured && !featured ? 'unfeatured' : 'submitted'
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_game_catalogue_entries').set({
        publication_status: status, availability, featured, featured_rank: featuredRank,
        updated_by_account_id: accountId, updated_at: now,
      }).where('game_id', '=', gameId).execute()
      await trx.insertInto('greenfield_game_catalogue_events').values({
        event_id: uuidv7(), game_id: gameId, publisher_id: entry.publisher_id,
        event_type: eventType, actor_account_id: accountId, previous_status: entry.publication_status,
        publication_status: status, evidence: sql`${JSON.stringify({reason: text(input.reason)})}::jsonb`, occurred_at: now,
      }).execute()
    })
    return this.catalogueEntry(gameId)
  }

  /**
   * The release a catalogue publication is judged against: the newest published
   * game release of exactly this module (stable channel preferred, as in the
   * registry listing), looked up directly by module ID. Unlike the paged
   * registry listing this neither caps at 100 products nor hides products the
   * beta Product Hub classifies as test-only.
   */
  private async latestPublishedRegistryGame(gameId: string): Promise<{releaseId: string; publisherId: string; verified: boolean} | null> {
    const rows = await this.db.selectFrom('greenfield_module_releases as release')
      .innerJoin('greenfield_mps_ingestions as ingestion', 'ingestion.release_id', 'release.release_id')
      .select(['release.release_id', 'release.version', 'release.release_channel', 'release.publisher_id'])
      .where('release.module_id', '=', gameId)
      .where('ingestion.registry_kind', '=', 'game')
      .where('release.release_state', '=', 'published')
      .execute()
    const latest = [...rows].sort((left, right) => {
      const channel = Number(right.release_channel === 'stable') - Number(left.release_channel === 'stable')
      if (channel) return channel
      try { return compareSemver(right.version, left.version) } catch { return 0 }
    })[0]
    if (!latest) return null
    const release = await this.releases.getReleaseById(latest.release_id)
    if (!release) return null
    const trust = await this.trust.forRelease(release, {}, release.version)
    return {releaseId: latest.release_id, publisherId: latest.publisher_id, verified: trust.verified}
  }

  async catalogueEntry(gameId: string) {
    return this.db.selectFrom('greenfield_game_catalogue_entries').selectAll().where('game_id', '=', gameId).executeTakeFirst()
  }

  private async entitlement(accountId: string | null, gameId: string) {
    const offers = await this.db.selectFrom('greenfield_offers').select(['offer_id', 'kind'])
      .where('product_id', '=', gameId).where('state', '=', 'ACTIVE').execute()
    const required = offers.some(offer => offer.kind !== 'FREE') && !offers.some(offer => offer.kind === 'FREE')
    if (!required || !accountId) return {required, owned: !required, entitlementId: null, state: null}
    const owned = await this.db.selectFrom('greenfield_entitlements').select(['entitlement_id', 'state'])
      .where('owner_account_id', '=', accountId).where('product_id', '=', gameId)
      .where('state', 'in', ['TRIAL', 'ACTIVE', 'GRACE'])
      .where(eb => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', new Date())]))
      .orderBy('created_at', 'desc').executeTakeFirst()
    return {required, owned: Boolean(owned), entitlementId: owned?.entitlement_id ?? null, state: owned?.state ?? null}
  }

  private async requirePublisherAccess(accountId: string, publisherId: string) {
    const owners = await this.db.selectFrom('greenfield_publisher_owners').selectAll().where('publisher_id', '=', publisherId).execute()
    if (owners.some(owner => owner.account_id === accountId)) return
    const organisationIds = owners.flatMap(owner => owner.organisation_id ? [owner.organisation_id] : [])
    if (organisationIds.length) {
      const membership = await this.db.selectFrom('greenfield_developer_organisation_memberships')
        .select('membership_id').where('account_id', '=', accountId).where('organisation_id', 'in', organisationIds)
        .where('state', '=', 'ACTIVE').where('role', 'in', ['OWNER', 'ADMIN', 'DEVELOPER', 'RELEASE_MANAGER']).executeTakeFirst()
      if (membership) return
    }
    throw moduleError('FORBIDDEN', 'Publisher access is required')
  }

  private async requireAdmin(accountId: string) {
    const account = await this.db.selectFrom('greenfield_accounts').select('primary_handle').where('account_id', '=', accountId).executeTakeFirst()
    if (!account || !this.config.adminHandles.includes(account.primary_handle.toLowerCase())) throw moduleError('FORBIDDEN', 'Administrative catalogue review is required')
  }
}

function record(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function requiredText(value: unknown, max: number, message: string): string {
  const parsed = text(value)
  if (!parsed || parsed.length > max) throw moduleError('VALIDATION_FAILED', message)
  return parsed
}

function invalid(message: string): never {
  throw moduleError('VALIDATION_FAILED', message)
}
