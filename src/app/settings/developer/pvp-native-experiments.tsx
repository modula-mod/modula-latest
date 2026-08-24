import {PvpNativeExperimentsScreen} from '@/platform/ui/dev/pvp-native-experiments'
import {canAccessDeveloperLabs} from '@/lib/platform'
import {SettingsCaption, SettingsScreen} from '@/features/settings/components/SettingsRows'
import {AppText} from '@/components/primitives/AppText'

export default function PvpNativeExperimentsRoute() {
  if (!canAccessDeveloperLabs()) {
    return (
      <SettingsScreen title="Native experiments">
        <AppText variant="headline">Developer settings are unavailable.</AppText>
        <SettingsCaption>This surface is only available in development and preview builds.</SettingsCaption>
      </SettingsScreen>
    )
  }
  return <PvpNativeExperimentsScreen />
}
