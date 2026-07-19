import type {StyleProp, ViewStyle} from 'react-native'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'

type IconButtonProps = {
  icon: AppIconName
  label: string
  onPress?: () => void
  selected?: boolean
  disabled?: boolean
  size?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Legacy primitive — routes to Expo UI plain ModulaIconButton.
 * Prefer ModulaIconButton / ChromeCircleButton at call sites.
 */
export function IconButton({
  icon,
  label,
  onPress,
  disabled,
  style,
}: IconButtonProps) {
  return (
    <ModulaIconButton
      icon={icon}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      chrome="plain"
      style={style}
    />
  )
}
