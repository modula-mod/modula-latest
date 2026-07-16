import {useMutation, useQueryClient} from '@tanstack/react-query'

import type {PostId} from '@/api/contracts'
import {applyEngagement, updatePostAcrossCache} from '@/features/feed/data/updatePostAcrossCache'
import {useAppServices} from '@/runtime'

export function useLikePostMutation() {
  const {postRepository} = useAppServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({postId, liked}: {postId: PostId; liked: boolean}) =>
      liked ? postRepository.likePost(postId) : postRepository.unlikePost(postId),
    onMutate: async ({postId, liked}) => {
      await queryClient.cancelQueries()
      const snapshot = queryClient.getQueryCache().findAll().map(query => ({
        queryKey: query.queryKey,
        data: query.state.data,
      }))
      updatePostAcrossCache(queryClient, postId, post => ({
        ...post,
        liked,
        likeCount: Math.max(0, post.likeCount + (liked === post.liked ? 0 : liked ? 1 : -1)),
      }))
      return {snapshot, postId}
    },
    onError: (_error, _variables, context) => {
      context?.snapshot.forEach(entry => queryClient.setQueryData(entry.queryKey, entry.data))
    },
    onSuccess: (engagement, _variables, context) => {
      if (context?.postId) {
        updatePostAcrossCache(queryClient, context.postId, post => applyEngagement(post, engagement))
      }
    },
  })
}
