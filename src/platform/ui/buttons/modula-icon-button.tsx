import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ModulaIconButtonProps = {
  icon: AppIconName
  accessibilityLabel: string
  onPress?: () => void
  disabled?: boolean
  colour?: string
  size?: number
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** 44pt icon control for toolbars and engagement rows. */
export function ModulaIconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  colour,
  size = 22,
  style,
  testID,
}: ModulaIconButtonProps) {
  const {colours} = useThemeTokens()

  return (
    <AppPressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[styles.target, style]}>
      <AppIcon name={icon} size={size} colour={colour ?? colours.textSecondary} />
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  target: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
  },
})
