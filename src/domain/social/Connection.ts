import type {ModulaProfile} from '@/features/profile/contracts'

export type FollowResult = {
  profile: ModulaProfile
  isFollowing: boolean
  followerCount: number
}

export type ConnectionListInput = {
  handle: string
  cursor?: string | null
  limit?: number
}
