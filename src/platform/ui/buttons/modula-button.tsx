import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

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
  fullWidth?: boolean
  size?: 'compact' | 'regular' | 'prominent'
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
  fullWidth = false,
  size,
  accessibilityLabel,
  style,
  testID,
}: ModulaButtonProps) {
  const {colours, controls, radius, spacing} = useThemeTokens()
  const isDisabled = disabled || loading
  const resolvedSize = size ?? (role === 'quiet' || role === 'plain' ? 'compact' : 'regular')

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
      : role === 'quiet'
        ? colours.accent
        : colours.text

  return (
    <AppPressable
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{disabled: isDisabled}}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.target,
        {
          opacity: isDisabled ? 0.45 : 1,
          minHeight: controls.touchTarget.minimum,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}>
      <View
        style={[
          styles.visual,
          {
            backgroundColor,
            borderColor,
            borderRadius: radius.md,
            minHeight: controls.controlHeight[resolvedSize],
            paddingHorizontal: resolvedSize === 'compact' ? spacing[3] : spacing[4],
            paddingVertical: resolvedSize === 'compact' ? spacing[1] : spacing[2],
            width: fullWidth ? '100%' : undefined,
          },
        ]}>
        <AppText
          variant="label"
          style={{
            color: labelColour,
            textAlign: 'center',
            fontWeight: role === 'quiet' ? '500' : '600',
          }}>
          {loading ? `${label}…` : label}
        </AppText>
      </View>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  target: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  visual: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
})
