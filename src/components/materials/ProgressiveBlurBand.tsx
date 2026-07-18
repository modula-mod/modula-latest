import {Platform, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import {BlurView} from 'expo-blur'
import {LinearGradient} from 'expo-linear-gradient'

import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProgressiveBlurBandProps = {
  height: number
  style?: StyleProp<ViewStyle>
  /** Strongest blur at the top fading to clear (header). Default true. */
  topHeavy?: boolean
  enabled?: boolean
}

/**
 * True progressive blur: stacked BlurView strips with falling intensity,
 * plus a soft canvas fade so the bottom edge dissolves (not a hard material bar).
 */
export function ProgressiveBlurBand({
  height,
  style,
  topHeavy = true,
  enabled = true,
}: ProgressiveBlurBandProps) {
  const {scheme} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const useBlur = enabled && !reduceTransparency && Platform.OS !== 'web'
  const tint = scheme === 'dark' ? 'dark' : 'light'

  // Top → bottom intensities (or reversed for bottom-heavy edges).
  const intensities = topHeavy
    ? [72, 58, 44, 32, 22, 14, 8, 3]
    : [3, 8, 14, 22, 32, 44, 58, 72]
  const stripCount = intensities.length
  const stripHeight = height / stripCount
  const overlap = Math.ceil(stripHeight * 0.55)

  const tintStops =
    scheme === 'dark'
      ? ([
          'rgba(11,20,22,0.55)',
          'rgba(11,20,22,0.28)',
          'rgba(11,20,22,0.1)',
          'rgba(11,20,22,0)',
        ] as const)
      : ([
          'rgba(243,247,248,0.62)',
          'rgba(243,247,248,0.32)',
          'rgba(243,247,248,0.12)',
          'rgba(243,247,248,0)',
        ] as const)

  return (
    <View pointerEvents="none" style={[{height, overflow: 'hidden'}, style]}>
      {useBlur
        ? intensities.map((intensity, index) => {
            const top = index * stripHeight - (index === 0 ? 0 : overlap / 2)
            const h = stripHeight + (index === 0 || index === stripCount - 1 ? overlap / 2 : overlap)
            return (
              <View
                key={`blur-${index}`}
                style={[
                  styles.strip,
                  {
                    top: Math.max(0, top),
                    height: h,
                  },
                ]}>
                <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
              </View>
            )
          })
        : null}
      <LinearGradient
        colors={[...tintStops]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },
})
