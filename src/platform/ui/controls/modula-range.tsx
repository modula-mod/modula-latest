import {View, type StyleProp, type ViewStyle} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaProgress} from '@/platform/ui/controls/modula-progress'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaRangeProps = {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Non-web fallback. Native platforms replace this with their platform slider. */
export function ModulaRange({value, min = 0, max = 100, label, style, testID}: ModulaRangeProps) {
  const {spacing} = useThemeTokens()
  const progress = max === min ? 0 : (value - min) / (max - min)
  return (
    <View style={[{gap: spacing[2]}, style]} testID={testID}>
      {label ? <AppText variant="caption">{label}</AppText> : null}
      <ModulaProgress progress={progress} />
    </View>
  )
}
