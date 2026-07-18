import {StyleSheet, View} from 'react-native'
import {useSegments} from 'expo-router'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {
  CHROME_BOTTOM_BLUR_INTENSITY,
  CHROME_BOTTOM_FADE,
} from '@/platform/ui/navigation/chrome-insets'
import {FLOATING_TAB_BAR_SEGMENT_HEIGHT} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {shouldHideShellTabBar} from '@/platform/ui/navigation/shell-tab-bar-visibility'

/**
 * Progressive blur along the bottom edge of the shell.
 * Tall enough to dissolve content *above* the floating tab island, while the
 * tab bar itself stays crisp on a higher z-index.
 */
export function ShellBottomProgressiveBlur() {
  const segments = useSegments()
  const insets = useSafeAreaInsets()

  if (shouldHideShellTabBar(segments)) {
    return null
  }

  const bottomLift = Math.max(insets.bottom, 8)
  const height =
    CHROME_BOTTOM_FADE + FLOATING_TAB_BAR_SEGMENT_HEIGHT + bottomLift

  return (
    <View pointerEvents="none" style={[styles.wrap, {height}]}>
      <ProgressiveBlurBand
        height={height}
        topHeavy={false}
        intensity={CHROME_BOTTOM_BLUR_INTENSITY}
      />
    </View>
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
