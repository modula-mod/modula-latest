import type {CursorPage, PostId} from '@/api/contracts'
import type {CreatePostInput, PostEngagement, SocialPost} from '@/domain/social'

export interface PostRepository {
  getPost(postId: PostId): Promise<SocialPost>
  createPost(input: CreatePostInput): Promise<SocialPost>
  likePost(postId: PostId): Promise<PostEngagement>
  unlikePost(postId: PostId): Promise<PostEngagement>
  savePost(postId: PostId): Promise<PostEngagement>
  unsavePost(postId: PostId): Promise<PostEngagement>
  repost(postId: PostId): Promise<PostEngagement>
  removeRepost(postId: PostId): Promise<PostEngagement>
  getSavedPosts(input: {cursor?: string | null; limit?: number}): Promise<CursorPage<SocialPost>>
}
