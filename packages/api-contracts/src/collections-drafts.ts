import type {CreatePostContentInput, FeedMode, PostAudience, PostReplyPermission, SocialPostDto} from './posts.js'

export type SavedCollectionDto = {
  id: string
  name: string
  itemCount: number
  version: number
  createdAt: string
  updatedAt: string
}

export type SavedCollectionItemDto = {
  id: string
  collectionId: string
  postId: string
  position: number
  available: boolean
  post: SocialPostDto | null
  version: number
  addedAt: string
  updatedAt: string
}

export type PostDraftState = 'editing' | 'published'

export type PostDraftDto = {
  id: string
  idempotencyKey: string | null
  text: string
  feed: FeedMode
  audience: PostAudience
  replyPermission: PostReplyPermission
  content: CreatePostContentInput[]
  publishToAtproto: boolean
  state: PostDraftState
  publishedPostId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type CreatePostDraftInput = {
  idempotencyKey?: string
  text: string
  feed?: FeedMode
  audience?: PostAudience
  replyPermission?: PostReplyPermission
  content?: CreatePostContentInput[]
  publishToAtproto?: boolean
}

export type UpdatePostDraftInput = Partial<Omit<CreatePostDraftInput, 'idempotencyKey'>> & {
  expectedVersion: number
}
