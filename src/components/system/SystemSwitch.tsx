import {Switch, View} from 'react-native'

type SystemSwitchProps = {
  value: boolean
  onValueChange: (value: boolean) => void
  label?: string
  disabled?: boolean
  testID?: string
}

/** Thin adapter over the React Native Switch. */
export function SystemSwitch({
  value,
  onValueChange,
  label,
  disabled,
  testID,
}: SystemSwitchProps) {
  return (
    <View style={{minHeight: 44, justifyContent: 'center'}}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        disabled={disabled}
        testID={testID}
      />
    </View>
  )
}
