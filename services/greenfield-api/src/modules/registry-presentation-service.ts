import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from './module-errors.js'

/**
 * Registry projection of the verified MPS `presentation` section.
 *
 * Every asset is bound to an immutable registry release and served by the
 * registry from content-addressed bytes. Clients never fetch artwork from a
 * source repository and never trust a path inside a downloaded archive.
 */
export type RegistryPresentationAsset = {
  assetId: string
  role: string
  slot: string | null
  url: string
  mediaType: string
  sha256: string | null
  width: number | null
  height: number | null
  alt: string | null
  developmentAsset: boolean
  available: boolean
}

export type RegistryPresentation = {
  releaseId: string
  version: string
  icon: RegistryPresentationAsset | null
  logo: RegistryPresentationAsset | null
  wordmark: RegistryPresentationAsset | null
  cover: RegistryPresentationAsset | null
  hero: RegistryPresentationAsset | null
  background: RegistryPresentationAsset | null
  badge: RegistryPresentationAsset | null
  screenshots: RegistryPresentationAsset[]
  videoPreviews: RegistryPresentationAsset[]
  alternates: RegistryPresentationAsset[]
  developmentAssets: boolean
}

const SERVABLE_RELEASE_STATES = ['published', 'superseded'] as const
const SINGLE_SLOTS = ['icon', 'logo', 'wordmark', 'cover', 'hero', 'background', 'badge'] as const

export class GreenfieldRegistryPresentationService {
  constructor(private readonly db: ModulaDb, private readonly publicApiUrl?: string | null) {}

  async forRelease(releaseId: string): Promise<RegistryPresentation | null> {
    return (await this.forReleases([releaseId])).get(releaseId) ?? null
  }

  async forReleases(releaseIds: readonly string[]): Promise<Map<string, RegistryPresentation>> {
    const ids = [...new Set(releaseIds.filter(Boolean))]
    const result = new Map<string, RegistryPresentation>()
    if (!ids.length) return result
    const rows = await this.db.selectFrom('greenfield_release_presentation_assets as a')
      .leftJoin('greenfield_release_asset_blobs as b', 'b.sha256', 'a.sha256')
      .select([
        'a.asset_id', 'a.release_id', 'a.version', 'a.role', 'a.presentation_slot', 'a.media_type', 'a.sha256',
        'a.width', 'a.height', 'a.alt_text', 'a.development_asset', 'a.sort_order',
        sql<boolean>`b.sha256 IS NOT NULL`.as('available'),
      ])
      .where('a.release_id', 'in', ids)
      .orderBy('a.sort_order')
      .orderBy('a.asset_id')
      .execute()
    for (const row of rows) {
      const releaseId = row.release_id!
      const presentation = result.get(releaseId) ?? emptyPresentation(releaseId, row.version)
      const asset: RegistryPresentationAsset = {
        assetId: row.asset_id,
        role: row.role,
        slot: row.presentation_slot,
        url: this.assetUrl(releaseId, row.asset_id),
        mediaType: row.media_type,
        sha256: row.sha256,
        width: row.width,
        height: row.height,
        alt: row.alt_text,
        developmentAsset: row.development_asset,
        available: Boolean(row.available),
      }
      place(presentation, asset)
      presentation.developmentAssets = presentation.developmentAssets || asset.developmentAsset
      result.set(releaseId, presentation)
    }
    return result
  }

  async readAsset(releaseId: string, assetId: string): Promise<{mediaType: string; sha256: string; bytes: Buffer; developmentAsset: boolean}> {
    const row = await this.db.selectFrom('greenfield_release_presentation_assets as a')
      .innerJoin('greenfield_module_releases as r', 'r.release_id', 'a.release_id')
      .leftJoin('greenfield_release_asset_blobs as b', 'b.sha256', 'a.sha256')
      .select(['a.media_type', 'a.sha256', 'a.development_asset', 'r.release_state', 'b.bytes', 'b.media_type as blob_media_type'])
      .where('a.release_id', '=', releaseId)
      .where('a.asset_id', '=', assetId)
      .executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'Release asset not found')
    if (!(SERVABLE_RELEASE_STATES as readonly string[]).includes(row.release_state)) {
      throw moduleError('NOT_FOUND', 'Release asset is not available for this release state')
    }
    if (!row.bytes || !row.sha256) throw moduleError('NOT_FOUND', 'Release asset bytes have not been ingested')
    return {mediaType: row.media_type, sha256: row.sha256, bytes: Buffer.from(row.bytes), developmentAsset: row.development_asset}
  }

  async readReleaseArtifact(releaseId: string): Promise<{sha256: string; bytes: Buffer; filename: string}> {
    const row = await this.db.selectFrom('greenfield_module_releases as r')
      .leftJoin('greenfield_module_sources as s', 's.release_id', 'r.release_id')
      .leftJoin('greenfield_release_asset_blobs as b', 'b.sha256', 'r.release_sha256')
      .select(['r.release_state', 'r.release_sha256', 'r.module_id', 'r.version', 's.release_asset_name', 'b.bytes'])
      .where('r.release_id', '=', releaseId)
      .executeTakeFirst()
    if (!row || !(SERVABLE_RELEASE_STATES as readonly string[]).includes(row.release_state)) throw moduleError('NOT_FOUND', 'Release artifact not found')
    if (!row.bytes || !row.release_sha256) throw moduleError('NOT_FOUND', 'Release artifact bytes are not held by the registry')
    const filename = (row.release_asset_name ?? `${row.module_id}-${row.version}.tgz`).replace(/[^A-Za-z0-9._-]/g, '_')
    return {sha256: row.release_sha256, bytes: Buffer.from(row.bytes), filename}
  }

  assetUrl(releaseId: string, assetId: string): string {
    const path = `/v1/registry/releases/${encodeURIComponent(releaseId)}/assets/${encodeURIComponent(assetId)}`
    return this.publicApiUrl ? `${this.publicApiUrl.replace(/\/+$/, '')}${path}` : path
  }
}

function emptyPresentation(releaseId: string, version: string): RegistryPresentation {
  return {
    releaseId, version,
    icon: null, logo: null, wordmark: null, cover: null, hero: null, background: null, badge: null,
    screenshots: [], videoPreviews: [], alternates: [], developmentAssets: false,
  }
}

function place(presentation: RegistryPresentation, asset: RegistryPresentationAsset) {
  const slot = asset.slot as (typeof SINGLE_SLOTS)[number] | 'screenshots' | 'assets' | null
  if (slot && (SINGLE_SLOTS as readonly string[]).includes(slot)) {
    const key = slot as (typeof SINGLE_SLOTS)[number]
    if (presentation[key]) presentation.alternates.push(presentation[key]!)
    presentation[key] = asset
    return
  }
  if (asset.role === 'product.screenshot') {
    presentation.screenshots.push(asset)
    return
  }
  if (asset.role === 'product.video-preview') {
    presentation.videoPreviews.push(asset)
    return
  }
  // Legacy rows ingested before slots were recorded: fall back to the role.
  const roleSlot = asset.role.startsWith('product.') ? asset.role.slice('product.'.length) : ''
  if (slot === null && (SINGLE_SLOTS as readonly string[]).includes(roleSlot) && !presentation[roleSlot as (typeof SINGLE_SLOTS)[number]]) {
    presentation[roleSlot as (typeof SINGLE_SLOTS)[number]] = asset
    return
  }
  presentation.alternates.push(asset)
}
