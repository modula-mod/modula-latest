import {Host, Menu} from '@expo/ui/swift-ui'

import {renderTapMenuItems} from '@/platform/ui/menus/native-menu-items'
import type {ToolbarChrome} from '@/platform/ui/menus/toolbar-chrome'
import {OVERLAY_GLASS_HIT, TOOLBAR_HIT} from '@/platform/ui/menus/toolbar-chrome'
import {toolbarIconModifiers} from '@/platform/ui/menus/toolbar-chrome-modifiers'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

type ChromeOverflowMenuProps = {
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  accessibilityLabel?: string
  /** glass = overlay circle. plain = glyph inside a native header capsule. */
  chrome?: ToolbarChrome
}

/**
 * Native SwiftUI Menu. Overlay screens keep circular glass; native stack
 * headers pass `plain` so iOS 26 does not nest a disc inside the capsule.
 */
export function ChromeOverflowMenu({
  actions,
  onAction,
  accessibilityLabel = 'More actions',
  chrome = 'glass',
}: ChromeOverflowMenuProps) {
  const hit = chrome === 'glass' ? OVERLAY_GLASS_HIT : TOOLBAR_HIT
  return (
    <Host matchContents style={{minHeight: hit, minWidth: hit}}>
      <Menu
        label={accessibilityLabel}
        systemImage="ellipsis"
        modifiers={toolbarIconModifiers(chrome)}>
        {renderTapMenuItems(actions, onAction)}
      </Menu>
    </Host>
  )
}
