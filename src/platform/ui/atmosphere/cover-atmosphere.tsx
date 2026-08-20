import {StyleSheet, View} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Quiet full-bleed banner when the profile has no cover photograph.
 * X / LinkedIn use a solid colour field — not a drawing, not a teal wash.
 * Ink-on-canvas at low opacity stays token-driven and readable as a banner.
 */
export function CoverAtmosphere({
  wash,
}: {
  ink?: string
  paper?: string
  wash?: string
}) {
  const {colours} = useThemeTokens()
  return (
    <View pointerEvents="none" style={styles.fill}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {backgroundColor: wash ?? colours.canvas},
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {backgroundColor: colours.text, opacity: 0.16},
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})
