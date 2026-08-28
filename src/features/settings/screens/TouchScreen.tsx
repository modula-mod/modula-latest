import {
  SettingsInfoRow,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'

export function TouchScreen() {
  return (
    <SettingsScreen title="Touch">
      <SettingsSection footer="Primary actions stay at least 44 pt. Further touch accommodations stay in your device settings.">
        <SettingsInfoRow label="Minimum target size" value="44 pt" last />
      </SettingsSection>
    </SettingsScreen>
  )
}
