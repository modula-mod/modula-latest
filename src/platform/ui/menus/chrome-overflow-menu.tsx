import {StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import type {ToolbarChrome} from '@/platform/ui/menus/toolbar-chrome'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ChromeOverflowMenuProps = {
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  accessibilityLabel?: string
  /** Accepted for API parity with native; fallback trigger is always a plain glyph. */
  chrome?: ToolbarChrome
}

/**
 * Native Menu (SwiftUI) with plain ellipsis trigger — not ActionSheet sheets.
 */
export function ChromeOverflowMenu({
  title,
  actions,
  onAction,
  accessibilityLabel = 'More actions',
}: ChromeOverflowMenuProps) {
  const {colours} = useThemeTokens()

  return (
    <ModulaMenu
      title={title}
      actions={actions}
      onAction={onAction}
      accessibilityLabel={accessibilityLabel}
      trigger={
        <View pointerEvents="none" style={styles.target}>
          <AppIcon name="more" colour={colours.text} />
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  target: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
  },
})
