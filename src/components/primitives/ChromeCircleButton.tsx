import {View, type StyleProp, type ViewStyle} from 'react-native'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'

type ChromeCircleButtonProps = {
  icon: AppIconName
  accessibilityLabel: string
  onPress?: () => void
  /** Visual-only — still renders native chrome; host owns press when false. */
  pressable?: boolean
  /**
   * App Store overlay chrome: circular glass (default).
   * `plain` is glyph-only for dense nav bars.
   */
  chrome?: 'glass' | 'bordered' | 'plain'
  size?: number
  iconSize?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Circular toolbar control — Expo UI glass + circle by default
 * (App Store back / share). Falls back to bordered when glass is unavailable.
 */
export function ChromeCircleButton({
  icon,
  accessibilityLabel,
  onPress,
  pressable = true,
  chrome = 'glass',
  style,
}: ChromeCircleButtonProps) {
  if (chrome === 'glass') {
    return (
      <View style={style}>
        <ChromeGlassControlGroup
          items={[{
            kind: 'button',
            icon,
            accessibilityLabel,
            disabled: !pressable || !onPress,
            onPress,
          }]}
        />
      </View>
    )
  }

  return (
    <ModulaIconButton
      icon={icon}
      accessibilityLabel={accessibilityLabel}
      onPress={pressable ? onPress : undefined}
      chrome={chrome}
      style={style}
    />
  )
}
