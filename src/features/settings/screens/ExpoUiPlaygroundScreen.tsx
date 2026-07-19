import {ExpoUiPlayground} from '@/platform/ui/dev/expo-ui-lab'
import {
  SettingsCaption,
  SettingsScreen,
} from '@/features/settings/components/SettingsRows'
import {AppText} from '@/components/primitives/AppText'
import {canAccessDeveloperLabs} from '@/lib/platform'

export function ExpoUiPlaygroundScreen() {
  if (!canAccessDeveloperLabs()) {
    return (
      <SettingsScreen title="Full playground">
        <AppText variant="headline">Developer settings are unavailable.</AppText>
        <SettingsCaption>
          This surface is only available in development and preview builds.
        </SettingsCaption>
      </SettingsScreen>
    )
  }

  return (
    <SettingsScreen
      title="Full playground"
      caption="Full Form host with every playground section — adapted from betomoedano/expo-ui-playground for SDK 57.">
      <ExpoUiPlayground />
    </SettingsScreen>
  )
}
