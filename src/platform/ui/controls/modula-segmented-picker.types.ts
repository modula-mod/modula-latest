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
}
