import {
  SettingsCaption,
  SettingsScreen,
} from '@/features/settings/components/SettingsRows'
import {AppText} from '@/components/primitives/AppText'
import {canAccessDeveloperLabs} from '@/lib/platform'
import {ModulaPrimitivesLabScreen} from '@/platform/ui/dev/modula-primitives-lab'

export function ModulaUiLabRouteScreen() {
  if (!canAccessDeveloperLabs()) {
    return (
      <SettingsScreen title="Modula UI Lab">
        <AppText variant="headline">Developer settings are unavailable.</AppText>
        <SettingsCaption>This surface is only available in development and preview builds.</SettingsCaption>
      </SettingsScreen>
    )
  }
  return (
    <SettingsScreen title="Modula UI Lab" caption="UI Lab 2.0 — quality compare plus flagship primitive matrix for Direction M.">
      <ModulaPrimitivesLabScreen />
    </SettingsScreen>
  )
}
