import {useMutation, useQueryClient} from '@tanstack/react-query'

import type {ProfileId} from '@/api/contracts'
import {queryKeys} from '@/data/query'
import type {ModulaProfile} from '@/features/profile/contracts'
import {useAppServices} from '@/runtime'

function patchProfile(profile: ModulaProfile, following: boolean): ModulaProfile {
  return {
    ...profile,
    isFollowing: following,
    followerCount:
      profile.isFollowing === following
        ? profile.followerCount
        : Math.max(0, profile.followerCount + (following ? 1 : -1)),
  }
}

export function useFollowProfileMutation() {
  const {socialGraphRepository} = useAppServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({profileId, following}: {profileId: ProfileId; following: boolean}) =>
      following ? socialGraphRepository.follow(profileId) : socialGraphRepository.unfollow(profileId),
    onMutate: async ({profileId, following}) => {
      await queryClient.cancelQueries({queryKey: queryKeys.profiles.all})
      const snapshot = queryClient.getQueriesData({queryKey: queryKeys.profiles.all})
      queryClient.setQueriesData<ModulaProfile>(
        {queryKey: queryKeys.profiles.all},
        data => data && data.id === profileId ? patchProfile(data, following) : data,
      )
      return {snapshot}
    },
    onError: (_error, _variables, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSuccess: result => {
      queryClient.setQueryData(
        queryKeys.profiles.byHandle(result.profile.handle),
        result.profile,
      )
      void queryClient.invalidateQueries({queryKey: queryKeys.discover.all})
      void queryClient.invalidateQueries({queryKey: queryKeys.reels.all})
    },
  })
}
