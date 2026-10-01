import type {
  GreenfieldModuleMarketplace,
  GreenfieldModulePreview,
  GreenfieldModuleRating,
  GreenfieldModuleRatingAggregate,
  GreenfieldRegistryDeclaration,
} from '@modula/greenfield-module-registry-contracts'
import {NOT_INSTALLED_STATUSES} from './installation-status.js'
import {moduleIdFamily, resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from './module-errors.js'

type JsonRecord = Record<string, unknown>

export class GreenfieldModuleMarketplaceService {
  constructor(private readonly db: ModulaDb) {}

  async project(input: {
    moduleId: string
    manifest: unknown
    registryPublishedAt: Date | null
  }): Promise<GreenfieldModuleMarketplace> {
    const moduleId = resolveCanonicalModuleId(input.moduleId)
    const manifest = record(input.manifest)
    const listing = marketplaceListing(manifest)
    const release = record(listing?.release)
    const [rating, installationCount, chart] = await Promise.all([
      this.ratingAggregate(moduleId),
      this.installationCount(moduleId),
      this.chartPlacement(moduleId, stringValue(listing?.category)),
    ])

    return {
      category: stringDeclaration(listing?.category),
      ageRating: stringDeclaration(listing?.ageRating),
      privacy: stringDeclaration(listing?.privacy),
      offlineSupport: booleanDeclaration(listing?.offlineSupport),
      syncSupport: booleanDeclaration(listing?.syncSupport),
      inAppPurchases: booleanDeclaration(listing?.inAppPurchases),
      previews: previewRows(listing?.previews),
      rating,
      installations: {count: installationCount},
      chart,
      release: {
        publishedAt: isoDate(release?.publishedAt) ?? input.registryPublishedAt?.toISOString() ?? null,
        sizeBytes: nonNegativeInteger(release?.sizeBytes),
        notes: stringArray(release?.notes),
      },
    }
  }

  async submitRating(moduleIdInput: string, accountId: string, rating: number): Promise<GreenfieldModuleRating> {
    const moduleId = resolveCanonicalModuleId(moduleIdInput)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw moduleError('VALIDATION_FAILED', 'Rating must be an integer from 1 to 5')
    }
    const release = await this.db
      .selectFrom('greenfield_module_releases')
      .select('release_id')
      .where('module_id', 'in', [...moduleIdFamily(moduleId)])
      .where('release_state', '=', 'published')
      .executeTakeFirst()
    if (!release) throw moduleError('NOT_FOUND', `Module ${moduleId} not found`)

    const now = new Date()
    await this.db
      .insertInto('greenfield_module_ratings')
      .values({
        rating_id: `module-rating:${moduleId}:${accountId}`,
        module_id: moduleId,
        account_id: accountId,
        rating,
        created_at: now,
        updated_at: now,
      })
      .onConflict(conflict => conflict.columns(['module_id', 'account_id']).doUpdateSet({rating, updated_at: now}))
      .execute()
    return {moduleId, userRating: rating, ...(await this.ratingAggregate(moduleId))}
  }

  private async ratingAggregate(moduleId: string): Promise<GreenfieldModuleRatingAggregate> {
    const row = await this.db
      .selectFrom('greenfield_module_ratings')
      .select([
        sql<string>`count(*)`.as('rating_count'),
        sql<string | null>`avg(rating)`.as('rating_average'),
        sql<Date | null>`max(updated_at)`.as('rating_updated_at'),
      ])
      .where('module_id', '=', moduleId)
      .executeTakeFirst()
    const count = Number(row?.rating_count ?? 0)
    const average = row?.rating_average === null || row?.rating_average === undefined
      ? null
      : Number(row.rating_average)
    return {
      average: average === null || !Number.isFinite(average) ? null : Math.round(average * 10) / 10,
      count: Number.isFinite(count) ? count : 0,
      updatedAt: row?.rating_updated_at instanceof Date ? row.rating_updated_at.toISOString() : null,
    }
  }

  private async installationCount(moduleId: string): Promise<number> {
    const row = await this.db
      .selectFrom('greenfield_extension_installations')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
      .select(sql<string>`count(distinct greenfield_extension_installations.account_id)`.as('installation_count'))
      .where('greenfield_module_releases.module_id', 'in', [...moduleIdFamily(moduleId)])
      .where('greenfield_extension_installations.status', 'not in', [...NOT_INSTALLED_STATUSES])
      .executeTakeFirst()
    const count = Number(row?.installation_count ?? 0)
    return Number.isFinite(count) ? count : 0
  }

  private async chartPlacement(
    moduleId: string,
    category: string | null,
  ): Promise<GreenfieldModuleMarketplace['chart']> {
    if (!category) return null
    const [releaseRows, installationRows] = await Promise.all([
      this.db
        .selectFrom('greenfield_module_releases')
        .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
        .select(['greenfield_module_releases.module_id', 'greenfield_module_releases.version', 'greenfield_module_versions.manifest'])
        .where('greenfield_module_releases.release_state', '=', 'published')
        .execute(),
      this.db
        .selectFrom('greenfield_extension_installations')
        .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
        .select(['greenfield_module_releases.module_id', 'greenfield_extension_installations.account_id'])
        .where('greenfield_extension_installations.status', 'not in', [...NOT_INSTALLED_STATUSES])
        .execute(),
    ])

    const latest = new Map<string, {version: string; category: string | null}>()
    for (const row of releaseRows) {
      const canonicalId = resolveCanonicalModuleId(row.module_id)
      const current = latest.get(canonicalId)
      if (!current || versionIsNewer(row.version, current.version)) {
        const manifest = record(row.manifest)
        const listing = marketplaceListing(manifest)
        latest.set(canonicalId, {
          version: row.version,
          category: stringValue(listing?.category),
        })
      }
    }
    const installations = new Map<string, Set<string>>()
    for (const row of installationRows) {
      const canonicalId = resolveCanonicalModuleId(row.module_id)
      const accounts = installations.get(canonicalId) ?? new Set<string>()
      accounts.add(row.account_id)
      installations.set(canonicalId, accounts)
    }
    const ranked = [...latest.entries()]
      .filter(([, value]) => value.category === category)
      .map(([id]) => ({moduleId: id, count: installations.get(id)?.size ?? 0}))
      .sort((left, right) => right.count - left.count || left.moduleId.localeCompare(right.moduleId))
    const index = ranked.findIndex(item => item.moduleId === moduleId)
    if (index < 0) return null
    const targetCount = ranked[index]!.count
    const rank = 1 + new Set(ranked.slice(0, index).map(item => item.count).filter(count => count > targetCount)).size
    return {rank, category, totalModules: ranked.length}
  }
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
}

function marketplaceListing(manifest: JsonRecord | null): JsonRecord | null {
  return record(manifest?.marketplace) ?? record(record(manifest?.extensions)?.marketplace)
}

function declarationValue(value: unknown): unknown {
  const declaration = record(value)
  if (!declaration) return value
  if (declaration.state === 'unknown') return undefined
  if (declaration.state === 'declared' && 'value' in declaration) return declaration.value
  return undefined
}

function stringDeclaration(value: unknown): GreenfieldRegistryDeclaration<string> {
  const parsed = stringValue(declarationValue(value))
  return parsed === null ? {state: 'unknown'} : {state: 'declared', value: parsed}
}

function booleanDeclaration(value: unknown): GreenfieldRegistryDeclaration<boolean> {
  const parsed = declarationValue(value)
  return typeof parsed === 'boolean' ? {state: 'declared', value: parsed} : {state: 'unknown'}
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function nonNegativeInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.NaN
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

function previewRows(value: unknown): GreenfieldModulePreview[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry, index) => {
    const row = record(entry)
    const source = stringValue(row?.source)
    const type: GreenfieldModulePreview['type'] | null = row?.type === 'video' ? 'video' : row?.type === 'image' ? 'image' : null
    if (!row || !source || !type) return []
    return [{
      id: stringValue(row.id) ?? `preview-${index + 1}`,
      type,
      source,
      posterSource: stringValue(row.posterSource) ?? undefined,
      alt: stringValue(row.alt) ?? undefined,
      width: nonNegativeInteger(row.width) ?? undefined,
      height: nonNegativeInteger(row.height) ?? undefined,
      sortOrder: nonNegativeInteger(row.sortOrder) ?? index,
    }]
  }).sort((left, right) => left.sortOrder - right.sortOrder)
}

function versionIsNewer(left: string, right: string): boolean {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return false
}
