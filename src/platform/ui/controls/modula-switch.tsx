import {Switch, View, type StyleProp, type ViewStyle} from 'react-native'

export type ModulaSwitchProps = {
  value: boolean
  onValueChange: (value: boolean) => void
  label?: string
  disabled?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Web / fallback switch (no platform Expo UI imports). */
export function ModulaSwitch({
  value,
  onValueChange,
  label,
  disabled,
  accessibilityLabel,
  style,
  testID,
}: ModulaSwitchProps) {
  return (
    <View style={[{minHeight: 44, justifyContent: 'center'}, style]}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={accessibilityLabel ?? label}
        disabled={disabled}
        testID={testID}
      />
    </View>
  )
}
