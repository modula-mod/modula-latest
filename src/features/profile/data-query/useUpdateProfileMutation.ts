import {useMutation, useQueryClient} from '@tanstack/react-query'

import {queryKeys} from '@/data/query'
import type {UpdateProfileInput} from '@/features/profile/contracts'
import {useSession} from '@/auth/runtime'
import {useAppServices} from '@/runtime'

export function useUpdateProfileMutation() {
  const {profileRepository} = useAppServices()
  const session = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => profileRepository.updateOwnerProfile(input),
    onSuccess: profile => {
      queryClient.setQueryData(queryKeys.profiles.byHandle(profile.handle), profile)
      if (session.status === 'signedIn') {
        queryClient.setQueryData(queryKeys.profiles.byHandle(session.profile.handle), profile)
      }
      void queryClient.invalidateQueries({queryKey: queryKeys.feed.all})
      void queryClient.invalidateQueries({queryKey: queryKeys.posts.all})
    },
  })
}
