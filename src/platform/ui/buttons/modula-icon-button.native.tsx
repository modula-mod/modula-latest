import {Button, Host} from '@expo/ui/swift-ui'
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers'
import type {StyleProp, ViewStyle} from 'react-native'

import type {AppIconName} from '@/components/primitives/AppIcon'
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

const SF_FOR_ICON: Partial<Record<AppIconName, string>> = {
  back: 'chevron.left',
  more: 'ellipsis',
  share: 'square.and.arrow.up',
  create: 'plus',
  search: 'magnifyingglass',
  close: 'xmark',
  settings: 'gearshape',
  messages: 'bubble.left.and.bubble.right',
  menu: 'line.3.horizontal',
}

/**
 * Native Expo UI icon button — SwiftUI Button + systemImage + iconOnly + glass circle.
 * Matches Expo docs: label kept for a11y, labelStyle('iconOnly') hides the title.
 */
export function ModulaIconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  chrome = 'glass',
  style,
  testID,
}: ModulaIconButtonProps) {
  const systemImage = SF_FOR_ICON[icon] ?? 'circle'
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
