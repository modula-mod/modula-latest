import {StyleSheet} from 'react-native'
import {useSegments} from 'expo-router'
import Animated from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {
  CHROME_BOTTOM_BLUR_INTENSITY,
  CHROME_BOTTOM_FADE,
} from '@/platform/ui/navigation/chrome-insets'
import {shouldHideShellTabBar} from '@/platform/ui/navigation/shell-tab-bar-visibility'
import {useShellChromeObscureStyle} from '@/platform/ui/navigation/use-shell-chrome-obscure-style'

/**
 * Short soft feather at the very bottom edge (home indicator).
 * Does not cover the floating liquid-glass tab island — that chrome is self-contained.
 */
export function ShellBottomProgressiveBlur() {
  const segments = useSegments()
  const insets = useSafeAreaInsets()
  const obscureStyle = useShellChromeObscureStyle('down')

  if (shouldHideShellTabBar(segments)) {
    return null
  }

  const bottomLift = Math.max(insets.bottom, 8)
  // Feather only the home-indicator strip + a short rise — not the whole tab zone.
  const height = CHROME_BOTTOM_FADE + bottomLift

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, {height}, obscureStyle]}>
      <ProgressiveBlurBand
        height={height}
        topHeavy={false}
        strength="soft"
        intensity={CHROME_BOTTOM_BLUR_INTENSITY}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 3,
  },
})
