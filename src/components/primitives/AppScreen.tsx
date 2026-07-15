import type {PropsWithChildren} from 'react'
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import {SafeAreaView} from 'react-native-safe-area-context'

import {spacing} from '@/theme/foundations/spacing'
import {lightSemanticColours} from '@/theme/tokens/semantic'

type AppScreenProps = PropsWithChildren<{
  padded?: boolean
  scroll?: boolean
  style?: StyleProp<ViewStyle>
}>

/**
 * Safe application screen surface.
 * Optional padding and scrolling only — no product-specific layout.
 */
export function AppScreen({
  children,
  padded = true,
  scroll = false,
  style,
}: AppScreenProps) {
  const contentStyle = [
    styles.content,
    padded && styles.padded,
    style,
  ]

  if (scroll) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={contentStyle}>{children}</View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: lightSemanticColours.canvas,
  },
  content: {
    flexGrow: 1,
    backgroundColor: lightSemanticColours.canvas,
  },
  padded: {
    paddingHorizontal: spacing.xl,
  },
})
