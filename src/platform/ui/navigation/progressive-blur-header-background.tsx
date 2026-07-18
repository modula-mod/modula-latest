import {StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'

const HEADER_ROW = 54
/** Extra dissolve below the nav row so content softens under the chrome. */
const FADE_EXTENSION = 40

/**
 * React Navigation `headerBackground` — progressive blur instead of
 * hard-edged `headerBlurEffect` system material.
 */
export function ProgressiveBlurHeaderBackground() {
  const insets = useSafeAreaInsets()
  const height = insets.top + HEADER_ROW + FADE_EXTENSION

  return (
    <View style={[styles.wrap, {height}]} pointerEvents="none">
      <ProgressiveBlurBand height={height} topHeavy />
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
