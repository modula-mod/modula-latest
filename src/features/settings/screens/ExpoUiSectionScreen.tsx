import {StyleSheet} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {
  SettingsCaption,
  SettingsScreen,
} from '@/features/settings/components/SettingsRows'
import {
  ExpoUiSectionDemo,
  getExpoUiLabSection,
  type ExpoUiLabSectionId,
} from '@/platform/ui/dev/expo-ui-lab'
import {canAccessDeveloperLabs} from '@/lib/platform'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ExpoUiSectionScreen({sectionId}: {sectionId: string}) {
  const {spacing} = useThemeTokens()
  const meta = getExpoUiLabSection(sectionId)

  if (!canAccessDeveloperLabs()) {
    return (
      <SettingsScreen title="Expo UI Lab">
        <AppText variant="headline">Developer settings are unavailable.</AppText>
        <SettingsCaption>
          This surface is only available in development and preview builds.
        </SettingsCaption>
      </SettingsScreen>
    )
  }

  if (!meta) {
    return (
      <SettingsScreen title="Unknown section">
        <AppText variant="body">Unknown Expo UI lab section: {sectionId}</AppText>
      </SettingsScreen>
    )
  }

  return (
    <SettingsScreen title={meta.title} caption={meta.summary}>
      <Surface
        variant="contained"
        style={[styles.card, {gap: spacing[2], padding: spacing[4]}]}>
        <AppText variant="label" colour="textSecondary">
          Status: {meta.status}
        </AppText>
        <AppText variant="label" colour="textSecondary">
          Use for: {meta.suggestedContexts.join(' · ')}
        </AppText>
        <AppText variant="label" colour="textSecondary">
          Prefer wrappers:{' '}
          {meta.modulaWrappers.length
            ? meta.modulaWrappers.join(', ')
            : 'design a Modula adapter before product use'}
        </AppText>
      </Surface>
      <ExpoUiSectionDemo sectionId={meta.id as ExpoUiLabSectionId} />
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
})
