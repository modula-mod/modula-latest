import {View, type StyleProp, type ViewStyle} from 'react-native'

import {useTheme} from '@/theme/runtime/useTheme'

type AppDividerProps = {
  style?: StyleProp<ViewStyle>
}

/** Hairline divider using semantic border colour. */
export function AppDivider({style}: AppDividerProps) {
  const {colours} = useTheme()
  return (
    <View
      style={[{height: 1, backgroundColor: colours.border}, style]}
    />
  )
}
