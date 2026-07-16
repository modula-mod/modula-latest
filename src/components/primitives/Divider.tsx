import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type DividerProps = {
  style?: StyleProp<ViewStyle>
}

export function Divider({style}: DividerProps) {
  const {colours} = useThemeTokens()
  return (
    <View
      style={[
        {height: StyleSheet.hairlineWidth, backgroundColor: colours.border},
        style,
      ]}
    />
  )
}
