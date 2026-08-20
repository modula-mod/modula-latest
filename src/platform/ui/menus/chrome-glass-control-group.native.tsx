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
  overlayGroupWidth,
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
if (overlayGroupWidth(2) !== OVERLAY_GROUP_MIN_WIDTH) {
  throw new Error('overlayGroupWidth(2) must equal OVERLAY_GROUP_MIN_WIDTH')
}

/**
 * Overlay trailing actions, sized like Profile's header capsule.
 *
 * Layout is RN-owned: 44pt tall, 22pt gap, 44pt slots. Width follows item
 * count (2 → 110pt, 3 → 176pt). Expo Host is given an explicit 44×44 frame
 * and does not matchContents. The capsule itself is LiquidGlassChrome
 * (Callstack / expo-glass-effect / BlurView) so photography shows through.
 */
export function ChromeGlassControlGroup({items}: {items: ChromeGlassGroupItem[]}) {
  const itemModifiers = toolbarGroupItemModifiers()
  const width = overlayGroupWidth(items.length)

  return (
    <LiquidGlassChrome
      interactive
      fallback="clear"
      contentLayout="flow"
      style={[styles.capsule, {minWidth: width, width}]}>
      <View style={[styles.row, {minWidth: width, width}]}>
        {items.map(item => (
          <View key={item.accessibilityLabel} style={styles.hit}>
            <Host style={styles.hit}>
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
          </View>
        ))}
      </View>
    </LiquidGlassChrome>
  )
}

const styles = StyleSheet.create({
  capsule: {
    borderRadius: OVERLAY_GROUP_HIT / 2,
    flexGrow: 0,
    flexShrink: 0,
    height: OVERLAY_GROUP_HIT,
    minHeight: OVERLAY_GROUP_HIT,
    overflow: 'hidden',
  },
  hit: {
    alignItems: 'center',
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
    width: OVERLAY_GROUP_HIT,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    gap: HEADER_ICON_PAIR_GAP,
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
  },
})
