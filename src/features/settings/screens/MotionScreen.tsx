import {
  SettingsAdaptiveRow,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useAppearanceActions} from '@/theme/runtime/useAppearanceActions'

export function MotionScreen() {
  const {preferences} = useAppearance()
  const actions = useAppearanceActions()

  return (
    <SettingsScreen title="Motion">
      <SettingsSection footer="When Reduce Motion is on, Modula prefers fades over large movement. System follows this device.">
        <SettingsAdaptiveRow
          label="Reduce Motion"
          value={preferences.reduceMotion}
          onValueChange={actions.setReduceMotion}
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}
