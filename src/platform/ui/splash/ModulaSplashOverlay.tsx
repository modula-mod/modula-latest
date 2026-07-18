import {useEffect, useState} from 'react'
import {Image, Platform, StyleSheet, View} from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import {AppText} from '@/components/primitives/AppText'
import {
  hideNativeSplash,
  prepareModulaSplash,
} from '@/platform/ui/splash/modula-splash'
import {useReduceMotion} from '@/lib/accessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const BRAND_TEAL = '#369CAA'
const BRAND_INK = '#0B1416'

/**
 * Full-screen brand hold after the native splash.
 * Logo + wordmark, then a short fade so first frame does not flash canvas.
 */
export function ModulaSplashOverlay() {
  const {spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const [visible, setVisible] = useState(Platform.OS !== 'web')
  const opacity = useSharedValue(1)
  const markScale = useSharedValue(reduceMotion ? 1 : 0.92)
  const markOpacity = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    if (Platform.OS === 'web') return

    let cancelled = false
    const finish = () => {
      if (!cancelled) setVisible(false)
    }

    void (async () => {
      await prepareModulaSplash()
      await hideNativeSplash()
      if (cancelled) return

      if (reduceMotion) {
        opacity.value = withDelay(
          120,
          withTiming(0, {duration: 160}, finished => {
            if (finished) runOnJS(finish)()
          }),
        )
        return
      }

      markOpacity.value = withTiming(1, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      })
      markScale.value = withTiming(1, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      })
      opacity.value = withDelay(
        520,
        withTiming(
          0,
          {duration: 380, easing: Easing.inOut(Easing.cubic)},
          finished => {
            if (finished) runOnJS(finish)()
          },
        ),
      )
    })()

    return () => {
      cancelled = true
    }
  }, [markOpacity, markScale, opacity, reduceMotion])

  const shellStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{scale: markScale.value}],
  }))

  if (!visible) return null

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.shell, shellStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={styles.glow} />
      <Animated.View style={[styles.mark, markStyle, {gap: spacing[3]}]}>
        <Image
          source={require('../../../../assets/images/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <AppText variant="headline" style={styles.wordmark}>
          MODULA
        </AppText>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  glow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BRAND_TEAL,
    opacity: 0.22,
  },
  logo: {
    height: 72,
    width: 72,
  },
  mark: {
    alignItems: 'center',
  },
  shell: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: BRAND_INK,
    justifyContent: 'center',
    zIndex: 100,
  },
  wordmark: {
    color: '#F4FAFB',
    letterSpacing: 4,
  },
})
