export const GREENFIELD_SEARCH_DOCUMENT_SCHEMA_VERSION = '1.0.0' as const

export type GreenfieldSearchEntityType = 'post' | 'profile' | 'module' | 'module-release' | 'note' | 'vault-folder' | 'module-record'

export type ModuleRecordSearchProjectionIdentity = {
  kind: 'module-record'
  moduleId: string
  recordType: string
  recordId: string
}

export type GreenfieldSearchVisibility = 'public' | 'followers' | 'private' | 'account' | 'system'

export type GreenfieldSearchDocumentStatus = 'active' | 'deleted' | 'hidden' | 'quarantined' | 'unavailable'

export type GreenfieldSearchSort = 'relevance' | 'recent' | 'oldest'

export interface GreenfieldSearchDocument {
  documentId: string
  schemaVersion: typeof GREENFIELD_SEARCH_DOCUMENT_SCHEMA_VERSION
  entityType: GreenfieldSearchEntityType
  entityId: string
  sourceVersion: number
  accountId?: string
  ownerId?: string
  title?: string
  body?: string
  summary?: string
  keywords: string[]
  tags: string[]
  visibility: GreenfieldSearchVisibility
  status: GreenfieldSearchDocumentStatus
  language?: string
  createdAt: string
  updatedAt: string
  indexedAt: string
  metadata: Record<string, unknown>
}

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

export interface GreenfieldSearchProjectionState {
  projectorId: string
  entityType: GreenfieldSearchEntityType
  lastEventId?: string
  lastProcessedAt?: string
  lastSuccessAt?: string
  lastFailureAt?: string
  lastFailureCode?: string
  processedCount: number
  failedCount: number
  lagSeconds: number
}

export type GreenfieldSearchOperationalEventType =
  | 'search.document-indexed'
  | 'search.document-deleted'
  | 'search.projection-failed'
  | 'search.reindex-requested'
  | 'search.reindex-completed'
  | 'search.reindex-failed'
