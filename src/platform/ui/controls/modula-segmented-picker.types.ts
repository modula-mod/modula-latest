import type {StyleProp, ViewStyle} from 'react-native'

export type ModulaSegmentedOption = {
  value: string
  label: string
  disabled?: boolean
}

export type ModulaSegmentedAppearance =
  | 'segmented'
  | 'track'
  | 'glass'
  | 'plain'

export type ModulaSegmentedPickerProps = {
  options: ModulaSegmentedOption[]
  value: string
  onValueChange: (value: string) => void
  /** Accessibility / VoiceOver label for the control. */
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
  /**
   * `segmented` — system UISegmentedControl on iOS (Expo UI Host).
   * `track` — classic token segmented track (shared RN, all platforms).
   * `glass` — liquid-glass wrapper + token thumbs.
   * `plain` — label / chip tabs (use with `scrollable` for a horizontal menu).
   */
  appearance?: ModulaSegmentedAppearance
  /**
   * Horizontal scroll when segments do not fit the viewport.
   * With `appearance="segmented"`, uses UIKit UISegmentedControl translated
   * inside a clipped viewport (ScrollView compositing bleeds native labels).
   */
  scrollable?: boolean
  /** Min width per scrollable segment button (default 86). */
  segmentMinWidth?: number
  /**
   * Max width of the visible viewport. Scroll content may be wider.
   * Defaults to 340 when `scrollable`.
   */
  maxWidth?: number
  /**
   * When true with `appearance="track"`, omit the muted track fill and hug
   * content width — for nesting inside an outer liquid-glass capsule.
   */
  embedded?: boolean
}
