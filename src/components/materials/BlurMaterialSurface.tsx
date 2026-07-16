import {BlurView} from 'expo-blur'
import {Platform, StyleSheet, View} from 'react-native'

import type {MaterialSurfaceBaseProps} from '@/components/materials/SolidMaterialSurface'
import {
  InnerHighlight,
  SolidMaterialSurface,
  materialBaseStyle,
} from '@/components/materials/SolidMaterialSurface'

export function BlurMaterialSurface({
  children,
  material,
  style,
  ...rest
}: MaterialSurfaceBaseProps) {
  if (material.blurIntensity <= 0) {
    return (
      <SolidMaterialSurface material={material} style={style} {...rest}>
        {children}
      </SolidMaterialSurface>
    )
  }

  return (
    <BlurView
      {...rest}
      tint={material.blurTint}
      intensity={material.blurIntensity}
      blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
      style={[materialBaseStyle(material), style]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {backgroundColor: material.backgroundColor, opacity: material.opacity},
        ]}
      />
      {children}
      <InnerHighlight material={material} />
    </BlurView>
  )
}
