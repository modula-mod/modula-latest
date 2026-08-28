import {useMemo} from 'react'
import {View} from 'react-native'

import {
  SettingsAdaptiveRow,
  SettingsFooter,
  SettingsMenuRow,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {
  customTextScaleLabel,
  textScaleLabel,
} from '@/theme/accessibility/adaptivePreference'
import {TEXT_SCALES, type TextScale} from '@/theme/contracts'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useAppearanceActions} from '@/theme/runtime/useAppearanceActions'

export function SystemAdaptationSection() {
  const {preferences} = useAppearance()
  const actions = useAppearanceActions()

  const textScaleActions = useMemo(
    () => [
      {id: 'system', label: 'System'},
      ...TEXT_SCALES.map(scale => ({
        id: String(scale),
        label: customTextScaleLabel(scale),
      })),
    ],
    [],
  )

  return (
    <>
      <SettingsSection
        title="Text"
        footer="System follows your device text size. Custom sizes change Modula only.">
        <SettingsMenuRow
          label="Text Size"
          icon="text"
          iconDomain="language"
          value={textScaleLabel(preferences.textScalePreference)}
          actions={textScaleActions}
          onAction={id => {
            if (id === 'system') {
              actions.setTextScalePreference({mode: 'system'})
              return
            }
            const scale = Number(id) as TextScale
            actions.setTextScalePreference({mode: 'custom', scale})
          }}
        />
        <SettingsAdaptiveRow
          label="Bold Text"
          icon="text"
          iconDomain="language"
          value={preferences.boldText}
          onValueChange={actions.setBoldText}
          last
        />
      </SettingsSection>

      <SettingsSection
        title="Visual accessibility"
        footer="Adds markers so selected, unread, and warning states are not colour-only. System means Modula follows the current operating-system preference.">
        <SettingsAdaptiveRow
          label="Increase Contrast"
          icon="contrast"
          iconDomain="appearance"
          value={preferences.increaseContrast}
          onValueChange={actions.setIncreaseContrast}
        />
        <SettingsAdaptiveRow
          label="Reduce Transparency"
          icon="appearance"
          iconDomain="appearance"
          value={preferences.reduceTransparency}
          onValueChange={actions.setReduceTransparency}
        />
        <SettingsAdaptiveRow
          label="Differentiate Without Color"
          icon="filter"
          iconDomain="accessibility"
          value={preferences.differentiateWithoutColor}
          onValueChange={actions.setDifferentiateWithoutColor}
          last
        />
      </SettingsSection>

      <SettingsSection
        title="Motion"
        footer="When Reduce Motion is on, Modula prefers fades over large movement.">
        <SettingsAdaptiveRow
          label="Reduce Motion"
          icon="motion"
          iconDomain="accessibility"
          value={preferences.reduceMotion}
          onValueChange={actions.setReduceMotion}
          last
        />
      </SettingsSection>

      <SettingsSection
        title="Controls"
        footer="On/Off labels are a Modula preference. iOS On/Off Labels cannot be read through public APIs.">
        <SettingsAdaptiveRow
          label="On/Off Indicators"
          icon="switch"
          iconDomain="interaction"
          value={preferences.showSwitchLabels}
          onValueChange={actions.setShowSwitchLabels}
          last
        />
      </SettingsSection>
    </>
  )
}

export function SystemAdaptationStatusNote() {
  const {systemAccessibility, resolved} = useAppearance()
  const bits = [
    systemAccessibility.screenReaderEnabled ? 'Screen reader active' : null,
    resolved.accessibility.boldText ? 'Bold text' : null,
    resolved.accessibility.reduceMotion ? 'Reduced motion' : null,
    resolved.accessibility.increaseContrast ? 'Increased contrast' : null,
  ].filter(Boolean)

  if (!bits.length) return null

  return (
    <View>
      <SettingsFooter>
        Currently adapting: {bits.join(' · ')}.
      </SettingsFooter>
    </View>
  )
}
