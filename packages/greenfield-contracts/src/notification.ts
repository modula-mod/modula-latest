import type {GreenfieldReactionType} from './reaction.js'

export type GreenfieldNotificationKind =
  | 'reaction'
  | 'comment'
  | 'reply'
  | 'mention'
  | 'repost'
  | 'quote'
  | 'follow'
  | 'system'
  | 'extension'

export type GreenfieldNotificationChannel = 'inApp' | 'email' | 'push' | 'off'

/**
 * Typed subject references — do not store arbitrary HTML.
 */
export type GreenfieldNotificationSubject =
  | {kind: 'post'; postId: string}
  | {kind: 'comment'; commentId: string; postId: string}
  | {kind: 'actor'; actorId: string}
  | {kind: 'extension'; extensionId: string}
  | {kind: 'system'; code: string}

export type GreenfieldNotification = {
  notificationId: string
  recipientAccountId: string
  kind: GreenfieldNotificationKind
  actorIds: string[]
  subject: GreenfieldNotificationSubject
  reactionType?: GreenfieldReactionType
  previewText: string | null
  batchKey: string | null
  batchCount: number
  readAt: string | null
  createdAt: string
  updatedAt: string
}

export type GreenfieldNotificationPreferenceKind =
  | 'reactions'
  | 'comments'
  | 'replies'
  | 'mentions'
  | 'reposts'
  | 'quotes'
  | 'follows'
  | 'extensions'
  | 'system'

/**
 * Phase 6S requires in-app delivery only.
 * `email` / `push` may be stored as `off` until later phases.
 */
export type GreenfieldNotificationPreferences = {
  accountId: string
  preferences: Record<GreenfieldNotificationPreferenceKind, GreenfieldNotificationChannel>
  updatedAt: string
}
