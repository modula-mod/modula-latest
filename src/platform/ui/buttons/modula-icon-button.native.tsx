import {Button, Host} from '@expo/ui/swift-ui'
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers'
import type {StyleProp, ViewStyle} from 'react-native'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {sfSymbolForIcon} from '@/platform/ui/buttons/sf-symbol-for-icon'
import {isCallstackLiquidGlassNativeAvailable} from '@/platform/ui/navigation/liquid-glass-availability'
import {isNativeGlassRuntimeAvailable} from '@/theme/materials/nativeMaterial'

type ModulaIconButtonProps = {
  icon: AppIconName
  accessibilityLabel: string
  onPress?: () => void
  disabled?: boolean
  chrome?: 'glass' | 'bordered' | 'plain'
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Native Expo UI icon button — SwiftUI Button + systemImage + iconOnly.
 * Default chrome is plain (no glass / filled disc).
 */
export function ModulaIconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  chrome = 'plain',
  style,
  testID,
}: ModulaIconButtonProps) {
  const systemImage = sfSymbolForIcon(icon)
  const glassOk =
    chrome === 'glass' &&
    (isNativeGlassRuntimeAvailable() || isCallstackLiquidGlassNativeAvailable())
  const styleName =
    chrome === 'plain' ? 'plain' : glassOk ? 'glass' : 'bordered'

  // Plain = glyph only (no filled disc). Glass/bordered keep circular chrome.
  const modifiers =
    chrome === 'plain'
      ? [buttonStyle('plain'), labelStyle('iconOnly'), controlSize('regular')]
      : [
          buttonStyle(styleName),
          labelStyle('iconOnly'),
          buttonBorderShape('circle'),
          controlSize('regular'),
        ]

  return (
    <Host matchContents style={style}>
      <Button
        label={accessibilityLabel}
        systemImage={systemImage as never}
        onPress={disabled ? undefined : onPress}
        modifiers={modifiers}
        testID={testID}
      />
    </Host>
  )
}
