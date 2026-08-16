import {useMemo, useState, type ReactNode} from 'react'
import {Platform, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated'

import {QueryErrorState} from '@/components/data'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import type {ModuleCatalogueItem, ModuleContribution} from '@/data/repositories/contracts'
import {
  canViewerSeeProfileField,
  createViewerContext,
  type ModulaProfile,
  type ProfileScreenMode,
  type ProfileViewerRelationship,
} from '@/features/profile/contracts/profile'
import type {ProfileTabManifest, ProfileTabVisibility} from '@/features/profile/contracts/profileTabs'
import {useModuleCatalogueQuery, useModuleContributionQuery} from '@/features/modules/hooks'
import {ProfileHero} from '@/features/profile/components/ProfileHero'
import {ProfileLayout} from '@/features/profile/components/ProfileLayout'
import {ProfileLinkCard} from '@/features/profile/components/ProfileLinkCard'
import {ProfileModuleCard} from '@/features/profile/components/ProfileModuleCard'
import {ProfileStats} from '@/features/profile/components/ProfileStats'
import {ProfileTabBar} from '@/features/profile/components/ProfileTabBar'
import {ProfileTabContent} from '@/features/profile/components/ProfileTabContent'
import {ProfileTabEmptyState} from '@/features/profile/components/ProfileTabEmptyState'
import type {ProfileModulePreview} from '@/features/profile/contracts/profileModules'
import {useOwnerProfileQuery, useProfileQuery} from '@/features/profile/data-query'
import {resolveProfileTabs, resolveSelectedProfileTab} from '@/features/profile/registry/resolveProfileTabs'
import {useProfile} from '@/features/profile/runtime/useProfile'
import {useProfileRegistry} from '@/features/profile/runtime/useProfileRegistry'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ProfileHeroSkeleton} from '@/platform/ui/skeletons'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useHydrated} from '@/lib/useHydrated'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

type ProfileShellProps = {
  mode: ProfileScreenMode
  handle?: string
}

const MODULE_PROFILE_TAB_KINDS: ProfileTabManifest['supportedProfileKinds'] = [
  'person',
  'creator',
  'professional',
  'organisation',
  'team',
]

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

function moduleProfileTabManifests(contributions: ModuleContribution[]): ProfileTabManifest[] {
  return contributions
    .filter(contribution => contribution.available)
    .map((contribution, index) => {
      const manifest = contribution.manifest ?? {}
      const rawVisibility = String(manifest.visibility ?? '')
      const visibility: ProfileTabVisibility =
        rawVisibility === 'public' || rawVisibility === 'followers' || rawVisibility === 'owner'
          ? rawVisibility
          : 'owner'
      const id = String(manifest.tabId ?? manifest.id ?? contribution.id)
      const title = String(manifest.title ?? manifest.label ?? manifest.name ?? id)
      return {
        id,
        title,
        accessibilityLabel: String(manifest.accessibilityLabel ?? `${title} profile tab`),
        icon: 'modules',
        kind: 'custom',
        source: 'module',
        rendererKey: 'profile.moduleRuntime',
        defaultOrder: Number(manifest.defaultOrder ?? 80 + index),
        defaultEnabled: manifest.defaultEnabled === false ? false : true,
        visibility,
        supportedProfileKinds: MODULE_PROFILE_TAB_KINDS,
        moduleId: contribution.moduleId,
      }
    })
}

function catalogueItemToProfileModule(module: ModuleCatalogueItem): ProfileModulePreview {
  return {
    id: module.moduleId,
    name: module.name,
    description: module.description,
    icon: module.kind === 'system' ? 'settings' : 'modules',
    status: module.installationState === 'enabled' || module.installationState === 'installed'
      ? 'featured'
      : module.installable
        ? 'available'
        : 'preview',
    visibility: 'public',
    actionLabel: module.installationState === 'enabled'
      ? 'Open'
      : module.installable
        ? 'Available'
        : 'Preview',
  }
}

function profileFeaturedModules(
  profile: ModulaProfile,
  catalogue: ModuleCatalogueItem[],
  viewer: ProfileViewerRelationship,
): ProfileModulePreview[] {
  const byId = new Map(catalogue.map(module => [module.moduleId, module]))
  return profile.featuredModuleIds
    .map(moduleId => byId.get(moduleId) ?? byId.get(normalizeLegacyProfileModuleId(moduleId)))
    .filter((module): module is ModuleCatalogueItem => Boolean(module))
    .map(catalogueItemToProfileModule)
    .filter(module => canViewerSeeProfileField(module.visibility, viewer))
}

function normalizeLegacyProfileModuleId(moduleId: string): string {
  if (moduleId === 'module-vault-notes') return 'digital.modula.vault-notes'
  if (moduleId === 'module-tasks') return 'digital.modula.tasks'
  if (moduleId === 'module-dimon-core') return 'digital.dimon.core'
  return moduleId
}

export function ProfileShell({mode, handle}: ProfileShellProps) {
  const router = useRouter()
  const {tab} = useLocalSearchParams<{tab?: string}>()
  const {width} = useWindowDimensions()
  const hydrated = useHydrated()
  const {colours, spacing} = useThemeTokens()
  const insets = useSafeAreaInsets()
  const tabPadding = useFloatingTabBarContentPadding()
  const registry = useProfileRegistry()
  const {presentation} = useProfile()
  const ownerQuery = useOwnerProfileQuery()
  const publicQuery = useProfileQuery(mode === 'public' ? handle : undefined)
  const profileTabContributions = useModuleContributionQuery({
    surface: 'profileTab',
    enabledOnly: true,
  })
  const catalogueQuery = useModuleCatalogueQuery()
  const isExpanded = width >= 1100
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y
    },
  })

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
    const manifests = [
      ...registry.getAllManifests(),
      ...moduleProfileTabManifests(profileTabContributions.data ?? []),
    ]
    return resolveProfileTabs({
      manifests,
      profile,
      presentation,
      viewer,
    })
  }, [presentation, profile, profileTabContributions.data, registry, viewer])

  const [selectedTabRequest, setSelectedTabRequest] = useState<string | null>(null)
  const selectedTabId = resolveSelectedProfileTab(
    tab ?? selectedTabRequest ?? presentation.defaultTabId,
    presentation,
    visibleTabs,
  )

  if (!hydrated) {
    return <View style={[styles.screen, {backgroundColor: colours.canvas}]} />
  }

  if (loading) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <ResponsiveContent>
          <ProfileHeroSkeleton />
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
  const modules = profileFeaturedModules(profile, catalogueQuery.data ?? [], viewer.relationship)
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
      scrollY={scrollY}
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
    <Animated.ScrollView
      contentInsetAdjustmentBehavior="never"
      scrollEventThrottle={16}
      onScroll={onScroll}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingBottom:
            Platform.OS === 'ios' ? 72 + insets.bottom : tabPadding,
        },
      ]}>
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
        <View style={{paddingHorizontal: spacing[4]}}>
          <ProfileStats
            profile={profile}
            ownerHandle={ownerProfile.handle}
            presentation={presentation}
            onSelectTab={setSelectedTabRequest}
          />
        </View>
      ) : null}
      <ProfileTabBar
        tabs={visibleTabs}
        selectedTabId={selectedTabId}
        onSelectTab={setSelectedTabRequest}
      />
      <ProfileTabContent profile={profile} viewer={viewer} tab={selectedTab} />
    </Animated.ScrollView>
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
        You are viewing this profile as a visitor.
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
