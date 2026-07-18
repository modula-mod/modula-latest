import {useEffect, useMemo, useState} from 'react'
import {
  FlatList,
  LayoutAnimation,
  Platform,
  RefreshControl,
  StyleSheet,
  UIManager,
  View,
} from 'react-native'
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
import {useHomeFeedQuery} from '@/features/feed/data'
import {PresenceArc} from '@/features/onboarding/components/PresenceArc'
import {
  FOCUS_PRESET_META,
  isFocusActive,
} from '@/features/product/data/focusPolicy'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {SocialPost} from '@/features/social/components/social-post'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
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

const PRESENCE_ROUTES: Record<string, Href> = {
  focus: '/product/focus',
  board: '/board',
  you: '/profile/os',
  modules: '/modules',
  team: '/teams',
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
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={({item}) => <SocialPost post={item} />}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={
              <RefreshControl
                refreshing={feedQuery.isRefetching && !feedQuery.isFetchingNextPage}
                tintColor={colours.accent}
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
                {!focus.hideNav ? (
                  <View style={{paddingVertical: spacing[3]}}>
                    <PresenceArc
                      centreLabel={focus.showHalo ? 'Focused' : 'Available'}
                      onCentrePress={() => router.push('/product/focus' as Href)}
                      onItemPress={id => {
                        void selectionHaptic()
                        const route = PRESENCE_ROUTES[id]
                        if (route) router.push(route)
                      }}
                      items={[
                        {
                          id: 'focus',
                          label: 'Focus',
                          icon: 'contrast',
                          unread: focusActive,
                        },
                        {
                          id: 'board',
                          label: 'Board',
                          icon: 'board',
                          unread: focus.priorityWork,
                        },
                        {
                          id: 'you',
                          label: 'You',
                          icon: 'profile',
                          unread: focus.showHalo,
                        },
                        {
                          id: 'modules',
                          label: 'Modules',
                          icon: 'modules',
                          unread: !focus.quietFeed,
                        },
                        {
                          id: 'team',
                          label: 'Team',
                          icon: 'teams',
                        },
                      ]}
                    />
                  </View>
                ) : null}

                {focusActive ? (
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

                {preferences.mergeFeedIds.length >= 2 ? (
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
                <ComposerPrompt />
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
      <AppPressable
        accessibilityLabel="Create a post"
        onPress={() => router.push('/compose' as Href)}
        style={[
          styles.promptInput,
          {
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.border,
            borderRadius: radius.round,
            paddingHorizontal: spacing[4],
          },
        ]}>
        <AppText variant="body" colour="textSecondary">
          What are you building?
        </AppText>
      </AppPressable>
      <AppPressable
        accessibilityLabel="Add media to a post"
        onPress={() => router.push('/compose' as Href)}
        style={styles.promptIcon}>
        <AppIcon name="photo" colour={colours.textSecondary} />
      </AppPressable>
    </View>
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
  promptIcon: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  promptInput: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  screen: {
    flex: 1,
  },
})
