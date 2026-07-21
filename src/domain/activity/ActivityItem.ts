import type {AppIconName} from '@/components/primitives/AppIcon'
import type {ModulaProfile} from '@/features/profile/contracts'

type BaseActivity = {
  id: string
  group: 'Today' | 'This week' | 'Earlier'
  actor?: ModulaProfile
  description: string
  timestamp: string
  preview?: string
  actionLabel?: string
  icon?: AppIconName
}

export type LikeActivity = BaseActivity & {type: 'like'}
export type ReplyActivity = BaseActivity & {type: 'reply'}
export type FollowActivity = BaseActivity & {type: 'follow'}
export type MentionActivity = BaseActivity & {type: 'mention'}
export type ReactionActivity = BaseActivity & {type: 'reaction'}
export type ExtensionActivity = BaseActivity & {type: 'extension'}
export type SystemActivity = BaseActivity & {type: 'system'}
export type ModuleActivity = BaseActivity & {type: 'moduleUpdate'}
export type TeamInviteActivity = BaseActivity & {type: 'teamInvitation'}

export type ActivityItem =
  | LikeActivity
  | ReplyActivity
  | FollowActivity
  | MentionActivity
  | ReactionActivity
  | ExtensionActivity
  | SystemActivity
  | ModuleActivity
  | TeamInviteActivity
