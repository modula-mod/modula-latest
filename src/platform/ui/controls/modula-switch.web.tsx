import {View} from 'react-native'

import {KonstaToggle} from '@/platform/ui/adapters/konsta/toggle.web'
import type {ModulaSwitchProps} from '@/platform/ui/controls/modula-switch'

export function ModulaSwitch({
  accessibilityLabel,
  disabled,
  label,
  onValueChange,
  style,
  testID,
  value,
}: ModulaSwitchProps) {
  return (
    <View style={[{minHeight: 44, justifyContent: 'center'}, style]}>
      <KonstaToggle
        accessibilityLabel={accessibilityLabel ?? label ?? 'Toggle'}
        disabled={disabled}
        onValueChange={onValueChange}
        testID={testID}
        value={value}
      />
    </View>
  )
}
