import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {useSession} from '@/auth/runtime'
import {queryKeys, queryNetworkMode} from '@/data/query'
import {useAppServices} from '@/runtime'
import {useAtprotoCapability} from '@/features/atproto/data/useApiMetadataQuery'

function useAccountKey() {
  const session = useSession()
  if (session.status === 'signedIn') return session.account.id
  if (session.status === 'guest') return 'guest' as const
  return 'signedOut' as const
}

export function useAtprotoConnectionsQuery() {
  const {atprotoRepository} = useAppServices()
  const accountId = useAccountKey()
  const oauthEnabled = useAtprotoCapability('atprotoOAuth')
  const session = useSession()

  return useQuery({
    queryKey: queryKeys.atproto.connections(accountId),
    networkMode: queryNetworkMode(),
    enabled: oauthEnabled && session.status === 'signedIn',
    queryFn: () => atprotoRepository.listConnections(),
  })
}

export function usePrimaryAtprotoConnection() {
  const query = useAtprotoConnectionsQuery()
  const items = query.data ?? []
  const connected =
    items.find(item => item.status === 'connected') ??
    items.find(item => item.status !== 'disconnected') ??
    null
  return {connection: connected, ...query}
}

export function useDisconnectAtprotoMutation() {
  const {atprotoRepository} = useAppServices()
  const queryClient = useQueryClient()
  const accountId = useAccountKey()
  return useMutation({
    mutationFn: (connectionId: string) => atprotoRepository.disconnect(connectionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: queryKeys.atproto.connections(accountId)})
      await queryClient.invalidateQueries({queryKey: queryKeys.atproto.all})
    },
  })
}

export function useRefreshAtprotoMutation() {
  const {atprotoRepository} = useAppServices()
  const queryClient = useQueryClient()
  const accountId = useAccountKey()
  return useMutation({
    mutationFn: (connectionId: string) => atprotoRepository.refresh(connectionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: queryKeys.atproto.connections(accountId)})
    },
  })
}
