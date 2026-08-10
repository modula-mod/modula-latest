import {useMutation, useQueryClient} from '@tanstack/react-query'

import {queryKeys} from '@/data/query'
import type {PostId} from '@/api/contracts'
import type {SocialPost, UpdatePostInput} from '@/domain/social'
import {useAppServices} from '@/runtime'

export function useUpdatePostMutation() {
  const {postRepository} = useAppServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {postId: PostId} & UpdatePostInput) =>
      postRepository.updatePost(input.postId, {
        expectedVersion: input.expectedVersion,
        text: input.text,
      }),
    onSuccess: updated => {
      queryClient.setQueriesData<{pages: {items: SocialPost[]}[]}>(
        {queryKey: queryKeys.feed.all},
        data =>
          data
            ? {
                ...data,
                pages: data.pages.map(page => ({
                  ...page,
                  items: page.items.map(post => (post.id === updated.id ? updated : post)),
                })),
              }
            : data,
      )
      void queryClient.invalidateQueries({queryKey: queryKeys.posts.detail(updated.id)})
    },
  })
}

export function useDeletePostMutation() {
  const {postRepository} = useAppServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (postId: PostId) => postRepository.deletePost(postId),
    onSuccess: (_void, postId) => {
      queryClient.setQueriesData<{pages: {items: SocialPost[]}[]}>(
        {queryKey: queryKeys.feed.all},
        data =>
          data
            ? {
                ...data,
                pages: data.pages.map(page => ({
                  ...page,
                  items: page.items.filter(post => post.id !== postId),
                })),
              }
            : data,
      )
      void queryClient.invalidateQueries({queryKey: queryKeys.feed.all})
    },
  })
}
