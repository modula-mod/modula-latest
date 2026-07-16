import {Host, Switch} from '@expo/ui'
import {View} from 'react-native'

type SystemSwitchProps = {
  value: boolean
  onValueChange: (value: boolean) => void
  label?: string
  disabled?: boolean
  testID?: string
}

/**
 * Thin adapter over @expo/ui universal Switch.
 * Features must import this — not @expo/ui/swift-ui.
 */
export function SystemSwitch({
  value,
  onValueChange,
  label,
  disabled,
  testID,
}: SystemSwitchProps) {
  return (
    <View style={{minHeight: 44, justifyContent: 'center'}}>
      <Host matchContents>
        <Switch
          value={value}
          onValueChange={onValueChange}
          label={label}
          disabled={disabled}
          testID={testID}
        />
      </Host>
    </View>
  )
}
