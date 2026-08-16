import {StyleSheet, View} from 'react-native'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
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

/** Web / Android: Profile-sized capsule — 44pt hits, 22pt gap. */
export function ChromeGlassControlGroup({items}: {items: ChromeGlassGroupItem[]}) {
  return (
    <LiquidGlassChrome
      interactive
      fallback="clear"
      contentLayout="flow"
      style={styles.capsule}>
      <View style={styles.row}>
        {items.map(item =>
          item.kind === 'button' ? (
            <ModulaIconButton
              key={item.accessibilityLabel}
              icon={item.icon}
              chrome="plain"
              accessibilityLabel={item.accessibilityLabel}
              onPress={item.onPress}
            />
          ) : (
            <ChromeOverflowMenu
              key={item.accessibilityLabel}
              chrome="plain"
              accessibilityLabel={item.accessibilityLabel}
              title={item.title}
              actions={item.actions}
              onAction={item.onAction}
            />
          ),
        )}
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
