import {useQuery, useQueryClient} from '@tanstack/react-query'

import type {CursorPage, PostId} from '@/api/contracts'
import {queryKeys, queryNetworkMode} from '@/data/query'
import type {SocialPost} from '@/domain/social'
import {useAppServices} from '@/runtime'

export function usePostQuery(postId: PostId | null) {
  const {postRepository} = useAppServices()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.posts.detail(postId ?? ('post-pending' as PostId)),
    networkMode: queryNetworkMode(),
    enabled: postId !== null,
    queryFn: () => {
      if (!postId) throw new Error('Post id required')
      return postRepository.getPost(postId)
    },
    initialData: () => {
      if (!postId) return undefined
      const feeds = queryClient.getQueriesData<{pages: CursorPage<SocialPost>[]}>({
        queryKey: queryKeys.feed.all,
      })
      for (const [, data] of feeds) {
        const match = data?.pages.flatMap(page => page.items).find(post => post.id === postId)
        if (match) return match
      }
      return undefined
    },
  })
}
