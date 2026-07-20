import type {ReactElement, ReactNode} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type CameraMaskedBlurSurfaceProps = {
  /** Opaque shapes in this element become live cutouts on native. */
  maskElement: ReactElement
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  blurIntensity?: number
  /** When false, show inactive placeholder (toggle off / Reduce Transparency). */
  active?: boolean
}

/**
 * Web / unsupported fallback for the camera masked-blur Preview.
 */
export function CameraMaskedBlurSurface({
  maskElement,
  children,
  style,
  active = true,
}: CameraMaskedBlurSurfaceProps) {
  const {colours, spacing, radius} = useThemeTokens()

  return (
    <View
      style={[
        styles.fallback,
        {
          backgroundColor: colours.surface1,
          borderColor: colours.border,
          borderRadius: radius.large,
          padding: spacing[4],
          gap: spacing[3],
        },
        style,
      ]}>
      <AppText variant="label">Living camera backdrop</AppText>
      <AppText variant="caption" colour="textTertiary">
        {active
          ? 'Camera cutout chrome needs a native iOS/Android build with camera permission.'
          : 'Turn on Advanced → Camera masked blur on a native device to preview the effect.'}
      </AppText>
      <View style={styles.maskPreview} pointerEvents="none">
        {maskElement}
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: {
    minHeight: 220,
    overflow: 'hidden',
    width: '100%',
  },
  maskPreview: {
    opacity: 0.35,
  },
})
