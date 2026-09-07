import type {ReactNode} from 'react'
import {ScrollView, type StyleProp, type ViewStyle} from 'react-native'

export type ModulaHorizontalScrollProps = {
  children: ReactNode
  accessibilityLabel: string
  contentContainerStyle?: StyleProp<ViewStyle>
  testID?: string
}

/** Native horizontal overflow with an explicit accessible region label. */
export function ModulaHorizontalScroll({
  children,
  accessibilityLabel,
  contentContainerStyle,
  testID,
}: ModulaHorizontalScrollProps) {
  return (
    <ScrollView
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={contentContainerStyle}
      focusable
      horizontal
      showsHorizontalScrollIndicator={false}
      testID={testID}>
      {children}
    </ScrollView>
  )
}
