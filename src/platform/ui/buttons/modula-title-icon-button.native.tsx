import {Button, Host} from '@expo/ui/swift-ui'
import {
  buttonStyle,
  controlSize,
  labelStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers'
import type {StyleProp, ViewStyle} from 'react-native'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {sfSymbolForIcon} from '@/platform/ui/buttons/sf-symbol-for-icon'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ModulaTitleIconButtonProps = {
  icon: AppIconName
  label: string
  onPress?: () => void
  disabled?: boolean
  /**
   * plain — glyph + title, no fill (default).
   * bordered — light capsule chrome.
   * prominent — accent capsule (primary CTAs like Compose).
   */
  chrome?: 'plain' | 'bordered' | 'prominent'
  /** Stretch horizontally (Compose and other dual-content pills). */
  stretch?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Expo UI Button with titleAndIcon — for icon + label controls that must
 * stretch (Compose pill, quick actions). Not for icon-only chrome.
 */
export function ModulaTitleIconButton({
  icon,
  label,
  onPress,
  disabled,
  chrome = 'plain',
  stretch = false,
  style,
  testID,
}: ModulaTitleIconButtonProps) {
  const {colours} = useThemeTokens()
  const styleName =
    chrome === 'prominent'
      ? 'borderedProminent'
      : chrome === 'bordered'
        ? 'bordered'
        : 'plain'

  const modifiers = [
    buttonStyle(styleName),
    labelStyle('titleAndIcon'),
    controlSize('regular'),
    ...(chrome === 'prominent' ? [tint(colours.accent)] : []),
  ]

  return (
    <Host
      matchContents
      style={[stretch ? {alignSelf: 'stretch', minWidth: 132} : null, style]}>
      <Button
        label={label}
        systemImage={sfSymbolForIcon(icon) as never}
        onPress={disabled ? undefined : onPress}
        modifiers={modifiers}
        testID={testID}
      />
    </Host>
  )
}
