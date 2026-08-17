import {useCallback, useMemo, useState} from 'react'
import {StyleSheet, View} from 'react-native'
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
 * Overview Metrics column. Vertical selector only — tap the selected metric
 * to open its destination. No right-hand duplicate list.
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
    <View style={styles.host} testID="profile-metrics-picker-host">
      <ProfileMetricPicker
        metrics={metrics}
        selectedMetricId={resolvedSelectedId}
        onSelectMetric={setSelectedMetricId}
        onActivateMetric={activate}
        align="center"
        showHints
      />
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    minWidth: 0,
    width: '100%',
  },
})
