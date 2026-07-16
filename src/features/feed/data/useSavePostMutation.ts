import {useMutation, useQueryClient} from '@tanstack/react-query'

import type {PostId} from '@/api/contracts'
import {applyEngagement, updatePostAcrossCache} from '@/features/feed/data/updatePostAcrossCache'
import {useAppServices} from '@/runtime'

export function useSavePostMutation() {
  const {postRepository} = useAppServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({postId, saved}: {postId: PostId; saved: boolean}) =>
      saved ? postRepository.savePost(postId) : postRepository.unsavePost(postId),
    onMutate: async ({postId, saved}) => {
      await queryClient.cancelQueries()
      const snapshot = queryClient.getQueryCache().findAll().map(query => ({
        queryKey: query.queryKey,
        data: query.state.data,
      }))
      updatePostAcrossCache(queryClient, postId, post => ({...post, saved}))
      return {snapshot, postId}
    },
    onError: (_error, _variables, context) => {
      context?.snapshot.forEach(entry => queryClient.setQueryData(entry.queryKey, entry.data))
    },
    onSuccess: (engagement, _variables, context) => {
      if (context?.postId) updatePostAcrossCache(queryClient, context.postId, post => applyEngagement(post, engagement))
    },
  })
}
