import {decodeCursorPage, decodePost} from '@/api/decoding'
import {asRecord} from '@/api/decoding/validation'
import type {ApiClient} from '@/api/client'
import type {PostRepository} from '@/data/repositories/contracts'
import type {PostId} from '@/api/contracts'
import type {CreatePostInput, PostEngagement, SocialPost} from '@/domain/social'

function decodeEngagement(value: unknown): PostEngagement {
  return asRecord(value, 'post engagement') as PostEngagement
}

export class ApiPostRepository implements PostRepository {
  constructor(private readonly client: ApiClient) {}

  getPost(postId: PostId): Promise<SocialPost> {
    return this.client.get({path: `/v1/posts/${encodeURIComponent(postId)}`}, decodePost)
  }

  createPost(input: CreatePostInput): Promise<SocialPost> {
    return this.client.post({path: '/v1/posts', body: input, authenticated: true}, decodePost)
  }

  likePost(postId: PostId): Promise<PostEngagement> {
    return this.client.post({path: `/v1/posts/${postId}/like`, authenticated: true}, decodeEngagement)
  }

  unlikePost(postId: PostId): Promise<PostEngagement> {
    return this.client.delete({path: `/v1/posts/${postId}/like`, authenticated: true}, decodeEngagement)
  }

  savePost(postId: PostId): Promise<PostEngagement> {
    return this.client.post({path: `/v1/posts/${postId}/save`, authenticated: true}, decodeEngagement)
  }

  unsavePost(postId: PostId): Promise<PostEngagement> {
    return this.client.delete({path: `/v1/posts/${postId}/save`, authenticated: true}, decodeEngagement)
  }

  repost(postId: PostId): Promise<PostEngagement> {
    return this.client.post({path: `/v1/posts/${postId}/repost`, authenticated: true}, decodeEngagement)
  }

  removeRepost(postId: PostId): Promise<PostEngagement> {
    return this.client.delete({path: `/v1/posts/${postId}/repost`, authenticated: true}, decodeEngagement)
  }

  getSavedPosts(input: {cursor?: string | null; limit?: number}) {
    return this.client.get({
      path: '/v1/posts/saved',
      query: {cursor: input.cursor ?? undefined, limit: input.limit},
      authenticated: true,
    }, value => decodeCursorPage(value, decodePost))
  }
}
