import {useMutation, useQueryClient} from '@tanstack/react-query'

import type {PostId} from '@/api/contracts'
import {applyEngagement, updatePostAcrossCache} from '@/features/feed/data/updatePostAcrossCache'
import {useAppServices} from '@/runtime'

export function useRepostMutation() {
  const {postRepository} = useAppServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({postId, reposted}: {postId: PostId; reposted: boolean}) =>
      reposted ? postRepository.repost(postId) : postRepository.removeRepost(postId),
    onMutate: async ({postId, reposted}) => {
      await queryClient.cancelQueries()
      const snapshot = queryClient.getQueryCache().findAll().map(query => ({
        queryKey: query.queryKey,
        data: query.state.data,
      }))
      updatePostAcrossCache(queryClient, postId, post => ({
        ...post,
        reposted,
        repostCount: Math.max(0, post.repostCount + (reposted === post.reposted ? 0 : reposted ? 1 : -1)),
      }))
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
