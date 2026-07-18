import {StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {
  CHROME_BLUR_INTENSITY,
  CHROME_FADE_EXTENSION,
  CHROME_HEADER_ROW,
} from '@/platform/ui/navigation/chrome-insets'

/**
 * React Navigation `headerBackground` — MaskedView progressive blur
 * (rit3zh/expo-progressive-blur technique), not hard system material.
 */
export function ProgressiveBlurHeaderBackground() {
  const insets = useSafeAreaInsets()
  const height = insets.top + CHROME_HEADER_ROW + CHROME_FADE_EXTENSION

  return (
    <View style={[styles.wrap, {height}]} pointerEvents="none">
      <ProgressiveBlurBand
        height={height}
        topHeavy
        intensity={CHROME_BLUR_INTENSITY}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})
