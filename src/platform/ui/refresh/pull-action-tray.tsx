import Ionicons from '@expo/vector-icons/Ionicons'
import type {ComponentProps, ReactNode} from 'react'
import {useEffect} from 'react'
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
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppText} from '@/components/primitives/AppText'
import {useReduceMotion} from '@/lib/accessibility'
import {PullAmbientAura} from '@/platform/ui/refresh/pull-ambient-aura'
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

/** Focus-orb spectrum — selected dominates; neighbours stay quiet. */
const ORB_SELECTED = 78
const ORB_NEAR = 40
const ORB_FAR = 30

const GLOW_OUTER = 168
const GLOW_MID = 120
const GLOW_INNER = 92

const BREATH = Easing.bezier(0.4, 0, 0.2, 1)

/**
 * Pull stage: soft ambient aura + focus-orb spectrum.
 * Selected action grows and glows; neighbours stay small and quiet.
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

  const stageProgress = (distance: number) => {
    'worklet'
    const progress = interpolate(
      distance,
      [0, PULL_ACTION_ARM_DISTANCE * 0.4, PULL_ACTION_ARM_DISTANCE],
      [0, 0.45, 1],
      Extrapolation.CLAMP,
    )
    return progress * progress * (3 - 2 * progress)
  }

  const blurStyle = useAnimatedStyle(() => {
    const eased = stageProgress(pullDistance.value)
    return {opacity: refreshing ? Math.max(eased, 0.5) : eased * 0.72}
  })

  const contentStyle = useAnimatedStyle(() => {
    const eased = stageProgress(pullDistance.value)
    if (reduceMotion) {
      return {
        opacity: interpolate(eased, [0, 1], [1, 0.97], Extrapolation.CLAMP),
      }
    }
    return {
      opacity: interpolate(eased, [0, 1], [1, 0.95], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(eased, [0, 1], [1, 0.985], Extrapolation.CLAMP),
        },
      ],
    }
  })

  const chromeStyle = useAnimatedStyle(() => {
    const eased = stageProgress(pullDistance.value)
    const boost = refreshing ? Math.max(eased, 0.98) : eased
    return {
      opacity: boost,
      transform: [
        {
          translateY: reduceMotion
            ? 0
            : interpolate(boost, [0, 1], [22, 0], Extrapolation.CLAMP),
        },
        {
          translateX: armed.value
            ? interpolate(
                swipeX.value,
                [-120, 0, 120],
                [-8, 0, 8],
                Extrapolation.CLAMP,
              )
            : 0,
        },
      ],
    }
  })

  const titleStyle = useAnimatedStyle(() => {
    const eased = stageProgress(pullDistance.value)
    return {opacity: refreshing ? 1 : eased}
  })

  const washColor =
    scheme === 'dark' ? 'rgba(8,10,12,0.18)' : 'rgba(255,255,255,0.08)'

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
            intensity={scheme === 'dark' ? 22 : 26}
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

      <PullAmbientAura pullDistance={pullDistance} refreshing={refreshing} />

      <View
        pointerEvents="none"
        style={[styles.chromeHost, {paddingTop: insets.top + spacing[5]}]}>
        <Animated.View style={[styles.chrome, chromeStyle]}>
          <View style={styles.orbRow}>
            {ACTIONS.map(action => (
              <FocusOrb
                key={action.id}
                action={action}
                selectedIndex={selectedIndex}
                accent={colours.accent}
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

function FocusOrb({
  action,
  selectedIndex,
  accent,
  accentForeground,
  refreshing,
  reduceMotion,
}: {
  action: ActionSpec
  selectedIndex: SharedValue<PullActionSelection>
  accent: string
  accentForeground: string
  refreshing: boolean
  reduceMotion: boolean
}) {
  const spin = useSharedValue(0)
  const breath = useSharedValue(0.5)

  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0.65
      return
    }
    breath.value = withRepeat(
      withTiming(1, {duration: 2600, easing: BREATH}),
      -1,
      true,
    )
  }, [breath, reduceMotion])

  useEffect(() => {
    if (action.index !== 1) return
    if (refreshing && !reduceMotion) {
      spin.value = withRepeat(
        withTiming(1, {duration: 1200, easing: Easing.linear}),
        -1,
        false,
      )
      return
    }
    spin.value = withTiming(0, {duration: 220})
  }, [action.index, reduceMotion, refreshing, spin])

  const activeIndex = () => {
    'worklet'
    return refreshing && action.index === 1 ? 1 : selectedIndex.value
  }

  const slotStyle = useAnimatedStyle(() => {
    const active = activeIndex()
    const distance = Math.abs(action.index - active)
    const size =
      distance === 0 ? ORB_SELECTED : distance === 1 ? ORB_NEAR : ORB_FAR
    return {
      width: size + 12,
      height: ORB_SELECTED + 36,
      opacity: distance === 0 ? 1 : distance === 1 ? 0.55 : 0.34,
    }
  })

  const orbStyle = useAnimatedStyle(() => {
    const active = activeIndex()
    const distance = Math.abs(action.index - active)
    const size =
      distance === 0 ? ORB_SELECTED : distance === 1 ? ORB_NEAR : ORB_FAR
    const selected = distance === 0
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: selected ? accent : 'rgba(42, 46, 52, 0.94)',
      borderColor: selected ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.06)',
      borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
      shadowColor: selected ? accent : '#000',
      shadowOpacity: selected ? 0.45 : 0.18,
      shadowRadius: selected ? 16 : 6,
      shadowOffset: {width: 0, height: selected ? 0 : 2},
    }
  })

  const glowOuterStyle = useAnimatedStyle(() => {
    const selected = action.index === activeIndex()
    const pulse = reduceMotion
      ? 1
      : interpolate(breath.value, [0, 1], [0.82, 1.08])
    return {
      opacity: selected ? 0.9 : 0,
      transform: [{scale: selected ? pulse : 0.5}],
    }
  })

  const glowMidStyle = useAnimatedStyle(() => {
    const selected = action.index === activeIndex()
    const pulse = reduceMotion
      ? 1
      : interpolate(breath.value, [0, 1], [0.9, 1.06])
    return {
      opacity: selected ? 1 : 0,
      transform: [{scale: selected ? pulse : 0.55}],
    }
  })

  const glowInnerStyle = useAnimatedStyle(() => {
    const selected = action.index === activeIndex()
    const pulse = reduceMotion
      ? 1
      : interpolate(breath.value, [0, 1], [0.94, 1.04])
    return {
      opacity: selected ? 1 : 0,
      transform: [{scale: selected ? pulse : 0.6}],
    }
  })

  const selectedIconStyle = useAnimatedStyle(() => {
    const selected = action.index === activeIndex()
    return {
      opacity: selected ? 1 : 0,
      transform:
        action.index === 1 && selected && refreshing
          ? [{rotate: `${spin.value * 360}deg`}]
          : [{rotate: '0deg'}],
    }
  })

  const idleIconStyle = useAnimatedStyle(() => {
    const selected = action.index === activeIndex()
    return {opacity: selected ? 0 : 1}
  })

  return (
    <Animated.View style={[styles.orbSlot, slotStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.glowOuter, glowOuterStyle]}>
        <View style={[styles.glowDisk, styles.glowOuterDisk]} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.glowMid, glowMidStyle]}>
        <View
          style={[
            styles.glowDisk,
            {backgroundColor: `${accent}40`},
          ]}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.glowInner, glowInnerStyle]}>
        <View
          style={[
            styles.glowDisk,
            {backgroundColor: `${accent}66`},
          ]}
        />
      </Animated.View>

      <Animated.View style={[styles.orb, orbStyle]}>
        <Animated.View style={[styles.iconLayer, idleIconStyle]}>
          <Ionicons
            name={action.icon}
            size={17}
            color="rgba(210, 214, 220, 0.78)"
          />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, selectedIconStyle]}>
          <Ionicons
            name={action.iconSelected}
            size={28}
            color={accentForeground}
          />
        </Animated.View>
      </Animated.View>
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
          Search
        </AppText>
        <AppText
          variant="caption"
          colour="textSecondary"
          style={styles.copyHint}>
          Release to open
        </AppText>
      </Animated.View>
      <Animated.View style={[styles.copyLine, refreshStyle]}>
        <AppText variant="title" style={{color: accent, textAlign: 'center'}}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </AppText>
        <AppText
          variant="caption"
          colour="textSecondary"
          style={styles.copyHint}>
          {refreshing ? 'Syncing your feed' : 'Release to sync'}
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
    marginTop: 14,
    minHeight: 52,
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
    height: 52,
    width: '100%',
  },
  glowDisk: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
  },
  glowInner: {
    height: GLOW_INNER,
    position: 'absolute',
    width: GLOW_INNER,
    zIndex: 1,
  },
  glowMid: {
    height: GLOW_MID,
    position: 'absolute',
    width: GLOW_MID,
    zIndex: 1,
  },
  glowOuter: {
    height: GLOW_OUTER,
    position: 'absolute',
    width: GLOW_OUTER,
    zIndex: 0,
  },
  glowOuterDisk: {
    backgroundColor: 'rgba(167, 139, 250, 0.22)',
  },
  iconLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 2,
  },
  orbRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: ORB_SELECTED + 40,
    justifyContent: 'center',
    maxWidth: 300,
    width: '78%',
  },
  orbSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    zIndex: 10,
  },
  stage: {
    flex: 1,
  },
})
