import {useState} from 'react'
import {Platform, StyleSheet, View} from 'react-native'
import {BlurView} from 'expo-blur'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated'

import {selectionHaptic} from '@/lib/haptics'
import {useReduceMotion} from '@/lib/accessibility'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {useSecondaryChromeSpacerHeight} from '@/platform/ui/navigation/chrome-insets'
import {useShellChromeObscureStyle} from '@/platform/ui/navigation/use-shell-chrome-obscure-style'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type HomeFeedModeLabel = 'Following' | 'For You' | 'Modules'

const MORPH_DISTANCE = 36

/** 0 → inline / expanded, 1 → stuck / compact. */
export function stickProgress(scrollY: number, stickAtY: number): number {
  'worklet'
  const start = Math.max(0, stickAtY)
  if (start <= 0) {
    // Modes already at the top of the header — morph as soon as we scroll.
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
  /** Header-local Y of the inline mode tabs (scroll offset when they hit the stick line). */
  stickAtY: SharedValue<number>
  mode: HomeFeedModeLabel
  modeOrder: HomeFeedModeLabel[]
  quietFeed: boolean
  onModeChange: (mode: HomeFeedModeLabel) => void
}

/**
 * Sticky clone of the home feed mode picker, pinned just under the nav row.
 * Must fill the screen with `pointerEvents="box-none"` so absolute children
 * aren't parented to a zero-height flex sibling under the list.
 */
export function HomeStickyFeedModes({
  scrollY,
  stickAtY,
  mode,
  modeOrder,
  quietFeed,
  onModeChange,
}: Props) {
  const {colours, spacing, scheme} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const headerOffset = useSecondaryChromeSpacerHeight()
  const obscureStyle = useShellChromeObscureStyle('up')
  const [interactive, setInteractive] = useState(false)

  const progress = useDerivedValue(() =>
    stickProgress(scrollY.value, stickAtY.value),
  )

  useAnimatedReaction(
    () => progress.value > 0.55,
    (stuck, previous) => {
      if (stuck !== previous) {
        runOnJS(setInteractive)(stuck)
      }
    },
    [],
  )

  const shellStyle = useAnimatedStyle(() => {
    const p = progress.value
    return {
      opacity: p,
      transform: reduceMotion
        ? [{translateY: 0}]
        : [
            {translateY: interpolate(p, [0, 1], [-10, 0])},
            {scale: interpolate(p, [0, 1], [1.05, 1])},
          ],
    }
  })

  const padStyle = useAnimatedStyle(() => {
    const p = progress.value
    return {
      paddingTop: interpolate(p, [0, 1], [spacing[1], 4]),
      paddingBottom: interpolate(p, [0, 1], [spacing[2], 5]),
    }
  })

  const pickerStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {transform: [{scale: 1}]}
    const p = progress.value
    return {
      transform: [{scale: interpolate(p, [0, 1], [1, 0.92])}],
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
        style={[styles.shell, {top: headerOffset}, shellStyle]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={scheme === 'dark' ? 48 : 64}
            tint={scheme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {backgroundColor: colours.canvas, opacity: 0.96},
            ]}
          />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colours.canvas,
              opacity: scheme === 'dark' ? 0.4 : 0.58,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.row,
            {
              borderBottomColor: colours.border,
              paddingHorizontal: spacing[4],
            },
            padStyle,
          ]}>
          <Animated.View style={pickerStyle}>
            <ModulaSegmentedPicker
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
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  )
}

/** Fades the inline mode row out as the sticky clone takes over. */
export function useInlineModeTabsStyle(
  scrollY: SharedValue<number>,
  stickAtY: SharedValue<number>,
) {
  return useAnimatedStyle(() => ({
    opacity: 1 - stickProgress(scrollY.value, stickAtY.value),
  }))
}

/** True while the inline picker should still receive taps. */
export function useInlineModeTabsInteractive(
  scrollY: SharedValue<number>,
  stickAtY: SharedValue<number>,
) {
  const [interactive, setInteractive] = useState(true)

  useAnimatedReaction(
    () => stickProgress(scrollY.value, stickAtY.value) < 0.55,
    (next, previous) => {
      if (next !== previous) {
        runOnJS(setInteractive)(next)
      }
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
  row: {
    alignSelf: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  shell: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },
})
