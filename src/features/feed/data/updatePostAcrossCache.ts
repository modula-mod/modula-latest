import type {InfiniteData, QueryClient} from '@tanstack/react-query'

import type {CursorPage, PostId} from '@/api/contracts'
import {queryKeys} from '@/data/query'
import type {PostEngagement, SocialPost} from '@/domain/social'

type PostUpdater = (post: SocialPost) => SocialPost

function updatePage(page: CursorPage<SocialPost>, postId: PostId, updater: PostUpdater) {
  return {
    ...page,
    items: page.items.map(post => (post.id === postId ? updater(post) : post)),
  }
}

export function updatePostAcrossCache(
  queryClient: QueryClient,
  postId: PostId,
  updater: PostUpdater,
) {
  queryClient.setQueriesData<InfiniteData<CursorPage<SocialPost>>>(
    {queryKey: queryKeys.feed.all},
    data => data
      ? {
          ...data,
          pages: data.pages.map(page => updatePage(page, postId, updater)),
        }
      : data,
  )
  queryClient.setQueriesData<SocialPost>(
    {queryKey: queryKeys.posts.detail(postId)},
    data => (data ? updater(data) : data),
  )
  queryClient.setQueriesData<InfiniteData<CursorPage<SocialPost>>>(
    {queryKey: queryKeys.posts.all},
    data => data
      ? {
          ...data,
          pages: data.pages.map(page => updatePage(page, postId, updater)),
        }
      : data,
  )
}

export function applyEngagement(post: SocialPost, engagement: PostEngagement): SocialPost {
  return {
    ...post,
    liked: engagement.liked,
    saved: engagement.saved,
    reposted: engagement.reposted,
    likeCount: Math.max(0, engagement.likeCount),
    replyCount: Math.max(0, engagement.replyCount),
    repostCount: Math.max(0, engagement.repostCount),
  }
}
