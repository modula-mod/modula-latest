import type {ModulaProfileDto} from './profiles.js'

export type NotificationType = 'follow' | 'like' | 'repost' | 'reply' | 'mention' | 'module_event'

export type NotificationBundleStyle = 'individual' | 'focus' | 'digest'

export type NotificationDto = {
  id: string
  type: NotificationType
  actor?: ModulaProfileDto
  actorId?: string
  resourceType?: string
  resourceId?: string
  body: string
  readAt?: string | null
  createdAt: string
}

export type NotificationPreferencesDto = {
  followEnabled: boolean
  likeEnabled: boolean
  reactionEnabled: boolean
  repostEnabled: boolean
  quoteEnabled: boolean
  replyEnabled: boolean
  commentEnabled: boolean
  mentionEnabled: boolean
  moduleEventEnabled: boolean
  extensionEnabled: boolean
  bundleStyle: NotificationBundleStyle
  version: number
  updatedAt: string
}

export type PatchNotificationPreferencesInput = Partial<NotificationPreferencesDto>
