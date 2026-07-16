import {useInfiniteQuery} from '@tanstack/react-query'

import type {ProfileId} from '@/api/contracts'
import {queryKeys, queryNetworkMode} from '@/data/query'
import {useAppServices} from '@/runtime'

export function useProfileFeedQuery(profileId: ProfileId) {
  const {feedRepository} = useAppServices()
  return useInfiniteQuery({
    queryKey: queryKeys.feed.profile(profileId),
    networkMode: queryNetworkMode(),
    initialPageParam: null as string | null,
    queryFn: ({pageParam}) =>
      feedRepository.getProfileFeed({profileId, cursor: pageParam, limit: 8}),
    getNextPageParam: lastPage => lastPage.nextCursor,
  })
}
