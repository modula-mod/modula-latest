import {useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {useSession} from '@/auth/runtime'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {
  matchesSettingsQuery,
  SettingsLinkRow,
  SettingsOverflowMenu,
  SettingsSection,
  type SettingsNavRow,
} from '@/features/settings/components/SettingsRows'
import {PRODUCT_LAB_LINKS} from '@/features/product/data/productLabLinks'
import {canAccessDeveloperLabs} from '@/lib/platform'
import {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
import {ModulaIcon} from '@/platform/ui/icons'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {textScaleLabel} from '@/theme/accessibility/adaptivePreference'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const profileRows: SettingsNavRow[] = [
  {
    title: 'My Profile',
    icon: 'profile',
    iconDomain: 'profile',
    route: '/profile/edit',
    keywords: ['identity', 'bio', 'avatar', 'name'],
  },
  {
    title: 'Account',
    icon: 'account',
    iconDomain: 'account',
    route: '/settings/account',
    keywords: ['handle', 'email', 'password', 'sessions', 'export', 'sign out'],
  },
  {
    title: 'Identity',
    icon: 'verified',
    iconDomain: 'profile',
    route: '/settings/account/handle',
    keywords: ['handle', 'username'],
  },
]

const personalisationRows: SettingsNavRow[] = [
  {
    title: 'Appearance',
    icon: 'appearance',
    iconDomain: 'appearance',
    route: '/settings/appearance',
    keywords: ['theme', 'dark', 'oled', 'accent', 'surface', 'glass'],
  },
  {
    title: 'Accessibility',
    icon: 'accessibility',
    iconDomain: 'accessibility',
    route: '/settings/accessibility',
    keywords: ['voiceover', 'motion', 'contrast', 'text size', 'bold', 'display'],
  },
  {
    title: 'Language',
    icon: 'community',
    iconDomain: 'language',
    route: '/settings/language',
    keywords: ['translate', 'locale'],
  },
]

const moduleRows: SettingsNavRow[] = [
  {
    title: 'Product Hub',
    icon: 'modules',
    iconDomain: 'modules',
    route: '/product',
    keywords: ['marketplace', 'catalogue', 'install'],
  },
  {
    title: 'Installed',
    icon: 'modules',
    iconDomain: 'modules',
    route: '/settings/modules',
    keywords: ['installed', 'products', 'extensions', 'updates'],
  },
]

const privacyRows: SettingsNavRow[] = [
  {
    title: 'Notifications',
    icon: 'notifications',
    iconDomain: 'notifications',
    route: '/settings/notifications',
    keywords: ['alerts', 'activity', 'push', 'likes', 'replies'],
  },
  {
    title: 'Privacy & Security',
    icon: 'privacy',
    iconDomain: 'privacy',
    route: '/settings/privacy',
    keywords: ['mute', 'block', 'audience', 'private'],
  },
]

const platformRows: SettingsNavRow[] = [
  {
    title: 'Data & Storage',
    icon: 'storage',
    iconDomain: 'data',
    route: '/settings/data',
    keywords: ['cache', 'saved', 'export', 'media'],
  },
  {
    title: 'Connections',
    icon: 'integrations',
    iconDomain: 'connections',
    route: '/settings/connections',
    keywords: ['atproto', 'bridge', 'services'],
  },
  {
    title: 'Content & Media',
    icon: 'photo',
    iconDomain: 'content',
    route: '/settings/content',
    keywords: ['autoplay', 'data saver', 'reactions'],
  },
]

const aboutRows: SettingsNavRow[] = [
  {
    title: 'About',
    icon: 'info',
    iconDomain: 'info',
    route: '/settings/about',
    keywords: ['version', 'what’s new', 'whats new'],
  },
  {
    title: 'Help',
    icon: 'info',
    iconDomain: 'info',
    route: '/settings/help',
    keywords: ['support'],
  },
]

const developerRows: SettingsNavRow[] = [
  {
    title: 'Product Hub',
    icon: 'modules',
    iconDomain: 'modules',
    route: '/product',
    keywords: ['marketplace', 'catalogue'],
  },
  {
    title: 'Extension Centre',
    icon: 'modules',
    iconDomain: 'modules',
    route: '/settings/extensions',
  },
  {
    title: 'Feature Control',
    icon: 'settings',
    iconDomain: 'developer',
    route: '/product/feature-control',
    preview: true,
  },
  {
    title: 'DIMON',
    icon: 'security',
    iconDomain: 'developer',
    route: '/settings/dimon',
  },
  {
    title: 'Account switcher',
    icon: 'switch',
    iconDomain: 'developer',
    route: '/account/switcher',
    preview: true,
  },
  ...PRODUCT_LAB_LINKS.map(link => ({
    title: link.label,
    description: link.description,
    icon: link.icon as SettingsNavRow['icon'],
    route: link.route,
    iconDomain: 'developer' as const,
  })),
  {
    title: 'Expo UI Lab',
    icon: 'developer',
    iconDomain: 'developer',
    route: '/settings/developer/expo-ui',
  },
  {
    title: 'Developer',
    icon: 'developer',
    iconDomain: 'developer',
    route: '/settings/developer',
    keywords: ['labs', 'runtime', 'session', 'diagnostics'],
  },
]

function labelMode(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())
}

export function SettingsHomeScreen() {
  const {preferences} = useAppearance()
  const {colours, controls, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const [query, setQuery] = useState('')
  const router = useRouter()
  const session = useSession()
  const profile = session.status === 'signedIn' ? session.profile : null

  const appearanceValue = `${labelMode(preferences.mode)}`
  const accessibilityValue = textScaleLabel(preferences.textScalePreference)
  const languageValue = 'English'

  const withValues = (rows: SettingsNavRow[]): SettingsNavRow[] =>
    rows.map(row => {
      if (row.title === 'Appearance') return {...row, value: appearanceValue}
      if (row.title === 'Accessibility') return {...row, value: accessibilityValue}
      if (row.title === 'Language') return {...row, value: languageValue}
      return row
    })

  const filter = (rows: SettingsNavRow[]) =>
    withValues(rows).filter(row => matchesSettingsQuery(row, query))

  const groups: {title: string; rows: SettingsNavRow[]; footer?: string}[] = [
    {title: 'Profile & Account', rows: filter(profileRows)},
    {title: 'Modules', rows: filter(moduleRows)},
    {title: 'Personalisation', rows: filter(personalisationRows)},
    {title: 'Privacy & Communication', rows: filter(privacyRows)},
    {title: 'Platform', rows: filter(platformRows)},
    {title: 'About', rows: filter(aboutRows)},
  ]

  if (canAccessDeveloperLabs()) {
    groups.push({
      title: 'Developer',
      rows: filter(developerRows),
      footer: 'Diagnostics and labs. Not shown on consumer Settings.',
    })
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader
        title="Settings"
        right={
          <SettingsOverflowMenu
            title="Settings"
            actions={[
              {id: 'account', label: 'Account', icon: 'account'},
              {id: 'appearance', label: 'Appearance', icon: 'appearance'},
              {id: 'accessibility', label: 'Accessibility', icon: 'accessibility'},
              {id: 'privacy', label: 'Privacy', icon: 'privacy'},
            ]}
            onAction={id => {
              if (id === 'account') router.push('/settings/account' as Href)
              if (id === 'appearance') router.push('/settings/appearance' as Href)
              if (id === 'accessibility') router.push('/settings/accessibility' as Href)
              if (id === 'privacy') router.push('/settings/privacy' as Href)
            }}
          />
        }
      />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={{
            gap: spacing[5],
            padding: spacing[4],
            paddingBottom: tabPadding + spacing[6],
          }}
          keyboardShouldPersistTaps="handled">
          <AppPressable
            accessibilityLabel={profile ? `Open profile for ${profile.displayName}` : 'Sign in to Modula'}
            onPress={() => router.push((profile ? '/profile/edit' : '/sign-in') as Href)}
            style={[
              styles.accountSummary,
              {
                backgroundColor: colours.surface,
                borderRadius: radius.medium,
                gap: spacing[3],
                minHeight: controls.listRow.minimum,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
              },
            ]}>
            <Avatar
              name={profile?.displayName ?? 'Guest'}
              uri={profile?.avatarUri}
              colour={profile?.coverColour}
              size={44}
            />
            <View style={styles.accountCopy}>
              <AppText variant="headline" numberOfLines={1}>
                {profile?.displayName ?? 'Guest profile'}
              </AppText>
              <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
                {profile?.handle ? `@${profile.handle}` : 'Sign in to sync your profile and settings'}
              </AppText>
            </View>
            <ModulaIcon name="chevronRight" size={controls.iconSize.status} colour={colours.textTertiary} />
          </AppPressable>

          <ModulaSearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search settings"
            accessibilityLabel="Search settings"
          />

          {groups.map(group =>
            group.rows.length === 0 ? null : (
              <SettingsSection
                key={group.title}
                title={group.title}
                footer={group.footer}>
                {group.rows.map((row, index) => (
                  <SettingsLinkRow
                    key={row.title}
                    row={row}
                    last={index === group.rows.length - 1}
                  />
                ))}
              </SettingsSection>
            ),
          )}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  accountCopy: {flex: 1, gap: 2, minWidth: 0},
  accountSummary: {alignItems: 'center', flexDirection: 'row'},
  screen: {
    flex: 1,
  },
})
