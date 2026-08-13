import {useQuery} from '@tanstack/react-query'

import {queryKeys, queryNetworkMode} from '@/data/query'
import {useSession} from '@/auth/runtime'
import {useAppServices} from '@/runtime'

export function useProfileQuery(handle: string | undefined, enabled = Boolean(handle)) {
  const {profileRepository} = useAppServices()
  return useQuery({
    queryKey: queryKeys.profiles.byHandle(handle ?? 'missing'),
    networkMode: queryNetworkMode(),
    enabled: Boolean(handle) && enabled,
    queryFn: () => profileRepository.getProfileByHandle(handle ?? ''),
  })
}

export function useOwnerProfileQuery() {
  const session = useSession()
  const handle = session.status === 'signedIn' ? session.profile.handle : undefined
  return useProfileQuery(handle, session.status === 'signedIn')
}
