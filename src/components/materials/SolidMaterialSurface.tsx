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

function shadowColourWithOpacity(colour: string, opacity: number): string {
  if (opacity <= 0) return 'transparent'
  const hex = colour.match(/^#([0-9a-f]{6})$/i)?.[1]
  if (!hex) return colour
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`
}

export function materialBaseStyle(material: MaterialTokens): ViewStyle {
  const platformShadow =
    Platform.OS === 'android'
      ? {elevation: material.elevation}
      : Platform.OS === 'web'
        ? ({
            boxShadow:
              material.shadowOpacity > 0 && material.shadowRadius > 0
                ? `0px ${material.shadowOffsetY}px ${material.shadowRadius}px ${shadowColourWithOpacity(material.shadowColor, material.shadowOpacity)}`
                : 'none',
          } as ViewStyle)
        : {
            shadowColor: material.shadowColor,
            shadowOffset: {width: 0, height: material.shadowOffsetY},
            shadowOpacity: material.shadowOpacity,
            shadowRadius: material.shadowRadius,
          }

  return {
    backgroundColor: material.backgroundColor,
    borderColor: material.borderColor,
    borderRadius: material.radius,
    borderWidth: material.borderWidth,
    overflow: material.radius > 0 ? 'hidden' : 'visible',
    ...platformShadow,
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
