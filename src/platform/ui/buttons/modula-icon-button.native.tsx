import {Button, Host} from '@expo/ui/swift-ui'
import type {StyleProp, ViewStyle} from 'react-native'

import {
  modulaIconDefinition,
  type ModulaIconName,
} from '@/platform/ui/icons/modula-icon-registry'
import {TOOLBAR_HIT, OVERLAY_GLASS_HIT} from '@/platform/ui/menus/toolbar-chrome'
import {toolbarIconModifiers} from '@/platform/ui/menus/toolbar-chrome-modifiers'
import {isCallstackLiquidGlassNativeAvailable} from '@/platform/ui/navigation/liquid-glass-availability'
import {isNativeGlassRuntimeAvailable} from '@/theme/materials/nativeMaterial'

type ModulaIconButtonProps = {
  icon: ModulaIconName
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
  const systemImage = modulaIconDefinition(icon).sf
  const glassOk =
    chrome === 'glass' &&
    (isNativeGlassRuntimeAvailable() || isCallstackLiquidGlassNativeAvailable())
  const modifiers = toolbarIconModifiers(chrome === 'plain' ? 'plain' : 'glass', {
    glassAvailable: chrome === 'glass' && glassOk,
  })

  const hit = chrome === 'plain' ? TOOLBAR_HIT : OVERLAY_GLASS_HIT
  return (
    <Host matchContents style={[{minHeight: hit, minWidth: hit}, style]}>
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
