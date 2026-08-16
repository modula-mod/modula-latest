import {useMemo} from 'react'

import type {
  ModulaProfile,
  ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'
import {
  normaliseMetricPreferences,
  resolveProfileMetrics,
  type ProfileMetricDescriptor,
  type ProfileMetricId,
} from '@/features/profile/model/profile-metrics'

export function useProfileMetrics({
  profile,
  ownerHandle,
  presentation,
  isOwner,
}: {
  profile: ModulaProfile
  ownerHandle: string
  presentation: ProfilePresentationPreferences
  isOwner: boolean
}): {
  metrics: ProfileMetricDescriptor[]
  defaultMetricId: ProfileMetricId
} {
  return useMemo(() => {
    const {defaultMetricId} = normaliseMetricPreferences(presentation)
    return {
      metrics: resolveProfileMetrics({
        profile,
        ownerHandle,
        presentation,
        isOwner,
      }),
      defaultMetricId,
    }
  }, [isOwner, ownerHandle, presentation, profile])
}
