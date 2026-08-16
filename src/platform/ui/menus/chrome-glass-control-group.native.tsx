import {StyleSheet, View} from 'react-native'
import {Button, Host, Menu} from '@expo/ui/swift-ui'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {sfSymbolForIcon} from '@/platform/ui/buttons/sf-symbol-for-icon'
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
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

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
 * and does not matchContents. Callstack / SwiftUI ControlGroup / BlurView
 * are not used — they shrink or wash out to white on overlay headers.
 */
export function ChromeGlassControlGroup({items}: {items: ChromeGlassGroupItem[]}) {
  const {scheme} = useThemeTokens()
  const itemModifiers = toolbarGroupItemModifiers()
  const isDark = scheme === 'dark'
  const width = overlayGroupWidth(items.length)

  return (
    <View style={[styles.shell, {width}]}>
      <View
        style={[
          styles.clip,
          {
            backgroundColor: isDark ? 'rgba(36,40,44,0.94)' : '#F7F7F8',
            borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)',
            width,
          },
        ]}>
        <View style={[styles.row, {width}]}>
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
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  clip: {
    borderRadius: OVERLAY_GROUP_HIT / 2,
    borderWidth: 1,
    flexGrow: 0,
    flexShrink: 0,
    height: OVERLAY_GROUP_HIT,
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
  shell: {
    borderRadius: OVERLAY_GROUP_HIT / 2,
    elevation: 3,
    flexGrow: 0,
    flexShrink: 0,
    height: OVERLAY_GROUP_HIT,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.16,
    shadowRadius: 6,
  },
})
