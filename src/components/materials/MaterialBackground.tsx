import type {PropsWithChildren} from 'react'
import type {StyleProp, ViewStyle} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'

export function MaterialBackground({
  children,
  style,
}: PropsWithChildren<{style?: StyleProp<ViewStyle>}>) {
  return (
    <MaterialSurface role="canvas" style={[{flex: 1}, style]}>
      {children}
    </MaterialSurface>
  )
}
