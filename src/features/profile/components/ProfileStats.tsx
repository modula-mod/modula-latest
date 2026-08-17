import {useCallback, useMemo, useState} from 'react'
import {Pressable, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {
  ModulaProfile,
  ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'
import {ProfileMetricPicker} from '@/features/profile/components/ProfileMetricPicker'
import {useProfileMetrics} from '@/features/profile/hooks/useProfileMetrics'
import type {
  ProfileMetricDescriptor,
  ProfileMetricId,
} from '@/features/profile/model/profile-metrics'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const METRIC_ICONS: Record<ProfileMetricId, ModulaIconName> = {
  posts: 'text',
  followers: 'people',
  following: 'profile',
  modules: 'modules',
}

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
 *
 * Page 01 keeps Metrics and About as separate pager pages. The two columns
 * here are picker + featured metric, not Metrics | About side by side.
 */
export function ProfileStats({
  profile,
  ownerHandle,
  presentation,
  onSelectTab,
  isOwner,
}: ProfileStatsProps) {
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
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

  const selected = metrics.find(metric => metric.id === resolvedSelectedId) ?? metrics[0]

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

  if (!metrics.length || !selected) return null

  return (
    <View style={styles.split} testID="profile-metrics-split">
      <View style={styles.pickerCol}>
        <ProfileMetricPicker
          metrics={metrics}
          selectedMetricId={resolvedSelectedId}
          onSelectMetric={setSelectedMetricId}
          onActivateMetric={activate}
          align="start"
          showSelectionDot
          showHints={false}
        />
      </View>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[styles.rule, {backgroundColor: colours.separator}]}
      />
      <View style={styles.spotlightCol}>
        <AppPressable
          accessibilityRole="button"
          accessibilityLabel={`${selected.label}, ${metricSpokenValue(selected)}`}
          accessibilityHint={
            selected.destination.type === 'none' ? undefined : 'Opens this metric'
          }
          onPress={() => activate(selected)}
          style={styles.spotlight}
          testID="profile-metric-spotlight">
          <ModulaIcon
            name={METRIC_ICONS[selected.id]}
            colour={colours.accent}
            size={22}
          />
          <AppText variant="title2" numberOfLines={1}>
            {metricDisplayValue(selected)} {selected.label}
          </AppText>
          {selected.secondaryText ? (
            <AppText
              variant="caption"
              colour="textTertiary"
              numberOfLines={2}
              style={{marginTop: spacing[1]}}>
              {selected.secondaryText}
            </AppText>
          ) : null}
        </AppPressable>
        {metrics
          .filter(metric => metric.id !== selected.id)
          .map(metric => (
            <Pressable
              key={metric.id}
              accessibilityRole="button"
              accessibilityLabel={`${metric.label}, ${metricSpokenValue(metric)}`}
              accessibilityHint={
                metric.destination.type === 'none' ? undefined : 'Opens this metric'
              }
              hitSlop={6}
              onPress={() => activate(metric)}
              style={styles.destRow}
              testID={`profile-metric-destination-${metric.id}`}>
              <ModulaIcon
                name={METRIC_ICONS[metric.id]}
                colour={colours.textTertiary}
                size={14}
              />
              <AppText
                variant="caption"
                colour="textSecondary"
                numberOfLines={1}
                style={styles.destLabel}>
                {metric.label}
              </AppText>
              <ModulaIcon name="chevronRight" colour={colours.textTertiary} size={12} />
            </Pressable>
          ))}
      </View>
    </View>
  )
}

function metricDisplayValue(metric: ProfileMetricDescriptor): string {
  if (metric.loading) return '—'
  if (metric.unavailable) return '—'
  return metric.formattedValue
}

function metricSpokenValue(metric: ProfileMetricDescriptor): string {
  if (metric.loading) return 'Loading'
  if (metric.unavailable) return 'Unavailable'
  return metric.formattedFullValue
}

const styles = StyleSheet.create({
  split: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
    width: '100%',
  },
  pickerCol: {
    flex: 1,
    minWidth: 0,
  },
  rule: {
    alignSelf: 'stretch',
    marginHorizontal: 10,
    width: StyleSheet.hairlineWidth,
  },
  spotlightCol: {
    flex: 1.15,
    justifyContent: 'center',
    minWidth: 0,
  },
  spotlight: {
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 2,
  },
  destRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 28,
    minWidth: 0,
  },
  destLabel: {
    flex: 1,
    minWidth: 0,
  },
})
