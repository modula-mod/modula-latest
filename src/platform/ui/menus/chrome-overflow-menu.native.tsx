import {Host, Menu} from '@expo/ui/swift-ui'
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers'

import {renderTapMenuItems} from '@/platform/ui/menus/native-menu-items'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

type ChromeOverflowMenuProps = {
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  accessibilityLabel?: string
}

/**
 * Native SwiftUI Menu with an App Store-style circular glass ellipsis.
 */
export function ChromeOverflowMenu({
  actions,
  onAction,
  accessibilityLabel = 'More actions',
}: ChromeOverflowMenuProps) {
  return (
    <Host matchContents>
      <Menu
        label={accessibilityLabel}
        systemImage="ellipsis"
        modifiers={[
          buttonStyle('glass'),
          labelStyle('iconOnly'),
          buttonBorderShape('circle'),
          controlSize('large'),
        ]}>
        {renderTapMenuItems(actions, onAction)}
      </Menu>
    </Host>
  )
}
