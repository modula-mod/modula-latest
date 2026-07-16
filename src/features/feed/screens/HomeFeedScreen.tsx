import {useMemo, useState} from 'react'
import {Alert, FlatList, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {DemoPostItem} from '@/components/feed/DemoPostItem'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Pill} from '@/components/primitives/Pill'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {useDemoSocial} from '@/demo/DemoSocialContext'
import {currentDemoProfile, storyProfiles} from '@/demo/demoProfiles'
import {selectionHaptic} from '@/lib/haptics'
import {AppHeader} from '@/shell/AppHeader'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {DemoPost} from '@/types/social'

type FeedMode = 'Following' | 'For You' | 'Modules'

const modeToFeed: Record<FeedMode, DemoPost['feed']> = {
  Following: 'following',
  'For You': 'forYou',
  Modules: 'modules',
}

export function HomeFeedScreen() {
  const router = useRouter()
  const {posts} = useDemoSocial()
  const {colours, spacing} = useThemeTokens()
  const [mode, setMode] = useState<FeedMode>('Following')

  const filteredPosts = useMemo(
    () => posts.filter(post => post.feed === modeToFeed[mode]),
    [mode, posts],
  )

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <AppHeader />
      <ResponsiveContent>
        <FeatureErrorBoundary label="Home feed">
          <FlatList
            data={filteredPosts}
            keyExtractor={item => item.id}
            renderItem={({item}) => <DemoPostItem post={item} />}
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
              <EmptyState
                icon="home"
                title="This feed is quiet."
                description="Switch modes or publish a local demo post to start the conversation."
                action={
                  <Pill
                    label="Create post"
                    selected
                    onPress={() => router.push('/compose' as Href)}
                  />
                }
              />
            }
            contentContainerStyle={{paddingBottom: spacing[6]}}
          />
        </FeatureErrorBoundary>
      </ResponsiveContent>
    </View>
  )
}

function StoryRail() {
  const {colours, spacing} = useThemeTokens()
  const items = [
    {label: 'Your Story', profile: currentDemoProfile},
    {label: 'Gaia', profile: storyProfiles[1]},
    {label: 'Modula Team', profile: storyProfiles[2]},
    {label: 'Design', profile: storyProfiles[2]},
    {label: 'Builders', profile: storyProfiles[3]},
    {label: 'Community', profile: storyProfiles[4]},
  ]

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
          accessibilityLabel={`${item.label} preview`}
          onPress={() => Alert.alert(item.label, 'Stories are local previews in Phase 1.')}
          style={styles.storyItem}>
          <View
            style={[
              styles.storyRing,
              {borderColor: colours.accent, padding: 2},
            ]}>
            <Avatar
              name={item.profile.displayName}
              colour={item.profile.avatarColour}
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
  const {colours, radius, spacing} = useThemeTokens()

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
        name={currentDemoProfile.displayName}
        colour={currentDemoProfile.avatarColour}
        size={40}
      />
      <AppPressable
        accessibilityLabel="Open composer"
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
        accessibilityLabel="Open composer media"
        onPress={() => router.push('/compose' as Href)}
        style={styles.promptIcon}>
        <AppIcon name="photo" colour={colours.accent} />
      </AppPressable>
      <AppPressable
        accessibilityLabel="Open Composer Tools"
        onPress={() => router.push('/compose' as Href)}
        style={styles.promptIcon}>
        <AppIcon name="tools" colour={colours.accent} />
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
