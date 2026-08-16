import {Host, Menu} from '@expo/ui/swift-ui'
import {
  buttonStyle,
  controlSize,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers'

import {renderTapMenuItems} from '@/platform/ui/menus/native-menu-items'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

type ChromeIconMenuProps = {
  systemImage: string
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  accessibilityLabel: string
}

/**
 * Native SwiftUI Menu with a plain SF Symbol trigger — no glass / filled disc.
 */
export function ChromeIconMenu({
  systemImage,
  actions,
  onAction,
  accessibilityLabel,
}: ChromeIconMenuProps) {
  return (
    <Host matchContents>
      <Menu
        label={accessibilityLabel}
        systemImage={systemImage as never}
        modifiers={[
          buttonStyle('plain'),
          labelStyle('iconOnly'),
          controlSize('regular'),
        ]}>
        {renderTapMenuItems(actions, onAction)}
      </Menu>
    </Host>
  )
}
