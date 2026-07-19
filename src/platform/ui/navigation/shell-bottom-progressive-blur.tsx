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
 * Progressive blur anchored to the literal bottom of the screen (home indicator).
 *
 * Height is safe-area + a tiny feather only — never tab-bar segment height.
 * The floating liquid-glass tab island sits above this band; feed content
 * above the tabs must stay clear.
 */
export function ShellBottomProgressiveBlur() {
  const segments = useSegments()
  const insets = useSafeAreaInsets()
  const obscureStyle = useShellChromeObscureStyle('down')

  if (shouldHideShellTabBar(segments)) {
    return null
  }

  // Screen bottom → home-indicator inset. Do not add tab-bar height.
  const height = Math.max(insets.bottom, 12) + CHROME_BOTTOM_FADE

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
