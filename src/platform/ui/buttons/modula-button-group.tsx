import type {ReactNode} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulaButtonGroup({
  children,
  accessibilityLabel,
  style,
}: {
  children: ReactNode
  accessibilityLabel: string
  style?: StyleProp<ViewStyle>
}) {
  const {spacing} = useThemeTokens()
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="toolbar"
      style={[styles.root, {gap: spacing[1]}, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
