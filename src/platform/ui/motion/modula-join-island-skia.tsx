import {Image} from 'expo-image'
import {BlurView} from 'expo-blur'
import {useMemo} from 'react'
import {
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import {
  Blur,
  Canvas,
  Circle,
  ColorMatrix,
  Group,
  Paint,
  RoundedRect,
} from '@shopify/react-native-skia'
import Animated, {
  Extrapolation,
  interpolate,
  runOnUI,
  scrollTo,
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import type {ModulaJoinIslandProps} from '@/platform/ui/motion/modula-join-island-fallback'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const MAX_RADIUS = 45
const MARGIN_TOP = 110
const STAGE_HEIGHT = 320

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)

/**
 * Skia join-island / meatball — adapted from Motionary telegram-join-animation (MIT).
 * Only load this module after `isReactNativeSkiaNativeAvailable()` is true.
 */
export function ModulaJoinIslandSkia({
  name,
  avatarUri,
  avatarColour,
  style,
  caption,
}: ModulaJoinIslandProps) {
  const insets = useSafeAreaInsets()
  const {width: screenWidth} = useWindowDimensions()
  const {colours, spacing, radius, scheme} = useThemeTokens()
  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  const scrollY = useSharedValue(MARGIN_TOP)
  const canvasMarginTop = insets.top <= 20 ? 8 : 12

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = MARGIN_TOP - event.contentOffset.y
    },
    onEndDrag: event => {
      const y = event.contentOffset.y
      if (y > 0 && y < MARGIN_TOP - MAX_RADIUS) {
        scrollTo(scrollRef, 0, 0, true)
      } else if (y >= MARGIN_TOP - MAX_RADIUS && y < MARGIN_TOP) {
        scrollTo(scrollRef, 0, MARGIN_TOP, true)
      }
    },
  })

  const circleRadius = useDerivedValue(() =>
    interpolate(
      scrollY.value,
      [0, MARGIN_TOP - MAX_RADIUS * 1.5],
      [0, MAX_RADIUS],
      Extrapolation.CLAMP,
    ),
  )

  const blurScale = useDerivedValue(() =>
    interpolate(
      scrollY.value,
      [0, MARGIN_TOP - MAX_RADIUS * 2],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  )

  const imageOpacity = useDerivedValue(() =>
    interpolate(scrollY.value, [MAX_RADIUS / 2, MARGIN_TOP], [0, 1], Extrapolation.CLAMP),
  )

  const circleOpacity = useDerivedValue(() => (scrollY.value < MARGIN_TOP ? 1 : 0))

  const animatedBlurProps = useAnimatedProps(() => {
    const intensity = interpolate(scrollY.value, [20, MARGIN_TOP], [30, 0])
    return {intensity}
  })

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{scale: blurScale.value}],
    opacity: imageOpacity.value,
    width: MAX_RADIUS * 2,
    height: MAX_RADIUS * 2,
    borderRadius: MAX_RADIUS * 2,
    position: 'absolute' as const,
    top: 0,
    left: 0,
  }))

  const blurContainerStyle = useAnimatedStyle(() => ({
    transform: [{translateY: scrollY.value}, {scale: blurScale.value}],
    opacity: imageOpacity.value,
    width: MAX_RADIUS * 2,
    height: MAX_RADIUS * 2,
    borderRadius: MAX_RADIUS * 2,
    position: 'absolute' as const,
    top: canvasMarginTop,
    left: (screenWidth - MAX_RADIUS * 2) / 2,
    zIndex: 100,
    overflow: 'hidden' as const,
  }))

  const skiaLayer = useMemo(
    () => (
      <Paint color={scheme === 'dark' ? '#E8EEF0' : '#1A2226'}>
        <Blur blur={10} />
        <ColorMatrix
          matrix={[
            1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 60, -30,
          ]}
        />
      </Paint>
    ),
    [scheme],
  )

  const rectWidth = 120
  const rectHeight = 30
  const rectX = (screenWidth - rectWidth) / 2
  const rectY = -rectHeight + canvasMarginTop

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: colours.surface1,
          borderColor: colours.border,
          borderRadius: radius.large,
        },
        style,
      ]}>
      <View style={[styles.stage, {height: STAGE_HEIGHT}]}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            height: STAGE_HEIGHT + MARGIN_TOP + 80,
            paddingTop: MARGIN_TOP + MAX_RADIUS * 2 + canvasMarginTop,
            paddingHorizontal: spacing[4],
            gap: spacing[3],
          }}>
          <AppText variant="headline" style={{textAlign: 'center'}}>
            {name}
          </AppText>
          <AppText variant="caption" colour="textTertiary" style={{textAlign: 'center'}}>
            {caption ??
              'Pull the stage — avatar joins from the island (Telegram-style Preview).'}
          </AppText>
          <AppPressable
            accessibilityLabel="Simulate join"
            onPress={() => {
              runOnUI(() => {
                'worklet'
                scrollTo(scrollRef, 0, 0, true)
              })()
            }}
            style={[
              styles.button,
              {
                backgroundColor: colours.accentSubtle,
                borderColor: colours.accent,
                borderRadius: radius.round,
                alignSelf: 'center',
              },
            ]}>
            <AppText variant="label" style={{color: colours.accent}}>
              Simulate join
            </AppText>
          </AppPressable>
          <AppPressable
            accessibilityLabel="Collapse to island"
            onPress={() => {
              runOnUI(() => {
                'worklet'
                scrollTo(scrollRef, 0, MARGIN_TOP, true)
              })()
            }}
            style={[
              styles.button,
              {
                backgroundColor: colours.surface2,
                borderColor: colours.border,
                borderRadius: radius.round,
                alignSelf: 'center',
              },
            ]}>
            <AppText variant="label" colour="textSecondary">
              Collapse to island
            </AppText>
          </AppPressable>
        </Animated.ScrollView>

        <Animated.View style={blurContainerStyle}>
          <AnimatedBlurView
            animatedProps={animatedBlurProps}
            tint={scheme === 'dark' ? 'dark' : 'light'}
            style={styles.blurDisc}
          />
          {avatarUri ? (
            <Animated.View style={imageStyle}>
              <Image source={{uri: avatarUri}} style={styles.avatarImage} />
            </Animated.View>
          ) : (
            <Animated.View style={imageStyle}>
              <Avatar name={name} colour={avatarColour ?? colours.accent} size={MAX_RADIUS * 2} />
            </Animated.View>
          )}
        </Animated.View>

        <Canvas pointerEvents="none" style={styles.canvas}>
          <Group opacity={circleOpacity} layer={skiaLayer}>
            <Circle cx={screenWidth / 2} cy={scrollY} r={circleRadius} />
            <RoundedRect
              x={rectX}
              y={rectY}
              width={rectWidth}
              height={rectHeight}
              r={10}
            />
          </Group>
        </Canvas>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  avatarImage: {
    borderRadius: MAX_RADIUS,
    height: MAX_RADIUS * 2,
    width: MAX_RADIUS * 2,
  },
  blurDisc: {
    borderRadius: MAX_RADIUS * 2,
    height: MAX_RADIUS * 2,
    width: MAX_RADIUS * 2,
    zIndex: 10000,
  },
  button: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  canvas: {
    ...StyleSheet.absoluteFill,
  },
  shell: {
    overflow: 'hidden',
    width: '100%',
  },
  stage: {
    overflow: 'hidden',
    width: '100%',
  },
})
