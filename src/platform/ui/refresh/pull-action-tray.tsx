import Ionicons from '@expo/vector-icons/Ionicons'
import type {ComponentProps, ReactNode} from 'react'
import {useEffect} from 'react'
import {StyleSheet, View} from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppText} from '@/components/primitives/AppText'
import {useReduceMotion} from '@/lib/accessibility'
import {
  PULL_ACTION_ARM_DISTANCE,
  type PullActionId,
} from '@/platform/ui/refresh/pull-action-types'
import type {PullActionSelection} from '@/platform/ui/refresh/use-pull-action-gesture'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type PullActionTrayProps = {
  pullDistance: SharedValue<number>
  swipeX: SharedValue<number>
  selectedIndex: SharedValue<PullActionSelection>
  armed: SharedValue<number>
  refreshing?: boolean
  children?: ReactNode
}

type IoniconName = ComponentProps<typeof Ionicons>['name']

type ActionSpec = {
  id: PullActionId
  index: PullActionSelection
  label: string
  icon: IoniconName
}

const ACTIONS: readonly ActionSpec[] = [
  {id: 'search', index: 0, label: 'Search', icon: 'search-outline'},
  {id: 'refresh', index: 1, label: 'Refresh', icon: 'refresh'},
  {id: 'close', index: 2, label: 'Close', icon: 'close'},
]

const ICON_IDLE = 20
const ICON_FOCUS = 26
const HIT = 44

/**
 * Simple pull-action chooser: search · refresh · close.
 * Focused icon grows and sharpens — no bubble / selector chrome.
 */
export function PullActionTray({
  pullDistance,
  swipeX,
  selectedIndex,
  armed,
  refreshing = false,
  children,
}: PullActionTrayProps) {
  const insets = useSafeAreaInsets()
  const {colours, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()

  const stageProgress = (distance: number) => {
    'worklet'
    const progress = interpolate(
      distance,
      [0, PULL_ACTION_ARM_DISTANCE * 0.45, PULL_ACTION_ARM_DISTANCE],
      [0, 0.55, 1],
      Extrapolation.CLAMP,
    )
    return progress * progress * (3 - 2 * progress)
  }

  const dimStyle = useAnimatedStyle(() => {
    const eased = stageProgress(pullDistance.value)
    return {
      opacity: refreshing ? Math.max(eased, 0.55) : eased * 0.62,
    }
  })

  const contentStyle = useAnimatedStyle(() => {
    const eased = stageProgress(pullDistance.value)
    if (reduceMotion) return {}
    return {
      transform: [
        {
          scale: interpolate(eased, [0, 1], [1, 0.985], Extrapolation.CLAMP),
        },
      ],
    }
  })

  const chromeStyle = useAnimatedStyle(() => {
    const eased = stageProgress(pullDistance.value)
    const boost = refreshing ? Math.max(eased, 1) : eased
    return {
      opacity: boost,
      transform: [
        {
          translateY: reduceMotion
            ? 0
            : interpolate(boost, [0, 1], [10, 0], Extrapolation.CLAMP),
        },
        {
          translateX: armed.value
            ? interpolate(
                swipeX.value,
                [-100, 0, 100],
                [-4, 0, 4],
                Extrapolation.CLAMP,
              )
            : 0,
        },
      ],
    }
  })

  return (
    <View style={styles.stage}>
      <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          dimStyle,
          styles.dim,
          {backgroundColor: colours.canvas},
        ]}
      />

      <View
        pointerEvents="none"
        style={[styles.chromeHost, {paddingTop: insets.top + spacing[4]}]}>
        <Animated.View style={[styles.chrome, chromeStyle]}>
          <View style={styles.row}>
            {ACTIONS.map(action => (
              <ActionIcon
                key={action.id}
                action={action}
                selectedIndex={selectedIndex}
                accent={colours.accent}
                muted={colours.textTertiary}
                refreshing={refreshing}
                reduceMotion={reduceMotion}
              />
            ))}
          </View>
          <SelectionLabel
            selectedIndex={selectedIndex}
            refreshing={refreshing}
            text={colours.textSecondary}
          />
        </Animated.View>
      </View>
    </View>
  )
}

function ActionIcon({
  action,
  selectedIndex,
  accent,
  muted,
  refreshing,
  reduceMotion,
}: {
  action: ActionSpec
  selectedIndex: SharedValue<PullActionSelection>
  accent: string
  muted: string
  refreshing: boolean
  reduceMotion: boolean
}) {
  const spin = useSharedValue(0)

  useEffect(() => {
    if (action.index !== 1) return
    if (refreshing && !reduceMotion) {
      spin.value = withRepeat(
        withTiming(1, {duration: 900, easing: Easing.linear}),
        -1,
        false,
      )
      return
    }
    spin.value = withTiming(0, {duration: 180})
  }, [action.index, reduceMotion, refreshing, spin])

  const slotStyle = useAnimatedStyle(() => {
    const active = refreshing ? 1 : selectedIndex.value
    const selected = action.index === active
    const scale = selected
      ? reduceMotion
        ? 1.08
        : ICON_FOCUS / ICON_IDLE
      : 0.92
    return {
      opacity: selected ? 1 : 0.28,
      transform: [{scale}],
    }
  })

  const focusedIconStyle = useAnimatedStyle(() => {
    const active = refreshing ? 1 : selectedIndex.value
    const selected = action.index === active
    return {
      opacity: selected ? 1 : 0,
      transform:
        action.index === 1 && selected && refreshing
          ? [{rotate: `${spin.value * 360}deg`}]
          : [{rotate: '0deg'}],
    }
  })

  const idleIconStyle = useAnimatedStyle(() => {
    const active = refreshing ? 1 : selectedIndex.value
    return {opacity: action.index === active ? 0 : 1}
  })

  return (
    <Animated.View style={[styles.slot, slotStyle]}>
      <Animated.View style={[styles.iconLayer, idleIconStyle]}>
        <Ionicons name={action.icon} size={ICON_IDLE} color={muted} />
      </Animated.View>
      <Animated.View style={[styles.iconLayer, focusedIconStyle]}>
        <Ionicons name={action.icon} size={ICON_FOCUS} color={accent} />
      </Animated.View>
    </Animated.View>
  )
}

function SelectionLabel({
  selectedIndex,
  refreshing,
  text,
}: {
  selectedIndex: SharedValue<PullActionSelection>
  refreshing: boolean
  text: string
}) {
  const searchStyle = useAnimatedStyle(() => ({
    opacity: !refreshing && selectedIndex.value === 0 ? 1 : 0,
  }))
  const refreshStyle = useAnimatedStyle(() => ({
    opacity: refreshing || selectedIndex.value === 1 ? 1 : 0,
  }))
  const closeStyle = useAnimatedStyle(() => ({
    opacity: !refreshing && selectedIndex.value === 2 ? 1 : 0,
  }))

  return (
    <View style={styles.labelStack}>
      <Animated.View style={[styles.labelLine, searchStyle]}>
        <AppText variant="caption" style={{color: text, textAlign: 'center'}}>
          Search
        </AppText>
      </Animated.View>
      <Animated.View style={[styles.labelLine, refreshStyle]}>
        <AppText variant="caption" style={{color: text, textAlign: 'center'}}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </AppText>
      </Animated.View>
      <Animated.View style={[styles.labelLine, closeStyle]}>
        <AppText variant="caption" style={{color: text, textAlign: 'center'}}>
          Close
        </AppText>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  chrome: {
    alignItems: 'center',
    width: '100%',
  },
  chromeHost: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 12,
  },
  content: {
    flex: 1,
  },
  dim: {
    zIndex: 10,
  },
  iconLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelLine: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelStack: {
    height: 18,
    marginTop: 8,
    width: '100%',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 36,
    height: HIT,
    justifyContent: 'center',
  },
  slot: {
    alignItems: 'center',
    height: HIT,
    justifyContent: 'center',
    width: HIT,
  },
  stage: {
    flex: 1,
  },
})
