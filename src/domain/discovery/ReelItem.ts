import type {ModulaProfile} from '@/features/profile/contracts'

export type ReelItem = {
  id: string
  author: ModulaProfile
  caption: string
  source: string
  colour: string
  liked: boolean
  likeCount: number
  replyCount: number
}
