import {StyleSheet, View} from 'react-native'
import {useSegments} from 'expo-router'
import Animated from 'react-native-reanimated'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {
  CHROME_BOTTOM_BLUR_INTENSITY,
  CHROME_BOTTOM_FADE,
} from '@/platform/ui/navigation/chrome-insets'
import {FLOATING_TAB_BAR_SEGMENT_HEIGHT} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {shouldHideShellTabBar} from '@/platform/ui/navigation/shell-tab-bar-visibility'
import {useShellChromeObscureStyle} from '@/platform/ui/navigation/use-shell-chrome-obscure-style'

/**
 * Progressive blur from the physical screen bottom (`bottom: 0`).
 *
 * Height = tab segment + 56px fade above it. Safe-area is intentionally
 * omitted — the floating tab glass pads the home indicator internally so
 * chrome reaches absolute 0 with no black strip underneath.
 */
export function ShellBottomProgressiveBlur() {
  const segments = useSegments()
  const obscureStyle = useShellChromeObscureStyle('down')

  if (shouldHideShellTabBar(segments)) {
    return null
  }

  const height = FLOATING_TAB_BAR_SEGMENT_HEIGHT + CHROME_BOTTOM_FADE

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.host, obscureStyle]}>
      <View style={[styles.band, {height}]}>
        <ProgressiveBlurBand
          height={height}
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
    left: 0,
    position: 'absolute',
    right: 0,
  },
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 3,
  },
})
