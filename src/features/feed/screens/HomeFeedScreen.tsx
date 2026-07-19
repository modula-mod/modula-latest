import {useEffect, useMemo, useState} from 'react'
import {
  LayoutAnimation,
  Platform,
  RefreshControl,
  StyleSheet,
  UIManager,
  View,
} from 'react-native'
import Animated from 'react-native-reanimated'
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
import {HomeQuickActions} from '@/features/feed/components/HomeQuickActions'
import {useHomeFeedQuery} from '@/features/feed/data'
import {PresenceStoriesRail} from '@/features/presence/components/PresenceStoriesRail'
import {
  FOCUS_PRESET_META,
  isFocusActive,
} from '@/features/product/data/focusPolicy'
import {isBlockOn} from '@/features/product/data/layoutBlocks'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {SocialPost} from '@/features/social/components/social-post'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {
  ShimmerRefreshEdge,
  useScrollPullProgress,
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
  const {colours, radius, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const tabPadding = useFloatingTabBarContentPadding()
  const {preferences} = useProductPreferences()
  const focus = preferences.focus
  const focusPreset = focus.preset ?? 'off'
  const focusActive = isFocusActive(focus)
  const homeBlocks = preferences.homeBlockIds
  const showBlock = (id: string) => isBlockOn(homeBlocks, id)
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
  const {pullDistance, onScroll} = useScrollPullProgress()
  const refreshing = feedQuery.isRefetching && !feedQuery.isFetchingNextPage

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

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <ResponsiveContent>
        <FeatureErrorBoundary label="Home feed">
          <View style={styles.screen}>
            <ShimmerRefreshEdge
              pullDistance={pullDistance}
              refreshing={refreshing}
            />
            <Animated.FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={({item}) => <SocialPost post={item} />}
            contentInsetAdjustmentBehavior="automatic"
            onScroll={onScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                // Hide the stock spinner — shimmer edge is the refresh signal.
                tintColor="transparent"
                colors={['transparent']}
                progressBackgroundColor="transparent"
                onRefresh={() => {
                  if (!feedQuery.isRefetching) void feedQuery.refetch()
                }}
              />
            }
            onEndReachedThreshold={0.35}
            onEndReached={() => {
              if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
                void feedQuery.fetchNextPage()
              }
            }}
            ListHeaderComponent={
              <View>
                {!focus.hideNav && showBlock('presence') ? (
                  <SectionEnter>
                    <View style={{paddingVertical: spacing[3]}}>
                      <PresenceStoriesRail compact showCaption />
                    </View>
                  </SectionEnter>
                ) : null}

                {showBlock('quick-actions') ? (
                  <SectionEnter delay={50} from="right">
                    <HomeQuickActions />
                  </SectionEnter>
                ) : null}

                {focusActive && showBlock('focus-banner') ? (
                  <AppPressable
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
                ) : null}

                {preferences.mergeFeedIds.length >= 2 && showBlock('merge-banner') ? (
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
                      Merge Feeds · {preferences.mergeFeedIds.length} sources (local Preview)
                    </AppText>
                    <AppIcon name="chevronRight" colour={colours.textTertiary} size={14} />
                  </AppPressable>
                ) : null}

                {showBlock('mode-tabs') ? (
                  <View
                    accessibilityRole="tablist"
                    style={[
                      styles.modeRow,
                      {
                        borderBottomColor: colours.border,
                        gap: spacing[2],
                        paddingHorizontal: spacing[4],
                        paddingTop: spacing[1],
                      },
                    ]}>
                    {modeOrder.map(next => {
                      const demoted = focus.quietFeed && next === 'For You'
                      const selected = mode === next
                      return (
                        <AppPressable
                          key={next}
                          accessibilityLabel={`${next} feed${demoted ? ', quiet' : ''}`}
                          accessibilityRole="tab"
                          accessibilityState={{selected: mode === next}}
                          onPress={() => {
                            void selectionHaptic()
                            setMode(next)
                          }}
                          style={[
                            styles.modeButton,
                            {
                              backgroundColor: selected ? colours.accentSubtle : 'transparent',
                              borderColor: selected ? colours.accentBorder : 'transparent',
                              borderRadius: radius.round,
                              paddingHorizontal: spacing[3],
                            },
                            demoted ? {opacity: 0.55} : null,
                          ]}>
                          <AppText
                            variant="label"
                            style={{
                              color:
                                selected ? colours.accent : colours.textSecondary,
                            }}>
                            {next}
                            {demoted ? ' · Quiet' : ''}
                          </AppText>
                          <View
                            style={[
                              styles.modeUnderline,
                              {
                                backgroundColor:
                                  selected ? colours.accent : 'transparent',
                                borderRadius: radius.round,
                              },
                            ]}
                          />
                        </AppPressable>
                      )
                    })}
                  </View>
                ) : null}
                {showBlock('composer') ? <ComposerPrompt /> : null}
              </View>
            }
            ListEmptyComponent={
              feedQuery.isLoading ? (
                <View>
                  <FeedPostSkeleton />
                  <FeedPostSkeleton />
                  <FeedPostSkeleton />
                </View>
              ) : feedQuery.isError ? (
                <QueryErrorState error={feedQuery.error} onRetry={() => void feedQuery.refetch()} />
              ) : (
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
            }
            ListFooterComponent={
              feedQuery.isFetchingNextPage ? <PaginationIndicator label="Loading more" /> : null
            }
            contentContainerStyle={{paddingBottom: tabPadding}}
          />
          </View>
        </FeatureErrorBoundary>
      </ResponsiveContent>
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
            padding: spacing[4],
            gap: spacing[3],
          },
        ]}>
        <Avatar
          name={profile?.displayName ?? (session.status === 'guest' ? 'Guest' : 'Modula')}
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
        <LiquidGlassChrome
          interactive
          fallback="clear"
          style={[styles.promptIconGlass, {borderColor: colours.border}]}>
          <AppPressable
            accessibilityLabel="Add media to a post"
            onPress={() => router.push('/compose' as Href)}
            style={styles.promptIcon}>
            <AppIcon name="photo" colour={colours.textSecondary} />
          </AppPressable>
        </LiquidGlassChrome>
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
  modeButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 42,
  },
  modeRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingBottom: 8,
  },
  modeUnderline: {
    height: 3,
    width: 28,
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
  promptIcon: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  promptIconGlass: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
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
