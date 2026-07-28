import {decodeDiscoverResult, decodeSearchResult} from '@/api/decoding'
import type {ApiClient} from '@/api/client'
import type {DiscoverRepository, DiscoverSearchInput} from '@/data/repositories/contracts'

export class ApiDiscoverRepository implements DiscoverRepository {
  constructor(private readonly client: ApiClient) {}

  getDiscover() {
    return this.client.get({path: '/v1/discover'}, decodeDiscoverResult)
  }

  search(input: DiscoverSearchInput, signal?: AbortSignal) {
    return this.client.get(
      {
        path: '/v1/search',
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
}
