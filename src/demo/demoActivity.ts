import {demoProfiles} from '@/demo/demoProfiles'
import type {AppIconName} from '@/components/primitives/AppIcon'
import type {DemoProfile} from '@/types/social'

export type DemoActivityEvent = {
  id: string
  group: 'Today' | 'This week' | 'Earlier'
  type:
    | 'like'
    | 'reply'
    | 'follow'
    | 'mention'
    | 'moduleUpdate'
    | 'teamInvitation'
  actor?: DemoProfile
  icon?: AppIconName
  description: string
  timestamp: string
  preview?: string
  actionLabel?: string
}

export const demoActivity: DemoActivityEvent[] = [
  {
    id: 'activity-like-1',
    group: 'Today',
    type: 'like',
    actor: demoProfiles.design,
    description: 'liked your post about the Phase 1 social shell.',
    timestamp: '18m',
    preview: 'Phase 1 goal: make Modula feel like a real social operating shell.',
  },
  {
    id: 'activity-reply-1',
    group: 'Today',
    type: 'reply',
    actor: demoProfiles.builders,
    description: 'replied to your Board prototype.',
    timestamp: '42m',
    preview: 'The focus strip makes the Board feel much more personal.',
    actionLabel: 'View reply',
  },
  {
    id: 'activity-follow-1',
    group: 'This week',
    type: 'follow',
    actor: demoProfiles.garden,
    description: 'started following your Modula updates.',
    timestamp: '2d',
    actionLabel: 'Follow back',
  },
  {
    id: 'activity-module-1',
    group: 'This week',
    type: 'moduleUpdate',
    icon: 'modules',
    description: 'Vault Notes added a new local preview surface.',
    timestamp: '3d',
    preview: 'Module installation is intentionally disabled for Phase 1.',
    actionLabel: 'Open preview',
  },
  {
    id: 'activity-team-1',
    group: 'Earlier',
    type: 'teamInvitation',
    icon: 'teams',
    description: 'Modula Team invited you to the Builders workspace.',
    timestamp: '1w',
    preview: 'Team collaboration will connect after the shell is stable.',
    actionLabel: 'Preview',
  },
  {
    id: 'activity-mention-1',
    group: 'Earlier',
    type: 'mention',
    actor: demoProfiles.gaia,
    description: 'mentioned you in a local automation note.',
    timestamp: '2w',
    preview: '@andrei.modula can review this workflow before activation.',
  },
]
