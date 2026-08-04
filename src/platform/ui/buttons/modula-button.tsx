import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModulaButtonRole} from '@/platform/ui/buttons/button-role'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ModulaButtonProps = {
  label: string
  onPress?: () => void
  role?: ModulaButtonRole
  disabled?: boolean
  loading?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Web / fallback Modula button (no direct SwiftUI imports). */
export function ModulaButton({
  label,
  onPress,
  role = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
  testID,
}: ModulaButtonProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const isDisabled = disabled || loading

  const backgroundColor =
    role === 'primary'
      ? colours.accent
      : role === 'destructive'
        ? colours.destructive
        : role === 'secondary' || role === 'glass'
          ? colours.surface
          : 'transparent'
  const borderColor =
    role === 'secondary' || role === 'glass' ? colours.border : 'transparent'
  const labelColour =
    role === 'primary' || role === 'destructive'
      ? colours.accentForeground
      : colours.text

  return (
    <AppPressable
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{disabled: isDisabled}}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderRadius: radius.md,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          opacity: isDisabled ? 0.45 : 1,
          minHeight: 44,
        },
        style,
      ]}>
      <AppText variant="label" style={{color: labelColour}}>
        {loading ? `${label}…` : label}
      </AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
})
