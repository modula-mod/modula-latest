import {StyleSheet, View} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
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
}

type ActionSpec = {
  id: PullActionId
  index: PullActionSelection
  label: string
  hint: string
  icon: AppIconName
}

const ACTIONS: readonly ActionSpec[] = [
  {
    id: 'search',
    index: 0,
    label: 'Search',
    hint: 'Swipe left',
    icon: 'search',
  },
  {
    id: 'refresh',
    index: 1,
    label: 'Refresh',
    hint: 'Release',
    icon: 'reset',
  },
  {
    id: 'close',
    index: 2,
    label: 'Close',
    hint: 'Swipe right',
    icon: 'close',
  },
]

/**
 * Three-way pull chooser: Search ← · Refresh · → Close.
 * Reveals as the list is pulled past the arm distance.
 */
export function PullActionTray({
  pullDistance,
  swipeX,
  selectedIndex,
  armed,
  refreshing = false,
}: PullActionTrayProps) {
  const insets = useSafeAreaInsets()
  const {colours, radius, spacing, scheme} = useThemeTokens()

  const hostStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      pullDistance.value,
      [0, PULL_ACTION_ARM_DISTANCE * 0.45, PULL_ACTION_ARM_DISTANCE],
      [0, 0.35, 1],
      Extrapolation.CLAMP,
    )
    const boost = refreshing ? Math.max(progress, 0.9) : progress
    return {
      opacity: boost,
      transform: [
        {
          translateY: interpolate(
            boost,
            [0, 1],
            [-18, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          translateX: armed.value
            ? interpolate(
                swipeX.value,
                [-120, 0, 120],
                [-10, 0, 10],
                Extrapolation.CLAMP,
              )
            : 0,
        },
      ],
    }
  })

  return (
    <View pointerEvents="none" style={[styles.host, {paddingTop: insets.top + 6}]}>
      <Animated.View
        style={[
          styles.tray,
          {
            backgroundColor:
              scheme === 'dark' ? 'rgba(20,24,26,0.72)' : 'rgba(255,255,255,0.72)',
            borderColor: colours.border,
            borderRadius: radius.xlarge,
            gap: spacing[1],
            paddingHorizontal: spacing[2],
          },
          hostStyle,
        ]}>
        {ACTIONS.map(action => (
          <ActionChip
            key={action.id}
            action={action}
            selectedIndex={selectedIndex}
            colours={colours}
            radius={radius.large}
          />
        ))}
      </Animated.View>
      <Animated.View style={[styles.hintRow, hostStyle]}>
        <AppText variant="caption" colour="textTertiary" style={styles.hint}>
          Pull · swipe left Search · middle Refresh · swipe right Close
        </AppText>
      </Animated.View>
    </View>
  )
}

function ActionChip({
  action,
  selectedIndex,
  colours,
  radius,
}: {
  action: ActionSpec
  selectedIndex: SharedValue<PullActionSelection>
  colours: ReturnType<typeof useThemeTokens>['colours']
  radius: number
}) {
  const accent = colours.accent
  const accentSubtle = colours.accentSubtle
  const chipStyle = useAnimatedStyle(() => {
    const selected = selectedIndex.value === action.index
    return {
      backgroundColor: selected ? accentSubtle : 'transparent',
      borderColor: selected ? accent : 'transparent',
      opacity: selected ? 1 : 0.5,
      transform: [{scale: selected ? 1.05 : 0.95}],
    }
  })

  return (
    <Animated.View
      style={[
        styles.chip,
        {
          borderRadius: radius,
        },
        chipStyle,
      ]}>
      <AppIcon name={action.icon} size={18} colour={accent} />
      <AppText variant="label" style={{color: colours.text}}>
        {action.label}
      </AppText>
      <AppText variant="caption" colour="textTertiary">
        {action.hint}
      </AppText>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 2,
    minHeight: 64,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  hint: {
    textAlign: 'center',
  },
  hintRow: {
    marginTop: 8,
    paddingHorizontal: 20,
  },
  host: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 9,
  },
  tray: {
    alignItems: 'stretch',
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginHorizontal: 16,
    maxWidth: 420,
    width: '92%',
  },
})
