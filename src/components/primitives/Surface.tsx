import type {ReactNode} from 'react'
import {View, type StyleProp, type ViewStyle} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type SurfaceVariant =
  | 'canvas'
  | 'plain'
  | 'raised'
  | 'muted'
  | 'contained'

type SurfaceProps = {
  variant?: SurfaceVariant
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

export function Surface({variant = 'plain', children, style}: SurfaceProps) {
  const {colours, radius} = useThemeTokens()
  const backgroundColor =
    variant === 'canvas'
      ? colours.canvas
      : variant === 'raised'
        ? colours.surfaceRaised
        : variant === 'muted'
          ? colours.surfaceMuted
          : colours.surface

  return (
    <View
      style={[
        {
          backgroundColor,
          borderColor: variant === 'contained' ? colours.border : 'transparent',
          borderRadius: variant === 'contained' ? radius.medium : 0,
          borderWidth: variant === 'contained' ? 1 : 0,
        },
        style,
      ]}>
      {children}
    </View>
  )
}
