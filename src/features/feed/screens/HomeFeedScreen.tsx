import {useMemo, useState} from 'react'
import {FlatList, RefreshControl, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {DemoPostItem} from '@/components/feed/DemoPostItem'
import {InitialLoadingState, PaginationIndicator, QueryErrorState} from '@/components/data'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Pill} from '@/components/primitives/Pill'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {useSession} from '@/auth/runtime'
import {useDiscoverQuery} from '@/features/discover/data'
import {useHomeFeedQuery} from '@/features/feed/data'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {selectionHaptic} from '@/lib/haptics'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {FeedMode as RepositoryFeedMode} from '@/domain/social'

type FeedModeLabel = 'Following' | 'For You' | 'Modules'

const modeToFeed: Record<FeedModeLabel, RepositoryFeedMode> = {
  Following: 'following',
  'For You': 'forYou',
  Modules: 'modules',
}

export function HomeFeedScreen() {
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  const [mode, setMode] = useState<FeedModeLabel>('Following')
  const feedQuery = useHomeFeedQuery(modeToFeed[mode])
  const posts = useMemo(
    () => feedQuery.data?.pages.flatMap(page => page.items) ?? [],
    [feedQuery.data],
  )

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <ResponsiveContent>
        <FeatureErrorBoundary label="Home feed">
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={({item}) => <DemoPostItem post={item} />}
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
                <StoryRail />
                <View style={[styles.modeRow, {paddingHorizontal: spacing[4]}]}>
                  {(['Following', 'For You', 'Modules'] as const).map(next => (
                    <AppPressable
                      key={next}
                      accessibilityLabel={`${next} feed`}
                      accessibilityState={{selected: mode === next}}
                      onPress={() => {
                        void selectionHaptic()
                        setMode(next)
                      }}
                      style={styles.modeButton}>
                      <AppText
                        variant="label"
                        style={{
                          color:
                            mode === next ? colours.accent : colours.textSecondary,
                        }}>
                        {next}
                      </AppText>
                      <View
                        style={[
                          styles.modeUnderline,
                          {
                            backgroundColor:
                              mode === next ? colours.accent : 'transparent',
                          },
                        ]}
                      />
                    </AppPressable>
                  ))}
                </View>
                <ComposerPrompt />
              </View>
            }
            ListEmptyComponent={
              feedQuery.isLoading ? (
                <InitialLoadingState label="Loading feed" />
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
            contentContainerStyle={{paddingBottom: spacing[6]}}
          />
        </FeatureErrorBoundary>
      </ResponsiveContent>
    </View>
  )
}

function StoryRail() {
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  const session = useSession()
  const discover = useDiscoverQuery()
  const ownerProfileId = session.status === 'signedIn' ? session.profile.id : ''
  const items = (discover.data?.suggestedProfiles ?? []).slice(0, 6).map(profile => ({
    label: profile.id === ownerProfileId ? 'Your Story' : profile.displayName,
    profile,
  }))

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.storyRail,
        {gap: spacing[3], paddingHorizontal: spacing[4]},
      ]}>
      {items.map(item => (
        <AppPressable
          key={item.label}
          accessibilityLabel={`Open ${item.profile.displayName} profile`}
          onPress={() =>
            router.push(getProfileRouteForIdentity(item.profile, ownerProfileId))
          }
          style={styles.storyItem}>
          <View
            style={[
              styles.storyRing,
              {borderColor: colours.accent, padding: 2},
            ]}>
            <Avatar
              name={item.profile.displayName}
              uri={item.profile.avatarUri}
              colour={item.profile.coverColour}
              size={54}
            />
          </View>
          <AppText variant="caption" numberOfLines={1} style={styles.storyText}>
            {item.label}
          </AppText>
        </AppPressable>
      ))}
    </ScrollView>
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
  modeButton: {
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 22,
  },
  modeUnderline: {
    height: 2,
    width: '100%',
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
  storyItem: {
    alignItems: 'center',
    gap: 6,
    width: 76,
  },
  storyRail: {
    paddingVertical: 14,
  },
  storyRing: {
    borderRadius: 999,
    borderWidth: 2,
  },
  storyText: {
    textAlign: 'center',
    width: '100%',
  },
})
