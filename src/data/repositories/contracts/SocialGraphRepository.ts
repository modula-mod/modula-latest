import type {CursorPage, ProfileId} from '@/api/contracts'
import type {ModulaProfile} from '@/features/profile/contracts'

export type ConnectionPageInput = {
  handle: string
  cursor?: string | null
  limit?: number
}

export type FollowResult = {
  profile: ModulaProfile
  isFollowing: boolean
  followerCount: number
}

export interface SocialGraphRepository {
  follow(profileId: ProfileId): Promise<FollowResult>
  unfollow(profileId: ProfileId): Promise<FollowResult>
  getFollowers(input: ConnectionPageInput): Promise<CursorPage<ModulaProfile>>
  getFollowing(input: ConnectionPageInput): Promise<CursorPage<ModulaProfile>>
}
