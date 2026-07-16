import {useQuery} from '@tanstack/react-query'

import {queryKeys, queryNetworkMode} from '@/data/query'
import {useAppServices} from '@/runtime'

export function useReelsQuery() {
  const {reelsRepository} = useAppServices()
  return useQuery({
    queryKey: queryKeys.reels.all,
    networkMode: queryNetworkMode(),
    queryFn: () => reelsRepository.getReels(),
  })
}
