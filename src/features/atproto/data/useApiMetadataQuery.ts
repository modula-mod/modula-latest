import {useQuery} from '@tanstack/react-query'
import type {ApiCapabilities} from '@modula/api-contracts'

import {queryKeys, queryNetworkMode} from '@/data/query'
import {useAppServices} from '@/runtime'

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

export function useAtprotoCapability(
  key: 'atprotoOAuth' | 'atprotoPublishing' | 'atprotoImport' | 'pdsPilot' | 'atproto',
): boolean {
  const capabilities = useApiCapabilities()
  return Boolean(capabilities[key])
}
