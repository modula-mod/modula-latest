import {decodeActivityItem, decodeCursorPage} from '@/api/decoding'
import type {ApiClient} from '@/api/client'
import type {CursorPage} from '@/api/contracts'
import type {ActivityItem} from '@/domain/activity'
import type {ActivityRepository} from '@/data/repositories/contracts'

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
    return this.client.get({
      path: '/v1/activity',
      query: {cursor: input.cursor ?? undefined, limit: input.limit},
    }, decodeActivityPage)
  }
}
