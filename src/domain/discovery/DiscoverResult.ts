import type {RemoteMediaAsset} from '@/domain/social/media'
import type {ModulaProfile} from '@/features/profile/contracts'
import type {ProfileModulePreview} from '@/features/profile/data/demoProfileModules'
import type {ReelItem} from '@/domain/discovery/ReelItem'

export type TrendingTopic = {
  id: string
  label: string
  postCount: number
}

export type DiscoverResult = {
  suggestedProfiles: ModulaProfile[]
  trendingTopics: TrendingTopic[]
  featuredModules: ProfileModulePreview[]
  media: RemoteMediaAsset[]
  reels: ReelItem[]
}
