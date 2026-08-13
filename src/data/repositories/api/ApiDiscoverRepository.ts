import {
  decodeDiscoverResult,
  decodeRecentSearches,
  decodeSavedSearch,
  decodeSavedSearches,
  decodeSearchResult,
  decodeUniversalSearchPage,
} from '@/api/decoding'
import type {ApiClient} from '@/api/client'
import type {
  DiscoverRepository,
  DiscoverSearchInput,
  SaveSearchInput,
  UniversalSearchInput,
} from '@/data/repositories/contracts'

export class ApiDiscoverRepository implements DiscoverRepository {
  constructor(private readonly client: ApiClient) {}

  getDiscover() {
    return this.client.get({path: '/v1/discover'}, decodeDiscoverResult)
  }

  search(input: DiscoverSearchInput, signal?: AbortSignal) {
    return this.client.get(
      {
        path: '/v1/search',
        authenticated: true,
        query: {
          q: input.q,
          type: input.type ?? 'all',
          cursor: input.cursor ?? undefined,
          limit: input.limit ?? 20,
        },
        signal,
      },
      decodeSearchResult,
    )
  }

  universalSearch(input: UniversalSearchInput, signal?: AbortSignal) {
    return this.client.get(
      {
        path: '/v1/search',
        authenticated: true,
        query: {
          query: input.query,
          entityTypes: input.entityTypes?.join(','),
          sort: input.sort,
          cursor: input.cursor ?? undefined,
          limit: input.limit ?? 20,
        },
        signal,
      },
      decodeUniversalSearchPage,
    )
  }

  listRecentSearches(limit = 8) {
    return this.client.get(
      {path: '/v1/search/recent', authenticated: true, query: {limit}},
      decodeRecentSearches,
    )
  }

  async deleteRecentSearch(recentSearchId: string): Promise<number> {
    const result = await this.client.delete(
      {path: '/v1/search/recent', authenticated: true, body: {recentSearchId}},
      value => value as {deleted?: unknown},
    )
    return Number(result.deleted ?? 0)
  }

  listSavedSearches() {
    return this.client.get({path: '/v1/search/saved', authenticated: true}, decodeSavedSearches)
  }

  saveSearch(input: SaveSearchInput) {
    return this.client.post(
      {
        path: '/v1/search/saved',
        authenticated: true,
        body: {
          name: input.name,
          query: input.query,
          entityTypes: input.entityTypes,
          sort: input.sort,
          limit: input.limit,
        },
      },
      decodeSavedSearch,
    )
  }

  async deleteSavedSearch(savedSearchId: string): Promise<boolean> {
    const result = await this.client.delete(
      {path: `/v1/search/saved/${encodeURIComponent(savedSearchId)}`, authenticated: true},
      value => value as {deleted?: unknown},
    )
    return result.deleted === true
  }
}
