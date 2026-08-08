import {Button, Host} from '@expo/ui'
import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  type ModulaButtonRole,
  universalVariantForRole,
} from '@/platform/ui/buttons/button-role'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ModulaButtonProps = {
  label: string
  onPress?: () => void
  role?: ModulaButtonRole
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Native Expo UI button host. Features import `ModulaButton` only. */
export function ModulaButton({
  label,
  onPress,
  role = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityLabel,
  style,
  testID,
}: ModulaButtonProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const isDisabled = disabled || loading

  // Full-width product CTAs: stretch shell with theme chrome. Host+matchContents
  // alone sizes to the label width and looks broken on auth forms.
  if (fullWidth || role === 'quiet') {
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
          styles.stretch,
          {
            backgroundColor,
            borderColor,
            borderRadius: radius.md,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            opacity: isDisabled ? 0.45 : 1,
            minHeight: role === 'quiet' ? 40 : 48,
            borderWidth:
              role === 'secondary' || role === 'glass'
                ? StyleSheet.hairlineWidth
                : 0,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
            width: fullWidth ? '100%' : undefined,
          },
          style,
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
      </AppPressable>
    )
  }

  return (
    <Host
      matchContents
      style={[{minHeight: 44}, style]}
      seedColor={role === 'destructive' ? colours.destructive : colours.accent}>
      <Button
        label={loading ? `${label}…` : label}
        onPress={isDisabled ? undefined : onPress}
        variant={universalVariantForRole(role)}
        disabled={isDisabled}
        testID={testID}
      />
    </Host>
  )
}

const styles = StyleSheet.create({
  stretch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
