import {useEffect} from 'react'
import {StyleSheet, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
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

import {useReduceMotion} from '@/lib/accessibility'
import {PULL_ACTION_ARM_DISTANCE} from '@/platform/ui/refresh/pull-action-types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type LightningScreenGlowProps = {
  pullDistance: SharedValue<number>
  refreshing?: boolean
}

function withAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return hex
  const r = Number.parseInt(cleaned.slice(0, 2), 16)
  const g = Number.parseInt(cleaned.slice(2, 4), 16)
  const b = Number.parseInt(cleaned.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Siri-style elegant perimeter glow (“lightning screen”).
 * Soft multi-stop light hugging the display edge while the pull stage is armed.
 */
export function LightningScreenGlow({
  pullDistance,
  refreshing = false,
}: LightningScreenGlowProps) {
  const {colours} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const phase = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) {
      phase.value = 0
      return
    }
    phase.value = withRepeat(
      withTiming(1, {
        duration: refreshing ? 2200 : 3200,
        easing: Easing.linear,
      }),
      -1,
      false,
    )
  }, [phase, reduceMotion, refreshing])

  const intensity = useDerivedValue(() => {
    const fromPull = interpolate(
      pullDistance.value,
      [0, PULL_ACTION_ARM_DISTANCE * 0.3, PULL_ACTION_ARM_DISTANCE],
      [0, 0.55, 1],
      Extrapolation.CLAMP,
    )
    return refreshing ? Math.max(fromPull, 0.75) : fromPull
  })

  const hostStyle = useAnimatedStyle(() => ({
    opacity: intensity.value,
  }))

  const breathStyle = useAnimatedStyle(() => {
    const pulse = reduceMotion
      ? 1
      : interpolate(phase.value, [0, 0.5, 1], [0.82, 1, 0.82])
    return {opacity: intensity.value * pulse}
  })

  const teal = colours.accent
  const cyan = '#5EC8D4'
  const amber = '#E8A05C'
  const rose = '#E07A8A'

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.host, hostStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, breathStyle]}>
        <EdgeBand
          side="top"
          colors={[
            withAlpha(cyan, 0),
            withAlpha(cyan, 0.55),
            withAlpha(teal, 0.35),
            withAlpha(cyan, 0),
          ]}
          thick={58}
        />
        <EdgeBand
          side="bottom"
          colors={[
            withAlpha(amber, 0),
            withAlpha(amber, 0.65),
            withAlpha(rose, 0.4),
            withAlpha(amber, 0),
          ]}
          thick={66}
        />
        <EdgeBand
          side="left"
          colors={[
            withAlpha(rose, 0),
            withAlpha(rose, 0.5),
            withAlpha(teal, 0.25),
            withAlpha(rose, 0),
          ]}
          thick={42}
        />
        <EdgeBand
          side="right"
          colors={[
            withAlpha(teal, 0),
            withAlpha(teal, 0.55),
            withAlpha(cyan, 0.35),
            withAlpha(teal, 0),
          ]}
          thick={42}
        />
      </Animated.View>

      <View style={StyleSheet.absoluteFill}>
        <EdgeBand
          side="top"
          colors={[
            withAlpha(cyan, 0),
            withAlpha(cyan, 0.95),
            withAlpha(teal, 0.7),
            withAlpha(cyan, 0),
          ]}
          thick={2.5}
          sharp
        />
        <EdgeBand
          side="bottom"
          colors={[
            withAlpha(amber, 0),
            withAlpha(amber, 0.95),
            withAlpha(rose, 0.7),
            withAlpha(amber, 0),
          ]}
          thick={2.5}
          sharp
        />
        <EdgeBand
          side="left"
          colors={[
            withAlpha(rose, 0),
            withAlpha(rose, 0.9),
            withAlpha(teal, 0.55),
            withAlpha(rose, 0),
          ]}
          thick={2}
          sharp
        />
        <EdgeBand
          side="right"
          colors={[
            withAlpha(teal, 0),
            withAlpha(teal, 0.95),
            withAlpha(cyan, 0.7),
            withAlpha(teal, 0),
          ]}
          thick={2}
          sharp
        />
      </View>

      <CornerBloom color={cyan} style={styles.cornerTL} />
      <CornerBloom color={teal} style={styles.cornerTR} />
      <CornerBloom color={rose} style={styles.cornerBL} />
      <CornerBloom color={amber} style={styles.cornerBR} />
    </Animated.View>
  )
}

function EdgeBand({
  side,
  colors,
  thick,
  sharp = false,
}: {
  side: 'top' | 'bottom' | 'left' | 'right'
  colors: string[]
  thick: number
  sharp?: boolean
}) {
  const horizontal = side === 'top' || side === 'bottom'
  return (
    <LinearGradient
      colors={colors as [string, string, ...string[]]}
      locations={horizontal ? [0, 0.28, 0.72, 1] : [0, 0.3, 0.7, 1]}
      start={
        horizontal
          ? {x: 0, y: side === 'top' ? 0 : 1}
          : {x: side === 'left' ? 0 : 1, y: 0}
      }
      end={
        horizontal
          ? {x: 1, y: side === 'top' ? 1 : 0}
          : {x: side === 'left' ? 1 : 0, y: 1}
      }
      style={[
        styles.band,
        horizontal
          ? {
              height: thick,
              left: sharp ? 20 : 0,
              right: sharp ? 20 : 0,
              ...(side === 'top' ? {top: sharp ? 1 : 0} : {bottom: sharp ? 1 : 0}),
            }
          : {
              width: thick,
              top: sharp ? 24 : 0,
              bottom: sharp ? 24 : 0,
              ...(side === 'left'
                ? {left: sharp ? 1 : 0}
                : {right: sharp ? 1 : 0}),
            },
        sharp ? styles.bandSharp : null,
      ]}
    />
  )
}

function CornerBloom({color, style}: {color: string; style: object}) {
  return (
    <LinearGradient
      colors={[withAlpha(color, 0.4), withAlpha(color, 0.12), 'transparent']}
      style={[styles.corner, style]}
    />
  )
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
  },
  bandSharp: {
    opacity: 0.9,
  },
  corner: {
    borderRadius: 80,
    height: 100,
    position: 'absolute',
    width: 100,
  },
  cornerBL: {
    bottom: -24,
    left: -24,
  },
  cornerBR: {
    bottom: -24,
    right: -24,
  },
  cornerTL: {
    left: -24,
    top: -24,
  },
  cornerTR: {
    right: -24,
    top: -24,
  },
  host: {
    zIndex: 11,
  },
})
