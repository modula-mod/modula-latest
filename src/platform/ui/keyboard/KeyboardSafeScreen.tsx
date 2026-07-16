import type {ReactNode} from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import {useReduceMotion} from '@/lib/accessibility'
import {isIOS} from '@/lib/platform'

type KeyboardSafeScreenProps = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Extra offset for fixed headers (Dynamic Island / navigation chrome). */
  headerOffset?: number
  enabled?: boolean
  testID?: string
}

/**
 * Platform keyboard avoidance for composer/edit forms.
 * Does not add custom tab-bar insets — native tabs own that space.
 * Reduce Motion does not disable avoidance; it only skips decorative motion elsewhere.
 */
export function KeyboardSafeScreen({
  children,
  style,
  headerOffset = 0,
  enabled = true,
  testID,
}: KeyboardSafeScreenProps) {
  useReduceMotion()

  return (
    <KeyboardAvoidingView
      testID={testID}
      style={[styles.screen, style]}
      behavior={isIOS ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerOffset : 0}
      enabled={enabled}>
      {children}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
})
