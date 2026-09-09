import type {ReactNode} from 'react'
import {View, type StyleProp, type ViewStyle} from 'react-native'

/** Passive content wrapper; the web drawer frame owns its presentation surface. */
export function NavigationDrawerSurface({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <View style={style}>{children}</View>
}
