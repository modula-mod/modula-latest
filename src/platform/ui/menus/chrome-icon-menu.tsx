import {StyleSheet, View} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import type {ToolbarChrome} from '@/platform/ui/menus/toolbar-chrome'
import {TOOLBAR_HIT} from '@/platform/ui/menus/toolbar-chrome'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {controls} from '@/theme/foundations/controls'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ChromeIconMenuProps = {
  systemImage?: string
  /** Fallback Ionicon when SwiftUI Menu is unavailable. */
  icon?: AppIconName
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  accessibilityLabel: string
  /** Accepted for API parity with native; fallback trigger is always a plain glyph. */
  chrome?: ToolbarChrome
}

/**
 * Web / Android fallback — AppIcon trigger only (no nested glass Host).
 */
export function ChromeIconMenu({
  icon = 'more',
  title,
  actions,
  onAction,
  accessibilityLabel,
}: ChromeIconMenuProps) {
  const {colours} = useThemeTokens()
  return (
    <ModulaMenu
      accessibilityLabel={accessibilityLabel}
      title={title}
      actions={actions}
      onAction={onAction}
      trigger={
        <View pointerEvents="none" style={styles.target}>
          <AppIcon name={icon} colour={colours.text} size={controls.iconSize.toolbar} />
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  target: {
    alignItems: 'center',
    height: TOOLBAR_HIT,
    justifyContent: 'center',
    minWidth: TOOLBAR_HIT,
  },
})
