import type {StyleProp, ViewStyle} from 'react-native'

export type ModulaSegmentedOption = {
  value: string
  label: string
  disabled?: boolean
}

export type ModulaSegmentedPickerProps = {
  options: ModulaSegmentedOption[]
  value: string
  onValueChange: (value: string) => void
  /** Accessibility / VoiceOver label for the control. */
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
  /**
   * Horizontal overflow mode. Uses a native SwiftUI ScrollView of buttons —
   * UISegmentedControl itself cannot scroll (it always compresses).
   */
  scrollable?: boolean
  /** Min width per scrollable segment button (default 86). */
  segmentMinWidth?: number
  /**
   * Max width of the visible viewport. Scroll content may be wider.
   * Defaults to 340 when `scrollable`.
   */
  maxWidth?: number
}
