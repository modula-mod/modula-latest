import type {ModulaProfileDto} from './profiles.js'

export type NotificationType = 'follow' | 'like' | 'repost' | 'reply' | 'mention' | 'module_event'

export type NotificationBundleStyle = 'individual' | 'focus' | 'digest'
export type NotificationCategory = 'social' | 'module' | 'AI' | 'connector' | 'automation' | 'security' | 'system' | 'DIMON' | 'marketplace'
export type NotificationChannel = 'in-app' | 'email' | 'web-push'
export type NotificationFrequency = 'immediate' | 'hourly' | 'daily' | 'weekly' | 'manual'

export type QuietHoursPreferences = {
  enabled: boolean
  start?: string
  end?: string
  timezone?: string
}

export type NotificationDto = {
  id: string
  type: NotificationType
  category?: NotificationCategory
  channels?: NotificationChannel[]
  dedupeKey?: string
  aggregateCount?: number
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
  inAppEnabled?: boolean
  emailEnabled?: boolean
  webPushEnabled?: boolean
  frequency?: NotificationFrequency
  digestMode?: boolean
  quietHours?: QuietHoursPreferences
  channelPreferences?: Partial<Record<NotificationChannel, boolean>>
  categoryPreferences?: Partial<Record<NotificationCategory, boolean>>
  modulePreferences?: Record<string, {enabled?: boolean; frequency?: NotificationFrequency; channels?: NotificationChannel[]}>
  connectorFailureEnabled?: boolean
  aiCompletionEnabled?: boolean
  automationFailureEnabled?: boolean
  dimonTransactionConfirmationEnabled?: boolean
  bundleStyle: NotificationBundleStyle
  version: number
  updatedAt: string
}

export type PatchNotificationPreferencesInput = Partial<NotificationPreferencesDto>
