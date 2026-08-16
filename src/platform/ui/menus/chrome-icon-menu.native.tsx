import {Host, Menu} from '@expo/ui/swift-ui'
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {sfSymbolForIcon} from '@/platform/ui/buttons/sf-symbol-for-icon'
import {renderTapMenuItems} from '@/platform/ui/menus/native-menu-items'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

type ChromeIconMenuProps = {
  systemImage?: string
  icon?: AppIconName
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  accessibilityLabel: string
}

/**
 * Native SwiftUI Menu with a circular glass SF Symbol trigger.
 */
export function ChromeIconMenu({
  systemImage,
  icon = 'more',
  actions,
  onAction,
  accessibilityLabel,
}: ChromeIconMenuProps) {
  const symbol = systemImage ?? sfSymbolForIcon(icon)

  return (
    <Host matchContents>
      <Menu
        label={accessibilityLabel}
        systemImage={symbol as never}
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
