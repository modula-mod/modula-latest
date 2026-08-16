import {StyleSheet, View} from 'react-native'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
import {OVERLAY_GLASS_HIT} from '@/platform/ui/menus/toolbar-chrome'
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

/** Web / Android: one capsule row so share + overflow stay a single control. */
export function ChromeGlassControlGroup({items}: {items: ChromeGlassGroupItem[]}) {
  const {colours} = useThemeTokens()

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
        },
      ]}>
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
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: OVERLAY_GLASS_HIT,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
})
