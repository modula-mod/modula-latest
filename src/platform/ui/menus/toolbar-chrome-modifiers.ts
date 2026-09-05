import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  frame,
  imageScale,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers'

import type {ToolbarChrome} from '@/platform/ui/menus/toolbar-chrome'
import {TOOLBAR_HIT} from '@/platform/ui/menus/toolbar-chrome'

/**
 * Shared SwiftUI modifiers for toolbar icons.
 *
 * Overlay glass uses the regular native size. The outer Host preserves the
 * 44pt target; the painted control should not compete with the title.
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

/**
 * Plain glyphs inside an overlay glass capsule.
 * Same control size as Profile `chrome="plain"` header items, pinned to the
 * 44pt toolbar hit so Expo Host cannot collapse to the SF Symbol.
 */
export function toolbarGroupItemModifiers() {
  return [
    buttonStyle('plain'),
    labelStyle('iconOnly'),
    controlSize('regular'),
    imageScale('large'),
    frame({
      alignment: 'center',
      height: TOOLBAR_HIT,
      width: TOOLBAR_HIT,
    }),
  ]
}
