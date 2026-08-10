import type {PostId} from '@/api/contracts/identifiers'
import type {ModulaProfile} from '@/features/profile/contracts'
import type {PendingMediaAttachment, RemoteMediaAsset} from '@/domain/social/media'

export type FeedMode = 'following' | 'forYou' | 'modules'
/** `innerCircle` / `modules` are Preview audiences (local UI only). */
export type PostAudience = 'public' | 'followers' | 'innerCircle' | 'modules'
export type ReplyPermission = 'everyone' | 'followers' | 'mentioned' | 'innerCircle'

export type PostEngagement = {
  liked: boolean
  saved: boolean
  reposted: boolean
  likeCount: number
  replyCount: number
  repostCount: number
  /** The signed-in viewer's selected reaction, when the provider exposes it. */
  viewerReaction?: ReactionType | null
  reactionCount?: number
  quoteCount?: number
}

export type ReactionType = 'like' | 'celebrate' | 'insightful' | 'support' | 'curious'

export type SocialComment = {
  id: string
  postId: PostId
  authorId: string
  parentCommentId: string | null
  rootCommentId: string | null
  text: string
  depth: number
  replyCount: number
  version: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type DraftLinkPreview = {
  domain: string
  title: string
  description: string
  image?: string
}

export type DraftPoll = {
  question: string
  options: string[]
}

export type CreatePostInput = {
  text: string
  audience: PostAudience
  replyPermission: ReplyPermission
  media: PendingMediaAttachment[]
  linkPreview?: DraftLinkPreview
  poll?: DraftPoll
  idempotencyKey: string
  /** Opt-in public AT Protocol cross-post. Never set for private audiences. */
  publishToAtproto?: boolean
}

export type OptimisticPostState = 'pending' | 'confirmed' | 'failed'

export type UpdatePostInput = {
  expectedVersion: number
  text: string
}

export type BaseSocialPost = PostEngagement & {
  id: PostId
  author: ModulaProfile
  createdAt: string
  feed: FeedMode
  text?: string
  /** Optimistic concurrency token from Greenfield (`posts.version`). */
  version?: number
  /** Embedded quote data is optional so providers without quote support remain compatible. */
  quotedPost?: SocialPost | null
  optimisticState?: OptimisticPostState
}

export type TextSocialPost = BaseSocialPost & {
  kind: 'text'
  text: string
}

export type MediaSocialPost = BaseSocialPost & {
  kind: 'media'
  media: RemoteMediaAsset[]
  pendingMedia?: PendingMediaAttachment[]
  glowColour: string
}

export type LinkSocialPost = BaseSocialPost & {
  kind: 'link'
  link: DraftLinkPreview
}

export type ModuleSocialPost = BaseSocialPost & {
  kind: 'module'
  module: {
    name: string
    actionLabel: string
    status: string
  }
}

export type SocialPost =
  | TextSocialPost
  | MediaSocialPost
  | LinkSocialPost
  | ModuleSocialPost
