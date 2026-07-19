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
   * When true, the segmented control is laid out wider than the viewport and
   * wrapped in a horizontal ScrollView so many segments can be panned.
   */
  scrollable?: boolean
  /** Approximate width per segment when `scrollable` (default 88). */
  segmentMinWidth?: number
  /**
   * Max width of the visible control (Host / viewport). Scroll content may be
   * wider. Defaults to 360 when `scrollable`, otherwise full width.
   */
  maxWidth?: number
}
