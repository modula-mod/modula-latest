import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers'

import type {ToolbarChrome} from '@/platform/ui/menus/toolbar-chrome'

/**
 * Shared SwiftUI modifiers for toolbar icons.
 * Overlay glass is large (App Store 44pt circle). Capsule glyphs are regular.
 */
export function toolbarIconModifiers(
  chrome: ToolbarChrome,
  options?: {glassAvailable?: boolean},
) {
  if (chrome === 'plain') {
    return [buttonStyle('plain'), labelStyle('iconOnly'), controlSize('regular')]
  }
  const styleName = options?.glassAvailable === false ? 'bordered' : 'glass'
  return [
    buttonStyle(styleName),
    labelStyle('iconOnly'),
    buttonBorderShape('circle'),
    controlSize('large'),
  ]
}
