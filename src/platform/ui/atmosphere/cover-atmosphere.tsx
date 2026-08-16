import {StyleSheet, View} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Quiet full-bleed banner when the profile has no cover photograph.
 * X / LinkedIn use a solid colour field — not a drawing, not a teal wash.
 */
export function CoverAtmosphere({
  wash,
}: {
  ink?: string
  paper?: string
  wash?: string
}) {
  const {colours} = useThemeTokens()
  const fill = wash ?? colours.surface2
  return (
    <View
      pointerEvents="none"
      style={[styles.fill, {backgroundColor: fill}]}
    />
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
