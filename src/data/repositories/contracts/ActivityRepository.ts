import type {CursorPage} from '@/api/contracts'
import type {ActivityItem} from '@/domain/activity'

export interface ActivityRepository {
  getActivity(input: {cursor?: string | null; limit?: number}): Promise<CursorPage<ActivityItem>>
}
