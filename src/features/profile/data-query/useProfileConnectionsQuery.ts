import {useInfiniteQuery} from '@tanstack/react-query'

import {queryKeys, queryNetworkMode} from '@/data/query'
import {useAppServices} from '@/runtime'

export function useFollowersQuery(handle: string) {
  const {socialGraphRepository} = useAppServices()
  return useInfiniteQuery({
    queryKey: queryKeys.profiles.followers(handle),
    networkMode: queryNetworkMode(),
    initialPageParam: null as string | null,
    queryFn: ({pageParam}) =>
      socialGraphRepository.getFollowers({handle, cursor: pageParam, limit: 20}),
    getNextPageParam: lastPage => lastPage.nextCursor,
  })
}

export function useFollowingQuery(handle: string) {
  const {socialGraphRepository} = useAppServices()
  return useInfiniteQuery({
    queryKey: queryKeys.profiles.following(handle),
    networkMode: queryNetworkMode(),
    initialPageParam: null as string | null,
    queryFn: ({pageParam}) =>
      socialGraphRepository.getFollowing({handle, cursor: pageParam, limit: 20}),
    getNextPageParam: lastPage => lastPage.nextCursor,
  })
}
