import {Pressable, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
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

/** Web / fallback checkbox. */
export function ModulaCheckbox({
  value,
  onValueChange,
  label,
  disabled,
  accessibilityLabel,
  style,
  testID,
}: ModulaCheckboxProps) {
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{checked: value, disabled: Boolean(disabled)}}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[{minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing[3]}, style]}
      testID={testID}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.small ?? 4,
          borderWidth: 1.5,
          borderColor: value ? colours.accent : colours.border,
          backgroundColor: value ? colours.accent : 'transparent',
        }}
      />
      {label ? <AppText variant="body">{label}</AppText> : null}
    </Pressable>
  )
}
