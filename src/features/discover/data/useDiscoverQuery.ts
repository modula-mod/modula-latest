import {useQuery} from '@tanstack/react-query'

import {queryKeys, queryNetworkMode} from '@/data/query'
import {useAppServices} from '@/runtime'

export function useDiscoverQuery() {
  const {discoverRepository} = useAppServices()
  return useQuery({
    queryKey: queryKeys.discover.all,
    networkMode: queryNetworkMode(),
    queryFn: () => discoverRepository.getDiscover(),
  })
}
