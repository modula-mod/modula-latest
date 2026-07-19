import {useState} from 'react'
import {StyleSheet} from 'react-native'
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

const MORPH_DISTANCE = 40
const COMPACT_SCALE = 0.94

export function approachProgress(scrollY: number, stickAtY: number): number {
  'worklet'
  const start = Math.max(0, stickAtY)
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

/** Hard stick latch — avoids dual-picker ghosting on scroll-up. */
export function isStuck(scrollY: number, stickAtY: number): boolean {
  'worklet'
  return scrollY >= Math.max(0, stickAtY)
}

type Props = {
  scrollY: SharedValue<number>
  /** Height of header content above the inline mode tabs. */
  stickAtY: SharedValue<number>
  mode: HomeFeedModeLabel
  modeOrder: HomeFeedModeLabel[]
  quietFeed: boolean
  onModeChange: (mode: HomeFeedModeLabel) => void
}

/**
 * Sticky clone of the feed mode picker (gray capsule), pinned under the nav.
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
  const {spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const headerOffset = useSecondaryChromeSpacerHeight()
  const obscureStyle = useShellChromeObscureStyle('up')
  const [interactive, setInteractive] = useState(false)

  const stuck = useDerivedValue(() => isStuck(scrollY.value, stickAtY.value))

  useAnimatedReaction(
    () => stuck.value,
    (next, previous) => {
      if (next !== previous) {
        runOnJS(setInteractive)(next)
      }
    },
    [],
  )

  const shellStyle = useAnimatedStyle(() => {
    const on = stuck.value
    return {
      opacity: on ? 1 : 0,
      transform: reduceMotion ? [] : [{scale: on ? COMPACT_SCALE : 1}],
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
      </Animated.View>
    </Animated.View>
  )
}

/** Inline row: hide when stuck; shrink as it approaches the stick line. */
export function useInlineModeTabsStyle(
  scrollY: SharedValue<number>,
  stickAtY: SharedValue<number>,
  reduceMotion: boolean,
) {
  return useAnimatedStyle(() => {
    const stuck = isStuck(scrollY.value, stickAtY.value)
    const approach = approachProgress(scrollY.value, stickAtY.value)
    return {
      opacity: stuck ? 0 : 1,
      transform: reduceMotion
        ? []
        : [
            {
              scale: interpolate(
                approach,
                [0, 1],
                [1, COMPACT_SCALE],
                Extrapolation.CLAMP,
              ),
            },
          ],
    }
  })
}

export function useInlineModeTabsInteractive(
  scrollY: SharedValue<number>,
  stickAtY: SharedValue<number>,
) {
  const [interactive, setInteractive] = useState(true)

  useAnimatedReaction(
    () => !isStuck(scrollY.value, stickAtY.value),
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
  shell: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
})
