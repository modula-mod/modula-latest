import {
  SettingsChoiceRow,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {
  customTextScaleLabel,
} from '@/theme/accessibility/adaptivePreference'
import {TEXT_SCALES} from '@/theme/contracts'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useAppearanceActions} from '@/theme/runtime/useAppearanceActions'

export function LargerTextScreen() {
  const {preferences} = useAppearance()
  const actions = useAppearanceActions()
  const selected = preferences.textScalePreference

  return (
    <SettingsScreen title="Larger Text">
      <SettingsSection footer="System follows your device text size. Other sizes change Modula only.">
        <SettingsChoiceRow
          label="System"
          selected={selected.mode === 'system'}
          onPress={() => actions.setTextScalePreference({mode: 'system'})}
        />
        {TEXT_SCALES.map((scale, index) => (
          <SettingsChoiceRow
            key={scale}
            label={customTextScaleLabel(scale)}
            selected={selected.mode === 'custom' && selected.scale === scale}
            onPress={() =>
              actions.setTextScalePreference({mode: 'custom', scale})
            }
            last={index === TEXT_SCALES.length - 1}
          />
        ))}
      </SettingsSection>
    </SettingsScreen>
  )
}
