import {View, type StyleProp, type ViewStyle} from 'react-native'

import {ModulaIcon} from '@/platform/ui/icons/modula-icon'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

export type ModulaIconButtonProps = {
  icon: ModulaIconName
  accessibilityLabel: string
  onPress?: () => void
  disabled?: boolean
  chrome?: 'glass' | 'bordered' | 'plain'
  style?: StyleProp<ViewStyle>
  testID?: string
  colour?: string
  size?: number
}

/** DOM button state model; painted icon geometry remains separate from hit size. */
export function ModulaIconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  chrome = 'plain',
  style,
  testID,
  colour,
  size = 20,
}: ModulaIconButtonProps) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  return (
    <View style={style}>
      <button
        aria-label={accessibilityLabel}
        className="modula-web-ui modula-web-icon-button"
        data-chrome={chrome}
        data-reduce-transparency={reduceTransparency ? 'true' : undefined}
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
        style={modulaWebCssVariables(tokens, {reduceTransparency})}
        type="button">
        <span className="modula-web-icon-button-visual">
          <ModulaIcon name={icon} size={size} colour={colour ?? tokens.colours.text} />
        </span>
      </button>
    </View>
  )
}
