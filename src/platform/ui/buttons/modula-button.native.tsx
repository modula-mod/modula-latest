import {Button, Host} from '@expo/ui'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  type ModulaButtonRole,
  universalVariantForRole,
} from '@/platform/ui/buttons/button-role'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaButtonProps = {
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

/** Native Expo UI button host. Features import `ModulaButton` only. */
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

  return (
    <Host
      matchContents
      style={[{minHeight: controls.touchTarget.minimum}, style]}
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
  visual: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
})
