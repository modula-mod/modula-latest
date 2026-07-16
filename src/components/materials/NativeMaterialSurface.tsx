import {GlassView} from 'expo-glass-effect'

import {BlurMaterialSurface} from '@/components/materials/BlurMaterialSurface'
import type {MaterialSurfaceBaseProps} from '@/components/materials/SolidMaterialSurface'
import {
  InnerHighlight,
  materialBaseStyle,
} from '@/components/materials/SolidMaterialSurface'
import {isNativeGlassRuntimeAvailable} from '@/theme/materials/nativeMaterial'

export function NativeMaterialSurface({
  children,
  material,
  style,
  ...rest
}: MaterialSurfaceBaseProps) {
  if (!material.useNativeGlass || !isNativeGlassRuntimeAvailable()) {
    return (
      <BlurMaterialSurface material={material} style={style} {...rest}>
        {children}
      </BlurMaterialSurface>
    )
  }

  return (
    <GlassView
      {...rest}
      glassEffectStyle="regular"
      tintColor={material.backgroundColor}
      colorScheme={material.blurTint === 'dark' ? 'dark' : 'light'}
      style={[materialBaseStyle(material), style]}>
      {children}
      <InnerHighlight material={material} />
    </GlassView>
  )
}
