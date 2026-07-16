import {Button, ContextMenu, Host} from '@expo/ui/swift-ui'
import type {ReactNode} from 'react'
import {View} from 'react-native'

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
 */
export function ModulaContextMenu({
  children,
  actions,
  onAction,
  accessibilityLabel,
  disabled,
}: ModulaContextMenuProps) {
  if (disabled) {
    return <View accessibilityLabel={accessibilityLabel}>{children}</View>
  }

  const actionable = actions.filter(action => !action.disabled)

  return (
    <Host matchContents style={{alignSelf: 'stretch'}}>
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
          <View accessibilityLabel={accessibilityLabel}>{children}</View>
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  )
}
