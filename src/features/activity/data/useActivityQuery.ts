import {useInfiniteQuery} from '@tanstack/react-query'

import {useSession} from '@/auth/runtime'
import {queryKeys, queryNetworkMode} from '@/data/query'
import {useAppServices} from '@/runtime'

export function useActivityQuery() {
  const {activityRepository} = useAppServices()
  const session = useSession()
  const accountId =
    session.status === 'signedIn'
      ? session.account.id
      : session.status === 'guest'
        ? 'guest'
        : 'signedOut'
  return useInfiniteQuery({
    queryKey: queryKeys.activity.pages(accountId),
    networkMode: queryNetworkMode(),
    initialPageParam: null as string | null,
    queryFn: ({pageParam}) =>
      activityRepository.getActivity({cursor: pageParam, limit: 12}),
    getNextPageParam: lastPage => lastPage.nextCursor,
  })
}
