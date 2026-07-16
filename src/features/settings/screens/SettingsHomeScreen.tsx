import {Alert, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type SettingsRow = {
  title: string
  description: string
  icon: AppIconName
  value?: string
  route?: string
}

const rows: SettingsRow[] = [
  {
    title: 'Account',
    description: 'Local profile identity and account surfaces.',
    icon: 'account',
  },
  {
    title: 'Privacy',
    description: 'Audience controls and future trust boundaries.',
    icon: 'privacy',
  },
  {
    title: 'Appearance',
    description: 'Colour, accent, material, and text preferences.',
    icon: 'appearance',
    route: '/settings/appearance',
  },
  {
    title: 'Accessibility',
    description: 'Text, contrast, transparency, and motion controls.',
    icon: 'accessibility',
    route: '/settings/accessibility',
  },
  {
    title: 'Notifications',
    description: 'Future local and device notification preferences.',
    icon: 'notifications',
  },
  {
    title: 'Modules',
    description: 'Installed module behaviour and visibility.',
    icon: 'modules',
  },
  {
    title: 'Integrations',
    description: 'Connections and import surfaces.',
    icon: 'integrations',
  },
  {
    title: 'Storage',
    description: 'Local media, cache, and saved content.',
    icon: 'storage',
  },
  {
    title: 'Security',
    description: 'Device safety and future verification settings.',
    icon: 'security',
  },
  {
    title: 'Developer',
    description: 'Appearance Lab and local validation tools.',
    icon: 'developer',
    route: '/settings/appearance-lab',
  },
]

export function SettingsHomeScreen() {
  const router = useRouter()
  const {preferences, resolved} = useAppearance()
  const {colours, spacing} = useThemeTokens()

  const values: Record<string, string> = {
    Appearance: `${label(preferences.mode)} · ${label(preferences.surfaceType)}`,
    Accessibility: resolved.accessibility.reduceMotion
      ? 'Reduced motion'
      : resolved.accessibility.increaseContrast
        ? 'High contrast'
        : 'Standard',
    Developer: 'Lab available',
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Settings" />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[4]}]}
          keyboardShouldPersistTaps="handled">
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Settings</AppText>
            <AppText variant="body" colour="textSub">
              Manage the local Modula shell experience on this device.
            </AppText>
          </View>
          <MaterialSurface role="card" style={styles.list}>
            {rows.map((row, index) => (
              <SettingsListRow
                key={row.title}
                row={{...row, value: values[row.title] ?? row.value}}
                last={index === rows.length - 1}
                onPress={() => {
                  if (row.route) {
                    router.push(row.route as Href)
                    return
                  }
                  Alert.alert(row.title, `${row.description}\n\nThis preview is not functional in Phase 2.`)
                }}
              />
            ))}
          </MaterialSurface>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function SettingsListRow({
  row,
  last,
  onPress,
}: {
  row: SettingsRow
  last: boolean
  onPress: () => void
}) {
  const {colours, spacing} = useThemeTokens()

  return (
    <AppPressable
      accessibilityLabel={row.title}
      onPress={onPress}
      style={[
        styles.row,
        {
          borderBottomColor: last ? 'transparent' : colours.separator,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          gap: spacing[3],
        },
      ]}>
      <View
        style={[
          styles.iconWrap,
          {backgroundColor: colours.accentSubtle, borderColor: colours.accentBorder},
        ]}>
        <AppIcon name={row.icon} colour={colours.accent} size={20} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="headline">{row.title}</AppText>
        <AppText variant="caption" colour="textSub">
          {row.description}
        </AppText>
      </View>
      {row.value ? (
        <AppText variant="caption" colour="textMuted" numberOfLines={1}>
          {row.value}
        </AppText>
      ) : null}
      <AppIcon name="chevronRight" colour={colours.textMuted} size={18} />
    </AppPressable>
  )
}

function label(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  list: {
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 64,
  },
  rowText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  screen: {
    flex: 1,
  },
})
