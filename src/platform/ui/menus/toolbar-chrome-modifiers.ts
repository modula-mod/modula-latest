import {buttonBorderShape, buttonStyle, controlSize, labelStyle} from '@expo/ui/swift-ui/modifiers'

import type {ToolbarChrome} from '@/platform/ui/menus/toolbar-chrome'

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

/** Plain glyphs inside a SwiftUI ControlGroup (the group is the glass). */
export function toolbarGroupItemModifiers() {
  return [buttonStyle('plain'), labelStyle('iconOnly'), controlSize('extraLarge')]
}
