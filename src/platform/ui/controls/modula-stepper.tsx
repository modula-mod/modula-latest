import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {
  clampModulaStepperValue,
  type ModulaStepperProps,
} from '@/platform/ui/controls/modula-stepper.types'

export function ModulaStepper({
  disabled,
  label = 'Value',
  max = Number.MAX_SAFE_INTEGER,
  min = Number.MIN_SAFE_INTEGER,
  onValueChange,
  step = 1,
  style,
  testID,
  value,
}: ModulaStepperProps) {
  const {spacing} = useThemeTokens()
  return (
    <View
      accessibilityLabel={`${label}: ${value}`}
      style={[{alignItems: 'center', flexDirection: 'row', gap: spacing[2]}, style]}
      testID={testID}>
      <ModulaButton
        accessibilityLabel={`Decrease ${label}`}
        disabled={disabled || value <= min}
        label="−"
        onPress={() => onValueChange(clampModulaStepperValue(value - step, min, max))}
        role="secondary"
        size="compact"
      />
      <AppText variant="buttonLabel">{value}</AppText>
      <ModulaButton
        accessibilityLabel={`Increase ${label}`}
        disabled={disabled || value >= max}
        label="+"
        onPress={() => onValueChange(clampModulaStepperValue(value + step, min, max))}
        role="secondary"
        size="compact"
      />
    </View>
  )
}

export type {ModulaStepperProps} from '@/platform/ui/controls/modula-stepper.types'
