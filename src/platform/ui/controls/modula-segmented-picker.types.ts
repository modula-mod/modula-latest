import type {StyleProp, ViewStyle} from 'react-native'

export type ModulaSegmentedOption = {
  value: string
  label: string
  disabled?: boolean
}

export type ModulaSegmentedAppearance = 'segmented' | 'glass' | 'plain'

export type ModulaSegmentedPickerProps = {
  options: ModulaSegmentedOption[]
  value: string
  onValueChange: (value: string) => void
  /** Accessibility / VoiceOver label for the control. */
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
  /**
   * `segmented` — classic system segmented control (UISegmentedControl on iOS).
   * `glass` — liquid-glass wrapper; selected thumb is a plain token capsule.
   * `plain` — label tabs only, no chrome around the menu.
   */
  appearance?: ModulaSegmentedAppearance
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
