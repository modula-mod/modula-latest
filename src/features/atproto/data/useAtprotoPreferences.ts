import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import type {PatchAtprotoPublicationPreferencesInput} from '@modula/api-contracts'

import {useSession} from '@/auth/runtime'
import {queryKeys, queryNetworkMode} from '@/data/query'
import {useAppServices} from '@/runtime'
import {useAtprotoCapability} from '@/features/atproto/data/useApiMetadataQuery'
import {usePrimaryAtprotoConnection} from '@/features/atproto/data/useAtprotoConnectionsQuery'
import {connectionHasPublishPermission} from '@/features/atproto/publishing/canCrossPost'

function useAccountKey() {
  const session = useSession()
  if (session.status === 'signedIn') return session.account.id
  if (session.status === 'guest') return 'guest' as const
  return 'signedOut' as const
}

export function useAtprotoPreferencesQuery() {
  const {atprotoRepository} = useAppServices()
  const accountId = useAccountKey()
  const publishing = useAtprotoCapability('atprotoPublishing')
  const {connection} = usePrimaryAtprotoConnection()
  const session = useSession()
  const canReadPrefs =
    publishing &&
    session.status === 'signedIn' &&
    connection != null &&
    connectionHasPublishPermission(connection)

  return useQuery({
    queryKey: queryKeys.atproto.preferences(accountId),
    networkMode: queryNetworkMode(),
    enabled: Boolean(canReadPrefs),
    queryFn: () => atprotoRepository.getPreferences(),
  })
}

export function useUpdateAtprotoPreferencesMutation() {
  const {atprotoRepository} = useAppServices()
  const queryClient = useQueryClient()
  const accountId = useAccountKey()
  return useMutation({
    mutationFn: (input: PatchAtprotoPublicationPreferencesInput) =>
      atprotoRepository.updatePreferences(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.atproto.preferences(accountId),
      })
    },
  })
}
