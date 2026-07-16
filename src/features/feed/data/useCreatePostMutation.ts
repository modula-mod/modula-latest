import {useMutation, useQueryClient} from '@tanstack/react-query'

import {parsePostId} from '@/api/contracts'
import {queryKeys} from '@/data/query'
import type {CreatePostInput, SocialPost} from '@/domain/social'
import {useSession} from '@/auth/runtime'
import {useAppServices} from '@/runtime'

function createOptimisticPost(input: CreatePostInput, author: SocialPost['author']): SocialPost {
  const id = parsePostId(`pending-${input.idempotencyKey.slice(0, 24).replace(/[^a-z0-9-]/gi, '-')}`)
  return {
    id,
    kind: input.media.length ? 'media' : 'text',
    author,
    createdAt: new Date().toISOString(),
    feed: 'following',
    text: input.text,
    liked: false,
    saved: false,
    reposted: false,
    likeCount: 0,
    replyCount: 0,
    repostCount: 0,
    optimisticState: 'pending',
    ...(input.media.length
      ? {
          media: input.media.map(media => ({
            id: media.localId,
            kind: 'image' as const,
            url: media.localUri,
            title: 'Selected local photo',
          })),
          pendingMedia: input.media,
          glowColour: author.coverColour ?? author.focusStatus.message,
        }
      : {}),
  } as SocialPost
}

export function useCreatePostMutation() {
  const {postRepository} = useAppServices()
  const session = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePostInput) => postRepository.createPost(input),
    onMutate: async input => {
      if (session.status !== 'signedIn') return {pendingId: null}
      await queryClient.cancelQueries({queryKey: queryKeys.feed.all})
      const pending = createOptimisticPost(input, session.profile)
      queryClient.setQueriesData<{pages: {items: SocialPost[]}[]}>(
        {queryKey: queryKeys.feed.all},
        data => data
          ? {
              ...data,
              pages: data.pages.map((page, index) =>
                index === 0 ? {...page, items: [pending, ...page.items]} : page,
              ),
            }
          : data,
      )
      return {pendingId: pending.id}
    },
    onSuccess: (accepted, _input, context) => {
      if (!context?.pendingId) return
      queryClient.setQueriesData<{pages: {items: SocialPost[]}[]}>(
        {queryKey: queryKeys.feed.all},
        data => data
          ? {
              ...data,
              pages: data.pages.map(page => ({
                ...page,
                items: page.items.map(post => post.id === context.pendingId ? accepted : post),
              })),
            }
          : data,
      )
    },
    onError: (_error, _input, context) => {
      if (!context?.pendingId) return
      queryClient.setQueriesData<{pages: {items: SocialPost[]}[]}>(
        {queryKey: queryKeys.feed.all},
        data => data
          ? {
              ...data,
              pages: data.pages.map(page => ({
                ...page,
                items: page.items.map(post =>
                  post.id === context.pendingId ? {...post, optimisticState: 'failed'} : post,
                ),
              })),
            }
          : data,
      )
    },
  })
}
