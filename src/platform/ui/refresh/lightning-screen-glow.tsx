import {useEffect} from 'react'
import {StyleSheet, useWindowDimensions} from 'react-native'
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
 * Elegant perimeter glow — soft bloom that breathes.
 * Spectrum stays put; only intensity pulses (no rotating rainbow).
 */
export function LightningScreenGlow({
  pullDistance,
  refreshing = false,
}: LightningScreenGlowProps) {
  const {width, height} = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const breath = useSharedValue(0)
  const inset = 2.5
  const radius = 42
  const rimW = Math.max(1, width - inset * 2)
  const rimH = Math.max(1, height - inset * 2)

  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0.55
      return
    }
    breath.value = withRepeat(
      withTiming(1, {
        duration: refreshing ? 1100 : 1800,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    )
  }, [breath, reduceMotion, refreshing])

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

  const outerBloomStyle = useAnimatedStyle(() => {
    const pulse = reduceMotion
      ? 0.7
      : interpolate(breath.value, [0, 1], [0.45, 0.85])
    return {
      opacity: intensity.value * pulse,
    }
  })

  const midBloomStyle = useAnimatedStyle(() => {
    const pulse = reduceMotion
      ? 0.8
      : interpolate(breath.value, [0, 1], [0.65, 1])
    return {
      opacity: intensity.value * pulse,
    }
  })

  const rimStyle = useAnimatedStyle(() => {
    const pulse = reduceMotion
      ? 0.9
      : interpolate(breath.value, [0, 1], [0.72, 1])
    return {
      opacity: intensity.value * pulse,
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.host, hostStyle]}>
      {/* Wide soft bloom */}
      <Animated.View style={[StyleSheet.absoluteFill, outerBloomStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <SvgLinearGradient id="lightningBloomOuter" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={SPECTRUM.cyan} stopOpacity={0.55} />
              <Stop offset="25%" stopColor={SPECTRUM.blue} stopOpacity={0.4} />
              <Stop offset="50%" stopColor={SPECTRUM.magenta} stopOpacity={0.5} />
              <Stop offset="75%" stopColor={SPECTRUM.amber} stopOpacity={0.55} />
              <Stop offset="100%" stopColor={SPECTRUM.violet} stopOpacity={0.4} />
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
            stroke="url(#lightningBloomOuter)"
            strokeWidth={42}
            strokeOpacity={0.35}
          />
        </Svg>
      </Animated.View>

      {/* Mid bloom */}
      <Animated.View style={[StyleSheet.absoluteFill, midBloomStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <SvgLinearGradient id="lightningBloomMid" x1="100%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={SPECTRUM.amber} stopOpacity={0.6} />
              <Stop offset="30%" stopColor={SPECTRUM.magenta} stopOpacity={0.55} />
              <Stop offset="60%" stopColor={SPECTRUM.cyan} stopOpacity={0.6} />
              <Stop offset="100%" stopColor={SPECTRUM.blue} stopOpacity={0.5} />
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
            stroke="url(#lightningBloomMid)"
            strokeWidth={18}
            strokeOpacity={0.55}
          />
        </Svg>
      </Animated.View>

      {/* Crisp inner rim — stationary spectrum, breathing opacity */}
      <Animated.View style={[StyleSheet.absoluteFill, rimStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <SvgLinearGradient id="lightningRim" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={SPECTRUM.cyan} />
              <Stop offset="22%" stopColor={SPECTRUM.blue} />
              <Stop offset="45%" stopColor={SPECTRUM.magenta} />
              <Stop offset="68%" stopColor={SPECTRUM.amber} />
              <Stop offset="88%" stopColor={SPECTRUM.violet} />
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
            strokeWidth={refreshing ? 3 : 2.25}
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
