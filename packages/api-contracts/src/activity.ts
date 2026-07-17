import type {ModulaProfileDto} from './profiles.js'

export type ActivityType =
  | 'like'
  | 'reply'
  | 'follow'
  | 'mention'
  | 'moduleUpdate'
  | 'teamInvitation'

export type ActivityItemDto = {
  id: string
  group: string
  type: ActivityType
  actor?: ModulaProfileDto
  icon?: string
  description: string
  timestamp: string
  preview?: string
  actionLabel?: string
}
