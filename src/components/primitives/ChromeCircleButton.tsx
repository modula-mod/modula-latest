import type {StyleProp, ViewStyle} from 'react-native'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'

type ChromeCircleButtonProps = {
  icon: AppIconName
  accessibilityLabel: string
  onPress?: () => void
  /** Visual-only — still renders native chrome; host owns press when false. */
  pressable?: boolean
  size?: number
  iconSize?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Header icon control — Expo UI plain icon button (no glass / filled disc).
 */
export function ChromeCircleButton({
  icon,
  accessibilityLabel,
  onPress,
  pressable = true,
  style,
}: ChromeCircleButtonProps) {
  return (
    <ModulaIconButton
      icon={icon}
      accessibilityLabel={accessibilityLabel}
      onPress={pressable ? onPress : undefined}
      chrome="plain"
      style={style}
    />
  )
}
