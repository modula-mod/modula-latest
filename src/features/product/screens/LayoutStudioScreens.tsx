import type {ReactNode} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {BlockStudioList} from '@/features/product/components/BlockStudioList'
import {
  ACTIVITY_LAYOUT_BLOCKS,
  DISCOVER_LAYOUT_BLOCKS,
  HOME_LAYOUT_BLOCKS,
  PROFILE_LAYOUT_BLOCKS,
  TAB_LAYOUT_BLOCKS,
} from '@/features/product/data/layoutBlocks'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
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
}: {
  title: string
  eyebrow: string
  body: string
  children: ReactNode
  footerHref?: Href
  footerLabel?: string
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
      body="Toggle and reorder Home header blocks. Changes apply immediately on the Home feed."
      footerHref={'/' as Href}
      footerLabel="Open Home">
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
      body="Choose which Discover sections appear under For You and related categories."
      footerHref={'/discover' as Href}
      footerLabel="Open Discover">
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
      body="Hide optional primary tabs. Home and Profile stay required so the shell always has an anchor."
      footerHref={'/' as Href}
      footerLabel="Return to tabs">
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
      footerLabel="Open Activity">
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
  return (
    <StudioShell
      title="Profile tabs"
      eyebrow="LAYOUT STUDIO · PREVIEW"
      body="Preferred profile tab slots for this device. Signed-in Customize Profile remains the live presentation editor."
      footerHref={'/profile/customize' as Href}
      footerLabel="Open Customize Profile">
      <BlockStudioList
        catalog={PROFILE_LAYOUT_BLOCKS}
        selectedIds={preferences.profileTabIds}
        onChange={profileTabIds => void update({profileTabIds})}
      />
    </StudioShell>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
})
