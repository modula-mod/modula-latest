import {useCallback, useMemo, useState} from 'react'
import {useRouter, type Href} from 'expo-router'

import type {
  ModulaProfile,
  ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'
import {ProfileMetricPicker} from '@/features/profile/components/ProfileMetricPicker'
import {useProfileMetrics} from '@/features/profile/hooks/useProfileMetrics'
import type {ProfileMetricDescriptor} from '@/features/profile/model/profile-metrics'

type ProfileStatsProps = {
  profile: ModulaProfile
  ownerHandle: string
  presentation: ProfilePresentationPreferences
  onSelectTab: (tabId: string) => void
  isOwner: boolean
}

/**
 * Profile Metric Picker host. Selecting a metric is not navigation —
 * activation (tap selected / accessibility activate) opens the destination.
 */
export function ProfileStats({
  profile,
  ownerHandle,
  presentation,
  onSelectTab,
  isOwner,
}: ProfileStatsProps) {
  const router = useRouter()
  const {metrics, defaultMetricId} = useProfileMetrics({
    profile,
    ownerHandle,
    presentation,
    isOwner,
  })
  const [selectedMetricId, setSelectedMetricId] = useState<string>(defaultMetricId)

  const resolvedSelectedId = useMemo(() => {
    if (metrics.some(metric => metric.id === selectedMetricId)) return selectedMetricId
    return metrics[0]?.id ?? defaultMetricId
  }, [defaultMetricId, metrics, selectedMetricId])

  const activate = useCallback(
    (metric: ProfileMetricDescriptor) => {
      if (metric.destination.type === 'profile-tab') {
        onSelectTab(metric.destination.tabId)
        return
      }
      if (metric.destination.type === 'route') {
        router.push(metric.destination.href as Href)
      }
    },
    [onSelectTab, router],
  )

  if (!metrics.length) return null

  return (
    <ProfileMetricPicker
      metrics={metrics}
      selectedMetricId={resolvedSelectedId}
      onSelectMetric={setSelectedMetricId}
      onActivateMetric={activate}
    />
  )
}
