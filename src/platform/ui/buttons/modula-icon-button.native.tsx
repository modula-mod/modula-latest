import {Button, Host} from '@expo/ui/swift-ui'
import type {StyleProp, ViewStyle} from 'react-native'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {sfSymbolForIcon} from '@/platform/ui/buttons/sf-symbol-for-icon'
import {TOOLBAR_HIT} from '@/platform/ui/menus/toolbar-chrome'
import {toolbarIconModifiers} from '@/platform/ui/menus/toolbar-chrome-modifiers'
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
  const modifiers = toolbarIconModifiers(chrome === 'plain' ? 'plain' : 'glass', {
    glassAvailable: chrome === 'glass' && glassOk,
  })

  return (
    <Host matchContents style={[{minHeight: TOOLBAR_HIT, minWidth: TOOLBAR_HIT}, style]}>
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
