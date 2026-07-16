import type {ActivityItem} from '@/domain/activity'
import {decodeProfile} from '@/api/decoding/decodeProfile'
import {asRecord, asString, optional} from '@/api/decoding/validation'

export function decodeActivityItem(value: unknown): ActivityItem {
  const item = asRecord(value, 'activity item')
  const type = asString(item.type, 'activity type') as ActivityItem['type']
  if (!['like', 'reply', 'follow', 'mention', 'moduleUpdate', 'teamInvitation'].includes(type)) {
    throw new Error('Invalid activity type.')
  }
  return {
    id: asString(item.id, 'activity id'),
    group: asString(item.group, 'activity group') as ActivityItem['group'],
    type,
    actor: optional(item.actor, decodeProfile),
    icon: optional(item.icon, icon => asString(icon, 'activity icon')) as ActivityItem['icon'],
    description: asString(item.description, 'activity description'),
    timestamp: asString(item.timestamp, 'activity timestamp'),
    preview: optional(item.preview, preview => asString(preview, 'activity preview')),
    actionLabel: optional(item.actionLabel, label => asString(label, 'activity action')),
  } as ActivityItem
}
