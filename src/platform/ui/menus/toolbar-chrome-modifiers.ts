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
 * Overlay glass uses extraLarge (Expo UI glass circle example) so back / share
 * read as App Store controls. Glyphs inside a ControlGroup or header capsule
 * stay plain — the group/capsule is the glass, not a second disc.
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
    controlSize('extraLarge'),
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
