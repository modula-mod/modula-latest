import type {ReactNode} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaFieldShellProps = {
  label?: string
  /** Persistent helper copy under the control. */
  support?: string
  /** Error copy; replaces support and announces via live region on web. */
  error?: string
  children: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Canonical label / control / support / error composition for Modula fields.
 * Controls stay unopinionated; screens never hand-roll field chrome.
 */
export function ModulaFieldShell({
  label,
  support,
  error,
  children,
  style,
  testID,
}: ModulaFieldShellProps) {
  const {colours, spacing} = useThemeTokens()

  return (
    <View style={[styles.root, {gap: spacing[2]}, style]} testID={testID}>
      {label ? (
        <AppText variant="label" colour="textSecondary">
          {label}
        </AppText>
      ) : null}
      {children}
      {error ? (
        <AppText
          variant="caption"
          accessibilityLiveRegion="polite"
          style={{color: colours.destructive}}>
          {error}
        </AppText>
      ) : support ? (
        <AppText variant="caption" colour="textTertiary">
          {support}
        </AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
})
