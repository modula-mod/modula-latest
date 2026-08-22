import {StyleSheet, View} from 'react-native'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {ChromeIconMenu} from '@/platform/ui/menus/chrome-icon-menu'
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
  icon?: AppIconName
  accessibilityLabel: string
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
}

export type ChromeGlassGroupItem = ChromeGlassGroupButton | ChromeGlassGroupMenu

if (OVERLAY_GROUP_HIT !== TOOLBAR_HIT || HEADER_ICON_PAIR_GAP !== OVERLAY_GROUP_GAP) {
  throw new Error('Overlay group must match Home header sizes (44pt hit, 22pt gap)')
}
if (overlayGroupWidth(2) !== OVERLAY_GROUP_MIN_WIDTH) {
  throw new Error('overlayGroupWidth(2) must equal OVERLAY_GROUP_MIN_WIDTH')
}

/**
 * Native Home-parity control group. Same RN layout as the cross-platform
 * file: 44×44 plain slots, 22pt gap, one LiquidGlassChrome capsule.
 * Avoids nested SwiftUI Host glass discs (those made Profile look wrong).
 */
export function ChromeGlassControlGroup({items}: {items: ChromeGlassGroupItem[]}) {
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
            {item.kind === 'button' ? (
              <ModulaIconButton
                icon={item.icon}
                chrome="plain"
                accessibilityLabel={item.accessibilityLabel}
                onPress={item.onPress}
              />
            ) : (
              <ChromeIconMenu
                icon={item.icon ?? 'more'}
                chrome="plain"
                accessibilityLabel={item.accessibilityLabel}
                title={item.title}
                actions={item.actions}
                onAction={item.onAction}
              />
            )}
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
    flexGrow: 0,
    flexShrink: 0,
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
