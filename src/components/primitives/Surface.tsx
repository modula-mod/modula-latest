import type {ReactNode} from 'react'
import {type StyleProp, type ViewStyle} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import type {SurfaceRole} from '@/theme/contracts'

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
  role?: SurfaceRole
}

function roleForVariant(variant: SurfaceVariant): SurfaceRole {
  if (variant === 'canvas') return 'canvas'
  if (variant === 'plain') return 'content'
  if (variant === 'contained') return 'card'
  if (variant === 'muted') return 'input'
  return 'card'
}

export function Surface({variant = 'plain', children, style, role}: SurfaceProps) {
  return (
    <MaterialSurface role={role ?? roleForVariant(variant)} style={style}>
      {children}
    </MaterialSurface>
  )
}
