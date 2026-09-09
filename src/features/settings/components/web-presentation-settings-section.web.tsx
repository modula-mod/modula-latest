import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {SettingsSection} from '@/features/settings/components/SettingsRows'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useAppearanceActions} from '@/theme/runtime/useAppearanceActions'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function WebPresentationSettingsSection() {
  const {preferences} = useAppearance()
  const actions = useAppearanceActions()
  const {spacing} = useThemeTokens()
  return (
    <SettingsSection
      title="Web interface"
      footer="Choose how Modula is presented in your browser. Native apps always use their native platform UI.">
      <View style={{gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3]}}>
        <ModulaSegmentedPicker
          accessibilityLabel="Web interface presentation"
          appearance="segmented"
          options={[
            {value: 'liquid', label: 'Liquid'},
            {value: 'material', label: 'Material'},
          ]}
          testID="appearance-web-presentation"
          value={preferences.webPresentation}
          onValueChange={value => {
            if (value === 'liquid' || value === 'material') {
              actions.setWebPresentation(value)
            }
          }}
        />
        <View style={{gap: spacing[2]}}>
          <AppText variant="caption" colour="textSecondary">
            Liquid — Translucent surfaces, floating controls, soft depth, and Liquid Glass presentation.
          </AppText>
          <AppText variant="caption" colour="textSecondary">
            Material — Material surfaces, controls, elevation, and interaction behavior.
          </AppText>
        </View>
      </View>
    </SettingsSection>
  )
}
