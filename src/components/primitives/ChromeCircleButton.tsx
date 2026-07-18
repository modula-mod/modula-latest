import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ChromeCircleButtonProps = {
  icon: AppIconName
  accessibilityLabel: string
  onPress?: () => void
  /** Visual-only glyph for hosts that already wrap press (e.g. ModulaMenu). */
  pressable?: boolean
  size?: number
  iconSize?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Circular chrome control used for header back / options (Board-style).
 * Dark circle + icon — shared across secondary headers and overflow menus.
 */
export function ChromeCircleButton({
  icon,
  accessibilityLabel,
  onPress,
  pressable = true,
  size = 36,
  iconSize = 18,
  style,
}: ChromeCircleButtonProps) {
  const {colours} = useThemeTokens()
  const circle = (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colours.surface2,
          borderColor: colours.border,
        },
        style,
      ]}>
      <AppIcon name={icon} size={iconSize} colour={colours.text} />
    </View>
  )

  if (!pressable || !onPress) {
    return (
      <View accessibilityLabel={accessibilityLabel} accessibilityRole="button">
        {circle}
      </View>
    )
  }

  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.hit}>
      {circle}
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
})
