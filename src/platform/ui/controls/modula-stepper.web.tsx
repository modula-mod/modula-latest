import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {KonstaStepper} from '@/platform/ui/adapters/konsta/stepper.web'
import {
  clampModulaStepperValue,
  type ModulaStepperProps,
} from '@/platform/ui/controls/modula-stepper.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

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
    <View style={[{alignItems: 'center', flexDirection: 'row', gap: spacing[3]}, style]}>
      <AppText variant="caption">{label}</AppText>
      <KonstaStepper
        decrementLabel={`Decrease ${label}`}
        disabled={disabled}
        incrementLabel={`Increase ${label}`}
        onDecrement={() => onValueChange(clampModulaStepperValue(value - step, min, max))}
        onIncrement={() => onValueChange(clampModulaStepperValue(value + step, min, max))}
        testID={testID}
        value={value}
      />
    </View>
  )
}
