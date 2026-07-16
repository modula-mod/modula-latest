import {useInfiniteQuery} from '@tanstack/react-query'

import {useSession} from '@/auth/runtime'
import {queryKeys, queryNetworkMode} from '@/data/query'
import {useAppServices} from '@/runtime'

export function useSavedPostsQuery() {
  const {postRepository} = useAppServices()
  const session = useSession()
  const accountId =
    session.status === 'signedIn'
      ? session.account.id
      : session.status === 'guest'
        ? 'guest'
        : 'signedOut'
  return useInfiniteQuery({
    queryKey: queryKeys.posts.saved(accountId),
    networkMode: queryNetworkMode(),
    enabled: session.status === 'signedIn',
    initialPageParam: null as string | null,
    queryFn: ({pageParam}) =>
      postRepository.getSavedPosts({cursor: pageParam, limit: 12}),
    getNextPageParam: lastPage => lastPage.nextCursor,
  })
}
