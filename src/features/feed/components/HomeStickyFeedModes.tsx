import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import {selectionHaptic} from '@/lib/haptics'
import {useReduceMotion} from '@/lib/accessibility'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {useSecondaryChromeSpacerHeight} from '@/platform/ui/navigation/chrome-insets'
import {useShellChromeObscureStyle} from '@/platform/ui/navigation/use-shell-chrome-obscure-style'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type HomeFeedModeLabel = 'Following' | 'For You' | 'Modules'

const MORPH_DISTANCE = 48
const COMPACT_SCALE = 0.94
/** Unstick slightly before the stick line so snap-back doesn’t chatter. */
const UNSTICK_SLOP = 18

const ENTER_SPRING = {damping: 22, stiffness: 280, mass: 0.82}
const SNAP_BACK_SPRING = {damping: 20, stiffness: 320, mass: 0.75}
const EXIT_TIMING = {duration: 140, easing: Easing.out(Easing.cubic)}

function stickThreshold(stickAtY: number): number {
  'worklet'
  return Math.max(0, stickAtY)
}

function approachProgress(scrollY: number, stickAtY: number): number {
  'worklet'
  const start = stickThreshold(stickAtY)
  if (start <= 0) {
    return interpolate(
      scrollY,
      [0, MORPH_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    )
  }
  const from = Math.max(0, start - MORPH_DISTANCE)
  return interpolate(scrollY, [from, start], [0, 1], Extrapolation.CLAMP)
}

type Props = {
  scrollY: SharedValue<number>
  stickAtY: SharedValue<number>
  mode: HomeFeedModeLabel
  modeOrder: HomeFeedModeLabel[]
  quietFeed: boolean
  onModeChange: (mode: HomeFeedModeLabel) => void
}

/**
 * Sticky clone of the feed mode picker — spring enter, quick snap-back.
 * Stories / composer stay in the list header and scroll away normally.
 */
export function HomeStickyFeedModes({
  scrollY,
  stickAtY,
  mode,
  modeOrder,
  quietFeed,
  onModeChange,
}: Props) {
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const headerOffset = useSecondaryChromeSpacerHeight()
  const obscureStyle = useShellChromeObscureStyle('up')
  const [interactive, setInteractive] = useState(false)
  const isDark = scheme === 'dark'

  /** 0 = free / inline, 1 = stuck under nav. Spring-smoothed. */
  const handoff = useSharedValue(0)
  const latched = useSharedValue(0)

  useAnimatedReaction(
    () => {
      const start = stickThreshold(stickAtY.value)
      const y = scrollY.value
      // Hysteresis: stick at `start`, unstick at `start - slop`.
      if (latched.value === 1) {
        return y >= start - UNSTICK_SLOP ? 1 : 0
      }
      return y >= start ? 1 : 0
    },
    (next, prev) => {
      if (next === prev) return
      latched.value = next
      if (reduceMotion) {
        handoff.value = next
      } else if (next === 1) {
        handoff.value = withSpring(1, ENTER_SPRING)
      } else {
        // Snap-back: dismiss sticky quickly so it doesn’t ghost over Stories.
        handoff.value = withTiming(0, EXIT_TIMING)
      }
      runOnJS(setInteractive)(next === 1)
    },
    [reduceMotion],
  )

  const shellStyle = useAnimatedStyle(() => {
    const p = handoff.value
    return {
      opacity: p,
      transform: reduceMotion
        ? []
        : [
            {translateY: interpolate(p, [0, 1], [-14, 0], Extrapolation.CLAMP)},
            {
              scale: interpolate(
                p,
                [0, 1],
                [1.05, COMPACT_SCALE],
                Extrapolation.CLAMP,
              ),
            },
          ],
    }
  })

  const options = modeOrder.map(next => ({
    value: next,
    label: quietFeed && next === 'For You' ? 'For You · Quiet' : next,
  }))

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.fill, obscureStyle]}>
      <Animated.View
        pointerEvents={interactive ? 'auto' : 'none'}
        style={[
          styles.shell,
          {
            top: headerOffset,
            paddingHorizontal: spacing[4],
            paddingTop: 4,
            paddingBottom: 4,
          },
          shellStyle,
        ]}>
        <View
          style={[
            styles.stickyTrack,
            {
              borderRadius: radius.round,
              backgroundColor: isDark
                ? 'rgba(18, 24, 28, 0.88)'
                : colours.surfaceMuted,
              borderColor: colours.border,
            },
          ]}>
          <ModulaSegmentedPicker
            appearance="segmented"
            accessibilityLabel="Feed mode"
            options={options}
            value={mode}
            onValueChange={next => {
              if (
                next === 'Following' ||
                next === 'For You' ||
                next === 'Modules'
              ) {
                void selectionHaptic()
                onModeChange(next)
              }
            }}
          />
        </View>
      </Animated.View>
    </Animated.View>
  )
}

/**
 * Inline row — scroll-linked shrink on approach; hard-hide while sticky;
 * spring settle on snap-back.
 */
export function useInlineModeTabsStyle(
  scrollY: SharedValue<number>,
  stickAtY: SharedValue<number>,
  reduceMotion: boolean,
) {
  const visible = useSharedValue(1)
  const settleScale = useSharedValue(1)
  const latched = useSharedValue(0)

  useAnimatedReaction(
    () => {
      const start = stickThreshold(stickAtY.value)
      const y = scrollY.value
      if (latched.value === 1) {
        return y >= start - UNSTICK_SLOP ? 1 : 0
      }
      return y >= start ? 1 : 0
    },
    (next, prev) => {
      if (next === prev) return
      latched.value = next
      if (next === 1) {
        // Stick: hide inline immediately (sticky clone takes over).
        visible.value = 0
      } else if (reduceMotion) {
        visible.value = 1
        settleScale.value = 1
      } else {
        // Snap-back: show inline at compact, spring open.
        visible.value = 1
        settleScale.value = COMPACT_SCALE
        settleScale.value = withSpring(1, SNAP_BACK_SPRING)
      }
    },
    [reduceMotion],
  )

  return useAnimatedStyle(() => {
    if (reduceMotion) {
      return {opacity: visible.value, transform: [{scale: 1}]}
    }
    const approach = approachProgress(scrollY.value, stickAtY.value)
    const scrollScale = interpolate(
      approach,
      [0, 1],
      [1, COMPACT_SCALE],
      Extrapolation.CLAMP,
    )
    // Mid snap-back spring takes priority; otherwise follow scroll-linked shrink.
    const liveScale =
      latched.value === 0 && settleScale.value < 0.999
        ? settleScale.value
        : scrollScale

    return {
      opacity: visible.value,
      transform: [{scale: liveScale}],
    }
  })
}

export function useInlineModeTabsInteractive(
  scrollY: SharedValue<number>,
  stickAtY: SharedValue<number>,
) {
  const [interactive, setInteractive] = useState(true)
  const latched = useSharedValue(0)

  useAnimatedReaction(
    () => {
      const start = stickThreshold(stickAtY.value)
      const y = scrollY.value
      if (latched.value === 1) {
        return y >= start - UNSTICK_SLOP ? 1 : 0
      }
      return y >= start ? 1 : 0
    },
    (next, prev) => {
      if (next === prev) return
      latched.value = next
      runOnJS(setInteractive)(next === 0)
    },
    [],
  )

  return interactive
}

const styles = StyleSheet.create({
  fill: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 30,
  },
  shell: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  stickyTrack: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: 2,
  },
})
