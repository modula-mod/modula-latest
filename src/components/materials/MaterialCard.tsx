import type {PropsWithChildren} from 'react'
import type {StyleProp, ViewStyle} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'

export function MaterialCard({
  children,
  style,
}: PropsWithChildren<{style?: StyleProp<ViewStyle>}>) {
  return (
    <MaterialSurface role="card" style={style}>
      {children}
    </MaterialSurface>
  )
}
