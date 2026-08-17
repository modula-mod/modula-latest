import {Pressable, StyleSheet, View} from 'react-native'
import {GestureDetector} from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import {ProfileAboutPage} from '@/features/profile/components/ProfileAboutPage'
import {ProfileMetricsPage} from '@/features/profile/components/ProfileMetricsPage'
import {ProfileOverviewSwitcher} from '@/features/profile/components/ProfileOverviewSwitcher'
import {useProfilePagerAnimation} from '@/features/profile/components/useProfilePagerAnimation'
import type {
  ModulaProfile,
  ProfilePresentationPreferences,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {PROFILE_LAYOUT} from '@/features/profile/model/profile-layout'
import {
  PROFILE_SNAPSHOT_OVERVIEW_PAGES,
  type ProfileOverviewPage,
} from '@/features/profile/model/profile-snapshot'
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
 * Inner Overview pager: Metrics ↔ About.
 * Horizontal swipe stays inside this content region so it cannot fight
 * the outer Overview → Modules → Links navigator.
 */
export function ProfileOverviewPageView({
  profile,
  viewer,
  presentation,
  ownerHandle,
  onSelectTab,
  showStats,
}: ProfileOverviewPageViewProps) {
  const {colours} = useThemeTokens()
  const pager = useProfilePagerAnimation(PROFILE_SNAPSHOT_OVERVIEW_PAGES.length)
  const current: ProfileOverviewPage = PROFILE_SNAPSHOT_OVERVIEW_PAGES[pager.pageIndex] ?? 'metrics'
  const accessibilityValue =
    current === 'metrics' ? 'Metrics, 1 of 2.' : 'About, 2 of 2.'

  const goToPage = (page: ProfileOverviewPage) => {
    pager.goTo(page === 'about' ? 1 : 0)
  }

  return (
    <View style={styles.host} testID="profile-overview-page">
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Overview details"
        accessibilityValue={{text: accessibilityValue}}
        accessibilityHint="Swipe left or right to switch Metrics and About."
        accessibilityActions={[
          {name: 'increment', label: 'Next overview page'},
          {name: 'decrement', label: 'Previous overview page'},
        ]}
        onAccessibilityAction={event => {
          const name = event.nativeEvent.actionName
          if (name === 'increment') pager.goTo(1)
          if (name === 'decrement') pager.goTo(0)
        }}
        style={styles.a11yAnchor}
      />
      <ProfileOverviewSwitcher selected={current} onSelect={goToPage} />
      <GestureDetector gesture={pager.pan}>
        <View
          onLayout={event => pager.onViewportLayout(event.nativeEvent.layout.width)}
          style={[styles.viewport, {minHeight: PROFILE_LAYOUT.snapshotBodyMinHeight}]}>
          <Animated.View
            style={[
              styles.track,
              {width: pager.pageWidth > 0 ? pager.pageWidth * 2 : '200%'},
              pager.trackStyle,
            ]}>
            <View
              testID="profile-overview-metrics"
              accessibilityElementsHidden={pager.pageIndex !== 0}
              importantForAccessibility={pager.pageIndex === 0 ? 'auto' : 'no-hide-descendants'}
              style={[styles.page, pager.pageWidth > 0 ? {width: pager.pageWidth} : styles.pageHalf]}>
              {showStats ? (
                <ProfileMetricsPage
                  profile={profile}
                  ownerHandle={ownerHandle}
                  presentation={presentation}
                  onSelectTab={onSelectTab}
                  isOwner={viewer.canEdit}
                />
              ) : null}
            </View>
            <View
              testID="profile-overview-about"
              accessibilityElementsHidden={pager.pageIndex !== 1}
              importantForAccessibility={pager.pageIndex === 1 ? 'auto' : 'no-hide-descendants'}
              style={[styles.page, pager.pageWidth > 0 ? {width: pager.pageWidth} : styles.pageHalf]}>
              <ProfileAboutPage profile={profile} viewer={viewer} />
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.indicators} testID="profile-overview-indicators">
        {PROFILE_SNAPSHOT_OVERVIEW_PAGES.map((id, index) => {
          const active = index === pager.pageIndex
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={id === 'metrics' ? 'Metrics, 1 of 2' : 'About, 2 of 2'}
              accessibilityState={{selected: active}}
              testID={`profile-overview-indicator-${id}`}
              hitSlop={10}
              onPress={() => pager.goTo(index)}
              style={styles.indicatorHit}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: active ? colours.accent : colours.textTertiary,
                    opacity: active ? 1 : 0.38,
                    width: PROFILE_LAYOUT.pagerIndicatorSize,
                    height: PROFILE_LAYOUT.pagerIndicatorSize,
                    borderRadius: PROFILE_LAYOUT.pagerIndicatorSize / 2,
                  },
                ]}
              />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  a11yAnchor: {
    height: 1,
    overflow: 'hidden',
    width: 1,
  },
  dot: {
    overflow: 'hidden',
  },
  host: {
    minWidth: 0,
    width: '100%',
  },
  indicatorHit: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  indicators: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 2,
  },
  page: {
    minWidth: 0,
  },
  pageHalf: {
    width: '50%',
  },
  track: {
    flexDirection: 'row',
  },
  viewport: {
    overflow: 'hidden',
    width: '100%',
  },
})
