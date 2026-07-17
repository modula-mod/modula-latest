import type {ModulaProfileDto} from './profiles.js'

export type PostKind = 'text' | 'media' | 'link' | 'module'
export type FeedMode = 'following' | 'forYou' | 'modules'

export type PostMediaDto = {
  id: string
  kind: 'image'
  url?: string
  title?: string
  colour?: string
  aspectRatio?: number
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
  media?: PostMediaDto[]
  glowColour?: string
  link?: PostLinkDto
  module?: PostModuleDto
}
