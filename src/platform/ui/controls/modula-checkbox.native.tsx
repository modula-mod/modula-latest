import {Checkbox, Host} from '@expo/ui'
import type {StyleProp, ViewStyle} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaCheckboxProps = {
  value: boolean
  onValueChange: (value: boolean) => void
  label?: string
  disabled?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Native Expo UI Checkbox adapter. */
export function ModulaCheckbox({
  value,
  onValueChange,
  label,
  disabled,
  accessibilityLabel,
  style,
  testID,
}: ModulaCheckboxProps) {
  const {colours, scheme} = useThemeTokens()

  return (
    <Host
      matchContents
      colorScheme={scheme}
      seedColor={colours.accent}
      style={[{minHeight: 44, justifyContent: 'center'}, style]}>
      <Checkbox
        value={value}
        onValueChange={onValueChange}
        label={label ?? accessibilityLabel}
        disabled={disabled}
        testID={testID}
      />
    </Host>
  )
}
