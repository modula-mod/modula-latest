import {Slider} from '@expo/ui'
import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {ModulaRangeProps} from '@/platform/ui/controls/modula-range'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulaRange({
  disabled,
  label,
  max = 100,
  min = 0,
  onValueChange,
  step = 1,
  style,
  testID,
  value,
}: ModulaRangeProps) {
  const {spacing} = useThemeTokens()
  return (
    <View accessibilityLabel={label} style={[{gap: spacing[2]}, style]}>
      {label ? <AppText variant="caption">{label}</AppText> : null}
      <Slider
        disabled={disabled}
        max={max}
        min={min}
        onValueChange={onValueChange}
        step={step}
        testID={testID}
        value={value}
      />
    </View>
  )
}
