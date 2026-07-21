import type {ModulaProfileDto} from './profiles.js'

export type NotificationType = 'follow' | 'like' | 'repost' | 'reply' | 'mention' | 'module_event'

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
  repostEnabled: boolean
  replyEnabled: boolean
  mentionEnabled: boolean
  moduleEventEnabled: boolean
}

export type PatchNotificationPreferencesInput = Partial<NotificationPreferencesDto>
