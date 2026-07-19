import {useEffect} from 'react'
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
} as const

/**
 * Elegant perimeter “lightning screen” glow.
 * Continuous rounded rim + soft bloom; spectrum is fixed (not accent-linked).
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

  useEffect(() => {
    if (reduceMotion) {
      phase.value = 0
      return
    }
    phase.value = withRepeat(
      withTiming(1, {
        duration: refreshing ? 1600 : 2600,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
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
      : interpolate(phase.value, [0, 1], [0.72, 1])
    return {
      opacity: intensity.value * pulse,
      transform: [
        {
          scale: reduceMotion
            ? 1
            : interpolate(phase.value, [0, 1], [0.995, 1.004]),
        },
      ],
    }
  })

  const rimStyle = useAnimatedStyle(() => {
    const pulse = reduceMotion
      ? 1
      : interpolate(phase.value, [0, 1], [0.85, 1])
    return {opacity: intensity.value * pulse}
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.host, hostStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, bloomStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <SvgLinearGradient id="lightningBloom" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={SPECTRUM.cyan} stopOpacity={0.7} />
              <Stop offset="22%" stopColor={SPECTRUM.blue} stopOpacity={0.55} />
              <Stop offset="45%" stopColor={SPECTRUM.magenta} stopOpacity={0.65} />
              <Stop offset="68%" stopColor={SPECTRUM.amber} stopOpacity={0.7} />
              <Stop offset="88%" stopColor={SPECTRUM.violet} stopOpacity={0.55} />
              <Stop offset="100%" stopColor={SPECTRUM.cyan} stopOpacity={0.7} />
            </SvgLinearGradient>
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
            strokeWidth={34}
            strokeOpacity={0.28}
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
            strokeOpacity={0.5}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, rimStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <SvgLinearGradient id="lightningRim" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={SPECTRUM.cyan} />
              <Stop offset="20%" stopColor={SPECTRUM.blue} />
              <Stop offset="42%" stopColor={SPECTRUM.magenta} />
              <Stop offset="64%" stopColor={SPECTRUM.amber} />
              <Stop offset="82%" stopColor={SPECTRUM.violet} />
              <Stop offset="100%" stopColor={SPECTRUM.cyan} />
            </SvgLinearGradient>
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
            strokeWidth={refreshing ? 3.25 : 2.25}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  host: {
    zIndex: 11,
  },
})
