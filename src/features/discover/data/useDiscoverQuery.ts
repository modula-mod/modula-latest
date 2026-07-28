import {useInfiniteQuery, useQuery} from '@tanstack/react-query'

import {queryKeys, queryNetworkMode} from '@/data/query'
import type {DiscoverSearchInput} from '@/data/repositories/contracts'
import {useAppServices} from '@/runtime'

export function useDiscoverQuery() {
  const {discoverRepository} = useAppServices()
  return useQuery({
    queryKey: queryKeys.discover.all,
    networkMode: queryNetworkMode(),
    queryFn: () => discoverRepository.getDiscover(),
  })
}

export function useDiscoverSearchQuery(input: DiscoverSearchInput) {
  const {discoverRepository} = useAppServices()
  const q = input.q.trim()
  const type = input.type ?? 'all'
  const limit = input.limit ?? 20
  return useInfiniteQuery({
    queryKey: queryKeys.discover.search(q, type, limit),
    networkMode: queryNetworkMode(),
    enabled: q.length > 0,
    initialPageParam: null as string | null,
    queryFn: ({pageParam, signal}) =>
      discoverRepository.search(
        {
          q,
          type,
          cursor: pageParam,
          limit,
        },
        signal,
      ),
    getNextPageParam: lastPage => lastPage.nextCursor,
  })
}
