import {StyleSheet, View} from 'react-native'
import {useSegments} from 'expo-router'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {
  CHROME_BOTTOM_BLUR_INTENSITY,
  CHROME_BOTTOM_FADE,
} from '@/platform/ui/navigation/chrome-insets'
import {shouldHideShellTabBar} from '@/platform/ui/navigation/shell-tab-bar-visibility'

/**
 * Light progressive blur along the bottom edge of the shell.
 * Sits under the floating tab bar (lower z-index) so icons stay crisp.
 */
export function ShellBottomProgressiveBlur() {
  const segments = useSegments()

  if (shouldHideShellTabBar(segments)) {
    return null
  }

  return (
    <View pointerEvents="none" style={[styles.wrap, {height: CHROME_BOTTOM_FADE}]}>
      <ProgressiveBlurBand
        height={CHROME_BOTTOM_FADE}
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
