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
import {useDiscoverQuery} from '@/features/discover/data'
import {useFollowProfileMutation} from '@/features/profile/data-query'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {seededCommunities} from '@/features/social/data/seededSurfaces'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {DiscoverResult} from '@/domain/discovery'
import type {ModulaProfile} from '@/features/profile/contracts'

type Category = 'For You' | 'People' | 'Communities' | 'Marketplace' | 'Media'

const categories: Category[] = ['For You', 'People', 'Communities', 'Marketplace', 'Media']

export function DiscoverScreen() {
  const router = useRouter()
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
            <View style={styles.titleRow}>
              <AppText variant="display">Discover</AppText>
              <ModulaMenu
                accessibilityLabel="Discover filter menu"
                title="Discover filters"
                actions={[
                  {id: 'For You', label: 'For You'},
                  {id: 'People', label: 'People'},
                  {id: 'Communities', label: 'Communities'},
                  {id: 'Marketplace', label: 'Marketplace'},
                  {id: 'Media', label: 'Media'},
                  {id: 'interests', label: 'Edit interests — Preview'},
                  {id: 'feeds', label: 'Custom feeds — Preview'},
                  {id: 'media-grid', label: 'Media grid'},
                  {id: 'open-marketplace', label: 'Open Marketplace'},
                  {id: 'open-communities', label: 'Open Communities'},
                ]}
                onAction={id => {
                  if (id === 'open-marketplace') {
                    router.push('/marketplace' as Href)
                    return
                  }
                  if (id === 'open-communities') {
                    router.push('/communities' as Href)
                    return
                  }
                  if (id === 'interests') {
                    router.push('/discover/interests' as Href)
                    return
                  }
                  if (id === 'feeds') {
                    router.push('/discover/feeds' as Href)
                    return
                  }
                  if (id === 'media-grid') {
                    router.push('/discover/media' as Href)
                    return
                  }
                  setCategory(id as Category)
                }}
                trigger={<AppIcon name="more" colour={colours.textSecondary} />}
              />
            </View>
            <AppPressable
              accessibilityLabel="Edit interests Preview"
              onPress={() => router.push('/discover/interests' as Href)}
              style={[
                styles.cta,
                {
                  backgroundColor: colours.accentSubtle,
                  borderRadius: radius.round,
                },
              ]}>
              <AppText variant="label" style={{color: colours.accent}}>
                Choose interests — Preview
              </AppText>
            </AppPressable>
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
              {(category === 'For You' || category === 'Media') && (
                <ReelsPreviewRail result={filtered} />
              )}
              {(category === 'For You' || category === 'People') && (
                <SuggestedPeople people={filtered.suggestedProfiles} />
              )}
              {(category === 'For You' || category === 'Communities') && (
                <>
                  <TrendingTopics topics={filtered.trendingTopics} />
                  <CommunitiesRail />
                </>
              )}
              {(category === 'For You' || category === 'Marketplace') && (
                <FeaturedModules modules={filtered.featuredModules} />
              )}
              {(category === 'For You' || category === 'Media') && (
                <MediaGrid result={filtered} />
              )}
              {category === 'Marketplace' ? (
                <AppPressable
                  accessibilityLabel="Browse Marketplace"
                  onPress={() => router.push('/marketplace' as Href)}
                  style={[
                    styles.cta,
                    {
                      backgroundColor: colours.accent,
                      borderRadius: radius.round,
                    },
                  ]}>
                  <AppText variant="label" style={{color: colours.accentForeground}}>
                    Browse Marketplace
                  </AppText>
                </AppPressable>
              ) : null}
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

function TrendingTopics({topics}: {topics: DiscoverResult['trendingTopics']}) {
  const router = useRouter()
  const {spacing} = useThemeTokens()
  return (
    <Section title="Trending topics">
      <View style={[styles.topicWrap, {gap: spacing[2]}]}>
        {topics.map(topic => (
          <ModulaContextMenu
            key={topic.id}
            accessibilityLabel={`${topic.label} topic actions`}
            actions={[
              {id: 'open', label: 'Open topic'},
              {id: 'pin', label: 'Pin feed — Preview'},
              {id: 'mute', label: 'Mute topic — Preview', style: 'destructive'},
            ]}
            onAction={id => {
              if (id === 'open') {
                router.push(`/communities/${topic.id}` as Href)
              }
            }}>
            <Pill
              label={`${topic.label}`}
              onPress={() => router.push(`/communities/${topic.id}` as Href)}
            />
          </ModulaContextMenu>
        ))}
      </View>
      <AppPressable
        accessibilityLabel="Manage custom feeds"
        onPress={() => router.push('/discover/feeds' as Href)}
        style={{minHeight: 44, justifyContent: 'center'}}>
        <AppText variant="label" colour="textSecondary">
          Custom feeds & pins — Preview
        </AppText>
      </AppPressable>
    </Section>
  )
}

function CommunitiesRail() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Section title="Communities">
      <View style={{gap: spacing[2]}}>
        {seededCommunities
          .filter(item => item.id.startsWith('community-'))
          .map(community => (
            <AppPressable
              key={community.id}
              accessibilityLabel={`Open ${community.name}`}
              onPress={() => router.push(`/communities/${community.id}` as Href)}
              style={[
                styles.communityRow,
                {
                  backgroundColor: colours.surfaceRaised,
                  borderColor: colours.border,
                  borderRadius: radius.large,
                  padding: spacing[3],
                  gap: spacing[3],
                },
              ]}>
              <AppIcon name="community" colour={colours.accent} />
              <View style={styles.personBody}>
                <AppText variant="label">{community.name}</AppText>
                <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
                  {community.description}
                </AppText>
              </View>
              <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
            </AppPressable>
          ))}
      </View>
    </Section>
  )
}

function FeaturedModules({modules}: {modules: DiscoverResult['featuredModules']}) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Section title="Featured modules">
      <View style={{gap: spacing[3]}}>
        {modules.slice(0, 5).map(module => (
          <AppPressable
            key={module.id}
            accessibilityLabel={`Open ${module.name} in Marketplace`}
            onPress={() => router.push(`/marketplace/${module.id}` as Href)}
            style={[styles.moduleRow, {gap: spacing[3], padding: spacing[3]}]}>
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
          </AppPressable>
        ))}
        <AppPressable
          accessibilityLabel="Open Marketplace"
          onPress={() => router.push('/marketplace' as Href)}>
          <AppText variant="label" colour="accent">
            Browse all Marketplace tools
          </AppText>
        </AppPressable>
      </View>
    </Section>
  )
}

function MediaGrid({result}: {result: DiscoverResult}) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Section title="Media grid">
      <View style={[styles.mediaGrid, {gap: spacing[2]}]}>
        {result.media.map(item => (
          <AppPressable
            key={item.id}
            accessibilityLabel={`Open media ${item.title ?? 'preview'}`}
            onPress={() => router.push('/reels' as Href)}
            style={[
              styles.mediaTile,
              {backgroundColor: item.colour ?? colours.surfaceMuted, borderRadius: radius.medium},
            ]}>
            <AppIcon name="play" colour={colours.surface} />
          </AppPressable>
        ))}
      </View>
    </Section>
  )
}

const styles = StyleSheet.create({
  communityRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
  },
  content: {
    padding: 16,
    paddingBottom: 96,
  },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
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
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topicWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
