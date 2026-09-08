import {useMemo, useState} from 'react'
import {Platform, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {parseProfileId} from '@/api/contracts'
import {useCapability, useProtectedPrompt, useSession} from '@/auth/runtime'
import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {InitialLoadingState, QueryErrorState} from '@/components/data'
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
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
import {SectionHeader} from '@/platform/ui/chrome/section-header'
import {StackedAvatars} from '@/platform/ui/avatars'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {useModulaToast} from '@/platform/ui/feedback'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
import {useNativeHeaderFadePadding, useSecondaryChromeSpacerHeight} from '@/platform/ui/navigation/chrome-insets'
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
  const headerClearance = useSecondaryChromeSpacerHeight()
  const topPadding = Platform.OS === 'web' ? headerClearance + fadePad : fadePad
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
              paddingTop: topPadding,
              paddingBottom: tabPadding,
            },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={{gap: spacing[3]}}>
            <View style={styles.titleRow}>
              <AppText variant="caption" colour="textSecondary" style={{flex: 1}}>
                People, topics, modules, and media.
              </AppText>
              <ChromeGlassControlGroup
                items={[
                  {
                    kind: 'menu',
                    icon: 'more',
                    accessibilityLabel: 'Discover filter menu',
                    title: 'Discover filters',
                    actions: [
                      {id: 'For You', label: 'For You', icon: 'sparkles'},
                      {id: 'People', label: 'People', icon: 'people'},
                      {id: 'Communities', label: 'Communities', icon: 'community'},
                      {id: 'Marketplace', label: 'Marketplace', icon: 'marketplace'},
                      {id: 'Media', label: 'Media', icon: 'photo'},
                      {
                        id: 'more',
                        label: 'More',
                        icon: 'more',
                        children: [
                          {id: 'interests', label: 'Edit interests — Preview'},
                          {id: 'feeds', label: 'Custom feeds — Preview'},
                          {id: 'inspire', label: 'Inspire next'},
                          {id: 'live', label: 'Live presence'},
                        ],
                      },
                      {id: 'customize', label: 'Customize Discover layout', icon: 'appearance'},
                      {id: 'media-grid', label: 'Media grid', icon: 'photo'},
                      {id: 'open-marketplace', label: 'Open Marketplace', icon: 'marketplace'},
                      {id: 'open-communities', label: 'Open Communities', icon: 'community'},
                    ],
                    onAction: id => {
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
                    },
                  },
                ]}
              />
            </View>
            <SectionEnter delay={20}>
              <ModulaSearchField
                value={query}
                onChangeText={setQuery}
                placeholder="Search people, topics, and modules"
                accessibilityLabel="Search people, topics, and modules"
              />
            </SectionEnter>
            <SectionEnter delay={60} from="right">
              <ModulaSegmentedPicker
                appearance="plain"
                scrollable
                segmentMinWidth={112}
                accessibilityLabel="Discover category"
                options={categories.map(item => ({value: item, label: item}))}
                value={category}
                onValueChange={next => setCategory(next as Category)}
              />
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

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: ModulaIconName
  children: React.ReactNode
}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3]}}>
      <SectionHeader title={title} icon={icon} />
      {children}
    </View>
  )
}

function ReelsPreviewRail({result}: {result: DiscoverResult}) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Section title="Reels preview" icon="play">
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
    <Section title="Suggested people" icon="people">
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
                  size={48}
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
                      backgroundColor: profile.isFollowing ? colours.surface : colours.accent,
                      borderColor: profile.isFollowing ? colours.border : 'transparent',
                      borderWidth: StyleSheet.hairlineWidth,
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
  const toast = useModulaToast()
  const {colours, spacing} = useThemeTokens()
  return (
    <Section title="Trending topics" icon="community">
      <View style={{gap: spacing[1]}}>
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
                return
              }
              if (id === 'pin') toast.show({message: 'Pinned topic feeds are not stored remotely yet.', tone: 'info'})
              if (id === 'mute') toast.show({message: 'Topic mutes are not available in the current Greenfield API.', tone: 'warning'})
            }}>
            <AppPressable
              accessibilityLabel={topic.label}
              onPress={() => router.push(`/communities/${topic.id}` as Href)}
              style={[styles.topicRow, {borderBottomColor: colours.separator}]}>
              <ModulaIcon name="community" colour={colours.text} size={18} />
              <AppText variant="label" style={styles.personBody}>
                {topic.label}
              </AppText>
              <ModulaIcon name="chevronRight" colour={colours.textTertiary} size={16} />
            </AppPressable>
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
  const {colours, spacing} = useThemeTokens()
  return (
    <Section title="Communities" icon="community">
      <View style={{gap: spacing[2]}}>
        {topics.map(topic => (
          <AppPressable
            key={topic.id}
            accessibilityLabel={`Open ${topic.label}`}
            onPress={() => router.push(`/communities/${topic.id}` as Href)}
            style={[
              styles.communityRow,
              {
                borderBottomColor: colours.separator,
                paddingVertical: spacing[3],
                gap: spacing[3],
              },
            ]}>
            <ModulaIcon name="community" colour={colours.text} />
            <View style={styles.personBody}>
              <AppText variant="label">{topic.label}</AppText>
              <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
                {topic.postCount.toLocaleString()} indexed posts
              </AppText>
            </View>
            <ModulaIcon name="chevronRight" colour={colours.textTertiary} size={18} />
          </AppPressable>
        ))}
      </View>
    </Section>
  )
}

function FeaturedModules({modules}: {modules: DiscoverResult['featuredModules']}) {
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  return (
    <Section title="Featured modules" icon="modules">
      <View style={{gap: spacing[3]}}>
        {modules.slice(0, 5).map(module => (
          <AppPressable
            key={module.id}
            accessibilityLabel={`Open ${module.name} in Marketplace`}
            onPress={() => router.push(`/marketplace/${module.id}` as Href)}
            style={[styles.moduleRow, {gap: spacing[3], paddingVertical: spacing[2]}]}>
            <ModulaIcon name={module.icon} colour={colours.text} />
            <View style={styles.personBody}>
              <AppText variant="label">{module.name}</AppText>
              <AppText variant="caption" colour="textSecondary">
                {module.description}
              </AppText>
            </View>
            <AppText variant="caption" colour="textSecondary">
              {module.status}
            </AppText>
          </AppPressable>
        ))}
        <AppPressable
          accessibilityLabel="Open Marketplace"
          onPress={() => router.push('/marketplace' as Href)}>
          <AppText variant="label">
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
    <Section title="Media grid" icon="photo">
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
            <ModulaIcon name="play" colour={colours.surface} />
          </AppPressable>
        ))}
      </View>
    </Section>
  )
}

const styles = StyleSheet.create({
  communityRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    minHeight: 36,
    minWidth: 88,
    paddingHorizontal: 16,
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
    minHeight: 52,
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
  topicRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
  },
})
