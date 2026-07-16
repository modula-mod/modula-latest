import {decodeActivityItem, decodeCursorPage} from '@/api/decoding'
import type {ApiClient} from '@/api/client'
import type {ActivityRepository} from '@/data/repositories/contracts'

export class ApiActivityRepository implements ActivityRepository {
  constructor(private readonly client: ApiClient) {}

  getActivity(input: {cursor?: string | null; limit?: number}) {
    return this.client.get({
      path: '/v1/activity',
      query: {cursor: input.cursor ?? undefined, limit: input.limit},
    }, value => decodeCursorPage(value, decodeActivityItem))
  }
}
