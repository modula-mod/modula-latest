import {Host, Switch} from '@expo/ui'
import type {StyleProp, ViewStyle} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaSwitchProps = {
  value: boolean
  onValueChange: (value: boolean) => void
  label?: string
  disabled?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Native Expo UI Switch — product code imports `ModulaSwitch` only. */
export function ModulaSwitch({
  value,
  onValueChange,
  label,
  disabled,
  accessibilityLabel,
  style,
  testID,
}: ModulaSwitchProps) {
  const {colours, scheme} = useThemeTokens()

  return (
    <Host
      matchContents
      colorScheme={scheme}
      seedColor={colours.accent}
      style={[{minHeight: 44, justifyContent: 'center'}, style]}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        label={label ?? accessibilityLabel}
        disabled={disabled}
        testID={testID}
      />
    </Host>
  )
}
