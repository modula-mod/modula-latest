import {StyleSheet, View, useWindowDimensions} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ProfileAboutPage} from '@/features/profile/components/ProfileAboutPage'
import {ProfileMetricsPage} from '@/features/profile/components/ProfileMetricsPage'
import type {
  ModulaProfile,
  ProfilePresentationPreferences,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {
  PROFILE_LAYOUT,
  profileOverviewStacked,
} from '@/features/profile/model/profile-layout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileOverviewPageViewProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
  presentation: ProfilePresentationPreferences
  ownerHandle: string
  onSelectTab: (tabId: string) => void
  showStats: boolean
}

/**
 * Overview split: Metrics and About are simultaneously visible.
 * There is no inner pager, inner dots, or Metrics/About swipe.
 *
 * Compact column headers are labels, not tappable tabs.
 * Large Dynamic Type / narrow widths stack both columns on this same page.
 */
export function ProfileOverviewPageView({
  profile,
  viewer,
  presentation,
  ownerHandle,
  onSelectTab,
  showStats,
}: ProfileOverviewPageViewProps) {
  const {colours, spacing} = useThemeTokens()
  const {width, fontScale} = useWindowDimensions()
  const stacked = profileOverviewStacked(width, fontScale)

  const metrics = showStats ? (
    <ProfileMetricsPage
      profile={profile}
      ownerHandle={ownerHandle}
      presentation={presentation}
      onSelectTab={onSelectTab}
      isOwner={viewer.canEdit}
    />
  ) : null

  const about = <ProfileAboutPage profile={profile} viewer={viewer} compact />

  if (stacked) {
    return (
      <View style={[styles.host, {gap: spacing[3]}]} testID="profile-overview-page">
        {showStats ? (
          <View testID="profile-overview-metrics" style={styles.stackBlock}>
            <OverviewColumnHeader label="Metrics" />
            {metrics}
          </View>
        ) : null}
        <View testID="profile-overview-about" style={styles.stackBlock}>
          <OverviewColumnHeader label="About" />
          {about}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.host} testID="profile-overview-page">
      <View
        testID="profile-overview-split"
        style={[styles.split, {gap: spacing[3]}]}>
        <View
          testID="profile-overview-metrics"
          style={[
            styles.metricsColumn,
            {maxWidth: PROFILE_LAYOUT.overviewMetricsMaxWidth},
          ]}>
          <OverviewColumnHeader label="Metrics" />
          <View style={styles.metricsBody}>{metrics}</View>
        </View>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.divider,
            {backgroundColor: colours.separator, width: StyleSheet.hairlineWidth},
          ]}
        />
        <View testID="profile-overview-about" style={styles.aboutColumn}>
          <OverviewColumnHeader label="About" />
          {about}
        </View>
      </View>
    </View>
  )
}

function OverviewColumnHeader({label}: {label: string}) {
  return (
    <AppText
      variant="label"
      colour="textSecondary"
      accessibilityRole="header"
      numberOfLines={1}
      style={styles.columnHeader}>
      {label}
    </AppText>
  )
}

const styles = StyleSheet.create({
  aboutColumn: {
    flex: 1,
    minWidth: 0,
  },
  columnHeader: {
    marginBottom: 6,
  },
  divider: {
    alignSelf: 'stretch',
    opacity: 0.45,
  },
  host: {
    minWidth: 0,
    width: '100%',
  },
  metricsBody: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  metricsColumn: {
    flexBasis: '36%',
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 108,
  },
  split: {
    alignItems: 'stretch',
    flexDirection: 'row',
    minWidth: 0,
    width: '100%',
  },
  stackBlock: {
    minWidth: 0,
    width: '100%',
  },
})
