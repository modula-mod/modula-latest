import type {DiscoverResult} from '@/domain/discovery'
import type {ModulaProfile} from '@/features/profile/contracts'
import type {SocialPost} from '@/domain/social'
import type {
  GreenfieldRecentSearch,
  GreenfieldSavedSearch,
  GreenfieldSearchEntityType,
  GreenfieldSearchResult,
  GreenfieldSearchSort,
  SearchType,
} from '@modula/api-contracts'

export type DiscoverSearchModuleResult = {
  id: string
  name: string
  description?: string
}

export type DiscoverSearchResult = {
  query?: string
  profiles: ModulaProfile[]
  posts: SocialPost[]
  modules: DiscoverSearchModuleResult[]
  nextCursor: string | null
  hasMore: boolean
}

export type DiscoverSearchInput = {
  q: string
  type?: SearchType
  cursor?: string | null
  limit?: number
}

export type UniversalSearchInput = {
  query: string
  entityTypes?: GreenfieldSearchEntityType[]
  sort?: GreenfieldSearchSort
  cursor?: string | null
  limit?: number
}

export type UniversalSearchPage = {
  results: GreenfieldSearchResult[]
  nextCursor: string | null
  requestId: string
  tookMs: number
}

export type UniversalRecentSearch = GreenfieldRecentSearch
export type UniversalSavedSearch = GreenfieldSavedSearch

export type SaveSearchInput = {
  name: string
  query: string
  entityTypes?: GreenfieldSearchEntityType[]
  sort?: GreenfieldSearchSort
  limit?: number
}

export interface DiscoverRepository {
  getDiscover(): Promise<DiscoverResult>
  search(input: DiscoverSearchInput, signal?: AbortSignal): Promise<DiscoverSearchResult>
  universalSearch(input: UniversalSearchInput, signal?: AbortSignal): Promise<UniversalSearchPage>
  listRecentSearches(limit?: number): Promise<UniversalRecentSearch[]>
  deleteRecentSearch(recentSearchId: string): Promise<number>
  listSavedSearches(): Promise<UniversalSavedSearch[]>
  saveSearch(input: SaveSearchInput): Promise<UniversalSavedSearch>
  deleteSavedSearch(savedSearchId: string): Promise<boolean>
}
