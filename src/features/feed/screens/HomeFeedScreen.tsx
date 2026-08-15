import {useCallback, useEffect, useMemo, useState, type ReactNode} from 'react'
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  UIManager,
  View,
} from 'react-native'
import {GestureDetector} from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import {useRouter, type Href} from 'expo-router'

import {PaginationIndicator, QueryErrorState} from '@/components/data'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {useSession} from '@/auth/runtime'
import {HomeSearchModal} from '@/features/feed/components/HomeSearchModal'
import {
  HomeStickyFeedModes,
  useInlineModeTabsInteractive,
  useInlineModeTabsStyle,
} from '@/features/feed/components/HomeStickyFeedModes'
import {useHomeFeedQuery} from '@/features/feed/data'
import {PresenceStoriesRail} from '@/features/presence/components/PresenceStoriesRail'
import {useStoriesRailQuery} from '@/features/presence/data/useStoriesRailQuery'
import {
  FOCUS_PRESET_META,
  isFocusActive,
} from '@/features/product/data/focusPolicy'
import {isFeatureEnabled} from '@/features/product/data/featureControl'
import {isBlockOn} from '@/features/product/data/layoutBlocks'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {SocialPost} from '@/features/social/components/social-post'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {useNativeHeaderFadePadding, useSecondaryChromeSpacerHeight} from '@/platform/ui/navigation/chrome-insets'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {setShellChromeHoldObscure} from '@/platform/ui/navigation/shell-chrome-obscure'
import {shellTabBarCompact} from '@/platform/ui/navigation/shell-tab-bar-compact'
import {ShellChromeObscureView} from '@/platform/ui/navigation/shell-chrome-obscure-view'
import {
  PullActionTray,
  usePullActionGesture,
  type PullActionId,
} from '@/platform/ui/refresh'
import {FeedPostSkeleton} from '@/platform/ui/skeletons'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {FeedMode as RepositoryFeedMode} from '@/domain/social'

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

type FeedModeLabel = 'Following' | 'For You' | 'Modules'

const modeToFeed: Record<FeedModeLabel, RepositoryFeedMode> = {
  Following: 'following',
  'For You': 'forYou',
  Modules: 'modules',
}

export function HomeFeedScreen() {
  const router = useRouter()
  const {colours, motion} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const tabPadding = useFloatingTabBarContentPadding()
  // Transparent header + nested Animated.FlatList does not reliably get UIKit
  // automatic top inset; clear the nav row explicitly, then keep the fade zone.
  const headerClearance = useSecondaryChromeSpacerHeight()
  const fadePad = useNativeHeaderFadePadding()
  const {preferences} = useProductPreferences()
  const focus = preferences.focus
  const focusPreset = focus.preset ?? 'off'
  const focusActive = isFocusActive(focus)
  const homeBlocks = preferences.homeBlockIds
  const focusMeta = FOCUS_PRESET_META[focusPreset]
  const focusBannerCopy = useMemo(() => {
    const bits = [focusMeta.title]
    if (focus.quietFeed) bits.push('Quiet Feed')
    if (focus.priorityWork) bits.push('Work First')
    return bits.join(' · ')
  }, [focus.priorityWork, focus.quietFeed, focusMeta.title])

  const modeOrder = useMemo((): FeedModeLabel[] => {
    if (focus.priorityWork && focus.quietFeed) {
      return ['Modules', 'Following', 'For You']
    }
    if (focus.priorityWork) return ['Modules', 'Following', 'For You']
    if (focus.quietFeed) return ['Following', 'Modules', 'For You']
    return ['Following', 'For You', 'Modules']
  }, [focus.priorityWork, focus.quietFeed])

  const [mode, setMode] = useState<FeedModeLabel>('Following')
  const feedQuery = useHomeFeedQuery(modeToFeed[mode])
  const posts = useMemo(
    () => feedQuery.data?.pages.flatMap(page => page.items) ?? [],
    [feedQuery.data],
  )
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const refreshing = manualRefreshing

  const showModeTabs =
    isBlockOn(homeBlocks, 'mode-tabs') || !homeBlocks.includes('mode-tabs')

  const onRefresh = useCallback(() => {
    if (manualRefreshing) return
    setShellChromeHoldObscure(true)
    setManualRefreshing(true)
    void feedQuery
      .refetch()
      .catch(() => undefined)
      .finally(() => setManualRefreshing(false))
  }, [feedQuery, manualRefreshing])

  const onPullAction = useCallback(
    (action: PullActionId) => {
      if (action === 'close') {
        void selectionHaptic()
        setShellChromeHoldObscure(false)
        return
      }
      if (action === 'search') {
        void selectionHaptic()
        setShellChromeHoldObscure(true)
        setSearchOpen(true)
        return
      }
      onRefresh()
    },
    [onRefresh],
  )

  const {
    scrollY,
    pullDistance,
    swipeX,
    selectedIndex,
    armed,
    onScroll,
    listGesture,
  } = usePullActionGesture(onPullAction)
  const modeTabsStickAtY = useSharedValue(0)

  useEffect(() => {
    if (!focus.quietFeed || mode !== 'For You') return undefined
    const id = setTimeout(() => setMode('Following'), 0)
    return () => clearTimeout(id)
  }, [focus.quietFeed, mode])

  useEffect(() => {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }
  }, [mode, reduceMotion])

  useEffect(() => {
    setShellChromeHoldObscure(refreshing || searchOpen)
  }, [refreshing, searchOpen])

  useEffect(() => {
    return () => {
      setShellChromeHoldObscure(false)
      shellTabBarCompact.value = 0
    }
  }, [])

  useEffect(() => {
    if (!refreshing) return
    const id = setTimeout(() => {
      pullDistance.value = withTiming(0, {duration: motion.slow})
    }, 100)
    return () => clearTimeout(id)
  }, [motion.slow, pullDistance, refreshing])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <HomeSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
      <ResponsiveContent>
        <FeatureErrorBoundary label="Home feed">
          <View style={styles.screen}>
            <PullActionTray
              pullDistance={pullDistance}
              swipeX={swipeX}
              selectedIndex={selectedIndex}
              armed={armed}
              refreshing={refreshing}>
              <GestureDetector gesture={listGesture}>
                <Animated.FlatList
                  style={styles.screen}
                  data={posts}
                  keyExtractor={item => item.id}
                  renderItem={({item}) => <SocialPost post={item} compact />}
                  contentInsetAdjustmentBehavior="never"
                  bounces
                  alwaysBounceVertical
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  onEndReachedThreshold={0.35}
                  onEndReached={() => {
                    if (
                      feedQuery.hasNextPage &&
                      !feedQuery.isFetchingNextPage
                    ) {
                      void feedQuery.fetchNextPage()
                    }
                  }}
                  ListHeaderComponent={
                    <HomeLayoutHeader
                      homeBlocks={homeBlocks}
                      focusActive={focusActive}
                      focusBannerCopy={focusBannerCopy}
                      focus={focus}
                      mode={mode}
                      modeOrder={modeOrder}
                      mergeCount={preferences.mergeFeedIds.length}
                      focusFeatureOn={isFeatureEnabled(preferences, 'focus')}
                      mergeFeatureOn={isFeatureEnabled(preferences, 'merge')}
                      onModeChange={setMode}
                      scrollY={scrollY}
                      modeTabsStickAtY={modeTabsStickAtY}
                      reduceMotion={reduceMotion}
                    />
                  }
                  ListEmptyComponent={
                    feedQuery.isLoading ? (
                      <View>
                        <FeedPostSkeleton />
                        <FeedPostSkeleton />
                        <FeedPostSkeleton />
                      </View>
                    ) : feedQuery.isError ? (
                      <QueryErrorState
                        error={feedQuery.error}
                        onRetry={() => void feedQuery.refetch()}
                      />
                    ) : (
                      <EmptyState
                        icon="home"
                        title="This feed is quiet."
                        description="Switch modes or publish a local post to start the conversation."
                        action={
                          <ModulaButton
                            label="Create post"
                            accessibilityLabel="Create a post"
                            onPress={() => router.push('/compose' as Href)}
                          />
                        }
                      />
                    )
                  }
                  ListFooterComponent={
                    feedQuery.isFetchingNextPage ? (
                      <PaginationIndicator label="Loading more" />
                    ) : null
                  }
                  contentContainerStyle={{
                    paddingTop: headerClearance + fadePad,
                    paddingBottom: tabPadding,
                  }}
                />
              </GestureDetector>
            </PullActionTray>
            {showModeTabs ? (
              <HomeStickyFeedModes
                scrollY={scrollY}
                stickAtY={modeTabsStickAtY}
                mode={mode}
                modeOrder={modeOrder}
                quietFeed={!!focus.quietFeed}
                onModeChange={setMode}
              />
            ) : null}
          </View>
        </FeatureErrorBoundary>
      </ResponsiveContent>
    </View>
  )
}

function HomeLayoutHeader({
  homeBlocks,
  focusActive,
  focusBannerCopy,
  focus,
  mode,
  modeOrder,
  mergeCount,
  focusFeatureOn,
  mergeFeatureOn,
  onModeChange,
  scrollY,
  modeTabsStickAtY,
  reduceMotion,
}: {
  homeBlocks: string[]
  focusActive: boolean
  focusBannerCopy: string
  focus: ReturnType<typeof useProductPreferences>['preferences']['focus']
  mode: FeedModeLabel
  modeOrder: FeedModeLabel[]
  mergeCount: number
  focusFeatureOn: boolean
  mergeFeatureOn: boolean
  onModeChange: (mode: FeedModeLabel) => void
  scrollY: SharedValue<number>
  modeTabsStickAtY: SharedValue<number>
  reduceMotion: boolean
}) {
  const router = useRouter()
  const {colours, radius, spacing, motion} = useThemeTokens()
  const session = useSession()
  const storiesRail = useStoriesRailQuery()
  const storiesPeople =
    storiesRail.data && storiesRail.data.length > 0
      ? storiesRail.data
      : session.status === 'signedIn'
        ? [
            {
              id: 'you',
              name: 'You',
              fresh: false,
              groupId: `add:${session.account.id}`,
              ringState: 'owner' as const,
              isOwner: true,
              itemCount: 0,
            },
          ]
        : []
  const showBlock = (id: string) => isBlockOn(homeBlocks, id)
  const inlineModeStyle = useInlineModeTabsStyle(
    scrollY,
    modeTabsStickAtY,
    reduceMotion,
    motion.springs.selection,
  )
  const modeTabsInteractive = useInlineModeTabsInteractive(
    scrollY,
    modeTabsStickAtY,
  )

  const nodes: Record<string, ReactNode> = {
    presence:
      !focus.hideNav &&
      (showBlock('presence') || session.status === 'signedIn') &&
      storiesPeople.length > 0 ? (
        <ShellChromeObscureView key="presence" direction="up">
          <SectionEnter>
            <View
              style={{
                paddingTop: spacing[2],
                paddingBottom: spacing[1],
              }}>
              <PresenceStoriesRail
                people={storiesPeople}
                compact
                showCaption={false}
              />
            </View>
          </SectionEnter>
        </ShellChromeObscureView>
      ) : null,
    'focus-banner':
      focusActive && focusFeatureOn && showBlock('focus-banner') ? (
        <AppPressable
          key="focus-banner"
          accessibilityLabel="Open Focus Mode"
          onPress={() => router.push('/product/focus' as Href)}
          style={[
            styles.focusBanner,
            {
              backgroundColor: colours.accentSubtle,
              borderColor: colours.accentBorder,
              borderRadius: radius.medium,
              marginHorizontal: spacing[4],
              marginBottom: spacing[2],
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              gap: spacing[2],
            },
          ]}>
          <AppIcon name="contrast" colour={colours.accent} size={16} />
          <View style={[styles.focusCopy, {gap: spacing[1]}]}>
            <AppText variant="label" colour="accent">
              Focus
            </AppText>
            <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
              {focusBannerCopy}
            </AppText>
          </View>
          <AppIcon name="chevronRight" colour={colours.accent} size={14} />
        </AppPressable>
      ) : null,
    'merge-banner':
      mergeCount >= 2 && mergeFeatureOn && showBlock('merge-banner') ? (
        <ShellChromeObscureView key="merge-banner" direction="up">
          <AppPressable
            accessibilityLabel="Open Merge Feeds"
            onPress={() => router.push('/product/merge-feeds' as Href)}
            style={[
              styles.focusBanner,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.medium,
                marginHorizontal: spacing[4],
                marginBottom: spacing[2],
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                gap: spacing[2],
              },
            ]}>
            <AppIcon name="discover" colour={colours.accent} size={16} />
            <AppText variant="caption" colour="textSecondary" style={{flex: 1}}>
              Merge Feeds · {mergeCount} sources (local Preview)
            </AppText>
            <AppIcon
              name="chevronRight"
              colour={colours.textTertiary}
              size={14}
            />
          </AppPressable>
        </ShellChromeObscureView>
      ) : null,
    'mode-tabs':
      showBlock('mode-tabs') || !homeBlocks.includes('mode-tabs') ? (
      <ShellChromeObscureView key="mode-tabs" direction="up">
        <Animated.View
          pointerEvents={modeTabsInteractive ? 'auto' : 'none'}
          style={[
            styles.modeRow,
            {
              paddingHorizontal: spacing[4],
              paddingTop: spacing[1],
              paddingBottom: spacing[2],
            },
            inlineModeStyle,
          ]}>
          <ModulaSegmentedPicker
            appearance="segmented"
            accessibilityLabel="Feed mode"
            options={modeOrder.map(next => ({
              value: next,
              label: next,
            }))}
            value={mode}
            onValueChange={next => {
              if (
                next === 'Following' ||
                next === 'For You' ||
                next === 'Modules'
              ) {
                void selectionHaptic()
                onModeChange(next)
              }
            }}
          />
        </Animated.View>
      </ShellChromeObscureView>
      ) : null,
    composer: showBlock('composer') ? (
      <ShellChromeObscureView key="composer" direction="up">
        <ComposerPrompt />
      </ShellChromeObscureView>
    ) : null,
  }

  // Prefer Stories → modes → composer. Keep Focus/Merge banners after Stories
  // so the rail is never buried under chrome.
  const preferredOrder = [
    'presence',
    'mode-tabs',
    'composer',
  ]
  const orderedIds = preferredOrder.filter(
    id =>
      homeBlocks.includes(id) ||
      id === 'mode-tabs' ||
      (id === 'presence' && session.status === 'signedIn'),
  )
  const modeIndex = orderedIds.indexOf('mode-tabs')
  const beforeIds = modeIndex >= 0 ? orderedIds.slice(0, modeIndex) : orderedIds
  const afterIds = modeIndex >= 0 ? orderedIds.slice(modeIndex + 1) : []

  return (
    <View>
      <View
        collapsable={false}
        onLayout={event => {
          // Reanimated shared value, not React state.
          // eslint-disable-next-line react-hooks/immutability
          modeTabsStickAtY.value = event.nativeEvent.layout.height
        }}>
        {beforeIds.map(id => nodes[id] ?? null)}
      </View>
      {modeIndex >= 0 ? nodes['mode-tabs'] : null}
      {afterIds.map(id => nodes[id] ?? null)}
    </View>
  )
}

function ComposerPrompt() {
  const router = useRouter()
  const session = useSession()
  const {colours, radius, spacing} = useThemeTokens()
  const profile = session.status === 'signedIn' ? session.profile : null

  return (
    <SectionEnter delay={80}>
      <View
        style={[
          styles.prompt,
          {
            borderTopColor: colours.border,
            borderBottomColor: colours.border,
            padding: spacing[3],
            gap: spacing[2],
          },
        ]}>
        <Avatar
          name={
            profile?.displayName ??
            (session.status === 'guest' ? 'Guest' : 'Modula')
          }
          uri={profile?.avatarUri}
          colour={profile?.coverColour}
          size={36}
        />
        <AppPressable
          accessibilityLabel="Create a post"
          onPress={() => router.push('/compose' as Href)}
          style={[
            styles.promptInput,
            {
              flex: 1,
              borderRadius: radius.round,
              paddingHorizontal: spacing[4],
              backgroundColor: colours.surfaceRaised,
              borderColor: colours.border,
              borderWidth: StyleSheet.hairlineWidth,
              minHeight: 44,
              justifyContent: 'center',
            },
          ]}>
          <AppText variant="body" colour="textSecondary">
            What are you building?
          </AppText>
        </AppPressable>
        <ModulaIconButton
          icon="photo"
          accessibilityLabel="Add media to a post"
          onPress={() => router.push('/compose' as Href)}
          chrome="plain"
          colour={colours.textSecondary}
        />
      </View>
    </SectionEnter>
  )
}

const styles = StyleSheet.create({
  focusBanner: {
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  focusCopy: {
    flex: 1,
    minWidth: 0,
  },
  modeRow: {
    alignSelf: 'stretch',
    width: '100%',
  },
  prompt: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  promptGlass: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: 'hidden',
  },
  promptInput: {
    justifyContent: 'center',
    minHeight: 44,
  },
  screen: {
    flex: 1,
  },
})
