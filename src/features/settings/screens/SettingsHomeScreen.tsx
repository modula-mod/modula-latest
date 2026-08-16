import {useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {
  SettingsLinkRow,
  SettingsSection,
  type SettingsNavRow,
} from '@/features/settings/components/SettingsRows'
import {PRODUCT_LAB_LINKS} from '@/features/product/data/productLabLinks'
import {canAccessDeveloperLabs} from '@/lib/platform'
import {PageIntro} from '@/platform/ui/chrome/page-intro'
import {ModulaDisclosureGroup} from '@/platform/ui/menus/modula-disclosure-group'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const accountRows: SettingsNavRow[] = [
  {
    title: 'Account',
    description: 'Modula Account, handle, sessions, and export.',
    icon: 'account',
    route: '/settings/account',
  },
  {
    title: 'Profile',
    description: 'Identity and public presentation.',
    icon: 'account',
    route: '/profile/edit',
  },
  {
    title: 'Profile presentation',
    description: 'Tabs, layout and public appearance.',
    icon: 'profile',
    route: '/profile/customize',
  },
  {
    title: 'Security',
    description: 'Sessions, credentials, recovery and account protection.',
    icon: 'security',
    route: '/settings/security',
  },
  {
    title: 'Modules',
    description: 'Installed Greenfield modules, settings, updates and data.',
    icon: 'modules',
    route: '/settings/modules',
  },
  {
    title: 'Connections',
    description: 'External services and optional bridges.',
    icon: 'integrations',
    route: '/settings/connections',
  },
  {
    title: 'Modula Mail',
    description: 'Mailbox identity and provisioner state.',
    icon: 'info',
    route: '/settings/account/mail',
  },
]

const preferenceRows: SettingsNavRow[] = [
  {
    title: 'Privacy',
    description: 'Profile visibility, post defaults, mute, block and report.',
    icon: 'privacy',
    route: '/settings/privacy',
  },
  {
    title: 'Notifications',
    description: 'Activity preference toggles.',
    icon: 'notifications',
    route: '/settings/notifications',
  },
  {
    title: 'Appearance',
    description: 'Colour, accent, OLED, materials.',
    icon: 'appearance',
    route: '/settings/appearance',
  },
  {
    title: 'Accessibility',
    description: 'Text, contrast, transparency, motion.',
    icon: 'accessibility',
    route: '/settings/accessibility',
  },
  {
    title: 'Content & Media',
    description: 'Autoplay, data saver, reactions.',
    icon: 'photo',
    route: '/settings/content',
  },
  {
    title: 'Language & Translate',
    description: 'Translate Preview preferences.',
    icon: 'text',
    route: '/settings/language',
  },
  {
    title: 'Marketplace',
    description: 'Browse preferences Preview.',
    icon: 'marketplace',
    route: '/settings/marketplace',
    preview: true,
  },
  {
    title: 'Data and storage',
    description: 'Saved posts, drafts, exports and local cache.',
    icon: 'storage',
    route: '/settings/data',
  },
  {
    title: 'About',
    description: 'Version and What’s New.',
    icon: 'info',
    route: '/settings/about',
  },
]

const developerRows: SettingsNavRow[] = [
  {
    title: 'Product Hub',
    description: 'Full Modula capability map.',
    icon: 'modules',
    route: '/product',
  },
  {
    title: 'Extension Centre',
    description: 'Tools, functions, plugins, modules, and connectors.',
    icon: 'modules',
    route: '/settings/extensions',
  },
  {
    title: 'Feature Control',
    description: 'Enable, hide, and lock experimental surfaces.',
    icon: 'settings',
    route: '/product/feature-control',
    preview: true,
  },
  {
    title: 'DIMON',
    description: 'Future economic protocol; inactive.',
    icon: 'security',
    route: '/settings/dimon',
  },
  {
    title: 'Account switcher',
    description: 'Local session switcher for development builds.',
    icon: 'switch',
    route: '/account/switcher',
    preview: true,
  },
  ...PRODUCT_LAB_LINKS.map(link => ({
    title: link.label,
    description: link.description,
    icon: link.icon,
    route: link.route,
  })),
]

export function SettingsHomeScreen() {
  const {preferences, resolved} = useAppearance()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const [query, setQuery] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const appearanceValue = `${label(preferences.mode)} · ${label(preferences.surfaceType)}`
  const accessibilityValue = resolved.accessibility.reduceMotion
    ? 'Reduced motion'
    : resolved.accessibility.increaseContrast
      ? 'High contrast'
      : 'Standard'

  const q = query.trim().toLowerCase()
  const match = (row: SettingsNavRow) =>
    !q ||
    `${row.title} ${row.description ?? ''}`.toLowerCase().includes(q)

  const filteredAccount = accountRows.filter(match)
  const filteredPrefs = preferenceRows.filter(match)
  const filteredDeveloper = developerRows.filter(match)

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Settings" />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5], paddingBottom: tabPadding}]}
          keyboardShouldPersistTaps="handled">
          <PageIntro
            eyebrow="Preferences"
            icon="settings"
            body="Account, appearance, and how Modula behaves."
          />
          <View
            style={[
              styles.search,
              {
                backgroundColor: colours.surface,
                borderColor: colours.separator,
                borderRadius: radius.large,
                borderWidth: StyleSheet.hairlineWidth,
                gap: spacing[2],
                paddingHorizontal: spacing[3],
              },
            ]}>
            <AppIcon name="search" colour={colours.textTertiary} size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={colours.textTertiary}
              accessibilityLabel="Search settings"
              style={[styles.searchInput, {color: colours.text}]}
            />
          </View>

          <SettingsSection title="Account">
            {filteredAccount.map((row, index) => (
              <SettingsLinkRow
                key={row.title}
                row={row}
                last={index === filteredAccount.length - 1}
              />
            ))}
          </SettingsSection>

          <SettingsSection title="Preferences">
            {filteredPrefs.map((row, index) => (
              <SettingsLinkRow
                key={row.title}
                row={{
                  ...row,
                  value:
                    row.title === 'Appearance'
                      ? appearanceValue
                      : row.title === 'Accessibility'
                        ? accessibilityValue
                        : row.value,
                }}
                last={index === filteredPrefs.length - 1}
              />
            ))}
          </SettingsSection>

          <ModulaDisclosureGroup
            label="Advanced preferences"
            isExpanded={advancedOpen}
            onIsExpandedChange={setAdvancedOpen}
            rows={[
              'Data saver and autoplay live under Content & Media.',
              'Mute words and blocked accounts live under Privacy.',
              'Developer diagnostics are hidden unless developer labs are enabled.',
            ]}
          >
            {null}
          </ModulaDisclosureGroup>

          {canAccessDeveloperLabs() ? (
            <SettingsSection title="Development">
              {filteredDeveloper.map((row, index) => (
                <SettingsLinkRow
                  key={row.title}
                  row={row}
                  last={false}
                />
              ))}
              <SettingsLinkRow
                row={{
                  title: 'Expo UI Lab',
                  description:
                    'Pick Expo UI playground components by product context.',
                  icon: 'developer',
                  route: '/settings/developer/expo-ui',
                  value: 'Open',
                }}
              />
              <SettingsLinkRow
                row={{
                  title: 'Developer',
                  description: 'Data runtime, session, Expo UI Lab and local tools.',
                  icon: 'developer',
                  route: '/settings/developer',
                  value: 'Labs',
                }}
                last
              />
            </SettingsSection>
          ) : null}

          <AppText variant="caption" colour="textSecondary">
            Modula 0.1.0 · {runtimeEnvironment.appEnvironment}
          </AppText>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function label(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  screen: {
    flex: 1,
  },
  search: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 44,
  },
})
