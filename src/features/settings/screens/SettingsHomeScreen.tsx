import {ScrollView, StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {
  SettingsInfoBlock,
  SettingsLinkRow,
  SettingsSection,
  type SettingsNavRow,
} from '@/features/settings/components/SettingsRows'
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
    description: 'Session and local prototype account.',
    icon: 'account',
    route: '/settings/account',
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
  const {colours, spacing} = useThemeTokens()

  const appearanceValue = `${label(preferences.mode)} · ${label(preferences.surfaceType)}`
  const accessibilityValue = resolved.accessibility.reduceMotion
    ? 'Reduced motion'
    : resolved.accessibility.increaseContrast
      ? 'High contrast'
      : 'Standard'

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

          <SettingsSection title="You">
            {accountRows.map((row, index) => (
              <SettingsLinkRow
                key={row.title}
                row={row}
                last={index === accountRows.length - 1}
              />
            ))}
          </SettingsSection>

          <SettingsSection title="Preferences">
            {preferenceRows.map((row, index) => (
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
                last={index === preferenceRows.length - 1}
              />
            ))}
          </SettingsSection>

          <SettingsSection title="Support">
            {supportRows.map((row, index) => (
              <SettingsLinkRow
                key={row.title}
                row={row}
                last={index === supportRows.length - 1}
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
})
