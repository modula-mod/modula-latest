import {useQuery} from '@tanstack/react-query'
import type {AtmosphereFeedMode} from '@modula/api-contracts'

import {queryKeys, queryNetworkMode} from '@/data/query'
import {useAppServices} from '@/runtime'
import {useAtprotoCapability} from '@/features/atproto/data/useApiMetadataQuery'

export function useAtmosphereFeedQuery(mode: AtmosphereFeedMode = 'modula-network') {
  const {atprotoRepository} = useAppServices()
  const importEnabled = useAtprotoCapability('atprotoImport')

  return useQuery({
    queryKey: queryKeys.atproto.atmosphere(mode),
    networkMode: queryNetworkMode(),
    enabled: importEnabled,
    queryFn: () => atprotoRepository.getAtmosphereFeed({mode, limit: 12}),
  })
}
