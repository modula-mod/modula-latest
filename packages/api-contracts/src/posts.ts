import type {ModulaProfileDto} from './profiles.js'

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
  saved: boolean
  reposted: boolean
  likeCount: number
  replyCount: number
  repostCount: number
  kind: PostKind
  audience?: PostAudience
  version?: number
  media?: PostMediaDto[]
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
  idempotencyKey?: string
  publishToAtproto?: boolean
}

export type UpdatePostInput = {
  expectedVersion: number
  text: string
}
