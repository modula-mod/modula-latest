import {StyleSheet, View} from 'react-native'
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
 * Progressive blur pinned to the physical screen bottom.
 *
 * Full-screen host + `bottom: 0` band — no safe-area inset, no tab-bar offset.
 * Height is exactly `CHROME_BOTTOM_FADE` (56).
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
      style={[styles.host, obscureStyle]}>
      <View style={styles.band}>
        <ProgressiveBlurBand
          height={CHROME_BOTTOM_FADE}
          topHeavy={false}
          intensity={CHROME_BOTTOM_BLUR_INTENSITY}
        />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  band: {
    bottom: 0,
    height: CHROME_BOTTOM_FADE,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 3,
  },
})
