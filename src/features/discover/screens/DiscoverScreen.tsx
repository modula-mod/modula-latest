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
import {InspireNextList} from '@/features/discover/components/InspireNextList'
import {LivePresenceRail} from '@/features/discover/components/LivePresenceRail'
import {useDiscoverQuery, useDiscoverSearchQuery} from '@/features/discover/data'
import {isFeatureEnabled} from '@/features/product/data/featureControl'
import {
  DEFAULT_DISCOVER_BLOCK_IDS,
  isBlockOn,
} from '@/features/product/data/layoutBlocks'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {useFollowProfileMutation} from '@/features/profile/data-query'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {StackedAvatars} from '@/platform/ui/avatars'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {useNativeHeaderFadePadding} from '@/platform/ui/navigation/chrome-insets'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {DiscoverResult} from '@/domain/discovery'
import type {DiscoverSearchResult} from '@/data/repositories/contracts'
import type {ModulaProfile} from '@/features/profile/contracts'
import type {SearchType} from '@modula/api-contracts'

type Category = 'For You' | 'People' | 'Communities' | 'Marketplace' | 'Media'

const categories: Category[] = ['For You', 'People', 'Communities', 'Marketplace', 'Media']

export function DiscoverScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const fadePad = useNativeHeaderFadePadding()
  const {preferences, update} = useProductPreferences()
  const discoverQuery = useDiscoverQuery()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('For You')
  const rawQuery = query.trim()
  const q = rawQuery.toLowerCase()
  const searchQuery = useDiscoverSearchQuery({
    q: rawQuery,
    type: searchTypeForCategory(category),
    limit: 20,
  })
  const result = discoverQuery.data
  const searchResult = useMemo(
    () => mergeSearchPages(searchQuery.data?.pages ?? []),
    [searchQuery.data?.pages],
  )
  const discoverBlocks = preferences.discoverBlockIds
  const showBlock = (id: string) => isBlockOn(discoverBlocks, id)
  const reelsFeatureOn = isFeatureEnabled(preferences, 'reels')

  const filtered = useMemo(() => {
    const local = filterDiscover(result, q)
    if (!rawQuery || !searchResult) return local
    return applySearchResult(local, searchResult)
  }, [result, q, rawQuery, searchResult])
  const hasResults =
    filtered.suggestedProfiles.length > 0 ||
    filtered.featuredModules.length > 0 ||
    filtered.trendingTopics.length > 0 ||
    filtered.media.length > 0
  const searchActive = rawQuery.length > 0
  const contentLoading = discoverQuery.isLoading || (searchActive && searchQuery.isLoading)
  const contentError = discoverQuery.isError || (searchActive && searchQuery.isError)
  const retryContent = () => {
    if (discoverQuery.isError) {
      void discoverQuery.refetch()
      return
    }
    void searchQuery.refetch()
  }

  const visibleSectionIds = useMemo(() => {
    return discoverBlocks.filter(id => {
      if (!showBlock(id)) return false
      if (id === 'live') return category === 'For You'
      if (id === 'reels') {
        return (
          reelsFeatureOn &&
          (category === 'For You' || category === 'Media') &&
          filtered.reels.length > 0
        )
      }
      if (id === 'people') {
        return (
          (category === 'For You' || category === 'People') &&
          filtered.suggestedProfiles.length > 0
        )
      }
      if (id === 'inspire') return category === 'For You'
      if (id === 'topics') {
        return (
          (category === 'For You' || category === 'Communities') &&
          filtered.trendingTopics.length > 0
        )
      }
      if (id === 'communities') {
        return category === 'For You' || category === 'Communities'
      }
      if (id === 'modules') {
        return (
          (category === 'For You' || category === 'Marketplace') &&
          filtered.featuredModules.length > 0
        )
      }
      if (id === 'media') {
        return (
          (category === 'For You' || category === 'Media') && filtered.media.length > 0
        )
      }
      return false
    })
    // showBlock closes over discoverBlocks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, discoverBlocks, filtered, reelsFeatureOn])

  const layoutEmpty = hasResults && visibleSectionIds.length === 0

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <ResponsiveContent>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.content,
            {
              gap: spacing[5],
              paddingTop: fadePad,
              paddingBottom: tabPadding,
            },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={{gap: spacing[3]}}>
            <View style={styles.titleRow}>
              <AppText variant="body" colour="textSecondary" style={{flex: 1}}>
                People, topics, modules, and media
              </AppText>
              <ChromeOverflowMenu
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
                  {id: 'inspire', label: 'Inspire next'},
                  {id: 'live', label: 'Live presence'},
                  {id: 'customize', label: 'Customize Discover layout'},
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
                  if (id === 'inspire') {
                    router.push('/discover/inspire' as Href)
                    return
                  }
                  if (id === 'live') {
                    router.push('/discover/live' as Href)
                    return
                  }
                  if (id === 'customize') {
                    router.push('/product/layout-discover' as Href)
                    return
                  }
                  if (id === 'media-grid') {
                    router.push('/discover/media' as Href)
                    return
                  }
                  setCategory(id as Category)
                }}
              />
            </View>
            <SectionEnter delay={20}>
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
            </SectionEnter>
            <SectionEnter delay={40}>
              <LiquidGlassChrome
                interactive
                fallback="regular"
                style={[
                  styles.searchGlass,
                  {borderRadius: radius.round, borderColor: colours.border},
                ]}>
                <View
                  style={[
                    styles.search,
                    {
                      borderRadius: radius.round,
                      paddingHorizontal: spacing[4],
                    },
                  ]}>
                  <AppIcon name="search" colour={colours.textSecondary} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Where next — people, topics, modules"
                    placeholderTextColor={colours.textTertiary}
                    style={[styles.searchInput, {color: colours.text}]}
                    returnKeyType="search"
                  />
                  <AppPressable
                    accessibilityLabel="Open inspire destinations"
                    onPress={() => router.push('/discover/inspire' as Href)}
                    style={[
                      styles.searchChip,
                      {
                        backgroundColor: colours.accentSubtle,
                        borderRadius: radius.round,
                      },
                    ]}>
                    <AppText variant="caption" colour="accent">
                      Inspire
                    </AppText>
                  </AppPressable>
                </View>
              </LiquidGlassChrome>
            </SectionEnter>
            <SectionEnter delay={60} from="right">
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
            </SectionEnter>
          </View>

          {contentLoading ? (
            <InitialLoadingState label="Loading discovery" />
          ) : contentError ? (
            <QueryErrorState error={discoverQuery.error ?? searchQuery.error} onRetry={retryContent} />
          ) : layoutEmpty ? (
            <EmptyState
              icon="discover"
              title="Discover layout is empty"
              description="Every Discover section is turned off for this category. Restore defaults or open the layout studio."
              action={
                <View style={{gap: spacing[2]}}>
                  <Pill
                    label="Restore Discover layout"
                    selected
                    onPress={() => void update({discoverBlockIds: [...DEFAULT_DISCOVER_BLOCK_IDS]})}
                  />
                  <Pill
                    label="Customize layout"
                    onPress={() => router.push('/product/layout-discover' as Href)}
                  />
                </View>
              }
            />
          ) : hasResults ? (
            <>
              {visibleSectionIds.map((id, index) => {
                if (id === 'live') {
                  return <LivePresenceRail key={id} />
                }
                if (id === 'reels') {
                  return (
                    <SectionEnter key={id} delay={80 + index * 24}>
                      <ReelsPreviewRail result={filtered} />
                    </SectionEnter>
                  )
                }
                if (id === 'people') {
                  return (
                    <SectionEnter key={id} delay={80 + index * 24}>
                      <SuggestedPeople people={filtered.suggestedProfiles} />
                    </SectionEnter>
                  )
                }
                if (id === 'inspire') {
                  return <InspireNextList key={id} />
                }
                if (id === 'topics') {
                  return (
                    <SectionEnter key={id} delay={80 + index * 24}>
                      <TrendingTopics topics={filtered.trendingTopics} />
                    </SectionEnter>
                  )
                }
                if (id === 'communities') {
                  return (
                    <SectionEnter key={id} delay={80 + index * 24}>
                      <CommunitiesRail topics={filtered.trendingTopics} />
                    </SectionEnter>
                  )
                }
                if (id === 'modules') {
                  return (
                    <SectionEnter key={id} delay={80 + index * 24}>
                      <FeaturedModules modules={filtered.featuredModules} />
                    </SectionEnter>
                  )
                }
                if (id === 'media') {
                  return (
                    <SectionEnter key={id} delay={80 + index * 24}>
                      <MediaGrid result={filtered} />
                    </SectionEnter>
                  )
                }
                return null
              })}
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
              {searchActive && searchQuery.hasNextPage ? (
                <AppPressable
                  accessibilityLabel="Load more search results"
                  onPress={() => {
                    if (!searchQuery.isFetchingNextPage) {
                      void searchQuery.fetchNextPage()
                    }
                  }}
                  style={[
                    styles.cta,
                    {
                      backgroundColor: colours.surfaceRaised,
                      borderRadius: radius.round,
                    },
                  ]}>
                  <AppText variant="label" colour="accent">
                    {searchQuery.isFetchingNextPage ? 'Loading more' : 'Load more results'}
                  </AppText>
                </AppPressable>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon="discover"
              title="No results"
              description="Try a different search across people, topics, modules, or media."
            />
          )}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function searchTypeForCategory(category: Category): SearchType {
  if (category === 'People') return 'profiles'
  if (category === 'Marketplace') return 'modules'
  return 'all'
}

function mergeSearchPages(pages: DiscoverSearchResult[]): DiscoverSearchResult | null {
  if (pages.length === 0) return null
  const profileMap = new Map<string, DiscoverSearchResult['profiles'][number]>()
  const postMap = new Map<string, DiscoverSearchResult['posts'][number]>()
  const moduleMap = new Map<string, DiscoverSearchResult['modules'][number]>()
  for (const page of pages) {
    for (const profile of page.profiles) profileMap.set(profile.id, profile)
    for (const post of page.posts) postMap.set(post.id, post)
    for (const module of page.modules) moduleMap.set(module.id, module)
  }
  const lastPage = pages[pages.length - 1]
  return {
    query: lastPage.query,
    profiles: Array.from(profileMap.values()),
    posts: Array.from(postMap.values()),
    modules: Array.from(moduleMap.values()),
    nextCursor: lastPage.nextCursor,
    hasMore: lastPage.hasMore,
  }
}

function applySearchResult(result: DiscoverResult, search: DiscoverSearchResult): DiscoverResult {
  return {
    ...result,
    suggestedProfiles: search.profiles,
    featuredModules: search.modules.map(module => ({
      id: module.id,
      name: module.name,
      description: module.description ?? '',
      icon: 'marketplace',
      status: 'available',
      visibility: 'public',
      actionLabel: 'Open',
    })),
  }
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
      {people.length > 1 ? (
        <StackedAvatars
          faces={people.slice(0, 5).map(profile => ({
            id: profile.id,
            name: profile.displayName,
            uri: profile.avatarUri,
            colour: profile.coverColour,
          }))}
          size={36}
          max={4}
        />
      ) : null}
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

function CommunitiesRail({topics}: {topics: DiscoverResult['trendingTopics']}) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Section title="Communities">
      <View style={{gap: spacing[2]}}>
        {topics.map(topic => (
          <AppPressable
            key={topic.id}
            accessibilityLabel={`Open ${topic.label}`}
            onPress={() => router.push(`/communities/${topic.id}` as Href)}
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
              <AppText variant="label">{topic.label}</AppText>
              <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
                {topic.postCount.toLocaleString()} indexed posts
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
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
  },
  searchChip: {
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 10,
  },
  searchGlass: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
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
