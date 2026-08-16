import type {ReactNode} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {
  keyboardScrollProps,
  sheetKeyboardBottomInset,
  useKeyboardHeight,
} from '@/platform/ui/keyboard'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Canonical actionable-sheet geometry:
 *
 *   HEADER   — structurally stable
 *   BODY     — independently scrolls
 *   FOOTER   — fixed above safe area + keyboard
 *
 * The primary CTA must live in `footer`, never at the end of unbounded children.
 */
export function ModulaSheetLayout({
  header,
  footer,
  children,
  scrollBody = true,
  testID,
}: {
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  scrollBody?: boolean
  testID?: string
}) {
  const {spacing} = useThemeTokens()
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardHeight()
  const footerPad = sheetKeyboardBottomInset(keyboardHeight, insets.bottom, spacing[3])

  return (
    <View style={styles.root} testID={testID}>
      {header ? <View style={styles.header}>{header}</View> : null}
      {scrollBody ? (
        <ScrollView
          {...keyboardScrollProps}
          style={styles.body}
          contentContainerStyle={[styles.bodyContent, {paddingBottom: spacing[4]}]}
          testID={testID ? `${testID}-body` : undefined}>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
      {footer ? (
        <View
          style={[styles.footer, {paddingBottom: footerPad, paddingTop: spacing[3]}]}
          testID={testID ? `${testID}-footer` : undefined}>
          {footer}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyContent: {
    flexGrow: 1,
  },
  footer: {
    flexShrink: 0,
  },
  header: {
    flexShrink: 0,
  },
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
})
