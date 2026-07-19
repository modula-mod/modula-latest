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
   * `fit` — full-width segmented control (home feed modes).
   * `scroll` — horizontal rail; swipe near the right edge to reveal more.
   */
  layout?: 'fit' | 'scroll'
  /** How many options show before the first near-end reveal (`scroll`). */
  initialVisibleCount?: number
  /** Extra options revealed each time the user nears the right edge. */
  revealBatchSize?: number
  /** Fired when the scroll position approaches the trailing edge. */
  onNearEnd?: () => void
}
