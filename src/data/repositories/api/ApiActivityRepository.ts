import {decodeActivityItem, decodeCursorPage} from '@/api/decoding'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {
  asBoolean,
  asIsoDate,
  asNumber,
  asRecord,
  asString,
  failInvalidResponse,
} from '@/api/decoding/validation'
import type {ApiClient} from '@/api/client'
import type {CursorPage} from '@/api/contracts'
import type {ActivityItem} from '@/domain/activity'
import type {
  ActivityRepository,
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
} from '@/data/repositories/contracts'

const BUNDLE_STYLES = new Set(['individual', 'focus', 'digest'])

function relativeTime(value: unknown): string {
  const timestamp = typeof value === 'string' ? Date.parse(value) : NaN
  if (Number.isNaN(timestamp)) return 'Recently'
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return 'Now'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h`
  return `${Math.floor(minutes / 1_440)}d`
}

function decodeNotificationPage(value: unknown): CursorPage<ActivityItem> {
  const page = value as {items?: unknown[]; nextCursor?: string | null; hasMore?: boolean}
  return {
    items: (page.items ?? []).map(row => {
      const item = (row ?? {}) as Record<string, unknown>
      const type = String(item.type ?? '')
      const mappedType =
        type === 'like' || type === 'repost' ? 'reaction'
          : type === 'module_event' ? 'extension'
          : ['reply', 'mention', 'follow'].includes(type) ? type
          : 'system'
      return {
        id: String(item.id ?? ''),
        group: 'Today',
        type: mappedType,
        description: typeof item.body === 'string' && item.body ? item.body : 'New notification',
        timestamp: relativeTime(item.createdAt),
        preview: undefined,
      } as ActivityItem
    }),
    nextCursor: page.nextCursor ?? null,
    hasMore: page.hasMore === true,
  }
}

function decodeActivityPage(value: unknown): CursorPage<ActivityItem> {
  // Preview API returns a bare activity array; local simulator returns a cursor page.
  if (Array.isArray(value)) {
    return {
      items: value.map(decodeActivityItem),
      nextCursor: null,
      hasMore: false,
    }
  }
  return decodeCursorPage(value, decodeActivityItem)
}

async function localOnlyActivityFallback<T>(operation: Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await operation
  } catch (error) {
    if (runtimeEnvironment.dataSource === 'local') return fallback()
    throw error
  }
}

function decodeNotificationPreferences(value: unknown): NotificationPreferences {
  const record = asRecord(value, 'notification preferences')
  const bundleStyle = asString(record.bundleStyle, 'notification preferences bundleStyle')
  if (!BUNDLE_STYLES.has(bundleStyle)) {
    failInvalidResponse('Invalid notification preferences bundleStyle.')
  }
  return {
    followEnabled: asBoolean(record.followEnabled, 'notification preferences followEnabled'),
    likeEnabled: asBoolean(record.likeEnabled, 'notification preferences likeEnabled'),
    reactionEnabled: asBoolean(record.reactionEnabled, 'notification preferences reactionEnabled'),
    repostEnabled: asBoolean(record.repostEnabled, 'notification preferences repostEnabled'),
    quoteEnabled: asBoolean(record.quoteEnabled, 'notification preferences quoteEnabled'),
    replyEnabled: asBoolean(record.replyEnabled, 'notification preferences replyEnabled'),
    commentEnabled: asBoolean(record.commentEnabled, 'notification preferences commentEnabled'),
    mentionEnabled: asBoolean(record.mentionEnabled, 'notification preferences mentionEnabled'),
    moduleEventEnabled: asBoolean(record.moduleEventEnabled, 'notification preferences moduleEventEnabled'),
    extensionEnabled: asBoolean(record.extensionEnabled, 'notification preferences extensionEnabled'),
    bundleStyle: bundleStyle as NotificationPreferences['bundleStyle'],
    version: asNumber(record.version, 'notification preferences version'),
    updatedAt: asIsoDate(record.updatedAt, 'notification preferences updatedAt'),
  }
}

export class ApiActivityRepository implements ActivityRepository {
  constructor(private readonly client: ApiClient) {}

  getActivity(input: {cursor?: string | null; limit?: number}) {
    const query = {cursor: input.cursor ?? undefined, limit: input.limit}
    return localOnlyActivityFallback(
      this.client.get({path: '/v1/notifications', query, authenticated: true}, decodeNotificationPage),
      () => this.client.get({path: '/v1/activity', query}, decodeActivityPage),
    )
  }

  async markRead(activityId: string): Promise<void> {
    await this.client.post(
      {path: `/v1/notifications/${encodeURIComponent(activityId)}/read`, authenticated: true},
      () => undefined,
    )
  }

  async markAllRead(): Promise<void> {
    await this.client.post(
      {path: '/v1/notifications/read-all', authenticated: true},
      () => undefined,
    )
  }

  getNotificationPreferences(): Promise<NotificationPreferences> {
    return this.client.get(
      {path: '/v1/accounts/me/notification-preferences', authenticated: true},
      decodeNotificationPreferences,
    )
  }

  updateNotificationPreferences(
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    return this.client.patch(
      {path: '/v1/accounts/me/notification-preferences', body: input, authenticated: true},
      decodeNotificationPreferences,
    )
  }
}
