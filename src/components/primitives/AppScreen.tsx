import type {PropsWithChildren} from 'react'
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import {SafeAreaView} from 'react-native-safe-area-context'

import {useTheme} from '@/theme/runtime/useTheme'

type AppScreenProps = PropsWithChildren<{
  padded?: boolean
  scroll?: boolean
  style?: StyleProp<ViewStyle>
  edges?: ('top' | 'right' | 'bottom' | 'left')[]
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
  edges,
}: AppScreenProps) {
  const {colours, spacing} = useTheme()
  const contentStyle = [
    styles.content,
    {backgroundColor: colours.canvas},
    padded && {paddingHorizontal: spacing.xl},
    style,
  ]

  if (scroll) {
    return (
      <SafeAreaView
        style={[styles.safe, {backgroundColor: colours.canvas}]}
        edges={edges}>
        <ScrollView
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView
      style={[styles.safe, {backgroundColor: colours.canvas}]}
      edges={edges}>
      <View style={contentStyle}>{children}</View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
})
