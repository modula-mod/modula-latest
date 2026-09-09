import type {ReactNode} from 'react'
import {View, type StyleProp, type ViewStyle} from 'react-native'

/** Konsta Panel owns the single web drawer surface; this keeps content neutral. */
export function NavigationDrawerSurface({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <View style={style}>{children}</View>
}
