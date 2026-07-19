import {StyleSheet} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated'

import {selectionHaptic} from '@/lib/haptics'
import {useReduceMotion} from '@/lib/accessibility'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
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

type Props = {
  scrollY: SharedValue<number>
  /** Height of ListHeader content above this sticky row. */
  stickAtY: SharedValue<number>
  mode: HomeFeedModeLabel
  modeOrder: HomeFeedModeLabel[]
  quietFeed: boolean
  onModeChange: (mode: HomeFeedModeLabel) => void
}

/**
 * Home feed mode tabs — FlatList sticky header item.
 * Plain labels (no capsule track). Shrinks as it approaches the stick line.
 */
export function HomeFeedModeTabs({
  scrollY,
  stickAtY,
  mode,
  modeOrder,
  quietFeed,
  onModeChange,
}: Props) {
  const {colours, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()

  const progress = useDerivedValue(() =>
    approachProgress(scrollY.value, stickAtY.value),
  )

  const morphStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {transform: [{scale: 1}]}
    return {
      transform: [
        {
          scale: interpolate(
            progress.value,
            [0, 1],
            [1, COMPACT_SCALE],
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
      style={[
        styles.row,
        {
          backgroundColor: colours.canvas,
          paddingHorizontal: spacing[4],
          paddingTop: spacing[1],
          paddingBottom: spacing[1],
        },
        morphStyle,
      ]}>
      <ModulaSegmentedPicker
        appearance="plain"
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
  )
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    width: '100%',
  },
})
