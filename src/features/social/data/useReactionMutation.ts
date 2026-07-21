import {useMutation, useQueryClient} from '@tanstack/react-query'

import type {PostId} from '@/api/contracts'
import type {ReactionType} from '@/domain/social'
import {updatePostAcrossCache} from '@/features/feed/data/updatePostAcrossCache'
import {useAppServices} from '@/runtime'

type ReactionSummary = {
  viewerReaction: ReactionType | null
  total: number
  byType: Partial<Record<ReactionType, number>>
}

export function useReactionMutation() {
  const {apiClient} = useAppServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({postId, reaction}: {postId: PostId; reaction: ReactionType | null}) =>
      reaction
        ? apiClient.put(
            {path: `/v1/posts/${encodeURIComponent(postId)}/reaction`, body: {type: reaction}, authenticated: true},
            value => value as ReactionSummary,
          )
        : apiClient.delete(
            {path: `/v1/posts/${encodeURIComponent(postId)}/reaction`, authenticated: true},
            value => value as ReactionSummary,
          ),
    onMutate: async ({postId, reaction}) => {
      await queryClient.cancelQueries()
      const snapshot = queryClient.getQueryCache().findAll().map(query => ({
        queryKey: query.queryKey,
        data: query.state.data,
      }))
      updatePostAcrossCache(queryClient, postId, post => ({
        ...post,
        viewerReaction: reaction,
        liked: reaction === 'like',
        likeCount: Math.max(
          0,
          post.likeCount +
            (reaction === 'like'
              ? (post.viewerReaction ?? (post.liked ? 'like' : null)) === 'like' ? 0 : 1
              : (post.viewerReaction ?? (post.liked ? 'like' : null)) === 'like' ? -1 : 0),
        ),
      }))
      return {postId, snapshot}
    },
    onError: (_error, _variables, context) => {
      context?.snapshot.forEach(entry => queryClient.setQueryData(entry.queryKey, entry.data))
    },
    onSuccess: (summary, _variables, context) => {
      if (!context) return
      updatePostAcrossCache(queryClient, context.postId, post => ({
        ...post,
        viewerReaction: summary.viewerReaction,
        liked: summary.viewerReaction === 'like',
        likeCount: summary.byType.like ?? 0,
        reactionCount: summary.total,
      }))
    },
  })
}
