import type {PropsWithChildren} from 'react'
import type {StyleProp, ViewProps, ViewStyle} from 'react-native'

import {BlurMaterialSurface} from '@/components/materials/BlurMaterialSurface'
import {SolidMaterialSurface} from '@/components/materials/SolidMaterialSurface'
import type {SurfaceRole} from '@/theme/contracts'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type MaterialSurfaceProps = PropsWithChildren<
  Omit<ViewProps, 'role'> & {
    role?: SurfaceRole
    style?: StyleProp<ViewStyle>
  }
>

export function MaterialSurface({
  role = 'card',
  children,
  style,
  ...rest
}: MaterialSurfaceProps) {
  const {materials} = useThemeTokens()
  const material = materials[role]

  if (material.useNativeGlass || material.blurIntensity > 0) {
    return (
      <BlurMaterialSurface material={material} style={style} {...rest}>
        {children}
      </BlurMaterialSurface>
    )
  }

  return (
    <SolidMaterialSurface material={material} style={style} {...rest}>
      {children}
    </SolidMaterialSurface>
  )
}
