import type {ReactNode} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {BlockStudioList} from '@/features/product/components/BlockStudioList'
import {
  ACTIVITY_LAYOUT_BLOCKS,
  DEFAULT_ACTIVITY_BLOCK_IDS,
  DEFAULT_DISCOVER_BLOCK_IDS,
  DEFAULT_HOME_BLOCK_IDS,
  DEFAULT_PROFILE_TAB_IDS,
  DEFAULT_TAB_BAR_IDS,
  DISCOVER_LAYOUT_BLOCKS,
  HOME_LAYOUT_BLOCKS,
  PROFILE_LAYOUT_BLOCKS,
  TAB_LAYOUT_BLOCKS,
} from '@/features/product/data/layoutBlocks'
import {presentationFromProfileTabIds} from '@/features/product/data/profileTabsSync'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {useProfile} from '@/features/profile/runtime/useProfile'
import {useProfileActions} from '@/features/profile/runtime/useProfileActions'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function StudioShell({
  title,
  eyebrow,
  body,
  children,
  footerHref,
  footerLabel,
  onResetSlot,
  resetLabel,
}: {
  title: string
  eyebrow: string
  body: string
  children: ReactNode
  footerHref?: Href
  footerLabel?: string
  onResetSlot?: () => void
  resetLabel?: string
}) {
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={title} />
      <ResponsiveContent maxWidth={720}>
        <ScrollView
          contentContainerStyle={{
            gap: spacing[5],
            padding: spacing[4],
            paddingBottom: tabPadding,
          }}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="caption" colour="accent">
              {eyebrow}
            </AppText>
            <AppText variant="display">{title}</AppText>
            <AppText variant="body" colour="textSecondary">
              {body}
            </AppText>
          </View>
          {children}
          {footerHref && footerLabel ? (
            <AppButton onPress={() => router.push(footerHref)}>{footerLabel}</AppButton>
          ) : null}
          {onResetSlot ? (
            <AppButton variant="secondary" onPress={onResetSlot}>
              {resetLabel ?? 'Reset this surface'}
            </AppButton>
          ) : null}
          <AppButton variant="secondary" onPress={() => router.push('/product/customize' as Href)}>
            Back to Customize hub
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

export function HomeLayoutStudioScreen() {
  const {preferences, update} = useProductPreferences()
  return (
    <StudioShell
      title="Home layout"
      eyebrow="LAYOUT STUDIO · LIVE"
      body="Toggle and reorder Home header blocks. Order and visibility apply immediately on the Home feed."
      footerHref={'/' as Href}
      footerLabel="Open Home"
      onResetSlot={() => void update({homeBlockIds: [...DEFAULT_HOME_BLOCK_IDS]})}
      resetLabel="Reset Home layout">
      <BlockStudioList
        catalog={HOME_LAYOUT_BLOCKS}
        selectedIds={preferences.homeBlockIds}
        onChange={homeBlockIds => void update({homeBlockIds})}
      />
    </StudioShell>
  )
}

export function DiscoverLayoutStudioScreen() {
  const {preferences, update} = useProductPreferences()
  return (
    <StudioShell
      title="Discover layout"
      eyebrow="LAYOUT STUDIO · LIVE"
      body="Choose which Discover sections appear under For You and related categories. Order is respected."
      footerHref={'/discover' as Href}
      footerLabel="Open Discover"
      onResetSlot={() => void update({discoverBlockIds: [...DEFAULT_DISCOVER_BLOCK_IDS]})}
      resetLabel="Reset Discover layout">
      <BlockStudioList
        catalog={DISCOVER_LAYOUT_BLOCKS}
        selectedIds={preferences.discoverBlockIds}
        onChange={discoverBlockIds => void update({discoverBlockIds})}
      />
    </StudioShell>
  )
}

export function TabBarLayoutStudioScreen() {
  const {preferences, update} = useProductPreferences()
  return (
    <StudioShell
      title="Tab bar"
      eyebrow="LAYOUT STUDIO · LIVE"
      body="Hide or reorder optional primary tabs. Home and Profile stay required so the shell always has an anchor."
      footerHref={'/' as Href}
      footerLabel="Return to tabs"
      onResetSlot={() => void update({tabBarIds: [...DEFAULT_TAB_BAR_IDS]})}
      resetLabel="Reset tab bar">
      <BlockStudioList
        catalog={TAB_LAYOUT_BLOCKS}
        selectedIds={preferences.tabBarIds}
        onChange={tabBarIds => void update({tabBarIds})}
      />
    </StudioShell>
  )
}

export function ActivityLayoutStudioScreen() {
  const {preferences, update} = useProductPreferences()
  return (
    <StudioShell
      title="Activity preferences"
      eyebrow="LAYOUT STUDIO · LIVE"
      body="Control digest strip, filter row chrome, unread wash, and enter motion on Activity."
      footerHref={'/activity' as Href}
      footerLabel="Open Activity"
      onResetSlot={() => void update({activityBlockIds: [...DEFAULT_ACTIVITY_BLOCK_IDS]})}
      resetLabel="Reset Activity prefs">
      <BlockStudioList
        catalog={ACTIVITY_LAYOUT_BLOCKS}
        selectedIds={preferences.activityBlockIds}
        onChange={activityBlockIds => void update({activityBlockIds})}
      />
    </StudioShell>
  )
}

export function ProfileLayoutStudioScreen() {
  const {preferences, update} = useProductPreferences()
  const {presentation} = useProfile()
  const {setProfilePresentation} = useProfileActions()
  return (
    <StudioShell
      title="Profile tabs"
      eyebrow="LAYOUT STUDIO · LIVE"
      body="Profile tab slots sync with Customize Profile presentation on this device."
      footerHref={'/profile/customize' as Href}
      footerLabel="Open Customize Profile"
      onResetSlot={() => {
        const profileTabIds = [...DEFAULT_PROFILE_TAB_IDS]
        void update({profileTabIds})
        setProfilePresentation(presentationFromProfileTabIds(profileTabIds, presentation))
      }}
      resetLabel="Reset profile tabs">
      <BlockStudioList
        catalog={PROFILE_LAYOUT_BLOCKS}
        selectedIds={preferences.profileTabIds}
        onChange={profileTabIds => {
          void update({profileTabIds})
          setProfilePresentation(presentationFromProfileTabIds(profileTabIds, presentation))
        }}
      />
    </StudioShell>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
})
