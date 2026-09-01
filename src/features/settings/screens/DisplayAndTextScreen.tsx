import {
  SettingsAdaptiveRow,
  SettingsLinkRow,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {SystemAdaptationStatusNote} from '@/features/settings/components/SystemAdaptationSection'
import {textScaleLabel} from '@/theme/accessibility/adaptivePreference'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useAppearanceActions} from '@/theme/runtime/useAppearanceActions'

export function DisplayAndTextScreen() {
  const {preferences} = useAppearance()
  const actions = useAppearanceActions()

  return (
    <SettingsScreen title="Display & Text Size">
      <SettingsSection>
        <SettingsAdaptiveRow
          label="Bold Text"
          value={preferences.boldText}
          onValueChange={actions.setBoldText}
        />
        <SettingsLinkRow
          row={{
            title: 'Larger Text',
            value: textScaleLabel(preferences.textScalePreference),
            route: '/settings/display-and-text/larger-text',
            keywords: ['dynamic type', 'text size', 'font'],
          }}
        />
        <SettingsAdaptiveRow
          label="On/Off Labels"
          value={preferences.showSwitchLabels}
          onValueChange={actions.setShowSwitchLabels}
          last
        />
      </SettingsSection>

      <SettingsSection footer="Improve contrast by reducing transparency and blurs on some backgrounds to increase legibility. System follows this device.">
        <SettingsAdaptiveRow
          label="Reduce Transparency"
          value={preferences.reduceTransparency}
          onValueChange={actions.setReduceTransparency}
          last
        />
      </SettingsSection>

      <SettingsSection footer="Increase colour contrast between app foreground and background colours. System follows this device.">
        <SettingsAdaptiveRow
          label="Increase Contrast"
          value={preferences.increaseContrast}
          onValueChange={actions.setIncreaseContrast}
          last
        />
      </SettingsSection>

      <SettingsSection footer="Replaces user interface items that rely solely on colour to convey information with alternatives. System follows this device. iOS Differentiate Without Color cannot be read through public APIs.">
        <SettingsAdaptiveRow
          label="Differentiate Without Color"
          value={preferences.differentiateWithoutColor}
          onValueChange={actions.setDifferentiateWithoutColor}
          last
        />
      </SettingsSection>

      <SystemAdaptationStatusNote />
    </SettingsScreen>
  )
}
