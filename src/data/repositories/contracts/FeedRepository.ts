import type {CursorPage} from '@/api/contracts'
import type {FeedMode, SocialPost} from '@/domain/social'
import type {ProfileId} from '@/api/contracts/identifiers'

export type GetHomeFeedInput = {
  mode: FeedMode
  cursor?: string | null
  limit?: number
}

export type GetProfileFeedInput = {
  profileId: ProfileId
  cursor?: string | null
  limit?: number
}

export interface FeedRepository {
  getHomeFeed(input: GetHomeFeedInput): Promise<CursorPage<SocialPost>>
  getProfileFeed(input: GetProfileFeedInput): Promise<CursorPage<SocialPost>>
}
