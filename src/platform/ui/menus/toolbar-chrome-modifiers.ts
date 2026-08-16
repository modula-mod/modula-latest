import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers'

import type {ToolbarChrome} from '@/platform/ui/menus/toolbar-chrome'

/**
 * Shared SwiftUI modifiers for toolbar icons.
 * Regular control size so header glyphs, overlay circles, and menus match.
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
    controlSize('regular'),
  ]
}
