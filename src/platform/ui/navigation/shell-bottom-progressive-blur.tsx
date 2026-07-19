import {StyleSheet} from 'react-native'
import {useSegments} from 'expo-router'
import Animated from 'react-native-reanimated'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {
  CHROME_BOTTOM_BLUR_INTENSITY,
  CHROME_BOTTOM_FADE,
} from '@/platform/ui/navigation/chrome-insets'
import {shouldHideShellTabBar} from '@/platform/ui/navigation/shell-tab-bar-visibility'
import {useShellChromeObscureStyle} from '@/platform/ui/navigation/use-shell-chrome-obscure-style'

/**
 * Progressive blur from the physical screen bottom (`bottom: 0`).
 *
 * Intentionally ignores safe-area inset and tab-bar geometry — adding either
 * lifts the dissolve up to the floating tab island (the previous bug).
 */
export function ShellBottomProgressiveBlur() {
  const segments = useSegments()
  const obscureStyle = useShellChromeObscureStyle('down')

  if (shouldHideShellTabBar(segments)) {
    return null
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, {height: CHROME_BOTTOM_FADE}, obscureStyle]}>
      <ProgressiveBlurBand
        height={CHROME_BOTTOM_FADE}
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
