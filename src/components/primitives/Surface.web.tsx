import type {CSSProperties, ReactNode} from 'react'
import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {SolidMaterialSurface} from '@/components/materials/SolidMaterialSurface'
import type {SurfaceVariant} from '@/components/primitives/Surface'
import {KonstaSurface} from '@/platform/ui/adapters/konsta/surface.web'
import type {SurfaceRole} from '@/theme/contracts'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type SurfaceProps = {
  variant?: SurfaceVariant
  children: ReactNode
  style?: StyleProp<ViewStyle>
  role?: SurfaceRole
}

function roleForVariant(variant: SurfaceVariant): SurfaceRole {
  if (variant === 'canvas') return 'canvas'
  if (variant === 'plain') return 'content'
  if (variant === 'overlay' || variant === 'glass') return 'modal'
  if (variant === 'floating') return 'floating'
  if (variant === 'inset') return 'input'
  return 'card'
}

/** Konsta only implements the web appearance of platform/glass surfaces. */
export function Surface({variant = 'plain', children, style, role}: SurfaceProps) {
  const {materials} = useThemeTokens()
  const resolvedRole = role ?? roleForVariant(variant)
  if (variant === 'platform' || variant === 'glass') {
    return (
      <KonstaSurface
        highlight={variant === 'platform'}
        style={StyleSheet.flatten(style) as CSSProperties}
        variant={variant}>
        {children}
      </KonstaSurface>
    )
  }
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

export type {SurfaceVariant} from '@/components/primitives/Surface'
