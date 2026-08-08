import {useQuery} from '@tanstack/react-query'
import type {ApiCapabilities} from '@modula/api-contracts'

import {useAppServices} from '@/runtime'
import {queryKeys} from '@/data/query/queryKeys'
import {queryNetworkMode} from '@/data/query/networkMode'

const DISABLED_CAPABILITIES: ApiCapabilities = {
  publicRead: true,
  authentication: false,
  mutations: false,
  mediaUpload: false,
  atproto: false,
  modules: false,
  atprotoOAuth: false,
  atprotoPublishing: false,
  atprotoImport: false,
  pdsPilot: false,
}

export function useApiMetadataQuery() {
  const {metadataRepository} = useAppServices()
  return useQuery({
    queryKey: queryKeys.metadata.current(),
    networkMode: queryNetworkMode(),
    queryFn: () => metadataRepository.getMetadata(),
    staleTime: 60_000,
  })
}

export function useApiCapabilities(): ApiCapabilities {
  const query = useApiMetadataQuery()
  return query.data?.capabilities ?? DISABLED_CAPABILITIES
}
