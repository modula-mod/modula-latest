import {View} from 'react-native'

import {KonstaCheckbox} from '@/platform/ui/adapters/konsta/checkbox.web'
import type {ModulaCheckboxProps} from '@/platform/ui/controls/modula-checkbox'

export function ModulaCheckbox({
  accessibilityLabel,
  disabled,
  label,
  onValueChange,
  style,
  testID,
  value,
}: ModulaCheckboxProps) {
  return (
    <View style={[{minHeight: 44, justifyContent: 'center'}, style]}>
      <KonstaCheckbox
        accessibilityLabel={accessibilityLabel ?? label ?? 'Checkbox'}
        disabled={disabled}
        label={label}
        onValueChange={onValueChange}
        testID={testID}
        value={value}
      />
    </View>
  )
}
