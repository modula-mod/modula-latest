import {keepPreviousData, useInfiniteQuery} from '@tanstack/react-query'

import {queryKeys, queryNetworkMode} from '@/data/query'
import type {FeedMode} from '@/domain/social'
import {useAppServices} from '@/runtime'
import {useSession} from '@/auth/runtime'

export function useHomeFeedQuery(mode: FeedMode) {
  const {feedRepository} = useAppServices()
  const session = useSession()
  const accountId =
    session.status === 'signedIn'
      ? session.account.id
      : session.status === 'guest'
        ? 'guest'
        : 'signedOut'

  return useInfiniteQuery({
    queryKey: queryKeys.feed.home(mode, accountId),
    networkMode: queryNetworkMode(),
    initialPageParam: null as string | null,
    placeholderData: keepPreviousData,
    queryFn: ({pageParam}) =>
      feedRepository.getHomeFeed({mode, cursor: pageParam, limit: 6}),
    getNextPageParam: lastPage => lastPage.nextCursor,
    select: data => ({
      ...data,
      pages: data.pages.map(page => ({
        ...page,
        items: Array.from(new Map(page.items.map(post => [post.id, post])).values()),
      })),
    }),
  })
}
