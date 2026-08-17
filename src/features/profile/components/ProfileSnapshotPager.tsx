import {useMemo} from 'react'
import {StyleSheet, View} from 'react-native'
import {GestureDetector} from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import {ProfileLinksPreview} from '@/features/profile/components/ProfileLinksPreview'
import {ProfileModulesPreview} from '@/features/profile/components/ProfileModulesPreview'
import {ProfileOverviewPageView} from '@/features/profile/components/ProfileOverviewPage'
import {ProfileSnapshotNav} from '@/features/profile/components/ProfileSnapshotNav'
import {useProfilePagerAnimation} from '@/features/profile/components/useProfilePagerAnimation'
import type {
  ModulaProfile,
  ProfilePresentationPreferences,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {useModuleCatalogueQuery} from '@/features/modules/hooks'
import {
  resolvePublicProfileLinks,
  resolvePublicProfileModules,
} from '@/features/profile/data/resolveProfilePublicContent'
import {
  LINK_PREVIEW_COUNT,
  MODULE_PREVIEW_COUNT,
  resolveProfileSnapshotPages,
} from '@/features/profile/model/profile-snapshot'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileSnapshotPagerProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
  presentation: ProfilePresentationPreferences
  ownerHandle: string
  showStats?: boolean
  onSelectTab: (tabId: string) => void
}

/**
 * Profile snapshot pager.
 *
 * Outer: Overview → Modules → Links (minimal page indicator).
 * Overview always shows Metrics and About together — there is no inner pager.
 *
 * Horizontal swipe is bound to each page so it does not compete with the
 * vertical metric wheel. The centered indicator remains tappable.
 */
export function ProfileSnapshotPager({
  profile,
  viewer,
  presentation,
  ownerHandle,
  showStats = true,
  onSelectTab,
}: ProfileSnapshotPagerProps) {
  const {colours} = useThemeTokens()
  const pages = resolveProfileSnapshotPages()
  const {
    pageIndex,
    pageWidth,
    createPan,
    trackStyle,
    goTo,
    onViewportLayout,
  } = useProfilePagerAnimation(pages.length)
  const overviewPan = useMemo(() => createPan(), [createPan])
  const modulesPan = useMemo(() => createPan(), [createPan])
  const linksPan = useMemo(() => createPan(), [createPan])
  const catalogue = useModuleCatalogueQuery()
  const modules = resolvePublicProfileModules(
    profile,
    viewer.relationship,
    catalogue.data ?? [],
  ).slice(0, MODULE_PREVIEW_COUNT)
  const links = resolvePublicProfileLinks(profile, viewer.relationship).slice(
    0,
    LINK_PREVIEW_COUNT,
  )
  const current = pages[pageIndex] ?? pages[0]
  const accessibilityValue = `${current.label}, page ${pageIndex + 1} of ${pages.length}.`

  return (
    <View testID="profile-snapshot-pager" style={styles.host}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Profile snapshot"
        accessibilityValue={{text: accessibilityValue}}
        accessibilityHint="Swipe or use next and previous to change Overview, Modules, and Links."
        accessibilityActions={[
          {name: 'increment', label: 'Next snapshot page'},
          {name: 'decrement', label: 'Previous snapshot page'},
        ]}
        onAccessibilityAction={event => {
          const name = event.nativeEvent.actionName
          if (name === 'increment') goTo(pageIndex + 1)
          if (name === 'decrement') goTo(pageIndex - 1)
        }}
        style={styles.a11yAnchor}
      />
      <View
        onLayout={event => onViewportLayout(event.nativeEvent.layout.width)}
        style={styles.viewport}>
        <Animated.View
          style={[
            styles.track,
            {width: pageWidth > 0 ? pageWidth * pages.length : (`${pages.length * 100}%` as `${number}%`)},
            trackStyle,
          ]}>
          {pages.map((page, index) => {
            const widthStyle =
              pageWidth > 0
                ? {width: pageWidth}
                : {width: `${100 / pages.length}%` as `${number}%`}
            const hidden = index !== pageIndex
            return (
              <View
                key={page.id}
                testID={`profile-snapshot-page-${page.id}`}
                accessibilityElementsHidden={hidden}
                importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
                style={[styles.page, widthStyle]}>
                {page.id === 'overview' ? (
                  <GestureDetector gesture={overviewPan}>
                    <View>
                      <ProfileOverviewPageView
                        profile={profile}
                        viewer={viewer}
                        presentation={presentation}
                        ownerHandle={ownerHandle}
                        onSelectTab={onSelectTab}
                        showStats={showStats}
                      />
                    </View>
                  </GestureDetector>
                ) : null}
                {page.id === 'modules' ? (
                  <GestureDetector gesture={modulesPan}>
                    <View>
                      <ProfileModulesPreview
                        modules={modules}
                        viewer={viewer}
                        loading={catalogue.isLoading}
                        failed={Boolean(catalogue.isError)}
                        onViewAll={() => onSelectTab('modules')}
                      />
                    </View>
                  </GestureDetector>
                ) : null}
                {page.id === 'links' ? (
                  <GestureDetector gesture={linksPan}>
                    <View>
                      <ProfileLinksPreview
                        links={links}
                        viewer={viewer}
                        displayName={profile.displayName}
                        onViewAll={() => onSelectTab('links')}
                      />
                    </View>
                  </GestureDetector>
                ) : null}
              </View>
            )
          })}
        </Animated.View>
      </View>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[styles.rule, {backgroundColor: colours.separator}]}
      />
      <ProfileSnapshotNav
        pages={pages}
        selectedId={current.id}
        onSelect={goTo}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  a11yAnchor: {
    height: 1,
    overflow: 'hidden',
    width: 1,
  },
  host: {
    minWidth: 0,
    width: '100%',
    zIndex: 2,
  },
  page: {
    minWidth: 0,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 2,
    opacity: 0.7,
    width: '100%',
  },
  track: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  viewport: {
    overflow: 'hidden',
    width: '100%',
  },
})
