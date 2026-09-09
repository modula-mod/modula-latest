import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {KonstaRange} from '@/platform/ui/adapters/konsta/range.web'
import type {ModulaRangeProps} from '@/platform/ui/controls/modula-range'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulaRange({
  disabled,
  label = 'Value',
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
    <View style={[{gap: spacing[2]}, style]}>
      <AppText variant="caption">{label}: {value}</AppText>
      <KonstaRange
        accessibilityLabel={label}
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
