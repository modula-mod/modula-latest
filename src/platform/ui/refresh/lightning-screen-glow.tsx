import {useEffect, useMemo} from 'react'
import {StyleSheet, useWindowDimensions, View} from 'react-native'
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import {useReduceMotion} from '@/lib/accessibility'
import {PULL_ACTION_ARM_DISTANCE} from '@/platform/ui/refresh/pull-action-types'

export type LightningScreenGlowProps = {
  pullDistance: SharedValue<number>
  refreshing?: boolean
}

/** Fixed lightning spectrum — never tied to product accent. */
const SPECTRUM = {
  blue: '#4DA3FF',
  cyan: '#5CE1FF',
  magenta: '#FF4D9A',
  violet: '#B794F6',
  amber: '#FFB020',
  white: '#FFFFFF',
} as const

const AnimatedGradient = Animated.createAnimatedComponent(SvgLinearGradient)
const AnimatedRect = Animated.createAnimatedComponent(Rect)

/**
 * Elegant perimeter “lightning screen” glow.
 * Spectrum rotates around the rim; a bright dash races the edge.
 */
export function LightningScreenGlow({
  pullDistance,
  refreshing = false,
}: LightningScreenGlowProps) {
  const {width, height} = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const phase = useSharedValue(0)
  const inset = 2.5
  const radius = 42
  const rimW = Math.max(1, width - inset * 2)
  const rimH = Math.max(1, height - inset * 2)
  // Approximate rounded-rect path length for dash chase.
  const perimeter = useMemo(() => {
    const straight = 2 * (rimW + rimH - 4 * radius)
    const arcs = 2 * Math.PI * radius
    return Math.max(400, straight + arcs)
  }, [radius, rimH, rimW])

  useEffect(() => {
    if (reduceMotion) {
      phase.value = 0
      return
    }
    phase.value = 0
    phase.value = withRepeat(
      withTiming(1, {
        duration: refreshing ? 1400 : 2400,
        easing: Easing.linear,
      }),
      -1,
      false,
    )
  }, [phase, reduceMotion, refreshing])

  const intensity = useDerivedValue(() => {
    const fromPull = interpolate(
      pullDistance.value,
      [0, PULL_ACTION_ARM_DISTANCE * 0.22, PULL_ACTION_ARM_DISTANCE],
      [0, 0.7, 1],
      Extrapolation.CLAMP,
    )
    return refreshing ? Math.max(fromPull, 0.9) : fromPull
  })

  const hostStyle = useAnimatedStyle(() => ({
    opacity: intensity.value,
  }))

  const bloomStyle = useAnimatedStyle(() => {
    const pulse = reduceMotion
      ? 1
      : interpolate(phase.value, [0, 0.5, 1], [0.78, 1, 0.78])
    return {opacity: intensity.value * pulse}
  })

  // Sweep gradient angle around the frame (spectrum chase).
  const gradientProps = useAnimatedProps(() => {
    const angle = phase.value * Math.PI * 2
    const x1 = 50 + Math.cos(angle) * 50
    const y1 = 50 + Math.sin(angle) * 50
    const x2 = 50 + Math.cos(angle + Math.PI) * 50
    const y2 = 50 + Math.sin(angle + Math.PI) * 50
    return {
      x1: `${x1}%`,
      y1: `${y1}%`,
      x2: `${x2}%`,
      y2: `${y2}%`,
    }
  })

  // Bright bolt racing along the perimeter.
  const boltProps = useAnimatedProps(() => {
    const dash = perimeter * (refreshing ? 0.12 : 0.08)
    const gap = Math.max(1, perimeter - dash)
    return {
      strokeDasharray: `${dash} ${gap}`,
      strokeDashoffset: -phase.value * perimeter,
      strokeOpacity: intensity.value * (refreshing ? 1 : 0.9),
    }
  })

  // Secondary chase bolt, offset half a lap.
  const boltSecondaryProps = useAnimatedProps(() => {
    const dash = perimeter * 0.05
    const gap = Math.max(1, perimeter - dash)
    return {
      strokeDasharray: `${dash} ${gap}`,
      strokeDashoffset: -(phase.value + 0.5) * perimeter,
      strokeOpacity: intensity.value * 0.75,
    }
  })

  const rimWidth = refreshing ? 3.5 : 2.5

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.host, hostStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, bloomStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <AnimatedGradient
              id="lightningBloom"
              animatedProps={gradientProps}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%">
              <Stop offset="0%" stopColor={SPECTRUM.cyan} stopOpacity={0.75} />
              <Stop offset="20%" stopColor={SPECTRUM.blue} stopOpacity={0.55} />
              <Stop offset="40%" stopColor={SPECTRUM.magenta} stopOpacity={0.7} />
              <Stop offset="60%" stopColor={SPECTRUM.amber} stopOpacity={0.75} />
              <Stop offset="80%" stopColor={SPECTRUM.violet} stopOpacity={0.55} />
              <Stop offset="100%" stopColor={SPECTRUM.cyan} stopOpacity={0.75} />
            </AnimatedGradient>
          </Defs>
          <Rect
            x={inset}
            y={inset}
            width={rimW}
            height={rimH}
            rx={radius}
            ry={radius}
            fill="none"
            stroke="url(#lightningBloom)"
            strokeWidth={36}
            strokeOpacity={0.26}
          />
          <Rect
            x={inset}
            y={inset}
            width={rimW}
            height={rimH}
            rx={radius}
            ry={radius}
            fill="none"
            stroke="url(#lightningBloom)"
            strokeWidth={16}
            strokeOpacity={0.48}
          />
        </Svg>
      </Animated.View>

      <View style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height}>
          <Defs>
            <AnimatedGradient
              id="lightningRim"
              animatedProps={gradientProps}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%">
              <Stop offset="0%" stopColor={SPECTRUM.cyan} />
              <Stop offset="20%" stopColor={SPECTRUM.blue} />
              <Stop offset="40%" stopColor={SPECTRUM.magenta} />
              <Stop offset="60%" stopColor={SPECTRUM.amber} />
              <Stop offset="80%" stopColor={SPECTRUM.violet} />
              <Stop offset="100%" stopColor={SPECTRUM.cyan} />
            </AnimatedGradient>
          </Defs>
          <Rect
            x={inset}
            y={inset}
            width={rimW}
            height={rimH}
            rx={radius}
            ry={radius}
            fill="none"
            stroke="url(#lightningRim)"
            strokeWidth={rimWidth}
            strokeOpacity={0.85}
          />
          {/* Hot bolt */}
          <AnimatedRect
            animatedProps={boltProps}
            x={inset}
            y={inset}
            width={rimW}
            height={rimH}
            rx={radius}
            ry={radius}
            fill="none"
            stroke={SPECTRUM.white}
            strokeWidth={rimWidth + 1.25}
            strokeLinecap="round"
          />
          {/* Magenta chase bolt */}
          <AnimatedRect
            animatedProps={boltSecondaryProps}
            x={inset}
            y={inset}
            width={rimW}
            height={rimH}
            rx={radius}
            ry={radius}
            fill="none"
            stroke={SPECTRUM.magenta}
            strokeWidth={rimWidth + 0.5}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  host: {
    zIndex: 11,
  },
})
