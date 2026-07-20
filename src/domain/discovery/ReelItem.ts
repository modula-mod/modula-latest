import type {ModulaProfile} from '@/features/profile/contracts'

export type ReelItem = {
  id: string
  author: ModulaProfile
  caption: string
  source: string
  colour: string
  /** Optional remote/local video URI for the Reels player foundation. */
  videoUri?: string
  liked: boolean
  likeCount: number
  replyCount: number
}
