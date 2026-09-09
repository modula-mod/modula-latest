import type {CSSProperties, ReactNode} from 'react'
import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

export type ModulaHorizontalScrollProps = {
  children: ReactNode
  accessibilityLabel: string
  contentContainerStyle?: StyleProp<ViewStyle>
  testID?: string
}

/** Keyboard-focusable native browser overflow; normal page scrolling is untouched. */
export function ModulaHorizontalScroll({
  children,
  accessibilityLabel,
  contentContainerStyle,
  testID,
}: ModulaHorizontalScrollProps) {
  return (
    <div
      aria-label={accessibilityLabel}
      className="modula-web-horizontal-scroll"
      data-testid={testID}
      role="region"
      tabIndex={0}>
      <div style={StyleSheet.flatten(contentContainerStyle) as unknown as CSSProperties}>{children}</div>
    </div>
  )
}
