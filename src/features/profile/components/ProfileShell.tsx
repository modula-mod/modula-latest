import {useMemo, useState, type ReactNode} from 'react'
import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {
  canViewerSeeProfileField,
  createViewerContext,
  type ModulaProfile,
  type ProfileScreenMode,
  type ProfileViewerRelationship,
} from '@/features/profile/contracts/profile'
import {demoProfileModules} from '@/features/profile/data/demoProfileModules'
import {ProfileHero} from '@/features/profile/components/ProfileHero'
import {ProfileLayout} from '@/features/profile/components/ProfileLayout'
import {ProfileLinkCard} from '@/features/profile/components/ProfileLinkCard'
import {ProfileModuleCard} from '@/features/profile/components/ProfileModuleCard'
import {ProfileStats} from '@/features/profile/components/ProfileStats'
import {ProfileTabBar} from '@/features/profile/components/ProfileTabBar'
import {ProfileTabContent} from '@/features/profile/components/ProfileTabContent'
import {ProfileTabEmptyState} from '@/features/profile/components/ProfileTabEmptyState'
import {useOwnerProfileQuery, useProfileQuery} from '@/features/profile/data-query'
import {resolveProfileTabs, resolveSelectedProfileTab} from '@/features/profile/registry/resolveProfileTabs'
import {useProfile} from '@/features/profile/runtime/useProfile'
import {useProfileRegistry} from '@/features/profile/runtime/useProfileRegistry'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileShellProps = {
  mode: ProfileScreenMode
  handle?: string
}

function relationshipForProfile(
  mode: ProfileScreenMode,
  profile: ModulaProfile,
  ownerProfile: ModulaProfile,
): ProfileViewerRelationship {
  if (mode === 'owner') return 'owner'
  if (mode === 'preview') return 'visitor'
  if (profile.id === ownerProfile.id) return 'owner'
  if (profile.isFollowing && profile.followsViewer) return 'mutual'
  if (profile.followsViewer) return 'follower'
  if (profile.isFollowing) return 'following'
  return 'visitor'
}

export function ProfileShell({mode, handle}: ProfileShellProps) {
  const router = useRouter()
  const {tab} = useLocalSearchParams<{tab?: string}>()
  const {width} = useWindowDimensions()
  const {colours, spacing} = useThemeTokens()
  const registry = useProfileRegistry()
  const {presentation} = useProfile()
  const ownerQuery = useOwnerProfileQuery()
  const publicQuery = useProfileQuery(mode === 'public' ? handle : undefined)
  const isExpanded = width >= 1100

  const ownerProfile = ownerQuery.data ?? null
  const profile = mode === 'owner' || mode === 'preview'
    ? ownerQuery.data ?? null
    : publicQuery.data ?? null
  const loading = mode === 'public' ? publicQuery.isLoading : ownerQuery.isLoading
  const error = mode === 'public' ? publicQuery.error : ownerQuery.error
  const refetch = mode === 'public' ? publicQuery.refetch : ownerQuery.refetch

  const viewer = useMemo(() => {
    const relationship = profile && ownerProfile
      ? relationshipForProfile(mode, profile, ownerProfile)
      : 'visitor'
    return createViewerContext(mode, relationship)
  }, [mode, ownerProfile, profile])

  const visibleTabs = useMemo(() => {
    if (!profile) return []
    return resolveProfileTabs({
      manifests: registry.getAllManifests(),
      profile,
      presentation,
      viewer,
    })
  }, [presentation, profile, registry, viewer])

  const [selectedTabRequest, setSelectedTabRequest] = useState<string | null>(null)
  const selectedTabId = resolveSelectedProfileTab(
    tab ?? selectedTabRequest ?? presentation.defaultTabId,
    presentation,
    visibleTabs,
  )

  if (loading) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <ResponsiveContent>
          <InitialLoadingState label="Loading profile" />
        </ResponsiveContent>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <ResponsiveContent>
          <QueryErrorState error={error} onRetry={() => void refetch()} />
        </ResponsiveContent>
      </View>
    )
  }

  if (!profile || !ownerProfile) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <ResponsiveContent>
          <View style={[styles.notFound, {gap: spacing[4], padding: spacing[5]}]}>
            <ProfileTabEmptyState
              icon="profile"
              title="Profile not found"
              description="This profile may have moved or may not be available."
            />
            <View style={[styles.actions, {gap: spacing[2]}]}>
              <NotFoundAction label="Return home" onPress={() => router.replace('/' as Href)} />
              <NotFoundAction label="Open Discover" onPress={() => router.push('/discover' as Href)} />
            </View>
          </View>
        </ResponsiveContent>
      </View>
    )
  }

  const selectedTab = visibleTabs.find(next => next.id === selectedTabId) ?? visibleTabs[0] ?? null
  const modules = (demoProfileModules[profile.id] ?? []).filter(module =>
    canViewerSeeProfileField(module.visibility, viewer.relationship),
  )
  const links = [
    profile.website,
    ...profile.links,
  ].filter((link): link is NonNullable<typeof link> =>
    Boolean(link && canViewerSeeProfileField(link.visibility, viewer.relationship)),
  )

  const featuredLinks = links.slice(0, 2)
  const featuredModules = modules.slice(0, 2)

  const hero = (
    <ProfileHero
      profile={profile}
      viewer={viewer}
      presentation={presentation}
      ownerHandle={ownerProfile.handle}
      showStats={presentation.layoutId !== 'creator' && presentation.layoutId !== 'minimal'}
      showActions={presentation.layoutId !== 'minimal'}
      compact={presentation.layoutId === 'minimal' || isExpanded}
      onSelectTab={setSelectedTabRequest}
    />
  )

  const contextRail = (
    <View style={{gap: spacing[3]}}>
      <ContextBlock title="Featured modules">
        {featuredModules.length ? (
          featuredModules.map(module => (
            <ProfileModuleCard key={module.id} module={module} />
          ))
        ) : (
          <AppText variant="caption" colour="textSecondary">
            No public modules are featured.
          </AppText>
        )}
      </ContextBlock>
      <ContextBlock title="Featured links">
        {featuredLinks.length ? (
          featuredLinks.map(link => <ProfileLinkCard key={link.id} link={link} />)
        ) : (
          <AppText variant="caption" colour="textSecondary">
            No public links are available.
          </AppText>
        )}
      </ContextBlock>
    </View>
  )

  const main = (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.scrollContent, {paddingBottom: spacing[8]}]}>
      {mode === 'preview' ? <PreviewBar /> : null}
      {!isExpanded && presentation.layoutId !== 'minimal' ? hero : null}
      {presentation.layoutId === 'creator' && !isExpanded ? (
        <FeaturedBand title="Featured links">{featuredLinks.map(link => (
          <ProfileLinkCard key={link.id} link={link} />
        ))}</FeaturedBand>
      ) : null}
      {presentation.layoutId === 'professional' && !isExpanded ? (
        <FeaturedBand title="Featured modules">{featuredModules.map(module => (
          <ProfileModuleCard key={module.id} module={module} />
        ))}</FeaturedBand>
      ) : null}
      {presentation.layoutId === 'minimal' ? (
        <View style={[styles.minimalActions, {paddingHorizontal: spacing[4], paddingBottom: spacing[3]}]}>
          <ProfileHero
            profile={profile}
            viewer={viewer}
            presentation={presentation}
            ownerHandle={ownerProfile.handle}
            showStats={false}
            showActions
            compact
            onSelectTab={setSelectedTabRequest}
          />
        </View>
      ) : null}
      {presentation.layoutId === 'creator' ? (
        <ProfileStats
          profile={profile}
          ownerHandle={ownerProfile.handle}
          presentation={presentation}
          onSelectTab={setSelectedTabRequest}
        />
      ) : null}
      <ProfileTabBar
        tabs={visibleTabs}
        selectedTabId={selectedTabId}
        onSelectTab={setSelectedTabRequest}
      />
      <ProfileTabContent profile={profile} viewer={viewer} tab={selectedTab} />
    </ScrollView>
  )

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <ProfileLayout
        left={isExpanded ? hero : undefined}
        main={main}
        right={isExpanded ? contextRail : undefined}
      />
    </View>
  )
}

function PreviewBar() {
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  return (
    <Surface
      variant="contained"
      style={[styles.previewBar, {gap: spacing[3], padding: spacing[3]}]}>
      <AppIcon name="profile" colour={colours.accent} />
      <AppText variant="label" style={styles.previewText}>
        Viewing as visitor
      </AppText>
      <AppPressable
        accessibilityLabel="Exit preview"
        onPress={() => router.replace('/profile' as Href)}
        style={styles.previewExit}>
        <AppText variant="label" colour="accent">
          Exit preview
        </AppText>
      </AppPressable>
    </Surface>
  )
}

function ContextBlock({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[2]}}>
      <AppText variant="headline">{title}</AppText>
      {children}
    </View>
  )
}

function FeaturedBand({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const {spacing} = useThemeTokens()
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  if (Array.isArray(items) && !items.length) return null
  return (
    <View style={[styles.featuredBand, {gap: spacing[3], padding: spacing[4]}]}>
      <AppText variant="headline">{title}</AppText>
      {items}
    </View>
  )
}

function NotFoundAction({label, onPress}: {label: string; onPress: () => void}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.notFoundButton,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
          borderRadius: radius.round,
          paddingHorizontal: spacing[4],
        },
      ]}>
      <AppText variant="label">{label}</AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  featuredBand: {
    minWidth: 0,
  },
  minimalActions: {
    minWidth: 0,
  },
  notFound: {
    alignItems: 'center',
    minHeight: 420,
    justifyContent: 'center',
  },
  notFoundButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  previewBar: {
    alignItems: 'center',
    flexDirection: 'row',
    margin: 12,
  },
  previewExit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  previewText: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  scrollContent: {
    minWidth: 0,
  },
})
