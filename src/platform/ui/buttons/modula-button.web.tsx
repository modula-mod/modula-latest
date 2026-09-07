import {View, type StyleProp, type ViewStyle} from 'react-native'

import type {ModulaButtonRole} from '@/platform/ui/buttons/button-role'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

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

/** DOM-native web button with compact paint geometry and a 44px hit target. */
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
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const blocked = disabled || loading
  const resolvedSize = size ?? (role === 'quiet' || role === 'plain' || role === 'inline' ? 'compact' : 'regular')
  return (
    <View style={[{alignSelf: fullWidth ? 'stretch' : 'flex-start'}, style]}>
      <button
        aria-busy={loading || undefined}
        aria-label={accessibilityLabel ?? label}
        className="modula-web-ui modula-web-button"
        data-full-width={String(fullWidth)}
        data-role={role}
        data-size={resolvedSize}
        data-testid={testID}
        disabled={blocked}
        onClick={onPress}
        style={modulaWebCssVariables(tokens, {reduceTransparency})}
        type="button">
        <span className="modula-web-button-visual">{loading ? `${label}…` : label}</span>
      </button>
    </View>
  )
}
