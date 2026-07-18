import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
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
 * Circular liquid-glass chrome control for header back / options.
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
    <LiquidGlassChrome
      interactive
      fallback="raised"
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}>
      <AppIcon name={icon} size={iconSize} colour={colours.text} />
    </LiquidGlassChrome>
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
    justifyContent: 'center',
  },
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
})
