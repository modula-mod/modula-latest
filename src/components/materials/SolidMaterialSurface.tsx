import type {PropsWithChildren} from 'react'
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native'

import type {MaterialTokens} from '@/theme/contracts'

export type MaterialSurfaceBaseProps = PropsWithChildren<
  ViewProps & {
    material: MaterialTokens
    style?: StyleProp<ViewStyle>
  }
>

export function materialBaseStyle(material: MaterialTokens): ViewStyle {
  return {
    backgroundColor: material.backgroundColor,
    borderColor: material.borderColor,
    borderRadius: material.radius,
    borderWidth: material.borderWidth,
    overflow: material.radius > 0 ? 'hidden' : 'visible',
    ...(Platform.OS === 'android'
      ? {elevation: material.elevation}
      : {
          shadowColor: material.shadowColor,
          shadowOffset: {width: 0, height: material.shadowOffsetY},
          shadowOpacity: material.shadowOpacity,
          shadowRadius: material.shadowRadius,
        }),
  }
}

export function InnerHighlight({material}: {material: MaterialTokens}) {
  if (material.innerHighlightOpacity <= 0 || material.radius <= 0) {
    return null
  }

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderColor: material.innerHighlightColor,
          borderRadius: material.radius,
          borderTopWidth: 1,
          opacity: material.innerHighlightOpacity,
        },
      ]}
    />
  )
}

export function SolidMaterialSurface({
  children,
  material,
  style,
  ...rest
}: MaterialSurfaceBaseProps) {
  return (
    <View {...rest} style={[materialBaseStyle(material), style]}>
      {children}
      <InnerHighlight material={material} />
    </View>
  )
}
