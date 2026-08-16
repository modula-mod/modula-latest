import {StyleSheet, View} from 'react-native'
import {Button, Host, Menu} from '@expo/ui/swift-ui'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {sfSymbolForIcon} from '@/platform/ui/buttons/sf-symbol-for-icon'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {renderTapMenuItems} from '@/platform/ui/menus/native-menu-items'
import {toolbarGroupItemModifiers} from '@/platform/ui/menus/toolbar-chrome-modifiers'
import {
  OVERLAY_GROUP_GAP,
  OVERLAY_GROUP_HIT,
  OVERLAY_GROUP_MIN_WIDTH,
  TOOLBAR_HIT,
} from '@/platform/ui/menus/toolbar-chrome'
import {HEADER_ICON_PAIR_GAP} from '@/platform/ui/navigation/plain-header-items'
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

if (OVERLAY_GROUP_HIT !== TOOLBAR_HIT || HEADER_ICON_PAIR_GAP !== OVERLAY_GROUP_GAP) {
  throw new Error('Overlay group must match Profile header sizes (44pt hit, 22pt gap)')
}

/**
 * Overlay trailing share + overflow, sized like Profile's header capsule.
 *
 * Each glyph lives in a 44×44 Host that does not shrink to the SF Symbol.
 * Gap is Profile's 22pt `HEADER_ICON_PAIR_GAP`.
 * The capsule is LiquidGlassChrome — not compact SwiftUI ControlGroup.
 */
export function ChromeGlassControlGroup({items}: {items: ChromeGlassGroupItem[]}) {
  const itemModifiers = toolbarGroupItemModifiers()

  return (
    <LiquidGlassChrome
      interactive
      fallback="clear"
      contentLayout="flow"
      style={styles.capsule}>
      <View style={styles.row}>
        {items.map(item => (
          <Host key={item.accessibilityLabel} style={styles.hit}>
            {item.kind === 'button' ? (
              <Button
                label={item.accessibilityLabel}
                systemImage={sfSymbolForIcon(item.icon) as never}
                modifiers={itemModifiers}
                onPress={item.onPress}
              />
            ) : (
              <Menu
                label={item.accessibilityLabel}
                systemImage="ellipsis"
                modifiers={itemModifiers}>
                {renderTapMenuItems(item.actions, item.onAction)}
              </Menu>
            )}
          </Host>
        ))}
      </View>
    </LiquidGlassChrome>
  )
}

const styles = StyleSheet.create({
  capsule: {
    borderRadius: OVERLAY_GROUP_HIT / 2,
    height: OVERLAY_GROUP_HIT,
    minHeight: OVERLAY_GROUP_HIT,
    minWidth: OVERLAY_GROUP_MIN_WIDTH,
  },
  hit: {
    height: OVERLAY_GROUP_HIT,
    width: OVERLAY_GROUP_HIT,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: HEADER_ICON_PAIR_GAP,
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
    minWidth: OVERLAY_GROUP_MIN_WIDTH,
    paddingHorizontal: 6,
  },
})
