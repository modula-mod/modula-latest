import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {selectionHaptic} from '@/lib/haptics'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type HubLink = {
  id: string
  label: string
  description: string
  icon: AppIconName
  href: Href
}

const STUDIOS: HubLink[] = [
  {
    id: 'home',
    label: 'Home layout',
    description: 'Presence, quick actions, composer, banners',
    icon: 'home',
    href: '/product/layout-home' as Href,
  },
  {
    id: 'discover',
    label: 'Discover layout',
    description: 'Live, Inspire, people, modules, media',
    icon: 'discover',
    href: '/product/layout-discover' as Href,
  },
  {
    id: 'tabs',
    label: 'Tab bar',
    description: 'Which primary tabs appear',
    icon: 'board',
    href: '/product/layout-tabs' as Href,
  },
  {
    id: 'activity',
    label: 'Activity preferences',
    description: 'Digest, filters, unread wash, motion',
    icon: 'activity',
    href: '/product/layout-activity' as Href,
  },
  {
    id: 'profile',
    label: 'Profile tabs',
    description: 'Tab slots Preview + Customize Profile',
    icon: 'profile',
    href: '/product/layout-profile' as Href,
  },
]

const SURFACES: HubLink[] = [
  {
    id: 'status',
    label: 'Status composer',
    description: 'Short Halo-audience status',
    icon: 'text',
    href: '/product/status-composer' as Href,
  },
  {
    id: 'saved-hub',
    label: 'Saved hub',
    description: 'Bookmarks, collections, drafts',
    icon: 'saved',
    href: '/product/saved-hub' as Href,
  },
  {
    id: 'quiet-inbox',
    label: 'Quiet inbox',
    description: 'Focus-aware notification digest',
    icon: 'notifications',
    href: '/product/quiet-inbox' as Href,
  },
  {
    id: 'inner-circle',
    label: 'Inner Circle',
    description: 'Priority people + presence',
    icon: 'people',
    href: '/product/inner-circle' as Href,
  },
  {
    id: 'share-destinations',
    label: 'Share destinations',
    description: 'People, lists, communities, modules',
    icon: 'share',
    href: '/product/share-destinations' as Href,
  },
  {
    id: 'scheduled',
    label: 'Scheduled posts',
    description: 'Composer schedule queue Preview',
    icon: 'event',
    href: '/product/scheduled-posts' as Href,
  },
  {
    id: 'reactions',
    label: 'Reactions prefs',
    description: 'Emoji / reaction gallery prefs',
    icon: 'like',
    href: '/product/reactions-prefs' as Href,
  },
  {
    id: 'agenda',
    label: 'Day agenda',
    description: 'Calendar module foreshadow',
    icon: 'event',
    href: '/product/day-agenda' as Href,
  },
  {
    id: 'automations-inbox',
    label: 'Automations inbox',
    description: 'Approvals and failed runs',
    icon: 'automation',
    href: '/product/automations-inbox' as Href,
  },
  {
    id: 'commands',
    label: 'Commands palette',
    description: 'Typed command browse Preview',
    icon: 'search',
    href: '/product/commands-palette' as Href,
  },
  {
    id: 'merge-editor',
    label: 'Merge Feeds editor',
    description: 'Richer source mix craft',
    icon: 'discover',
    href: '/product/merge-feeds' as Href,
  },
  {
    id: 'motion',
    label: 'Motion density',
    description: 'Entrance and pulse intensity',
    icon: 'motion',
    href: '/product/motion-prefs' as Href,
  },
  {
    id: 'chrome',
    label: 'Chrome density',
    description: 'Compact / comfortable / airy',
    icon: 'appearance',
    href: '/product/chrome-density' as Href,
  },
  {
    id: 'surface',
    label: 'Surface Type playground',
    description: 'Solid / glass / minimal previews',
    icon: 'palette',
    href: '/product/surface-playground' as Href,
  },
  {
    id: 'widgets',
    label: 'Board widgets',
    description: 'Existing widget studio',
    icon: 'board',
    href: '/product/widgets' as Href,
  },
  {
    id: 'feature-control',
    label: 'Feature Control',
    description: 'Enable or hide product channels',
    icon: 'switch',
    href: '/product/feature-control' as Href,
  },
]

export function CustomizationHubScreen() {
  const {colours, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const {reset, ready} = useProductPreferences()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Customize" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView
          contentContainerStyle={{
            gap: spacing[5],
            padding: spacing[4],
            paddingBottom: tabPadding,
          }}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Pick what to have</AppText>
            <AppText variant="body" colour="textSecondary">
              Layout studios control real Home, Discover, Activity, and tab chrome. Extra surfaces
              are honest Previews — toggle them on when you want them later.
            </AppText>
            <AppText variant="caption" colour="textTertiary">
              {ready ? 'Preferences loaded on this device.' : 'Loading preferences…'}
            </AppText>
          </View>

          <Section title="Layout studios" items={STUDIOS} />
          <Section title="Optional surfaces" items={SURFACES} />

          <AppButton
            variant="secondary"
            onPress={() => {
              void selectionHaptic()
              void reset()
            }}>
            Reset all customize prefs
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function Section({title, items}: {title: string; items: HubLink[]}) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3]}}>
      <AppText variant="headline">{title}</AppText>
      {items.map(item => (
        <AppPressable
          key={item.id}
          accessibilityLabel={item.label}
          onPress={() => router.push(item.href)}
          style={{borderRadius: radius.large}}>
          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.large,
                gap: spacing[3],
                padding: spacing[3],
              },
            ]}>
            <View
              style={[
                styles.icon,
                {backgroundColor: colours.accentSubtle, borderRadius: radius.medium},
              ]}>
              <AppIcon name={item.icon} colour={colours.accent} />
            </View>
            <View style={{flex: 1, gap: 2}}>
              <AppText variant="label">{item.label}</AppText>
              <AppText variant="caption" colour="textSecondary">
                {item.description}
              </AppText>
            </View>
            <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
          </Surface>
        </AppPressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  icon: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  screen: {flex: 1},
})
