import {useMemo, type ReactNode} from 'react'
import {Modal, Pressable, StyleSheet, View} from 'react-native'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import Animated, {interpolate, runOnJS, useAnimatedStyle, type SharedValue} from 'react-native-reanimated'

import {useReduceMotion} from '@/lib/accessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaDrawerFrameProps = {
  isPresented: boolean
  progress: SharedValue<number>
  width: number
  onDismiss: () => void
  onSettle: (options: {velocityX: number; at: number}) => void
  children: ReactNode
  side?: 'leading' | 'trailing'
  accessibilityLabel?: string
  testID?: string
}

/** Shared modal, backdrop, pan gesture and Reduce Motion behavior for drawers. */
export function ModulaDrawerFrame({
  isPresented,
  progress,
  width,
  onDismiss,
  onSettle,
  children,
  side = 'leading',
  accessibilityLabel = 'Navigation drawer',
  testID,
}: ModulaDrawerFrameProps) {
  const {colours} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const direction = side === 'leading' ? -1 : 1
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }))
  const drawerStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? interpolate(progress.value, [0, 1], [0, 1])
      : interpolate(progress.value, [0, 0.2, 1], [0.85, 1, 1]),
    transform: reduceMotion
      ? []
      : [
          {translateX: interpolate(progress.value, [0, 1], [direction * width, 0])},
          {scale: interpolate(progress.value, [0, 1], [0.97, 1])},
        ],
  }))
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-24, 24])
        .onUpdate(event => {
          'worklet'
          const travel = side === 'leading' ? event.translationX : -event.translationX
          // eslint-disable-next-line react-hooks/immutability
          progress.value = Math.max(0, Math.min(1, 1 + travel / width))
        })
        .onEnd(event => {
          'worklet'
          runOnJS(onSettle)({
            velocityX: side === 'leading' ? event.velocityX : -event.velocityX,
            at: progress.value,
          })
        }),
    [onSettle, progress, side, width],
  )

  return (
    <Modal
      accessibilityViewIsModal
      animationType="none"
      onRequestClose={onDismiss}
      transparent
      visible={isPresented}>
      <View style={StyleSheet.absoluteFill} testID={testID}>
        <Animated.View
          pointerEvents="auto"
          style={[StyleSheet.absoluteFill, {backgroundColor: colours.backdrop}, backdropStyle]}>
          <Pressable
            accessibilityLabel="Close drawer"
            accessibilityRole="button"
            onPress={onDismiss}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityLabel={accessibilityLabel}
            style={[
              styles.frame,
              side === 'trailing' ? styles.trailing : styles.leading,
              {width},
              drawerStyle,
            ]}>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  frame: {bottom: 0, position: 'absolute', top: 0},
  leading: {left: 0},
  trailing: {right: 0},
})
