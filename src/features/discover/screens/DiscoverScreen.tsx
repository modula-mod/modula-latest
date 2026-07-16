import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {parseProfileId} from '@/api/contracts'
import {useCapability, useProtectedPrompt, useSession} from '@/auth/runtime'
import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Pill} from '@/components/primitives/Pill'
import {Surface} from '@/components/primitives/Surface'
import {useDiscoverQuery} from '@/features/discover/data'
import {useFollowProfileMutation} from '@/features/profile/data-query'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {DiscoverResult} from '@/domain/discovery'
import type {ModulaProfile} from '@/features/profile/contracts'

type Category = 'For You' | 'People' | 'Topics' | 'Modules' | 'Media'

const categories: Category[] = ['For You', 'People', 'Topics', 'Modules', 'Media']

export function DiscoverScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const discoverQuery = useDiscoverQuery()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('For You')
  const q = query.trim().toLowerCase()
  const result = discoverQuery.data

  const filtered = useMemo(() => filterDiscover(result, q), [result, q])
  const hasResults =
    filtered.suggestedProfiles.length > 0 ||
    filtered.featuredModules.length > 0 ||
    filtered.trendingTopics.length > 0 ||
    filtered.media.length > 0

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <View style={{gap: spacing[3]}}>
            <AppText variant="display">Discover</AppText>
            <View
              style={[
                styles.search,
                {
                  backgroundColor: colours.surfaceRaised,
                  borderColor: colours.border,
                  borderRadius: radius.round,
                  paddingHorizontal: spacing[4],
                },
              ]}>
              <AppIcon name="search" colour={colours.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search people, topics, modules"
                placeholderTextColor={colours.textTertiary}
                style={[styles.searchInput, {color: colours.text}]}
                returnKeyType="search"
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{gap: spacing[2]}}>
              {categories.map(item => (
                <Pill
                  key={item}
                  label={item}
                  selected={category === item}
                  onPress={() => setCategory(item)}
                />
              ))}
            </ScrollView>
          </View>

          {discoverQuery.isLoading ? (
            <InitialLoadingState label="Loading discovery" />
          ) : discoverQuery.isError ? (
            <QueryErrorState error={discoverQuery.error} onRetry={() => void discoverQuery.refetch()} />
          ) : hasResults ? (
            <>
              <ReelsPreviewRail result={filtered} />
              <SuggestedPeople people={filtered.suggestedProfiles} />
              <TrendingTopics topics={filtered.trendingTopics.map(topic => topic.label)} />
              <FeaturedModules modules={filtered.featuredModules} />
              <MediaGrid result={filtered} />
            </>
          ) : (
            <EmptyState
              icon="discover"
              title="No local results"
              description="Try a different search across people, topics, modules, or media previews."
            />
          )}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function filterDiscover(result: DiscoverResult | undefined, query: string): DiscoverResult {
  const empty: DiscoverResult = {
    suggestedProfiles: [],
    trendingTopics: [],
    featuredModules: [],
    media: [],
    reels: [],
  }
  if (!result) return empty
  if (!query) return result
  return {
    suggestedProfiles: result.suggestedProfiles.filter(profile =>
      `${profile.displayName} ${profile.handle} ${profile.bio}`.toLowerCase().includes(query),
    ),
    trendingTopics: result.trendingTopics.filter(topic => topic.label.toLowerCase().includes(query)),
    featuredModules: result.featuredModules.filter(module =>
      `${module.name} ${module.description}`.toLowerCase().includes(query),
    ),
    media: result.media.filter(media =>
      `${media.title ?? ''} ${media.altText ?? ''}`.toLowerCase().includes(query),
    ),
    reels: result.reels.filter(reel =>
      `${reel.caption} ${reel.source} ${reel.author.displayName}`.toLowerCase().includes(query),
    ),
  }
}

function Section({title, children}: {title: string; children: React.ReactNode}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3]}}>
      <AppText variant="headline">{title}</AppText>
      {children}
    </View>
  )
}

function ReelsPreviewRail({result}: {result: DiscoverResult}) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Section title="Reels preview">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing[3]}}>
        {result.reels.map(reel => (
          <AppPressable
            key={reel.id}
            accessibilityLabel={`Open reel by ${reel.author.displayName}`}
            onPress={() => router.push('/reels' as Href)}
            style={[styles.reelCard, {backgroundColor: reel.colour, borderRadius: radius.large}]}>
            <View style={[styles.reelScrim, {backgroundColor: colours.backdrop, opacity: 0.18}]} />
            <AppText variant="label" style={{color: colours.surface}}>
              {reel.author.displayName}
            </AppText>
            <AppText variant="caption" numberOfLines={3} style={{color: colours.surface}}>
              {reel.caption}
            </AppText>
          </AppPressable>
        ))}
      </ScrollView>
    </Section>
  )
}

function SuggestedPeople({people}: {people: ModulaProfile[]}) {
  const router = useRouter()
  const session = useSession()
  const canFollow = useCapability('social:follow')
  const prompt = useProtectedPrompt()
  const followMutation = useFollowProfileMutation()
  const {colours, radius, spacing} = useThemeTokens()
  const ownerProfileId = session.status === 'signedIn' ? session.profile.id : ''
  return (
    <Section title="Suggested people">
      <View style={{gap: spacing[3]}}>
        {people.map(profile => {
          const profileRoute = getProfileRouteForIdentity(profile, ownerProfileId)
          return (
            <View key={profile.id} style={styles.personRow}>
              <AppPressable
                accessibilityLabel={`Open ${profile.displayName} profile`}
                onPress={() => router.push(profileRoute)}
                style={styles.personIdentity}>
                <Avatar
                  name={profile.displayName}
                  uri={profile.avatarUri}
                  colour={profile.coverColour}
                  size={42}
                />
                <View style={styles.personBody}>
                  <AppText variant="label">{profile.displayName}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    @{profile.handle}
                  </AppText>
                  <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
                    {profile.bio}
                  </AppText>
                </View>
              </AppPressable>
              {profile.id !== ownerProfileId ? (
                <AppPressable
                  accessibilityLabel={profile.isFollowing ? `Unfollow ${profile.displayName}` : `Follow ${profile.displayName}`}
                  accessibilityState={{selected: profile.isFollowing}}
                  onPress={() => {
                    if (!canFollow) {
                      prompt.show()
                      return
                    }
                    followMutation.mutate({
                      profileId: parseProfileId(profile.id),
                      following: !profile.isFollowing,
                    })
                  }}
                  style={[
                    styles.followButton,
                    {
                      backgroundColor: profile.isFollowing ? colours.surfaceMuted : colours.accent,
                      borderRadius: radius.round,
                    },
                  ]}>
                  <AppText
                    variant="label"
                    style={{
                      color: profile.isFollowing ? colours.textSecondary : colours.accentForeground,
                    }}>
                    {profile.isFollowing ? 'Following' : 'Follow'}
                  </AppText>
                </AppPressable>
              ) : null}
            </View>
          )
        })}
      </View>
      <ProtectedActionPrompt
        visible={prompt.visible}
        onClose={prompt.hide}
        description="Sign in to follow profiles in this local Modula build."
      />
    </Section>
  )
}

function TrendingTopics({topics}: {topics: string[]}) {
  const {spacing} = useThemeTokens()
  return (
    <Section title="Trending topics">
      <View style={[styles.topicWrap, {gap: spacing[2]}]}>
        {topics.map(topic => <Pill key={topic} label={topic} />)}
      </View>
    </Section>
  )
}

function FeaturedModules({modules}: {modules: DiscoverResult['featuredModules']}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Section title="Featured modules">
      <View style={{gap: spacing[3]}}>
        {modules.slice(0, 5).map(module => (
          <Surface key={module.id} variant="contained" style={[styles.moduleRow, {gap: spacing[3], padding: spacing[3]}]}>
            <View style={[styles.moduleIcon, {backgroundColor: colours.accentSubtle, borderRadius: radius.medium}]}>
              <AppIcon name={module.icon} colour={colours.accent} />
            </View>
            <View style={styles.personBody}>
              <AppText variant="label">{module.name}</AppText>
              <AppText variant="caption" colour="textSecondary">
                {module.description}
              </AppText>
            </View>
            <AppText variant="caption" colour="accent">
              {module.status}
            </AppText>
          </Surface>
        ))}
      </View>
    </Section>
  )
}

function MediaGrid({result}: {result: DiscoverResult}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Section title="Media grid">
      <View style={[styles.mediaGrid, {gap: spacing[2]}]}>
        {result.media.map(item => (
          <View key={item.id} style={[styles.mediaTile, {backgroundColor: item.colour ?? colours.surfaceMuted, borderRadius: radius.medium}]}>
            <AppIcon name="play" colour={colours.surface} />
          </View>
        ))}
      </View>
    </Section>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 96,
  },
  followButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 86,
    paddingHorizontal: 12,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mediaTile: {
    alignItems: 'center',
    aspectRatio: 1,
    flexBasis: '31.5%',
    justifyContent: 'center',
  },
  moduleIcon: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  moduleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  personBody: {
    flex: 1,
    minWidth: 0,
  },
  personIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  personRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
  },
  reelCard: {
    aspectRatio: 9 / 16,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 12,
    width: 132,
  },
  reelScrim: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  screen: {
    flex: 1,
  },
  search: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 44,
  },
  topicWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
