import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ModulaIconButtonProps = {
  icon: AppIconName
  accessibilityLabel: string
  onPress?: () => void
  disabled?: boolean
  /** Default plain — glyph only. Glass is opt-in for rare surfaces. */
  chrome?: 'glass' | 'bordered' | 'plain'
  style?: StyleProp<ViewStyle>
  testID?: string
  /** @deprecated Prefer chrome; kept for older call sites. */
  colour?: string
  size?: number
}

/**
 * Cross-platform icon button. Native uses Expo UI via
 * modula-icon-button.native.tsx; this file is the RN / web fallback.
 * Default chrome is plain (no filled background).
 */
export function ModulaIconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  chrome = 'plain',
  style,
  testID,
  colour,
  size = 22,
}: ModulaIconButtonProps) {
  const {colours} = useThemeTokens()

  if (chrome === 'plain' || chrome === 'bordered') {
    return (
      <AppPressable
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{disabled: !!disabled}}
        disabled={disabled}
        onPress={onPress}
        style={[styles.target, style]}>
        <AppIcon
          name={icon}
          size={size}
          colour={colour ?? colours.text}
        />
      </AppPressable>
    )
  }

  return (
    <AppPressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[styles.target, style]}>
      <LiquidGlassChrome interactive fallback="clear" style={styles.glass}>
        <AppIcon name={icon} size={18} colour={colour ?? colours.text} />
      </LiquidGlassChrome>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  glass: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  target: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
  },
})
