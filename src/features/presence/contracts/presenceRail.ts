import type {StoryRingState} from '@/domain/stories'

export type PresenceRailPerson = {
  id: string
  name: string
  uri?: string
  /** True when there are unviewed items (legacy dial accent). */
  fresh: boolean
  colour?: string
  groupId?: string
  ringState?: StoryRingState
  isOwner?: boolean
  itemCount?: number
}
