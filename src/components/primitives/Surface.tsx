import type {ReactNode} from 'react'
import {type StyleProp, type ViewStyle} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import type {SurfaceRole} from '@/theme/contracts'

export type SurfaceVariant =
  | 'canvas'
  | 'plain'
  | 'grouped'
  | 'raised'
  | 'muted'
  | 'contained'
  | 'overlay'
  | 'glass'
  | 'floating'
  | 'inset'

type SurfaceProps = {
  variant?: SurfaceVariant
  children: ReactNode
  style?: StyleProp<ViewStyle>
  role?: SurfaceRole
}

function roleForVariant(variant: SurfaceVariant): SurfaceRole {
  if (variant === 'canvas') return 'canvas'
  if (variant === 'plain') return 'content'
  if (variant === 'grouped') return 'card'
  if (variant === 'overlay' || variant === 'glass') return 'modal'
  if (variant === 'floating') return 'floating'
  if (variant === 'inset') return 'input'
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
