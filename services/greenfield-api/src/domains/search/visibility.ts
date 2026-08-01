import type {GreenfieldSearchEntityType, GreenfieldSearchResult, SearchDocumentRow} from './contracts.js'

const METADATA_ALLOWLIST: Record<GreenfieldSearchEntityType, Set<string>> = {
  post: new Set(['handle', 'authorDisplayName', 'feed', 'kind', 'linkDomain', 'mediaCount', 'audience']),
  profile: new Set(['handle', 'kind', 'publicLocation', 'publicLinks', 'moduleCount', 'featuredModuleIds']),
  module: new Set(['publisher', 'trustState', 'version', 'categories', 'capabilities', 'platforms', 'status', 'installable']),
  'module-release': new Set([
    'moduleId',
    'version',
    'standardVersion',
    'channel',
    'compatibility',
    'publisher',
    'trustState',
    'checksumState',
    'releaseState',
  ]),
  note: new Set(['moduleId', 'folderId', 'folderName', 'sourceTitle', 'sourceAuthor', 'archived', 'pinned', 'favourite', 'dataSchemaVersion']),
  'vault-folder': new Set(['moduleId', 'parentFolderId', 'position']),
}

export function resourceTypeForSearch(entityType: GreenfieldSearchEntityType): string {
  if (entityType === 'module-release') return 'module'
  if (entityType === 'note' || entityType === 'vault-folder') return 'module.record'
  return entityType
}

export function redactSearchMetadata(row: SearchDocumentRow): Record<string, unknown> {
  const allowed = METADATA_ALLOWLIST[row.entityType] ?? new Set<string>()
  return Object.fromEntries(
    Object.entries(row.metadata)
      .filter(([key]) => allowed.has(key))
      .filter(([key]) => !/(email|phone|token|secret|password|private|security|internal)/i.test(key)),
  )
}

export function toSearchResult(row: SearchDocumentRow, matchedFields: string[], excerpt?: string): GreenfieldSearchResult {
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    title: row.title ?? undefined,
    excerpt,
    score: row.score,
    matchedFields,
    ownerId: row.ownerId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    metadata: redactSearchMetadata(row),
  }
}

export function searchVisibilityFromAudience(audience: string): 'public' | 'followers' | 'private' {
  if (audience === 'public') return 'public'
  if (audience === 'followers') return 'followers'
  return 'private'
}

export function searchVisibilityFromProfile(visibility: string): 'public' | 'followers' | 'private' {
  if (visibility === 'public') return 'public'
  if (visibility === 'followers' || visibility === 'teams') return 'followers'
  return 'private'
}
