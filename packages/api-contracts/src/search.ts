import type {ModulaProfileDto} from './profiles.js'
import type {SocialPostDto} from './posts.js'

export type SearchType = 'all' | 'profiles' | 'posts' | 'modules'
export type SearchScope = SearchType
export type GreenfieldSearchEntityType = 'post' | 'profile' | 'module' | 'module-release' | 'note' | 'vault-folder'
export type GreenfieldSearchVisibility = 'public' | 'followers' | 'private' | 'account' | 'system'
export type GreenfieldSearchDocumentStatus = 'active' | 'deleted' | 'hidden' | 'quarantined' | 'unavailable'
export type GreenfieldSearchSort = 'relevance' | 'recent' | 'oldest'

export interface GreenfieldSearchRequest {
  query: string
  entityTypes?: GreenfieldSearchEntityType[]
  tags?: string[]
  ownerId?: string
  accountId?: string
  createdAfter?: string
  createdBefore?: string
  updatedAfter?: string
  updatedBefore?: string
  sort?: GreenfieldSearchSort
  limit?: number
  cursor?: string
}

export interface GreenfieldSearchResult {
  entityType: string
  entityId: string
  title?: string
  excerpt?: string
  score?: number
  matchedFields: string[]
  ownerId?: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface GreenfieldSearchResponse {
  results: GreenfieldSearchResult[]
  nextCursor?: string
  requestId: string
  tookMs: number
}

export interface GreenfieldSearchSuggestion {
  query: string
  entityType?: GreenfieldSearchEntityType
  entityId?: string
  label: string
  source: 'profile-handle' | 'module-name' | 'recent-search'
}

export interface GreenfieldRecentSearch {
  recentSearchId: string
  accountId: string
  query: string
  filters: Partial<Omit<GreenfieldSearchRequest, 'query' | 'cursor'>>
  searchedAt: string
}

export interface GreenfieldSavedSearch {
  savedSearchId: string
  accountId: string
  name: string
  query: string
  filters: Partial<Omit<GreenfieldSearchRequest, 'query' | 'cursor'>>
  createdAt: string
  updatedAt: string
}

export interface GreenfieldSearchDiagnostics {
  documentsByEntityType: Record<string, number>
  documentsByStatus: Record<string, number>
  projectionLag: Array<{
    projectorId: string
    entityType: GreenfieldSearchEntityType
    lastEventId?: string
    lastSuccessAt?: string
    lastFailureAt?: string
    lastFailureCode?: string
    processedCount: number
    failedCount: number
    lagSeconds: number
  }>
  oldestPendingEvent?: string
  lastSuccessfulProjection?: string
  projectionFailures: number
  staleDocumentCount: number
  deletedTombstoneCount: number
  averageSearchLatencyMs?: number
  p95SearchLatencyMs?: number
}

export interface GreenfieldSearchReindexRequest {
  mode: 'single-entity' | 'entity-type' | 'account-scope' | 'full-index'
  entityType?: GreenfieldSearchEntityType
  entityId?: string
  accountId?: string
  dryRun?: boolean
  reason: string
}

export type SearchResultDto = {
  query?: string
  profiles: ModulaProfileDto[]
  posts: SocialPostDto[]
  modules: Array<{id: string; name: string; description?: string}>
  nextCursor: string | null
  hasMore: boolean
}
