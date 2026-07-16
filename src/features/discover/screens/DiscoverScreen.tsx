import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {Pill} from '@/components/primitives/Pill'
import {Surface} from '@/components/primitives/Surface'
import {EmptyState} from '@/components/primitives/EmptyState'
import {useDemoSocial} from '@/demo/DemoSocialContext'
import {demoModules} from '@/demo/demoModules'
import {demoProfiles} from '@/demo/demoProfiles'
import {demoReels} from '@/demo/demoReels'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {useProfile} from '@/features/profile/runtime/useProfile'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type Category = 'For You' | 'People' | 'Topics' | 'Modules' | 'Media'

const categories: Category[] = ['For You', 'People', 'Topics', 'Modules', 'Media']
const topics = ['Profile OS', 'Module SDK', 'Composer Tools', 'Board workflows', 'DIMON previews']

export function DiscoverScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('For You')
  const q = query.trim().toLowerCase()

  const people = useMemo(
    () =>
      Object.values(demoProfiles).filter(profile =>
        `${profile.displayName} ${profile.handle} ${profile.bio}`
          .toLowerCase()
          .includes(q),
      ),
    [q],
  )
  const modules = useMemo(
    () =>
      demoModules.filter(module =>
        `${module.name} ${module.description}`.toLowerCase().includes(q),
      ),
    [q],
  )
  const visibleTopics = topics.filter(topic => topic.toLowerCase().includes(q))
  const hasResults = people.length > 0 || modules.length > 0 || visibleTopics.length > 0

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

          {hasResults ? (
            <>
              <ReelsPreviewRail />
              <SuggestedPeople people={people} />
              <TrendingTopics topics={visibleTopics} />
              <FeaturedModules modules={modules} />
              <MediaGrid />
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

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3]}}>
      <AppText variant="headline">{title}</AppText>
      {children}
    </View>
  )
}

function ReelsPreviewRail() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Section title="Reels preview">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{gap: spacing[3]}}>
        {demoReels.map(reel => (
          <AppPressable
            key={reel.id}
            accessibilityLabel={`Open reel by ${reel.author.displayName}`}
            onPress={() => router.push('/reels' as Href)}
            style={[
              styles.reelCard,
              {backgroundColor: reel.colour, borderRadius: radius.large},
            ]}>
            <View
              style={[
                styles.reelScrim,
                {backgroundColor: colours.backdrop, opacity: 0.18},
              ]}
            />
            <AppText variant="label" style={{color: colours.surface}}>
              {reel.author.displayName}
            </AppText>
            <AppText
              variant="caption"
              numberOfLines={3}
              style={{color: colours.surface}}>
              {reel.caption}
            </AppText>
          </AppPressable>
        ))}
      </ScrollView>
    </Section>
  )
}

function SuggestedPeople({people}: {people: typeof demoProfiles[keyof typeof demoProfiles][]}) {
  const router = useRouter()
  const {followedProfileIds, toggleFollow} = useDemoSocial()
  const {ownerProfile} = useProfile()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Section title="Suggested people">
      <View style={{gap: spacing[3]}}>
        {people.map(profile => {
          const followed = followedProfileIds.has(profile.id)
          const profileRoute = getProfileRouteForIdentity(profile, ownerProfile.id)
          return (
            <View key={profile.id} style={styles.personRow}>
              <AppPressable
                accessibilityLabel={`Open ${profile.displayName} profile`}
                onPress={() => router.push(profileRoute)}
                style={styles.personIdentity}>
                <Avatar
                  name={profile.displayName}
                  colour={profile.avatarColour}
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
              <AppPressable
                accessibilityLabel={followed ? `Unfollow ${profile.displayName}` : `Follow ${profile.displayName}`}
                accessibilityState={{selected: followed}}
                onPress={() => toggleFollow(profile.id)}
                style={[
                  styles.followButton,
                  {
                    backgroundColor: followed ? colours.surfaceMuted : colours.accent,
                    borderRadius: radius.round,
                  },
                ]}>
                <AppText
                  variant="label"
                  style={{
                    color: followed ? colours.textSecondary : colours.accentForeground,
                  }}>
                  {followed ? 'Following' : 'Follow'}
                </AppText>
              </AppPressable>
            </View>
          )
        })}
      </View>
    </Section>
  )
}

function TrendingTopics({topics: visibleTopics}: {topics: string[]}) {
  const {spacing} = useThemeTokens()
  return (
    <Section title="Trending topics">
      <View style={[styles.topicWrap, {gap: spacing[2]}]}>
        {visibleTopics.map(topic => (
          <Pill key={topic} label={topic} />
        ))}
      </View>
    </Section>
  )
}

function FeaturedModules({modules}: {modules: typeof demoModules}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Section title="Featured modules">
      <View style={{gap: spacing[3]}}>
        {modules.slice(0, 5).map(module => (
          <Surface
            key={module.id}
            variant="contained"
            style={[styles.moduleRow, {gap: spacing[3], padding: spacing[3]}]}>
            <View
              style={[
                styles.moduleIcon,
                {backgroundColor: colours.accentSubtle, borderRadius: radius.medium},
              ]}>
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

function MediaGrid() {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Section title="Media grid">
      <View style={[styles.mediaGrid, {gap: spacing[2]}]}>
        {demoReels.concat(demoReels).map((item, index) => (
          <View
            key={`${item.id}-${index}`}
            style={[
              styles.mediaTile,
              {
                backgroundColor: item.colour,
                borderRadius: radius.medium,
              },
            ]}>
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
