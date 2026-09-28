import type {ModulaProfileDto} from './profiles.js'

export type PostReactionType = 'like' | 'love' | 'laugh' | 'fire' | 'celebrate' | 'insightful' | 'support' | 'curious'

export type PostKind = 'text' | 'media' | 'link' | 'module'
export type FeedMode = 'following' | 'forYou' | 'modules'
export type PostAudience = 'public' | 'followers' | 'private'
export type PostReplyPermission = 'everyone' | 'followers' | 'mentioned' | 'none'

export type PostMediaDto = {
  id: string
  kind: 'image'
  url?: string
  title?: string
  colour?: string
  aspectRatio?: number
  altText?: string
}

export type AttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'unknown'
export type AttachmentStatus = 'created' | 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed' | 'expired' | 'rejected'

export type AttachmentDto = {
  id: string
  kind: AttachmentKind
  mimeType: string
  filename: string
  byteSize: number
  checksum?: string
  status: AttachmentStatus
  width?: number
  height?: number
  duration?: number
  pageCount?: number
  originalURL?: string
  previewURL?: string
  thumbnailURL?: string
}

export type PostContentDto = {
  id: string
  type: Exclude<AttachmentKind, 'unknown'>
  order: number
  caption?: string
  attachment: AttachmentDto
}

export type CreatePostContentInput = {
  type: Exclude<AttachmentKind, 'unknown'>
  attachmentId: string
  caption?: string
}

export type CreatePostMediaInput = {
  localId?: string
  kind: 'image'
  base64: string
  width?: number
  height?: number
  mimeType?: 'image/jpeg' | 'image/jpg' | 'image/png' | 'image/webp'
  altText?: string
}

export type PostLinkDto = {
  domain: string
  title: string
  description: string
  image?: string
}

export type PostModuleDto = {
  name: string
  actionLabel: string
  status: string
}

export type SocialPostDto = {
  id: string
  author: ModulaProfileDto
  createdAt: string
  feed: FeedMode
  text?: string
  liked: boolean
  viewerReaction?: PostReactionType | null
  reactionCount?: number
  saved: boolean
  reposted: boolean
  likeCount: number
  replyCount: number
  repostCount: number
  quoteCount: number
  quotedPost?: SocialPostDto | null
  kind: PostKind
  audience?: PostAudience
  version?: number
  media?: PostMediaDto[]
  content?: PostContentDto[]
  glowColour?: string
  link?: PostLinkDto
  module?: PostModuleDto
}

export type CreatePostInput = {
  text: string
  feed?: FeedMode
  audience?: PostAudience
  replyPermission?: PostReplyPermission
  media?: CreatePostMediaInput[]
  content?: CreatePostContentInput[]
  idempotencyKey?: string
  publishToAtproto?: boolean
}

export type UpdatePostInput = {
  expectedVersion: number
  text: string
}
