import type {ActivityItem} from '@/domain/activity'
import {decodeProfile} from '@/api/decoding/decodeProfile'
import {asRecord, asString, optional} from '@/api/decoding/validation'
import {ModulaApiError} from '@/api/contracts/ApiError'
import {formatRelativeTime} from '@/lib/formatRelativeTime'

const activityGroups = new Set<ActivityItem['group']>(['Today', 'This week', 'Earlier'])

function decodeActivityGroup(value: unknown): ActivityItem['group'] {
  const raw = asString(value, 'activity group')
  if (activityGroups.has(raw as ActivityItem['group'])) {
    return raw as ActivityItem['group']
  }
  // Preview API seeds lowercase group keys (today / earlier).
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'today') return 'Today'
  if (normalized === 'this week' || normalized === 'thisweek') return 'This week'
  if (normalized === 'earlier') return 'Earlier'
  throw new ModulaApiError({
    message: 'Invalid activity group.',
    code: 'INVALID_RESPONSE',
    status: 0,
    retryable: false,
  })
}

export function decodeActivityItem(value: unknown): ActivityItem {
  const item = asRecord(value, 'activity item')
  const type = asString(item.type, 'activity type') as ActivityItem['type']
  if (!['like', 'reply', 'follow', 'mention', 'moduleUpdate', 'teamInvitation'].includes(type)) {
    throw new Error('Invalid activity type.')
  }
  return {
    id: asString(item.id, 'activity id'),
    group: decodeActivityGroup(item.group),
    type,
    actor: optional(item.actor, decodeProfile),
    icon: optional(item.icon, icon => asString(icon, 'activity icon')) as ActivityItem['icon'],
    description: asString(item.description, 'activity description'),
    timestamp: formatRelativeTime(
      typeof item.timestamp === 'string'
        ? item.timestamp
        : typeof item.createdAt === 'string'
          ? item.createdAt
          : asString(item.timestamp, 'activity timestamp'),
    ),
    preview: optional(item.preview, preview => asString(preview, 'activity preview')),
    actionLabel: optional(item.actionLabel, label => asString(label, 'activity action')),
  } as ActivityItem
}
