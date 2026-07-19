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
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
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
 * Sticky clone — real segmented track inside a hugging, dense liquid-glass capsule.
 * Opaque underlay (sibling under glass) blocks feed bleed without killing the glass.
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

  const handoff = useSharedValue(0)
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
      if (reduceMotion) {
        handoff.value = next
      } else if (next === 1) {
        handoff.value = withSpring(1, ENTER_SPRING)
      } else {
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

  const underlay = isDark ? 'rgba(14, 18, 20, 0.97)' : colours.canvas

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.fill, obscureStyle]}>
      <Animated.View
        pointerEvents={interactive ? 'box-none' : 'none'}
        style={[
          styles.shell,
          {
            top: headerOffset,
            paddingHorizontal: spacing[4],
          },
          shellStyle,
        ]}>
        <View
          style={[
            styles.capsule,
            {
              borderRadius: radius.round,
              borderColor: isDark
                ? 'rgba(255,255,255,0.16)'
                : colours.border,
            },
          ]}>
          {/* Sibling under glass — blocks feed text; glass stays translucent on top. */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {backgroundColor: underlay, borderRadius: radius.round},
            ]}
          />
          <LiquidGlassChrome
            interactive
            fallback="regular"
            contentLayout="flow"
            blurIntensity={100}
            style={[styles.stickyGlass, {borderRadius: radius.round}]}>
            <ModulaSegmentedPicker
              appearance="track"
              embedded
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
          </LiquidGlassChrome>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

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
        visible.value = 0
      } else if (reduceMotion) {
        visible.value = 1
        settleScale.value = 1
      } else {
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
  capsule: {
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    // Hug the segmented control — not a full-bleed bar.
    maxWidth: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  fill: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 40,
  },
  shell: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  stickyGlass: {
    alignSelf: 'center',
  },
})
