import type {
  GreenfieldSearchDiagnostics,
  GreenfieldSearchEntityType,
  GreenfieldSearchRequest,
  GreenfieldSearchResult,
  GreenfieldSearchSort,
  GreenfieldSearchSuggestion,
} from '@modula/api-contracts'
import type {GreenfieldSearchDocument, GreenfieldSearchDocumentStatus, GreenfieldSearchVisibility} from '@modula/greenfield-contracts'

export type {
  GreenfieldSearchDiagnostics,
  GreenfieldSearchDocument,
  GreenfieldSearchDocumentStatus,
  GreenfieldSearchEntityType,
  GreenfieldSearchRequest,
  GreenfieldSearchResult,
  GreenfieldSearchSort,
  GreenfieldSearchSuggestion,
  GreenfieldSearchVisibility,
}

export type SearchActorContext = {
  actorId: string | null
  accountId: string | null
  capabilities: string[]
  requestId: string
  correlationId: string
}

export type SearchLimits = {
  minQueryLength: number
  maxQueryLength: number
  defaultLimit: number
  maxLimit: number
  maxEntityTypes: number
  maxTags: number
  timeoutMs: number
  recentLimit: number
}

export type ParsedSearchRequest = GreenfieldSearchRequest & {
  query: string
  normalizedQuery: string
  entityTypes: GreenfieldSearchEntityType[]
  tags: string[]
  sort: GreenfieldSearchSort
  limit: number
}

export type SearchCursor = {
  sort: GreenfieldSearchSort
  offset?: number
  score?: number
  updatedAt?: string
  documentId?: string
}

export type SearchDocumentRow = {
  documentId: string
  entityType: GreenfieldSearchEntityType
  entityId: string
  sourceVersion: number
  accountId: string | null
  ownerId: string | null
  title: string | null
  body: string | null
  summary: string | null
  keywords: string[]
  tags: string[]
  visibility: GreenfieldSearchVisibility
  status: GreenfieldSearchDocumentStatus
  language: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  indexedAt: string
  score: number
}

export type SearchReindexInput = {
  mode: 'single-entity' | 'entity-type' | 'account-scope' | 'full-index'
  entityType?: GreenfieldSearchEntityType
  entityId?: string
  accountId?: string
  dryRun: boolean
  reason: string
}
