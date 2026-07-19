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
   * When set below `options.length`, the native segmented control starts with
   * this many segments and automatically loads more over time / on selection.
   * Omit or pass `options.length` to show everything immediately.
   */
  initialVisibleCount?: number
  /** How many segments to append each auto-load step. Default 2. */
  revealBatchSize?: number
  /** Delay before the first automatic reveal, then between batches. Default 700ms. */
  autoRevealIntervalMs?: number
  /** Fired whenever more options are revealed into the control. */
  onRevealMore?: (visibleCount: number) => void
}
