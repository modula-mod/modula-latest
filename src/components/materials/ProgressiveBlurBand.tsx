import {Platform, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import {BlurView} from 'expo-blur'
import {LinearGradient} from 'expo-linear-gradient'

import {MaskedView} from '@/platform/ui/materials/masked-view'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProgressiveBlurBandProps = {
  height: number
  style?: StyleProp<ViewStyle>
  /** Strongest blur at the top fading to clear (header). Default true. */
  topHeavy?: boolean
  enabled?: boolean
  /** Max BlurView intensity under the opaque end of the mask. */
  intensity?: number
  /**
   * `soft` — lighter mask + tint (shell bottom under floating glass tabs).
   * `normal` — denser dissolve (headers / drawers).
   */
  strength?: 'normal' | 'soft'
}

/**
 * Progressive blur — MaskedView + BlurView + gradient mask
 * (same technique as rit3zh/expo-progressive-blur).
 *
 * Opaque mask → blur visible; transparent mask → content clear.
 * Soft canvas tint sits on top so the dissolve reads on light and dark.
 */
export function ProgressiveBlurBand({
  height,
  style,
  topHeavy = true,
  enabled = true,
  intensity = 55,
  strength = 'normal',
}: ProgressiveBlurBandProps) {
  const {scheme} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const useBlur =
    enabled && !reduceTransparency && Platform.OS !== 'web'
  const tint = scheme === 'dark' ? 'dark' : 'light'
  const androidBlurMethod =
    Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined
  const soft = strength === 'soft'

  // Mask: black = reveal blur, transparent = hide blur (fade to clear).
  const maskColors = topHeavy
    ? (['#000000', '#000000', 'rgba(0,0,0,0.55)', 'transparent'] as const)
    : soft
      ? (['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)'] as const)
      : (['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)', '#000000'] as const)
  const maskLocations = topHeavy
    ? ([0, 0.35, 0.7, 1] as const)
    : soft
      ? ([0, 0.35, 0.72, 1] as const)
      : ([0, 0.22, 0.55, 1] as const)

  const tintColors =
    scheme === 'dark'
      ? topHeavy
        ? (['rgba(11,20,22,0.42)', 'rgba(11,20,22,0.18)', 'rgba(11,20,22,0)'] as const)
        : soft
          ? (['rgba(11,20,22,0)', 'rgba(11,20,22,0.06)', 'rgba(11,20,22,0.16)'] as const)
          : (['rgba(11,20,22,0)', 'rgba(11,20,22,0.16)', 'rgba(11,20,22,0.38)'] as const)
      : topHeavy
        ? (['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)'] as const)
        : soft
          ? (['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.2)'] as const)
          : (['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.48)'] as const)

  if (!useBlur) {
    return (
      <View pointerEvents="none" style={[{height, overflow: 'hidden'}, style]}>
        <LinearGradient
          colors={[...tintColors]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    )
  }

  return (
    <View pointerEvents="none" style={[{height, overflow: 'hidden'}, style]}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <LinearGradient
            colors={[...maskColors]}
            locations={[...maskLocations]}
            style={StyleSheet.absoluteFill}
          />
        }>
        <BlurView
          intensity={intensity}
          tint={tint}
          blurMethod={androidBlurMethod}
          style={StyleSheet.absoluteFill}
        />
      </MaskedView>
      <LinearGradient
        colors={[...tintColors]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}
