import {useCallback, useEffect, useMemo, useState, type ReactNode} from 'react'
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  UIManager,
  View,
} from 'react-native'
import {GestureDetector} from 'react-native-gesture-handler'
import Animated, {useSharedValue, withTiming} from 'react-native-reanimated'
import {useRouter, type Href} from 'expo-router'

import {PaginationIndicator, QueryErrorState} from '@/components/data'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Pill} from '@/components/primitives/Pill'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {useSession} from '@/auth/runtime'
import type {SocialPost as SocialPostModel} from '@/domain/social'
import {HomeSearchModal} from '@/features/feed/components/HomeSearchModal'
import {HomeFeedModeTabs} from '@/features/feed/components/HomeStickyFeedModes'
import {useHomeFeedQuery} from '@/features/feed/data'
import {PresenceStoriesRail} from '@/features/presence/components/PresenceStoriesRail'
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
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {setShellChromeHoldObscure} from '@/platform/ui/navigation/shell-chrome-obscure'
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

type HomeListRow =
  | {key: string; kind: 'mode-tabs'}
  | {key: string; kind: 'header-tail'}
  | {key: string; kind: 'post'; post: SocialPostModel}
  | {key: string; kind: 'loading'}
  | {key: string; kind: 'error'}
  | {key: string; kind: 'empty'}

export function HomeFeedScreen() {
  const router = useRouter()
  const {colours} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const tabPadding = useFloatingTabBarContentPadding()
  const {preferences} = useProductPreferences()
  const focus = preferences.focus
  const focusPreset = focus.preset ?? 'off'
  const focusActive = isFocusActive(focus)
  const homeBlocks = preferences.homeBlockIds
  const focusMeta = FOCUS_PRESET_META[focusPreset]
  const focusBannerCopy = useMemo(() => {
    const sentences = [`${focusMeta.title} Focus is active.`]
    if (focus.quietFeed) {
      sentences.push('Quiet Feed is reducing algorithmic recommendations.')
    }
    if (focus.priorityWork) {
      sentences.push('Work First is prioritising modules and project updates.')
    }
    if (!focus.quietFeed && !focus.priorityWork) {
      sentences.push(focusMeta.summary)
    }
    return sentences.join(' ')
  }, [focus.priorityWork, focus.quietFeed, focusMeta.summary, focusMeta.title])

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
  const modeTabsIndex = homeBlocks.indexOf('mode-tabs')
  const beforeModeBlocks = useMemo(() => {
    if (!showModeTabs) return homeBlocks
    if (modeTabsIndex < 0) return homeBlocks
    return homeBlocks.slice(0, modeTabsIndex)
  }, [homeBlocks, modeTabsIndex, showModeTabs])
  const afterModeBlocks = useMemo(() => {
    if (!showModeTabs || modeTabsIndex < 0) return []
    return homeBlocks.slice(modeTabsIndex + 1)
  }, [homeBlocks, modeTabsIndex, showModeTabs])

  const onRefresh = useCallback(() => {
    if (manualRefreshing) return
    setShellChromeHoldObscure(true)
    setManualRefreshing(true)
    const started = Date.now()
    const holdMs = 3000
    void feedQuery
      .refetch()
      .catch(() => undefined)
      .finally(() => {
        const remaining = Math.max(0, holdMs - (Date.now() - started))
        setTimeout(() => setManualRefreshing(false), remaining)
      })
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

  const listData = useMemo((): HomeListRow[] => {
    const rows: HomeListRow[] = []
    if (showModeTabs) {
      rows.push({key: '__mode_tabs__', kind: 'mode-tabs'})
    }
    if (afterModeBlocks.length > 0) {
      rows.push({key: '__header_tail__', kind: 'header-tail'})
    }
    if (feedQuery.isLoading && posts.length === 0) {
      rows.push({key: '__loading__', kind: 'loading'})
    } else if (feedQuery.isError && posts.length === 0) {
      rows.push({key: '__error__', kind: 'error'})
    } else if (posts.length === 0) {
      rows.push({key: '__empty__', kind: 'empty'})
    } else {
      for (const post of posts) {
        rows.push({key: post.id, kind: 'post', post})
      }
    }
    return rows
  }, [
    afterModeBlocks.length,
    feedQuery.isError,
    feedQuery.isLoading,
    posts,
    showModeTabs,
  ])

  const stickyHeaderIndices = useMemo(
    () => (showModeTabs ? [0] : undefined),
    [showModeTabs],
  )

  useEffect(() => {
    if (focus.quietFeed && mode === 'For You') {
      setMode('Following')
    }
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
    return () => setShellChromeHoldObscure(false)
  }, [])

  useEffect(() => {
    if (!refreshing) return
    const id = setTimeout(() => {
      pullDistance.value = withTiming(0, {duration: 480})
    }, 100)
    return () => clearTimeout(id)
  }, [pullDistance, refreshing])

  const renderItem = useCallback(
    ({item}: {item: HomeListRow}) => {
      switch (item.kind) {
        case 'mode-tabs':
          return (
            <ShellChromeObscureView direction="up">
              <HomeFeedModeTabs
                scrollY={scrollY}
                stickAtY={modeTabsStickAtY}
                mode={mode}
                modeOrder={modeOrder}
                quietFeed={!!focus.quietFeed}
                onModeChange={setMode}
              />
            </ShellChromeObscureView>
          )
        case 'header-tail':
          return (
            <HomeLayoutBlocks
              blockIds={afterModeBlocks}
              homeBlocks={homeBlocks}
              focusActive={focusActive}
              focusBannerCopy={focusBannerCopy}
              focus={focus}
              mergeCount={preferences.mergeFeedIds.length}
              focusFeatureOn={isFeatureEnabled(preferences, 'focus')}
              mergeFeatureOn={isFeatureEnabled(preferences, 'merge')}
            />
          )
        case 'post':
          return <SocialPost post={item.post} />
        case 'loading':
          return (
            <View>
              <FeedPostSkeleton />
              <FeedPostSkeleton />
              <FeedPostSkeleton />
            </View>
          )
        case 'error':
          return (
            <QueryErrorState
              error={feedQuery.error}
              onRetry={() => void feedQuery.refetch()}
            />
          )
        case 'empty':
          return (
            <EmptyState
              icon="home"
              title="This feed is quiet."
              description="Switch modes or publish a local post to start the conversation."
              action={
                <Pill
                  label="Create post"
                  selected
                  onPress={() => router.push('/compose' as Href)}
                />
              }
            />
          )
        default:
          return null
      }
    },
    [
      afterModeBlocks,
      feedQuery,
      focus,
      focusActive,
      focusBannerCopy,
      homeBlocks,
      mode,
      modeOrder,
      modeTabsStickAtY,
      preferences,
      router,
      scrollY,
    ],
  )

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
                  data={listData}
                  keyExtractor={item => item.key}
                  renderItem={renderItem}
                  stickyHeaderIndices={stickyHeaderIndices}
                  contentInsetAdjustmentBehavior="automatic"
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
                    <View
                      collapsable={false}
                      onLayout={event => {
                        modeTabsStickAtY.value = event.nativeEvent.layout.height
                      }}>
                      <HomeLayoutBlocks
                        blockIds={beforeModeBlocks}
                        homeBlocks={homeBlocks}
                        focusActive={focusActive}
                        focusBannerCopy={focusBannerCopy}
                        focus={focus}
                        mergeCount={preferences.mergeFeedIds.length}
                        focusFeatureOn={isFeatureEnabled(preferences, 'focus')}
                        mergeFeatureOn={isFeatureEnabled(preferences, 'merge')}
                      />
                    </View>
                  }
                  ListFooterComponent={
                    feedQuery.isFetchingNextPage ? (
                      <PaginationIndicator label="Loading more" />
                    ) : null
                  }
                  contentContainerStyle={{paddingBottom: tabPadding}}
                />
              </GestureDetector>
            </PullActionTray>
          </View>
        </FeatureErrorBoundary>
      </ResponsiveContent>
    </View>
  )
}

function HomeLayoutBlocks({
  blockIds,
  homeBlocks,
  focusActive,
  focusBannerCopy,
  focus,
  mergeCount,
  focusFeatureOn,
  mergeFeatureOn,
}: {
  blockIds: readonly string[]
  homeBlocks: string[]
  focusActive: boolean
  focusBannerCopy: string
  focus: ReturnType<typeof useProductPreferences>['preferences']['focus']
  mergeCount: number
  focusFeatureOn: boolean
  mergeFeatureOn: boolean
}) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const showBlock = (id: string) => isBlockOn(homeBlocks, id)

  const nodes: Record<string, ReactNode> = {
    presence:
      !focus.hideNav && showBlock('presence') ? (
        <ShellChromeObscureView key="presence" direction="up">
          <SectionEnter>
            <View style={{paddingVertical: spacing[3]}}>
              <PresenceStoriesRail compact showCaption={false} />
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
              Focus mode is on
            </AppText>
            <AppText variant="caption" colour="textSecondary">
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
    composer: showBlock('composer') ? (
      <ShellChromeObscureView key="composer" direction="up">
        <ComposerPrompt />
      </ShellChromeObscureView>
    ) : null,
  }

  return <>{blockIds.map(id => nodes[id] ?? null)}</>
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
            padding: spacing[4],
            gap: spacing[3],
          },
        ]}>
        <Avatar
          name={
            profile?.displayName ??
            (session.status === 'guest' ? 'Guest' : 'Modula')
          }
          uri={profile?.avatarUri}
          colour={profile?.coverColour}
          size={40}
        />
        <LiquidGlassChrome
          interactive
          fallback="regular"
          style={[
            styles.promptGlass,
            {
              borderColor: colours.border,
              borderRadius: radius.round,
            },
          ]}>
          <AppPressable
            accessibilityLabel="Create a post"
            onPress={() => router.push('/compose' as Href)}
            style={[
              styles.promptInput,
              {
                borderRadius: radius.round,
                paddingHorizontal: spacing[4],
              },
            ]}>
            <AppText variant="body" colour="textSecondary">
              What are you building?
            </AppText>
          </AppPressable>
        </LiquidGlassChrome>
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
