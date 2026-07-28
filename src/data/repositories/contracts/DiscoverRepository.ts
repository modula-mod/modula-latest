import type {DiscoverResult} from '@/domain/discovery'
import type {ModulaProfile} from '@/features/profile/contracts'
import type {SocialPost} from '@/domain/social'
import type {SearchType} from '@modula/api-contracts'

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

export interface DiscoverRepository {
  getDiscover(): Promise<DiscoverResult>
  search(input: DiscoverSearchInput, signal?: AbortSignal): Promise<DiscoverSearchResult>
}
