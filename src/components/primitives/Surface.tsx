import type {ReactNode} from 'react'
import {type StyleProp, type ViewStyle} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {SolidMaterialSurface} from '@/components/materials/SolidMaterialSurface'
import type {SurfaceRole} from '@/theme/contracts'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type SurfaceVariant =
  | 'platform'
  | 'solid'
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
  if (variant === 'platform') return 'card'
  if (variant === 'solid') return 'card'
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
  const {materials} = useThemeTokens()
  const resolvedRole = role ?? roleForVariant(variant)
  if (variant === 'solid') {
    return (
      <SolidMaterialSurface material={materials[resolvedRole]} style={style}>
        {children}
      </SolidMaterialSurface>
    )
  }
  return (
    <MaterialSurface role={resolvedRole} style={style}>
      {children}
    </MaterialSurface>
  )
}
