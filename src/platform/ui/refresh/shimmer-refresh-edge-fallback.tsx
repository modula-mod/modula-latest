import {LinearGradient} from 'expo-linear-gradient'
import {StyleSheet, View} from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import {useEffect} from 'react'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useReduceMotion} from '@/lib/accessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ShimmerRefreshEdgeProps = {
  pullDistance: SharedValue<number>
  refreshing: boolean
  /** Pull distance that maps to full intensity. */
  threshold?: number
}

const DEFAULT_THRESHOLD = 92

/**
 * Reanimated + LinearGradient shimmer edge — used when Skia is unavailable.
 * Soft aurora wash + traveling highlight along the top edge (iPhone-edge energy).
 */
export function ShimmerRefreshEdgeFallback({
  pullDistance,
  refreshing,
  threshold = DEFAULT_THRESHOLD,
}: ShimmerRefreshEdgeProps) {
  const insets = useSafeAreaInsets()
  const {colours} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const shimmerPhase = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) {
      shimmerPhase.value = 0
      return
    }
    if (refreshing) {
      shimmerPhase.value = withRepeat(
        withTiming(1, {duration: 1400, easing: Easing.inOut(Easing.sin)}),
        -1,
        true,
      )
    } else {
      shimmerPhase.value = withTiming(0, {duration: 220})
    }
  }, [reduceMotion, refreshing, shimmerPhase])

  const intensity = useDerivedValue(() => {
    const fromPull = interpolate(
      pullDistance.value,
      [0, threshold * 0.35, threshold],
      [0, 0.45, 1],
      Extrapolation.CLAMP,
    )
    return refreshing ? Math.max(fromPull, 0.85) : fromPull
  })

  const bandStyle = useAnimatedStyle(() => ({
    opacity: intensity.value,
    height: interpolate(
      intensity.value,
      [0, 1],
      [insets.top + 28, insets.top + 120],
      Extrapolation.CLAMP,
    ),
  }))

  const streakStyle = useAnimatedStyle(() => {
    const travel = refreshing
      ? interpolate(shimmerPhase.value, [0, 1], [-0.35, 1.15])
      : interpolate(intensity.value, [0, 1], [0.15, 0.55])
    return {
      opacity: intensity.value * (refreshing ? 0.95 : 0.7),
      transform: [{translateX: travel * 280 - 40}],
    }
  })

  return (
    <View pointerEvents="none" style={styles.host}>
      <Animated.View style={[styles.band, bandStyle]}>
        <LinearGradient
          colors={[
            hexWithAlpha(colours.accent, 0.55),
            hexWithAlpha(colours.accent, 0.18),
            'transparent',
          ]}
          locations={[0, 0.45, 1]}
          start={{x: 0.5, y: 0}}
          end={{x: 0.5, y: 1}}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[
            'transparent',
            hexWithAlpha('#FFFFFF', 0.55),
            hexWithAlpha(colours.accent, 0.35),
            'transparent',
          ]}
          locations={[0, 0.35, 0.55, 1]}
          start={{x: 0, y: 0.2}}
          end={{x: 1, y: 0.8}}
          style={[styles.aurora, {marginTop: insets.top * 0.35}]}
        />
        <Animated.View style={[styles.streakWrap, {top: Math.max(insets.top - 2, 8)}, streakStyle]}>
          <LinearGradient
            colors={[
              'transparent',
              hexWithAlpha('#FFFFFF', 0.95),
              hexWithAlpha(colours.accent, 0.8),
              'transparent',
            ]}
            start={{x: 0, y: 0.5}}
            end={{x: 1, y: 0.5}}
            style={styles.streak}
          />
        </Animated.View>
      </Animated.View>
    </View>
  )
}

function hexWithAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) {
    return hex
  }
  const r = Number.parseInt(cleaned.slice(0, 2), 16)
  const g = Number.parseInt(cleaned.slice(2, 4), 16)
  const b = Number.parseInt(cleaned.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const styles = StyleSheet.create({
  aurora: {
    ...StyleSheet.absoluteFill,
    height: 72,
  },
  band: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 8,
  },
  streak: {
    borderRadius: 3,
    height: 3,
    width: 140,
  },
  streakWrap: {
    left: 0,
    position: 'absolute',
  },
})
