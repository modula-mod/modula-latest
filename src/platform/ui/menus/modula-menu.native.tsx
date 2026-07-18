import {Button, Host, Menu, RNHostView} from '@expo/ui/swift-ui'
import type {ReactNode} from 'react'
import {View} from 'react-native'

import type {ModulaActionItem} from '@/platform/ui/menus/types'

type ModulaMenuProps = {
  trigger: ReactNode
  title?: string
  actions: ModulaActionItem[]
  onAction: (actionId: string) => void
  accessibilityLabel?: string
  disabled?: boolean
}

/**
 * Tap Menu via Expo UI SwiftUI Menu on iOS.
 * RN trigger is hosted as the Menu label through RNHostView.
 */
export function ModulaMenu({
  trigger,
  actions,
  onAction,
  accessibilityLabel = 'Open menu',
  disabled,
}: ModulaMenuProps) {
  if (disabled) {
    return <View accessibilityLabel={accessibilityLabel}>{trigger}</View>
  }

  const visibleActions = actions.filter(action => !action.disabled || action.disabledReason)

  return (
    <Host matchContents>
      <Menu
        label={
          <RNHostView matchContents>
            <View accessibilityLabel={accessibilityLabel} accessibilityRole="button">
              {trigger}
            </View>
          </RNHostView>
        }>
        {visibleActions.map(action => (
          <Button
            key={action.id}
            label={action.accessibilityLabel ?? getActionLabel(action)}
            role={!action.disabled && action.style === 'destructive' ? 'destructive' : undefined}
            onPress={() => {
              if (!action.disabled) onAction(action.id)
            }}
          />
        ))}
      </Menu>
    </Host>
  )
}

function getActionLabel(action: ModulaActionItem): string {
  if (!action.disabled || !action.disabledReason) return action.label
  return `${action.label} unavailable — ${action.disabledReason}`
}
