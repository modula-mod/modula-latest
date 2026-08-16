import {Host, Menu} from '@expo/ui/swift-ui'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {sfSymbolForIcon} from '@/platform/ui/buttons/sf-symbol-for-icon'
import {renderTapMenuItems} from '@/platform/ui/menus/native-menu-items'
import type {ToolbarChrome} from '@/platform/ui/menus/toolbar-chrome'
import {toolbarIconModifiers} from '@/platform/ui/menus/toolbar-chrome-modifiers'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

type ChromeIconMenuProps = {
  systemImage?: string
  icon?: AppIconName
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  accessibilityLabel: string
  /** glass = overlay circle. plain = glyph inside a native header capsule. */
  chrome?: ToolbarChrome
}

/**
 * Native SwiftUI Menu. Overlay screens keep circular glass; native stack
 * headers pass `plain` so iOS 26 does not nest a disc inside the capsule.
 */
export function ChromeIconMenu({
  systemImage,
  icon = 'more',
  actions,
  onAction,
  accessibilityLabel,
  chrome = 'glass',
}: ChromeIconMenuProps) {
  const symbol = systemImage ?? sfSymbolForIcon(icon)

  return (
    <Host matchContents>
      <Menu
        label={accessibilityLabel}
        systemImage={symbol as never}
        modifiers={toolbarIconModifiers(chrome)}>
        {renderTapMenuItems(actions, onAction)}
      </Menu>
    </Host>
  )
}
