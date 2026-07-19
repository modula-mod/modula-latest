import Ionicons from '@expo/vector-icons/Ionicons'
import type {ComponentProps, ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'
import {BlurView} from 'expo-blur'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
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
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'

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
  hint: string
  icon: IoniconName
  iconSelected: IoniconName
}

const ACTIONS: readonly ActionSpec[] = [
  {
    id: 'search',
    index: 0,
    label: 'Search',
    hint: 'Swipe left',
    icon: 'search-outline',
    iconSelected: 'search',
  },
  {
    id: 'refresh',
    index: 1,
    label: 'Refresh',
    hint: 'Release to sync',
    icon: 'refresh-outline',
    iconSelected: 'refresh',
  },
  {
    id: 'close',
    index: 2,
    label: 'Close',
    hint: 'Swipe right',
    icon: 'close-outline',
    iconSelected: 'close',
  },
]

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)

/**
 * Pull stage: soft-blurs the feed, floats three icon actions, and follows
 * the horizontal swipe for Search ← · Refresh · → Close.
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
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const {reduceTransparency} = useSystemAccessibility()

  const progressStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      pullDistance.value,
      [0, PULL_ACTION_ARM_DISTANCE * 0.35, PULL_ACTION_ARM_DISTANCE],
      [0, 0.4, 1],
      Extrapolation.CLAMP,
    )
    return {opacity: refreshing ? Math.max(progress, 0.85) : progress}
  })

  const blurStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      pullDistance.value,
      [0, PULL_ACTION_ARM_DISTANCE * 0.25, PULL_ACTION_ARM_DISTANCE],
      [0, 0.45, 1],
      Extrapolation.CLAMP,
    )
    const boost = refreshing ? Math.max(progress, 0.7) : progress
    return {opacity: boost}
  })

  const contentStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      pullDistance.value,
      [0, PULL_ACTION_ARM_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    )
    if (reduceMotion) {
      return {
        opacity: interpolate(progress, [0, 1], [1, 0.92], Extrapolation.CLAMP),
      }
    }
    return {
      opacity: interpolate(progress, [0, 1], [1, 0.88], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(progress, [0, 1], [1, 0.965], Extrapolation.CLAMP),
        },
      ],
      borderRadius: interpolate(progress, [0, 1], [0, 28], Extrapolation.CLAMP),
      overflow: 'hidden' as const,
    }
  })

  const chromeStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      pullDistance.value,
      [0, PULL_ACTION_ARM_DISTANCE * 0.4, PULL_ACTION_ARM_DISTANCE],
      [0, 0.5, 1],
      Extrapolation.CLAMP,
    )
    const boost = refreshing ? Math.max(progress, 0.9) : progress
    return {
      opacity: boost,
      transform: [
        {
          translateY: reduceMotion
            ? 0
            : interpolate(boost, [0, 1], [-28, 0], Extrapolation.CLAMP),
        },
        {
          scale: reduceMotion
            ? 1
            : interpolate(boost, [0, 1], [0.92, 1], Extrapolation.CLAMP),
        },
        {
          translateX: armed.value
            ? interpolate(
                swipeX.value,
                [-140, 0, 140],
                [-14, 0, 14],
                Extrapolation.CLAMP,
              )
            : 0,
        },
      ],
    }
  })

  const titleStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      pullDistance.value,
      [PULL_ACTION_ARM_DISTANCE * 0.5, PULL_ACTION_ARM_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    )
    return {opacity: refreshing ? 1 : progress}
  })

  const washColor =
    scheme === 'dark' ? 'rgba(8,10,12,0.45)' : 'rgba(255,255,255,0.28)'

  return (
    <View style={styles.stage}>
      <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, blurStyle, styles.overlay]}>
        {reduceTransparency ? (
          <View
            style={[StyleSheet.absoluteFill, {backgroundColor: washColor}]}
          />
        ) : (
          <AnimatedBlurView
            intensity={scheme === 'dark' ? 48 : 56}
            tint={
              scheme === 'dark'
                ? 'systemChromeMaterialDark'
                : 'systemChromeMaterialLight'
            }
            style={StyleSheet.absoluteFill}
          />
        )}
        <View
          style={[StyleSheet.absoluteFill, {backgroundColor: washColor}]}
        />
      </Animated.View>

      <View
        pointerEvents="none"
        style={[styles.chromeHost, {paddingTop: insets.top + spacing[3]}]}>
        <Animated.View style={[styles.chrome, chromeStyle]}>
          <View
            style={[
              styles.orbRow,
              {
                backgroundColor:
                  scheme === 'dark'
                    ? 'rgba(22,26,28,0.55)'
                    : 'rgba(255,255,255,0.55)',
                borderColor: colours.border,
                borderRadius: radius.xlarge,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[3],
              },
            ]}>
            {ACTIONS.map(action => (
              <ActionOrb
                key={action.id}
                action={action}
                selectedIndex={selectedIndex}
                accent={colours.accent}
                accentSubtle={colours.accentSubtle}
                text={colours.text}
                textSecondary={colours.textSecondary}
                accentForeground={colours.accentForeground}
              />
            ))}
          </View>

          <Animated.View style={[styles.copyBlock, titleStyle, progressStyle]}>
            <SelectionCopy
              selectedIndex={selectedIndex}
              refreshing={refreshing}
              accent={colours.accent}
              text={colours.text}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  )
}

function ActionOrb({
  action,
  selectedIndex,
  accent,
  accentSubtle,
  text,
  textSecondary,
  accentForeground,
}: {
  action: ActionSpec
  selectedIndex: SharedValue<PullActionSelection>
  accent: string
  accentSubtle: string
  text: string
  textSecondary: string
  accentForeground: string
}) {
  const orbStyle = useAnimatedStyle(() => {
    const selected = selectedIndex.value === action.index
    return {
      transform: [{scale: selected ? 1.1 : 0.9}],
      opacity: selected ? 1 : 0.48,
    }
  })

  const ringStyle = useAnimatedStyle(() => {
    const selected = selectedIndex.value === action.index
    const filledCenter = selected && action.index === 1
    return {
      borderColor: selected ? accent : 'rgba(127,127,127,0.16)',
      backgroundColor: filledCenter
        ? accent
        : selected
          ? accentSubtle
          : 'rgba(127,127,127,0.10)',
    }
  })

  const outlineStyle = useAnimatedStyle(() => ({
    opacity: selectedIndex.value === action.index ? 0 : 1,
  }))
  const filledStyle = useAnimatedStyle(() => ({
    opacity: selectedIndex.value === action.index ? 1 : 0,
  }))

  return (
    <Animated.View style={[styles.orbSlot, orbStyle]}>
      <Animated.View style={[styles.orb, ringStyle]}>
        <Animated.View style={[styles.iconLayer, outlineStyle]}>
          <Ionicons name={action.icon} size={26} color={textSecondary} />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, filledStyle]}>
          <Ionicons
            name={action.iconSelected}
            size={26}
            color={action.index === 1 ? accentForeground : accent}
          />
        </Animated.View>
      </Animated.View>
      <AppText
        variant="caption"
        style={{
          color: text,
          fontWeight: '600',
          marginTop: 8,
        }}>
        {action.label}
      </AppText>
    </Animated.View>
  )
}

function SelectionCopy({
  selectedIndex,
  refreshing,
  accent,
  text,
}: {
  selectedIndex: SharedValue<PullActionSelection>
  refreshing: boolean
  accent: string
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
    <View style={styles.copyStack}>
      <Animated.View style={[styles.copyLine, searchStyle]}>
        <AppText variant="title" style={{color: text, textAlign: 'center'}}>
          Search Discover
        </AppText>
        <AppText
          variant="caption"
          colour="textSecondary"
          style={styles.copyHint}>
          Release to open search
        </AppText>
      </Animated.View>
      <Animated.View style={[styles.copyLine, refreshStyle]}>
        <AppText variant="title" style={{color: accent, textAlign: 'center'}}>
          {refreshing ? 'Refreshing…' : 'Refresh feed'}
        </AppText>
        <AppText
          variant="caption"
          colour="textSecondary"
          style={styles.copyHint}>
          {refreshing ? 'Pulling the latest posts' : 'Release in the middle'}
        </AppText>
      </Animated.View>
      <Animated.View style={[styles.copyLine, closeStyle]}>
        <AppText variant="title" style={{color: text, textAlign: 'center'}}>
          Close
        </AppText>
        <AppText
          variant="caption"
          colour="textSecondary"
          style={styles.copyHint}>
          Release to dismiss
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
  copyBlock: {
    marginTop: 18,
    minHeight: 56,
    paddingHorizontal: 24,
    width: '100%',
  },
  copyHint: {
    marginTop: 4,
    textAlign: 'center',
  },
  copyLine: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyStack: {
    height: 56,
    width: '100%',
  },
  iconLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    alignItems: 'center',
    borderRadius: 32,
    borderWidth: 1.5,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  orbRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 360,
    width: '88%',
  },
  orbSlot: {
    alignItems: 'center',
    flex: 1,
  },
  overlay: {
    zIndex: 10,
  },
  stage: {
    flex: 1,
  },
})
