import {useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {
  SettingsInfoBlock,
  SettingsLinkRow,
  SettingsSection,
  type SettingsNavRow,
} from '@/features/settings/components/SettingsRows'
import {ModulaDisclosureGroup} from '@/platform/ui/menus/modula-disclosure-group'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const accountRows: SettingsNavRow[] = [
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
    title: 'Account',
    description: 'Modula Account, handle, sessions, and export.',
    icon: 'account',
    route: '/settings/account',
  },
  {
    title: 'Connections',
    description: 'External Networks and optional bridges.',
    icon: 'integrations',
    route: '/settings/connections',
  },
  {
    title: 'Extension Centre',
    description: 'Tools, functions, plugins, modules, and connectors.',
    icon: 'modules',
    route: '/settings/extensions',
  },
  {
    title: 'Product Hub',
    description: 'Full Modula capability map — Social OS catalogue.',
    icon: 'discover',
    route: '/product',
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
    description: 'Future economic protocol — not active yet.',
    icon: 'security',
    route: '/settings/dimon',
  },
  {
    title: 'Accounts',
    description: 'Switcher Preview for local sessions.',
    icon: 'switch',
    route: '/account/switcher',
    preview: true,
  },
]

const preferenceRows: SettingsNavRow[] = [
  {
    title: 'Privacy & Safety',
    description: 'Mute, block, inner circle, report.',
    icon: 'privacy',
    route: '/settings/privacy',
  },
  {
    title: 'Glass Privacy',
    description: 'Disable Sharing, Protected Chat, Vault Chat.',
    icon: 'privacy',
    route: '/product/glass-privacy',
    preview: true,
  },
  {
    title: 'Focus Mode',
    description: 'Quiet feed, priority modules, Focus Halo.',
    icon: 'contrast',
    route: '/product/focus',
    preview: true,
  },
  {
    title: 'Gaia',
    description: 'Permission-aware intelligence — planned.',
    icon: 'automation',
    route: '/product/gaia',
    preview: true,
  },
  {
    title: 'Forge',
    description: 'Module Builder pipeline — planned.',
    icon: 'developer',
    route: '/product/forge',
    preview: true,
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
    title: 'Data & storage',
    description: 'Saved, drafts, local cache notes.',
    icon: 'storage',
    route: '/settings/data',
    preview: true,
  },
]

const supportRows: SettingsNavRow[] = [
  {
    title: 'Help',
    description: 'Articles and shortcuts.',
    icon: 'info',
    route: '/settings/help',
  },
  {
    title: 'About',
    description: 'Version and What’s New.',
    icon: 'info',
    route: '/settings/about',
  },
]

export function SettingsHomeScreen() {
  const {preferences, resolved} = useAppearance()
  const {colours, radius, spacing} = useThemeTokens()
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
  const filteredSupport = supportRows.filter(match)

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Settings" />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <SettingsInfoBlock
            title="Settings"
            body="Manage the local Modula shell. Every row opens a real screen with usable controls or honest Preview content."
          />

          <View
            style={[
              styles.search,
              {
                backgroundColor: colours.surfaceMuted,
                borderRadius: radius.round,
                gap: spacing[2],
                paddingHorizontal: spacing[3],
              },
            ]}>
            <AppIcon name="search" colour={colours.textTertiary} size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search settings"
              placeholderTextColor={colours.textTertiary}
              accessibilityLabel="Search settings"
              style={[styles.searchInput, {color: colours.text}]}
            />
          </View>

          <SettingsSection title="You">
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
              'Developer diagnostics are development-only.',
            ]}
          >
            {null}
          </ModulaDisclosureGroup>

          <SettingsSection title="Support">
            {filteredSupport.map((row, index) => (
              <SettingsLinkRow
                key={row.title}
                row={row}
                last={index === filteredSupport.length - 1}
              />
            ))}
          </SettingsSection>

          {runtimeEnvironment.appEnvironment === 'development' ? (
            <SettingsSection title="Development">
              <SettingsLinkRow
                row={{
                  title: 'Developer',
                  description: 'Data runtime, session and local tools.',
                  icon: 'developer',
                  route: '/settings/developer',
                  value: 'Lab available',
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
