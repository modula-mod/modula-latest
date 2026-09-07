import {View, type StyleProp, type ViewStyle} from 'react-native'

import {ModulaIcon} from '@/platform/ui/icons/modula-icon'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

export type ModulaActionButtonEmphasis = 'primary' | 'neutral' | 'inverse' | 'destructive' | 'quiet'
export type ModulaActionButtonSize = 'compact' | 'regular' | 'prominent'
export type ModulaActionButtonProps = {
  label: string
  accessibilityLabel?: string
  onPress?: () => void
  emphasis?: ModulaActionButtonEmphasis
  size?: ModulaActionButtonSize
  icon?: ModulaIconName
  disabled?: boolean
  loading?: boolean
  selected?: boolean
  loadingLabel?: string
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

const roleForEmphasis = (emphasis: ModulaActionButtonEmphasis) => {
  if (emphasis === 'neutral') return 'secondary'
  if (emphasis === 'inverse') return 'primary'
  return emphasis
}

/** Compact lifecycle control for Get/Open/Install and related actions. */
export function ModulaActionButton({
  label,
  accessibilityLabel,
  onPress,
  emphasis = 'neutral',
  size = 'compact',
  icon,
  disabled = false,
  loading = false,
  selected,
  loadingLabel,
  fullWidth = false,
  style,
  testID,
}: ModulaActionButtonProps) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const blocked = disabled || loading
  const shown = loading ? (loadingLabel ?? `${label}…`) : label
  return (
    <View style={[{alignSelf: fullWidth ? 'stretch' : 'flex-start'}, style]}>
      <button
        aria-busy={loading || undefined}
        aria-label={accessibilityLabel ?? label}
        aria-pressed={selected}
        className="modula-web-ui modula-web-button"
        data-full-width={String(fullWidth)}
        data-role={roleForEmphasis(emphasis)}
        data-size={size}
        data-testid={testID}
        disabled={blocked}
        onClick={onPress}
        style={modulaWebCssVariables(tokens, {reduceTransparency})}
        type="button">
        <span className="modula-web-button-visual">
          {icon ? <ModulaIcon name={icon} size={16} colour="currentColor" /> : null}
          {shown}
        </span>
      </button>
    </View>
  )
}
