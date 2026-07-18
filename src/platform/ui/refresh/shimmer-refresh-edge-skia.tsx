import {useEffect} from 'react'
import {StyleSheet, View, useWindowDimensions} from 'react-native'
import {Canvas, LinearGradient, RoundedRect, vec} from '@shopify/react-native-skia'
import {
  Easing,
  Extrapolation,
  interpolate,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useReduceMotion} from '@/lib/accessibility'
import type {ShimmerRefreshEdgeProps} from '@/platform/ui/refresh/shimmer-refresh-edge-fallback'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const DEFAULT_THRESHOLD = 92

/**
 * Skia shimmering top-edge refresh — soft aurora wash + traveling specular streak.
 * Load only after RNSkiaModule is confirmed available.
 */
export function ShimmerRefreshEdgeSkia({
  pullDistance,
  refreshing,
  threshold = DEFAULT_THRESHOLD,
}: ShimmerRefreshEdgeProps) {
  const insets = useSafeAreaInsets()
  const {width} = useWindowDimensions()
  const {colours} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const shimmerPhase = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) {
      shimmerPhase.value = 0.5
      return
    }
    if (refreshing) {
      shimmerPhase.value = withRepeat(
        withTiming(1, {duration: 1600, easing: Easing.linear}),
        -1,
        false,
      )
    } else {
      shimmerPhase.value = withTiming(0.35, {duration: 240})
    }
  }, [reduceMotion, refreshing, shimmerPhase])

  const intensity = useDerivedValue(() => {
    const fromPull = interpolate(
      pullDistance.value,
      [0, threshold * 0.3, threshold],
      [0, 0.5, 1],
      Extrapolation.CLAMP,
    )
    return refreshing ? Math.max(fromPull, 0.88) : fromPull
  })

  const bandHeight = useDerivedValue(() =>
    interpolate(
      intensity.value,
      [0, 1],
      [insets.top + 36, insets.top + 132],
      Extrapolation.CLAMP,
    ),
  )

  const glowY = insets.top > 0 ? insets.top - 2 : 10

  const streakX = useDerivedValue(() => {
    if (refreshing) {
      return interpolate(shimmerPhase.value, [0, 1], [-width * 0.3, width * 0.9])
    }
    return interpolate(intensity.value, [0, 1], [width * 0.1, width * 0.4])
  })

  const accent = colours.accent

  const auroraColors = useDerivedValue(() => [
    withAlpha(accent, 0.7 * intensity.value),
    withAlpha(accent, 0.28 * intensity.value),
    withAlpha('#FFFFFF', 0.12 * intensity.value),
    'transparent',
  ])

  const streakColors = useDerivedValue(() => [
    'transparent',
    withAlpha('#FFFFFF', 0.98 * intensity.value),
    withAlpha(accent, 0.8 * intensity.value),
    'transparent',
  ])

  const rimColors = useDerivedValue(() => [
    'transparent',
    withAlpha('#FFFFFF', 0.65 * intensity.value),
    withAlpha(accent, 0.45 * intensity.value),
    'transparent',
  ])

  return (
    <View pointerEvents="none" style={styles.host}>
      <Canvas style={StyleSheet.absoluteFill}>
        <RoundedRect x={0} y={0} width={width} height={bandHeight} r={0} opacity={intensity}>
          <LinearGradient
            start={vec(width * 0.5, 0)}
            end={vec(width * 0.4, 150)}
            colors={auroraColors}
          />
        </RoundedRect>

        <RoundedRect
          x={0}
          y={glowY}
          width={width}
          height={3}
          r={1.5}
          opacity={intensity}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(width, 0)}
            colors={rimColors}
          />
        </RoundedRect>

        <RoundedRect
          x={streakX}
          y={glowY - 1}
          width={width * 0.38}
          height={6}
          r={3}
          opacity={intensity}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(width * 0.38, 0)}
            colors={streakColors}
          />
        </RoundedRect>
      </Canvas>
    </View>
  )
}

function withAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) {
    return `rgba(54,156,170,${Math.max(0, Math.min(1, alpha))})`
  }
  const r = Number.parseInt(cleaned.slice(0, 2), 16)
  const g = Number.parseInt(cleaned.slice(2, 4), 16)
  const b = Number.parseInt(cleaned.slice(4, 6), 16)
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${r},${g},${b},${a})`
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 8,
  },
})
