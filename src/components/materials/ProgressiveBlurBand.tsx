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
   * `soft` — lighter dissolve.
   * `normal` — denser dissolve (headers / drawers).
   */
  strength?: 'normal' | 'soft'
}

/**
 * Progressive blur — MaskedView + BlurView + gradient mask
 * (same technique as rit3zh/expo-progressive-blur).
 *
 * Gradients are always painted top-heavy in local coordinates (SwiftUI Mask
 * composites this correctly). Bottom-anchored bands flip 180° so the opaque
 * end lands on the physical edge.
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

  const maskColors = soft
    ? (['#000000', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.25)', 'transparent'] as const)
    : (['#000000', '#000000', 'rgba(0,0,0,0.55)', 'transparent'] as const)
  const maskLocations = [0, 0.35, 0.7, 1] as const

  const tintColors =
    scheme === 'dark'
      ? soft
        ? (['rgba(11,20,22,0.32)', 'rgba(11,20,22,0.12)', 'rgba(11,20,22,0)'] as const)
        : (['rgba(11,20,22,0.42)', 'rgba(11,20,22,0.18)', 'rgba(11,20,22,0)'] as const)
      : soft
        ? (['rgba(255,255,255,0.36)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'] as const)
        : (['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)'] as const)

  const tintLocations = [0, 0.55, 1] as const
  const gradientAxis = {
    start: {x: 0, y: 0} as const,
    end: {x: 0, y: 1} as const,
  }

  const body = !useBlur ? (
    <LinearGradient
      colors={[...tintColors]}
      locations={[...tintLocations]}
      start={gradientAxis.start}
      end={gradientAxis.end}
      style={StyleSheet.absoluteFill}
    />
  ) : (
    <>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <LinearGradient
            colors={[...maskColors]}
            locations={[...maskLocations]}
            start={gradientAxis.start}
            end={gradientAxis.end}
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
        locations={[...tintLocations]}
        start={gradientAxis.start}
        end={gradientAxis.end}
        style={StyleSheet.absoluteFill}
      />
    </>
  )

  return (
    <View
      pointerEvents="none"
      style={[
        {height, overflow: 'hidden'},
        !topHeavy ? styles.flip : null,
        style,
      ]}>
      {body}
    </View>
  )
}

const styles = StyleSheet.create({
  flip: {
    transform: [{rotate: '180deg'}],
  },
})
