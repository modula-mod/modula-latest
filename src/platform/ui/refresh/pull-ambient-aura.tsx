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
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useReduceMotion} from '@/lib/accessibility'
import {PULL_ACTION_ARM_DISTANCE} from '@/platform/ui/refresh/pull-action-types'

export type PullAmbientAuraProps = {
  pullDistance: SharedValue<number>
  refreshing?: boolean
}

const BREATH = Easing.bezier(0.4, 0, 0.2, 1)

function rgba(hex: string, a: number): string {
  const c = hex.replace('#', '')
  if (c.length !== 6) return hex
  const r = Number.parseInt(c.slice(0, 2), 16)
  const g = Number.parseInt(c.slice(2, 4), 16)
  const b = Number.parseInt(c.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

/**
 * Soft atmospheric wash behind the pull orb picker — not a screen-edge rim.
 * Fixed spectrum (violet → cyan), slow breathing only.
 */
export function PullAmbientAura({
  pullDistance,
  refreshing = false,
}: PullAmbientAuraProps) {
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  const breath = useSharedValue(0.5)

  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0.6
      return
    }
    breath.value = withRepeat(
      withTiming(1, {duration: refreshing ? 3000 : 4800, easing: BREATH}),
      -1,
      true,
    )
  }, [breath, reduceMotion, refreshing])

  const intensity = useDerivedValue(() => {
    const raw = interpolate(
      pullDistance.value,
      [0, PULL_ACTION_ARM_DISTANCE * 0.35, PULL_ACTION_ARM_DISTANCE],
      [0, 0.55, 1],
      Extrapolation.CLAMP,
    )
    const eased = raw * raw * (3 - 2 * raw)
    return refreshing ? Math.max(eased, 0.88) : eased
  })

  const hostStyle = useAnimatedStyle(() => {
    const pulse = reduceMotion
      ? 1
      : interpolate(breath.value, [0, 1], [0.9, 1])
    return {
      opacity: intensity.value * pulse,
      transform: [
        {
          scale: reduceMotion
            ? 1
            : interpolate(breath.value, [0, 1], [0.97, 1.04]),
        },
      ],
    }
  })

  const cyan = '#5CE1FF'
  const violet = '#B8A4FF'
  const teal = '#369CAA'

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.host, {paddingTop: insets.top}, hostStyle]}>
      <View style={styles.bloom}>
        <LinearGradient
          colors={[
            rgba(violet, 0.5),
            rgba(cyan, 0.32),
            rgba(teal, 0.14),
            'transparent',
          ]}
          locations={[0, 0.28, 0.58, 1]}
          start={{x: 0.5, y: 0}}
          end={{x: 0.5, y: 1}}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.coreHalo}>
          <LinearGradient
            colors={[
              rgba(cyan, 0.38),
              rgba(violet, 0.2),
              'transparent',
            ]}
            style={styles.coreHaloFill}
          />
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bloom: {
    alignSelf: 'center',
    height: 260,
    overflow: 'hidden',
    width: '130%',
  },
  coreHalo: {
    alignItems: 'center',
    height: 180,
    justifyContent: 'flex-start',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 36,
  },
  coreHaloFill: {
    borderRadius: 999,
    height: 160,
    width: 160,
  },
  host: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 11,
  },
})
