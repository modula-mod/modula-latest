import type {StyleProp, ViewStyle} from 'react-native'

export type ModulaStepperProps = {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function clampModulaStepperValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
