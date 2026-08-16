import {Button, ControlGroup, Host, Menu} from '@expo/ui/swift-ui'
import {controlSize, glassEffect} from '@expo/ui/swift-ui/modifiers'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {sfSymbolForIcon} from '@/platform/ui/buttons/sf-symbol-for-icon'
import {renderTapMenuItems} from '@/platform/ui/menus/native-menu-items'
import {toolbarGroupItemModifiers} from '@/platform/ui/menus/toolbar-chrome-modifiers'
import {OVERLAY_GLASS_HIT} from '@/platform/ui/menus/toolbar-chrome'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

export type ChromeGlassGroupButton = {
  kind: 'button'
  icon: AppIconName
  accessibilityLabel: string
  onPress: () => void
}

export type ChromeGlassGroupMenu = {
  kind: 'menu'
  accessibilityLabel: string
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
}

export type ChromeGlassGroupItem = ChromeGlassGroupButton | ChromeGlassGroupMenu

/**
 * SwiftUI ControlGroup for overlay trailing actions (share + overflow).
 * The group is the liquid glass capsule; inner controls stay plain extraLarge.
 *
 * Reference: Expo UI ControlGroup + glassEffect capsule
 * (https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/controlgroup/).
 */
export function ChromeGlassControlGroup({items}: {items: ChromeGlassGroupItem[]}) {
  const itemModifiers = toolbarGroupItemModifiers()

  return (
    <Host matchContents style={{minHeight: OVERLAY_GLASS_HIT}}>
      <ControlGroup
        modifiers={[
          glassEffect({
            glass: {variant: 'regular', interactive: true},
            shape: 'capsule',
          }),
          controlSize('extraLarge'),
        ]}>
        {items.map(item =>
          item.kind === 'button' ? (
            <Button
              key={item.accessibilityLabel}
              label={item.accessibilityLabel}
              systemImage={sfSymbolForIcon(item.icon) as never}
              modifiers={itemModifiers}
              onPress={item.onPress}
            />
          ) : (
            <Menu
              key={item.accessibilityLabel}
              label={item.accessibilityLabel}
              systemImage="ellipsis"
              modifiers={itemModifiers}>
              {renderTapMenuItems(item.actions, item.onAction)}
            </Menu>
          ),
        )}
      </ControlGroup>
    </Host>
  )
}
