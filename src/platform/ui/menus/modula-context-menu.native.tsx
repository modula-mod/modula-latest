import {ContextMenu, Host} from '@expo/ui/swift-ui'
import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {renderContextMenuItems} from '@/platform/ui/menus/native-menu-items'
import type {ModulaActionItem, ModulaMenuFit} from '@/platform/ui/menus/types'

export type ModulaContextMenuProps = {
  children: ReactNode
  title?: string
  actions: ModulaActionItem[]
  onAction: (actionId: string) => void
  accessibilityLabel?: string
  disabled?: boolean
  /**
   * `fill` (default) stretches the Host across a list row — required so
   * Activity / feed cells are not crush-sized. `content` uses matchContents
   * for compact triggers such as avatars.
   */
  fit?: ModulaMenuFit
}

/**
 * iOS long-press ContextMenu via Expo UI SwiftUI.
 * Features import this wrapper only — never `@expo/ui/swift-ui`.
 *
 * Important: do NOT use Host `matchContents` around full-width flex rows.
 * SwiftUI intrinsic sizing crushed Activity / list rows into a narrow column
 * (see docs/validation/phase4-5-ui-bugs/01-activity-broken.png).
 */
export function ModulaContextMenu({
  children,
  actions,
  onAction,
  accessibilityLabel,
  disabled,
  fit = 'fill',
}: ModulaContextMenuProps) {
  if (disabled) {
    return <View style={fit === 'fill' ? styles.fill : undefined}>{children}</View>
  }

  const contentFit = fit === 'content'

  return (
    <Host matchContents={contentFit} style={contentFit ? undefined : styles.fill}>
      <ContextMenu>
        <ContextMenu.Items>{renderContextMenuItems(actions, onAction)}</ContextMenu.Items>
        <ContextMenu.Trigger>
          <View
            style={contentFit ? undefined : styles.fill}
            accessibilityLabel={accessibilityLabel}>
            {children}
          </View>
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  )
}

const styles = StyleSheet.create({
  fill: {
    alignSelf: 'stretch',
    width: '100%',
  },
})
