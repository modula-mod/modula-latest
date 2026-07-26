import type {CursorPage} from '@/api/contracts'
import type {ActivityItem} from '@/domain/activity'
import type {
  NotificationBundleStyle,
  NotificationPreferencesDto,
  PatchNotificationPreferencesInput,
} from '@modula/api-contracts'

export type NotificationPreferences = NotificationPreferencesDto

export type UpdateNotificationPreferencesInput = PatchNotificationPreferencesInput & {
  expectedVersion?: number
  bundleStyle?: NotificationBundleStyle
}

export interface ActivityRepository {
  getActivity(input: {cursor?: string | null; limit?: number}): Promise<CursorPage<ActivityItem>>
  markRead(activityId: string): Promise<void>
  markAllRead(): Promise<void>
  getNotificationPreferences(): Promise<NotificationPreferences>
  updateNotificationPreferences(
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences>
}
