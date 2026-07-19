import Ionicons from '@expo/vector-icons/Ionicons'
import type {ComponentProps, ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'
import {BlurView} from 'expo-blur'
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
import {useEffect} from 'react'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppText} from '@/components/primitives/AppText'
import {useReduceMotion} from '@/lib/accessibility'
import {LightningScreenGlow} from '@/platform/ui/refresh/lightning-screen-glow'
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
  icon: IoniconName
  iconSelected: IoniconName
}

const ACTIONS: readonly ActionSpec[] = [
  {
    id: 'search',
    index: 0,
    label: 'Search',
    icon: 'search-outline',
    iconSelected: 'search',
  },
  {
    id: 'refresh',
    index: 1,
    label: 'Refresh',
    icon: 'refresh-outline',
    iconSelected: 'refresh',
  },
  {
    id: 'close',
    index: 2,
    label: 'Close',
    icon: 'close-outline',
    iconSelected: 'close',
  },
]

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)
const ICON_SIZE = 20
const HIT = 44

/**
 * Pull stage: lightning edge glow, soft page blur, and minimal icons
 * (circle only on the selected action — no card chrome).
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
  const {colours, spacing, scheme} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const {reduceTransparency} = useSystemAccessibility()

  const blurStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      pullDistance.value,
      [0, PULL_ACTION_ARM_DISTANCE * 0.28, PULL_ACTION_ARM_DISTANCE],
      [0, 0.4, 1],
      Extrapolation.CLAMP,
    )
    return {opacity: refreshing ? Math.max(progress, 0.65) : progress}
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
        opacity: interpolate(progress, [0, 1], [1, 0.94], Extrapolation.CLAMP),
      }
    }
    return {
      opacity: interpolate(progress, [0, 1], [1, 0.9], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(progress, [0, 1], [1, 0.97], Extrapolation.CLAMP),
        },
      ],
      borderRadius: interpolate(progress, [0, 1], [0, 36], Extrapolation.CLAMP),
      overflow: 'hidden' as const,
    }
  })

  const chromeStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      pullDistance.value,
      [0, PULL_ACTION_ARM_DISTANCE * 0.4, PULL_ACTION_ARM_DISTANCE],
      [0, 0.45, 1],
      Extrapolation.CLAMP,
    )
    const boost = refreshing ? Math.max(progress, 0.9) : progress
    return {
      opacity: boost,
      transform: [
        {
          translateY: reduceMotion
            ? 0
            : interpolate(boost, [0, 1], [-16, 0], Extrapolation.CLAMP),
        },
        {
          translateX: armed.value
            ? interpolate(
                swipeX.value,
                [-140, 0, 140],
                [-10, 0, 10],
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
      [PULL_ACTION_ARM_DISTANCE * 0.45, PULL_ACTION_ARM_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    )
    return {opacity: refreshing ? 1 : progress}
  })

  const washColor =
    scheme === 'dark' ? 'rgba(8,10,12,0.32)' : 'rgba(255,255,255,0.18)'

  return (
    <View style={styles.stage}>
      <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>

      <LightningScreenGlow
        pullDistance={pullDistance}
        refreshing={refreshing}
      />

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, blurStyle, styles.overlay]}>
        {reduceTransparency ? (
          <View
            style={[StyleSheet.absoluteFill, {backgroundColor: washColor}]}
          />
        ) : (
          <AnimatedBlurView
            intensity={scheme === 'dark' ? 36 : 42}
            tint={
              scheme === 'dark'
                ? 'systemUltraThinMaterialDark'
                : 'systemUltraThinMaterialLight'
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
        style={[styles.chromeHost, {paddingTop: insets.top + spacing[5]}]}>
        <Animated.View style={[styles.chrome, chromeStyle]}>
          <View style={styles.iconRow}>
            {ACTIONS.map(action => (
              <ActionGlyph
                key={action.id}
                action={action}
                selectedIndex={selectedIndex}
                accent={colours.accent}
                textSecondary={colours.textSecondary}
                accentForeground={colours.accentForeground}
                refreshing={refreshing}
                reduceMotion={reduceMotion}
              />
            ))}
          </View>

          <Animated.View style={[styles.copyBlock, titleStyle]}>
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

function ActionGlyph({
  action,
  selectedIndex,
  accent,
  textSecondary,
  accentForeground,
  refreshing,
  reduceMotion,
}: {
  action: ActionSpec
  selectedIndex: SharedValue<PullActionSelection>
  accent: string
  textSecondary: string
  accentForeground: string
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
    const selected =
      refreshing && action.index === 1
        ? true
        : selectedIndex.value === action.index
    return {
      transform: [{scale: selected ? 1.06 : 1}],
      opacity: selected ? 1 : refreshing ? 0.28 : 0.42,
    }
  })

  // Circle appears only while this action is selected (lock-screen control energy).
  const circleStyle = useAnimatedStyle(() => {
    const selected =
      refreshing && action.index === 1
        ? true
        : selectedIndex.value === action.index
    return {
      opacity: selected ? 1 : 0,
      transform: [{scale: selected ? 1 : 0.7}],
      backgroundColor:
        action.index === 1 ? accent : 'rgba(127,127,127,0.22)',
    }
  })

  const outlineStyle = useAnimatedStyle(() => {
    const selected =
      refreshing && action.index === 1
        ? true
        : selectedIndex.value === action.index
    return {opacity: selected ? 0 : 1}
  })
  const filledStyle = useAnimatedStyle(() => {
    const selected =
      refreshing && action.index === 1
        ? true
        : selectedIndex.value === action.index
    return {
      opacity: selected ? 1 : 0,
      transform:
        action.index === 1
          ? [{rotate: `${spin.value * 360}deg`}]
          : [{rotate: '0deg'}],
    }
  })

  return (
    <Animated.View style={[styles.glyphSlot, slotStyle]}>
      <View style={styles.glyphHit}>
        <Animated.View style={[styles.selectCircle, circleStyle]} />
        <Animated.View style={[styles.iconLayer, outlineStyle]}>
          <Ionicons name={action.icon} size={ICON_SIZE} color={textSecondary} />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, filledStyle]}>
          <Ionicons
            name={action.iconSelected}
            size={ICON_SIZE}
            color={action.index === 1 ? accentForeground : accent}
          />
        </Animated.View>
      </View>
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
        <AppText variant="label" style={{color: text, textAlign: 'center'}}>
          Search
        </AppText>
        <AppText
          variant="caption"
          colour="textSecondary"
          style={styles.copyHint}>
          Release to open search
        </AppText>
      </Animated.View>
      <Animated.View style={[styles.copyLine, refreshStyle]}>
        <AppText variant="label" style={{color: accent, textAlign: 'center'}}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </AppText>
        <AppText
          variant="caption"
          colour="textSecondary"
          style={styles.copyHint}>
          {refreshing ? 'Syncing your feed' : 'Release in the middle'}
        </AppText>
      </Animated.View>
      <Animated.View style={[styles.copyLine, closeStyle]}>
        <AppText variant="label" style={{color: text, textAlign: 'center'}}>
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
    marginTop: 14,
    minHeight: 44,
    paddingHorizontal: 24,
    width: '100%',
  },
  copyHint: {
    marginTop: 2,
    textAlign: 'center',
  },
  copyLine: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyStack: {
    height: 44,
    width: '100%',
  },
  glyphHit: {
    alignItems: 'center',
    height: HIT,
    justifyContent: 'center',
    width: HIT,
  },
  glyphSlot: {
    alignItems: 'center',
    flex: 1,
  },
  iconLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 280,
    width: '70%',
  },
  overlay: {
    zIndex: 10,
  },
  selectCircle: {
    borderRadius: HIT / 2,
    height: HIT,
    position: 'absolute',
    width: HIT,
  },
  stage: {
    flex: 1,
  },
})
