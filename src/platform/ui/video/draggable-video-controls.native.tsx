import type {ReactNode} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const SPRING = {damping: 28, stiffness: 170}
const DETACH_THRESHOLD = 48
const SNAP_X = -110
const SNAP_Y = 140
const SNAP_CONDITION_X = -40
const SNAP_CONDITION_Y = 90

export type DraggableVideoControlsProps = {
  playing: boolean
  onTogglePlay: () => void
  onSkipBack?: () => void
  onSkipForward?: () => void
  style?: StyleProp<ViewStyle>
}

/**
 * Draggable play control with spring snap + detachable skip buttons.
 * Plain icon controls — no glass / filled discs.
 * Interaction pattern adapted from Motionary draggable-video-control (MIT).
 */
export function DraggableVideoControls({
  playing,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
  style,
}: DraggableVideoControlsProps) {
  const {colours} = useThemeTokens()
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const offsetX = useSharedValue(0)
  const offsetY = useSharedValue(0)

  const pan = Gesture.Pan()
    .onBegin(() => {
      offsetX.value = translateX.value
      offsetY.value = translateY.value
    })
    .onUpdate(event => {
      translateX.value = offsetX.value + event.translationX
      translateY.value = offsetY.value + event.translationY
    })
    .onEnd(() => {
      const snap =
        translateX.value < SNAP_CONDITION_X && translateY.value > SNAP_CONDITION_Y
      translateX.value = withSpring(snap ? SNAP_X : 0, SPRING)
      translateY.value = withSpring(snap ? SNAP_Y : 0, SPRING)
    })

  const playStyle = useAnimatedStyle(() => ({
    transform: [
      {translateX: translateX.value},
      {translateY: translateY.value},
    ],
  }))

  const prevStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          Math.abs(translateX.value) > DETACH_THRESHOLD
            ? withSpring(DETACH_THRESHOLD, SPRING)
            : withSpring(0, SPRING),
      },
    ],
  }))

  const nextStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          Math.abs(translateX.value) > DETACH_THRESHOLD
            ? withSpring(-DETACH_THRESHOLD, SPRING)
            : withSpring(0, SPRING),
      },
    ],
  }))

  return (
    <View style={[styles.cluster, style]} pointerEvents="box-none">
      <Animated.View style={prevStyle}>
        <PlainIconHit
          size={56}
          accessibilityLabel="Skip back 10 seconds"
          onPress={onSkipBack}>
          <AppIcon name="skipBack" colour={colours.mediaOverlayIcon} size={22} />
        </PlainIconHit>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={playStyle}>
          <PlainIconHit
            size={64}
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            onPress={onTogglePlay}>
            <AppIcon
              name={playing ? 'pause' : 'play'}
              colour={colours.mediaOverlayIcon}
              size={30}
            />
          </PlainIconHit>
        </Animated.View>
      </GestureDetector>

      <Animated.View style={nextStyle}>
        <PlainIconHit
          size={56}
          accessibilityLabel="Skip forward 30 seconds"
          onPress={onSkipForward}>
          <AppIcon name="skipForward" colour={colours.mediaOverlayIcon} size={22} />
        </PlainIconHit>
      </Animated.View>
    </View>
  )
}

function PlainIconHit({
  size,
  children,
  onPress,
  accessibilityLabel,
}: {
  size: number
  children: ReactNode
  onPress?: () => void
  accessibilityLabel: string
}) {
  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.hit, {width: size, height: size}]}>
      {children}
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  cluster: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
