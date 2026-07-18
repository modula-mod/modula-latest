import type {PropsWithChildren} from 'react'
import {StyleSheet, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Soft atmospheric stage for first-run and pre-screens.
 * Uses Modula Teal–tinted depth — not pastel purple defaults.
 */
export function OnboardingAtmosphere({children}: PropsWithChildren) {
  const {colours, scheme} = useThemeTokens()
  const insets = useSafeAreaInsets()
  const topWash =
    scheme === 'dark'
      ? ['#0B1416', colours.canvas, colours.accentSubtle]
      : [colours.accentSubtle, colours.canvas, '#F3F7F8']

  return (
    <View style={[styles.root, {backgroundColor: colours.canvas}]}>
      <LinearGradient
        colors={topWash as [string, string, ...string[]]}
        start={{x: 0.1, y: 0}}
        end={{x: 0.9, y: 1}}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, {paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16}]}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
})
