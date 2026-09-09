import type {ReactNode} from 'react'
import type {StyleProp, ViewStyle} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'

export function NavigationDrawerSurface({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <MaterialSurface role="modal" style={style}>
      {children}
    </MaterialSurface>
  )
}
