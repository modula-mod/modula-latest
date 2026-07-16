import {Button, Host} from '@expo/ui'
import type {StyleProp, ViewStyle} from 'react-native'

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
  style,
  testID,
}: ModulaButtonProps) {
  const {colours} = useThemeTokens()
  const isDisabled = disabled || loading

  return (
    <Host matchContents style={style} seedColor={role === 'destructive' ? colours.destructive : colours.accent}>
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
