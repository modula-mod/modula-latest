import {Button, Host, Menu} from '@expo/ui/swift-ui'
import {
  buttonStyle,
  controlSize,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers'

import type {ModulaActionItem} from '@/platform/ui/menus/types'

type ChromeOverflowMenuProps = {
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  accessibilityLabel?: string
}

/**
 * Native SwiftUI Menu with a plain ellipsis trigger — no glass / filled disc.
 */
export function ChromeOverflowMenu({
  actions,
  onAction,
  accessibilityLabel = 'More actions',
}: ChromeOverflowMenuProps) {
  const visibleActions = actions.filter(action => !action.disabled || action.disabledReason)

  return (
    <Host matchContents>
      <Menu
        label={accessibilityLabel}
        systemImage="ellipsis"
        modifiers={[
          buttonStyle('plain'),
          labelStyle('iconOnly'),
          controlSize('regular'),
        ]}>
        {visibleActions.map(action => (
          <Button
            key={action.id}
            label={
              action.disabled && action.disabledReason
                ? `${action.label} unavailable — ${action.disabledReason}`
                : action.label
            }
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
