import type {ModulaProfileDto} from './profiles.js'
import type {PostMediaDto} from './posts.js'

export type TrendingTopicDto = {
  id: string
  label: string
  postCount: number
}

export type FeaturedModuleDto = Record<string, unknown>

export type ReelItemDto = {
  id: string
  author: ModulaProfileDto
  caption: string
  source: string
  colour: string
  liked: boolean
  likeCount: number
  replyCount: number
}

export type DiscoverResultDto = {
  suggestedProfiles: ModulaProfileDto[]
  trendingTopics: TrendingTopicDto[]
  featuredModules: FeaturedModuleDto[]
  media: PostMediaDto[]
  reels: ReelItemDto[]
}
