import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type IconButtonProps = {
  icon: AppIconName
  label: string
  onPress?: () => void
  selected?: boolean
  disabled?: boolean
  size?: number
  style?: StyleProp<ViewStyle>
}

export function IconButton({
  icon,
  label,
  onPress,
  selected,
  disabled,
  size = 44,
  style,
}: IconButtonProps) {
  const {colours} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityState={{selected, disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          minHeight: size,
          minWidth: size,
          backgroundColor: selected ? colours.accentSubtle : 'transparent',
        },
        style,
      ]}>
      <AppIcon
        name={icon}
        colour={selected ? colours.accent : colours.textSecondary}
      />
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
