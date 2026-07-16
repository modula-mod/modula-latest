import {Button, ContextMenu, Host} from '@expo/ui/swift-ui'
import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import type {ModulaActionItem} from '@/platform/ui/menus/types'

type ModulaContextMenuProps = {
  children: ReactNode
  title?: string
  actions: ModulaActionItem[]
  onAction: (actionId: string) => void
  accessibilityLabel?: string
  disabled?: boolean
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
}: ModulaContextMenuProps) {
  if (disabled) {
    return <View style={styles.fill}>{children}</View>
  }

  const actionable = actions.filter(action => !action.disabled)

  return (
    <Host style={styles.fill}>
      <ContextMenu>
        <ContextMenu.Items>
          {actionable.map(action => (
            <Button
              key={action.id}
              label={action.accessibilityLabel ?? action.label}
              role={action.style === 'destructive' ? 'destructive' : undefined}
              onPress={() => onAction(action.id)}
            />
          ))}
        </ContextMenu.Items>
        <ContextMenu.Trigger>
          <View style={styles.fill} accessibilityLabel={accessibilityLabel}>
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
