import {decodeActivityItem, decodeCursorPage} from '@/api/decoding'
import type {ApiClient} from '@/api/client'
import type {CursorPage} from '@/api/contracts'
import type {ActivityItem} from '@/domain/activity'
import type {ActivityRepository} from '@/data/repositories/contracts'

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

export class ApiActivityRepository implements ActivityRepository {
  constructor(private readonly client: ApiClient) {}

  getActivity(input: {cursor?: string | null; limit?: number}) {
    const query = {cursor: input.cursor ?? undefined, limit: input.limit}
    return this.client
      .get({path: '/v1/notifications', query, authenticated: true}, decodeNotificationPage)
      .catch(() => this.client.get({path: '/v1/activity', query}, decodeActivityPage))
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
}
