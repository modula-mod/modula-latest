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
   * `glass` — dense liquid-glass wrapper (sticky chrome); plain selected thumb.
   * `plain` — label / chip tabs (use with `scrollable` for a horizontal menu).
   */
  appearance?: ModulaSegmentedAppearance
  /**
   * Horizontal scrollable menu. Prefer with `appearance="plain"`.
   * (UISegmentedControl itself cannot scroll.)
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
